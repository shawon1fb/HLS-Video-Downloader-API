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

type AbortReason = 'paused' | 'cancelled' | null;

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

  /**
   * Polls DB to check if a download should be aborted.
   * Returns 'paused', 'cancelled', or null (continue).
   * Only one poll is active at a time per download via the isPolling guard.
   */
  private async checkAbortStatus(downloadId: string): Promise<AbortReason> {
    try {
      const [result] = await this.db
        .select({ status: downloads.status })
        .from(downloads)
        .where(eq(downloads.id, downloadId));

      if (result?.status === DownloadStatus.PAUSED) return 'paused';
      if (result?.status === DownloadStatus.CANCELLED) return 'cancelled';
      return null;
    } catch (error) {
      this.logger.warn(`Failed to poll status for ${downloadId}: ${error.message}`);
      return null;
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
    const isResuming = !!(resumeFrom && resumeFrom > 0 && existingFilePath);

    this.logger.log(
      `Processing download ${downloadId}${isResuming ? ` (resuming from ${resumeFrom}%)` : ''}`,
    );

    try {
      // Check immediately — might have been paused/cancelled while waiting in queue
      const abortReason = await this.checkAbortStatus(downloadId);
      if (abortReason) {
        this.logger.log(`Download ${downloadId} is ${abortReason} before processing started — skipping`);
        return;
      }

      // Mark as processing (keep existing progress so resume shows correct %)
      await this.db
        .update(downloads)
        .set({ status: DownloadStatus.PROCESSING })
        .where(eq(downloads.id, downloadId));

      // Determine file path
      let filePath: string;

      if (isResuming && existingFilePath && fs.existsSync(existingFilePath)) {
        filePath = existingFilePath;
        this.logger.log(`Resuming ${downloadId} using existing file: ${filePath}`);
      } else {
        const fileExtension = 'mp4';
        let fileName = preferredName
          ? `${preferredName}.${fileExtension}`
          : `${uuidv4()}.${fileExtension}`;

        if (preferredName) {
          fileName = fileName.replace(/[^a-z0-9.]/gi, '_');
          if (fs.existsSync(path.join(this.DOWNLOAD_DIR, fileName))) {
            fileName = `${preferredName}_${uuidv4().substring(0, 8)}.${fileExtension}`;
          }
        }

        filePath = path.join(this.DOWNLOAD_DIR, fileName);
      }

      // Save filePath to DB immediately — required so pause/resume works correctly
      await this.db
        .update(downloads)
        .set({ filePath, fileName: path.basename(filePath) })
        .where(eq(downloads.id, downloadId));

      // Run the actual download
      const stopReason = format === DownloadFormat.MP4
        ? await this.downloadMp4(url, filePath, downloadId, isResuming ? (resumeFrom ?? 0) : 0)
        : await this.downloadHls(url, filePath, downloadId, isResuming ? (resumeFrom ?? 0) : 0);

      if (stopReason === 'paused') {
        this.logger.log(`Download ${downloadId} paused — partial file kept for resume`);
        return;
      }

      if (stopReason === 'cancelled') {
        this.logger.log(`Download ${downloadId} cancelled — cleaning up file`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        // Clear filePath from DB since file is gone
        await this.db
          .update(downloads)
          .set({ filePath: null, fileName: null })
          .where(eq(downloads.id, downloadId));
        return;
      }

      // Completed successfully
      await this.db
        .update(downloads)
        .set({
          status: DownloadStatus.COMPLETED,
          progress: 100,
          filePath,
          fileName: path.basename(filePath),
        })
        .where(eq(downloads.id, downloadId));

      this.logger.log(`Download ${downloadId} completed successfully`);
    } catch (error) {
      // Final safety check — if paused/cancelled during an unexpected error, don't override status
      const abortReason = await this.checkAbortStatus(downloadId);
      if (abortReason) {
        this.logger.log(`Download ${downloadId} error occurred but status is ${abortReason} — not marking as failed`);
        return;
      }

      this.logger.error(`Download ${downloadId} failed: ${error.message}`);
      await this.db
        .update(downloads)
        .set({ status: DownloadStatus.FAILED, error: error.message })
        .where(eq(downloads.id, downloadId));
      throw error;
    }
  }

  /**
   * Downloads an MP4 file, supporting byte-range resume.
   * Returns 'paused', 'cancelled', or null (completed normally).
   */
  private async downloadMp4(
    url: string,
    filePath: string,
    downloadId: string,
    resumeFrom: number = 0,
  ): Promise<AbortReason> {
    let startByte = 0;
    let totalFileSize = 0;

    if (resumeFrom > 0 && fs.existsSync(filePath)) {
      startByte = fs.statSync(filePath).size;
      this.logger.log(`MP4 resume: ${downloadId} from byte ${startByte} (${resumeFrom}%)`);
    }

    const requestHeaders: Record<string, string> = {};
    if (startByte > 0) {
      requestHeaders['Range'] = `bytes=${startByte}-`;
    }

    const abortController = new AbortController();
    let abortReason: AbortReason = null;
    let isPolling = false; // prevent concurrent DB polls

    const triggerAbort = (reason: AbortReason) => {
      abortReason = reason;
      abortController.abort();
    };

    const writer = fs.createWriteStream(filePath, { flags: startByte > 0 ? 'a' : 'w' });

    let response: any;
    try {
      response = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'stream',
          headers: requestHeaders,
          signal: abortController.signal as any,
        }),
      );
    } catch (error) {
      writer.destroy();
      if (abortReason) return abortReason;
      throw error;
    }

    // Calculate total size correctly for range requests
    const isRangeResponse = response.status === 206;
    const contentLength = parseInt(response.headers['content-length'] || '0');

    if (isRangeResponse && startByte > 0) {
      totalFileSize = startByte + contentLength;
    } else {
      totalFileSize = contentLength;
      if (startByte > 0 && !isRangeResponse) {
        this.logger.warn(`Server rejected Range header for ${downloadId} — restarting from 0`);
        startByte = 0;
      }
    }

    let downloadedBytes = startByte;
    let lastPauseCheckAt = Date.now();
    let lastProgressValue = -1;

    response.data.on('data', async (chunk: Buffer) => {
      if (abortReason) return;

      downloadedBytes += chunk.length;

      // Poll DB every 2 seconds — only one poll at a time
      const now = Date.now();
      if (!isPolling && now - lastPauseCheckAt >= 2000) {
        isPolling = true;
        lastPauseCheckAt = now;

        const reason = await this.checkAbortStatus(downloadId);
        isPolling = false;

        if (reason) {
          triggerAbort(reason);
          return;
        }
      }

      if (totalFileSize > 0) {
        const progress = Math.min(Math.round((downloadedBytes / totalFileSize) * 100), 99);
        if (progress !== lastProgressValue) {
          lastProgressValue = progress;
          this.updateProgress(downloadId, progress);
        }
      }
    });

    response.data.pipe(writer);

    return new Promise<AbortReason>((resolve, reject) => {
      writer.on('finish', () => resolve(abortReason));
      writer.on('error', (err) => {
        if (abortReason) {
          resolve(abortReason);
        } else {
          reject(err);
        }
      });

      abortController.signal.addEventListener('abort', () => {
        // Flush writer then resolve — file is preserved for pause/resume
        writer.end();
      });
    });
  }

  /**
   * Downloads an HLS stream via FFmpeg.
   * NOTE: FFmpeg cannot truly resume HLS. On resume, it restarts from 0
   * but progress is offset by resumeFrom so the displayed % stays correct.
   * Returns 'paused', 'cancelled', or null (completed normally).
   */
  private async downloadHls(
    url: string,
    filePath: string,
    downloadId: string,
    resumeFrom: number = 0,
  ): Promise<AbortReason> {
    // FFmpeg cannot resume HLS — delete partial file and start fresh
    if (resumeFrom > 0 && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        this.logger.log(`HLS resume: deleted partial file for ${downloadId}, restarting with offset progress`);
      } catch (e) {
        this.logger.warn(`Could not delete partial HLS file: ${(e as Error).message}`);
      }
    }

    return new Promise<AbortReason>((resolve, reject) => {
      let abortReason: AbortReason = null;
      let ffmpegCommand: ffmpeg.FfmpegCommand | null = null;
      let lastPauseCheckAt = Date.now();
      let isPolling = false;
      let lastProgressValue = -1;

      const triggerAbort = (reason: AbortReason) => {
        abortReason = reason;
        ffmpegCommand?.kill('SIGTERM');
      };

      ffmpegCommand = ffmpeg(url)
        .on('progress', async (progress) => {
          if (abortReason) return;

          // Poll DB every 2 seconds — one poll at a time
          const now = Date.now();
          if (!isPolling && now - lastPauseCheckAt >= 2000) {
            isPolling = true;
            lastPauseCheckAt = now;

            const reason = await this.checkAbortStatus(downloadId);
            isPolling = false;

            if (reason) {
              triggerAbort(reason);
              return;
            }
          }

          if (progress.percent != null) {
            // Map FFmpeg's 0–100% into the remaining portion after resumeFrom
            // e.g. resumeFrom=30, FFmpeg=50% → actual = 30 + (50 * 0.70) = 65%
            const remaining = 100 - resumeFrom;
            const actual = Math.min(
              Math.round(resumeFrom + (progress.percent / 100) * remaining),
              99,
            );

            if (actual !== lastProgressValue) {
              lastProgressValue = actual;
              this.updateProgress(downloadId, actual);
            }
          }
        })
        .on('end', () => resolve(null))
        .on('error', (err) => {
          // SIGTERM from us — treat as graceful stop
          if (
            abortReason ||
            err.message?.includes('SIGTERM') ||
            err.message?.includes('Exiting normally')
          ) {
            resolve(abortReason ?? 'paused');
          } else {
            reject(err);
          }
        })
        .save(filePath);
    });
  }

  private async updateProgress(downloadId: string, progress: number): Promise<void> {
    try {
      await this.db
        .update(downloads)
        .set({ progress, updatedAt: new Date() })
        .where(eq(downloads.id, downloadId));
    } catch (error) {
      this.logger.warn(`Progress update failed for ${downloadId}: ${(error as Error).message}`);
    }
  }
}
