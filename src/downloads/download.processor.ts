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
import { downloads, DownloadStatus, DownloadFormat } from '../database/schema/downloads';
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

  async process(job: Job<{ downloadId: string; url: string; format: string; preferredName?: string }>) {
    const { downloadId, url, format, preferredName } = job.data;
    this.logger.log(`Processing download ${downloadId} for URL: ${url}`);

    try {
      // Update status to processing
      await this.db
        .update(downloads)
        .set({ status: DownloadStatus.PROCESSING, progress: 0 })
        .where(eq(downloads.id, downloadId));

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

      const filePath = path.join(this.DOWNLOAD_DIR, fileName);

      if (format === DownloadFormat.MP4) {
        await this.downloadMp4(url, filePath, downloadId);
      } else if (format === DownloadFormat.HLS) {
        await this.downloadHls(url, filePath, downloadId);
      }

      // Update status to completed
      await this.db
        .update(downloads)
        .set({
          status: DownloadStatus.COMPLETED,
          progress: 100,
          filePath,
          fileName,
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

  private async downloadMp4(url: string, filePath: string, downloadId: string): Promise<void> {
    const writer = fs.createWriteStream(filePath);
    const response = await firstValueFrom(
      this.httpService.get(url, { responseType: 'stream' }),
    );

    const totalLength = response.headers['content-length'];
    let downloadedLength = 0;

    response.data.on('data', (chunk) => {
      downloadedLength += chunk.length;
      if (totalLength) {
        const progress = Math.round((downloadedLength / totalLength) * 100);
        this.updateProgress(downloadId, progress);
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private async downloadHls(url: string, filePath: string, downloadId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(url)
        .on('progress', (progress) => {
          if (progress.percent) {
            this.updateProgress(downloadId, Math.round(progress.percent));
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
      this.logger.warn(`Failed to update progress for ${downloadId}: ${error.message}`);
    }
  }
}
