import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { HttpService } from '@nestjs/axios';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import { firstValueFrom } from 'rxjs';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import {
  downloads,
  DownloadStatus,
  DownloadFormat,
} from '../database/schema/downloads';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

@Processor('downloads', { concurrency: 5 })
export class DownloadProcessor extends WorkerHost {
  private readonly logger = new Logger(DownloadProcessor.name);
  private readonly DOWNLOAD_DIR = path.resolve(__dirname, '../../downloads');

  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly httpService: HttpService,
  ) {
    super();
    if (!fs.existsSync(this.DOWNLOAD_DIR)) {
      fs.mkdirSync(this.DOWNLOAD_DIR, { recursive: true });
    }
  }

  async process(
    job: Job<{
      downloadId: string;
      url: string;
      format: string;
      preferredName?: string;
      resumeFrom?: number;
      filePath?: string;
    }>,
  ) {
    const { downloadId, url, format, preferredName, resumeFrom, filePath: existingFilePath } = job.data;
    const isResuming = resumeFrom && resumeFrom > 0 && existingFilePath;

    this.logger.log(
      `Processing download ${downloadId} for URL: ${url}${isResuming ? ` (resuming from ${resumeFrom}%)` : ''}`,
    );

    try {
      // Update status to processing
      await this.db
        .update(downloads)
        .set({ status: DownloadStatus.PROCESSING })
        .where(eq(downloads.id, downloadId));

      let filePath: string;

      // If resuming, use the existing file path
      if (isResuming && existingFilePath && fs.existsSync(existingFilePath)) {
        filePath = existingFilePath;
        this.logger.log(`Resuming download ${downloadId} from existing file: ${filePath}`);
      } else {
        // Generate new file path for fresh downloads
        const fileExtension = 'mp4';
        let fileName = preferredName
          ? `${preferredName}.${fileExtension}`
          : `${uuidv4()}.${fileExtension}`;

        // Ensure filename is safe and unique if user provided one
        if (preferredName) {
          // Simple sanitization
          fileName = fileName.replace(/[^a-z0-9.]/gi, '_');
          // Check if file exists, if so append uuid
          if (fs.existsSync(path.join(this.DOWNLOAD_DIR, fileName))) {
            fileName = `${preferredName}_${uuidv4().substring(0, 8)}.${fileExtension}`;
          }
        }

        filePath = path.join(this.DOWNLOAD_DIR, fileName);
      }

      if (format === DownloadFormat.MP4) {
        await this.downloadMp4(url, filePath, downloadId, isResuming ? resumeFrom : 0);
      } else if (format === DownloadFormat.HLS) {
        await this.downloadHls(url, filePath, downloadId, isResuming ? resumeFrom : 0);
      }

      // Bail out if the download was paused or cancelled while processing
      const [current] = await this.db
        .select({ status: downloads.status })
        .from(downloads)
        .where(eq(downloads.id, downloadId));

      if (current?.status === DownloadStatus.PAUSED) {
        this.logger.log(
          `Download ${downloadId} was paused during processing — keeping partial file for resume`,
        );
        return;
      }

      if (current?.status === DownloadStatus.CANCELLED) {
        this.logger.log(
          `Download ${downloadId} was cancelled during processing — skipping completion`,
        );
        // Clean up the file that was written
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return;
      }

      // Update status to completed
      await this.db
        .update(downloads)
        .set({
          status: DownloadStatus.COMPLETED,
          progress: 100,
          filePath,
          fileName: path.basename(filePath),
        })
        .where(eq(downloads.id, downloadId));

      this.logger.log(`Download ${downloadId} completed successfully.`);
    } catch (error) {
      this.logger.error(`Download ${downloadId} failed: ${error.message}`);
      await this.db
        .update(downloads)
        .set({
          status: DownloadStatus.FAILED,
          error: error.message,
        })
        .where(eq(downloads.id, downloadId));
      throw error;
    }
  }

  private async downloadMp4(
    url: string,
    filePath: string,
    downloadId: string,
    resumeFrom: number = 0,
  ): Promise<void> {
    // For MP4 resume, we need to check if file exists and get its size
    let startByte = 0;
    if (resumeFrom > 0 && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      startByte = stats.size;
      this.logger.log(`Resuming MP4 download ${downloadId} from byte ${startByte}`);
    }

    const headers: Record<string, string> = {};
    if (startByte > 0) {
      headers['Range'] = `bytes=${startByte}-`;
    }

    const writer = fs.createWriteStream(filePath, { flags: startByte > 0 ? 'a' : 'w' });
    const response = await firstValueFrom(
      this.httpService.get(url, { responseType: 'stream', headers }),
    );

    const totalLength = response.headers['content-length'];
    let downloadedLength = startByte;

    response.data.on('data', (chunk) => {
      downloadedLength += chunk.length;
      if (totalLength) {
        const progress = Math.round((downloadedLength / (parseInt(totalLength) + startByte)) * 100);
        this.updateProgress(downloadId, progress);
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private async downloadHls(
    url: string,
    filePath: string,
    downloadId: string,
    resumeFrom: number = 0,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // For HLS, resume is tricky - we'll restart from beginning but skip progress updates until resume point
      // A true resume would require parsing the manifest and downloading only remaining segments
      let hasResumed = resumeFrom === 0;

      ffmpeg(url)
        .on('progress', (progress) => {
          if (progress.percent) {
            // If we're resuming, we need to account for the already downloaded portion
            const actualProgress = hasResumed
              ? Math.round(progress.percent)
              : Math.round((progress.percent * (100 - resumeFrom) / 100) + resumeFrom);
            this.updateProgress(downloadId, actualProgress);
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        })
        .save(filePath);
    });
  }

  private async updateProgress(downloadId: string, progress: number) {
    try {
      await this.db
        .update(downloads)
        .set({ progress })
        .where(eq(downloads.id, downloadId));
    } catch (error) {
      // Ignore progress update errors to avoid crashing the download
      this.logger.warn(
        `Failed to update progress for ${downloadId}: ${error.message}`,
      );
    }
  }
}
