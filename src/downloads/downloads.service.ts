import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CreateDownloadDto } from './dto/create-download.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, lt, inArray, desc, notInArray, and } from 'drizzle-orm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import {
  downloads,
  DownloadStatus,
  DownloadFormat,
} from '../database/schema/downloads';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);
  private readonly DOWNLOAD_DIR = path.resolve(__dirname, '../../downloads');

  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectQueue('downloads') private downloadQueue: Queue,
  ) {
    if (!fs.existsSync(this.DOWNLOAD_DIR)) {
      fs.mkdirSync(this.DOWNLOAD_DIR, { recursive: true });
    }
  }

  async create(createDownloadDto: CreateDownloadDto) {
    const { url, name } = createDownloadDto;

    // SSRF Check (Basic implementation)
    if (this.isPrivateIp(url)) {
      throw new BadRequestException(
        'Invalid URL: Private IP addresses are not allowed',
      );
    }

    // Check if download already exists
    const [existingDownload] = await this.db
      .select()
      .from(downloads)
      .where(eq(downloads.url, url));

    if (existingDownload) {
      this.logger.log(`Download already exists for URL: ${url}`);
      return {
        id: existingDownload.id,
        status: existingDownload.status,
        message: 'Download already exists',
        url: existingDownload.url,
        createdAt: existingDownload.createdAt.toISOString(),
      };
    }

    const format = url.endsWith('.m3u8')
      ? DownloadFormat.HLS
      : DownloadFormat.MP4;

    // Save to DB
    const [download] = await this.db
      .insert(downloads)
      .values({
        url,
        format,
        status: DownloadStatus.PENDING,
        fileName: name, // Store initial preferred name if provided
      })
      .returning();

    // Add to Queue
    await this.downloadQueue.add('process-download', {
      downloadId: download.id,
      url: download.url,
      format: download.format,
      preferredName: name,
    });

    return {
      id: download.id,
      status: download.status,
      message: 'Download started successfully',
      url: download.url,
      createdAt: download.createdAt.toISOString(),
    };
  }

  async clearQueue() {
    await this.downloadQueue.obliterate({ force: true });
    this.logger.log('Queue cleared successfully');
    return { message: 'Queue cleared successfully' };
  }

  async getActiveDownloads() {
    const activeStatuses = [
      DownloadStatus.PENDING,
      DownloadStatus.PROCESSING,
      DownloadStatus.PAUSED,
    ];
    const activeDownloads = await this.db
      .select()
      .from(downloads)
      .where(inArray(downloads.status, activeStatuses))
      .orderBy(desc(downloads.createdAt));

    return activeDownloads.map(download => ({
      ...download,
      canResume: download.status === DownloadStatus.PAUSED,
      canRetry: [DownloadStatus.FAILED, DownloadStatus.PAUSED, DownloadStatus.CANCELLED].includes(download.status as DownloadStatus),
      canPause: [DownloadStatus.PENDING, DownloadStatus.PROCESSING].includes(download.status as DownloadStatus),
    }));
  }

  async getPausedDownloads() {
    const pausedDownloads = await this.db
      .select()
      .from(downloads)
      .where(eq(downloads.status, DownloadStatus.PAUSED))
      .orderBy(desc(downloads.createdAt));

    return pausedDownloads.map(download => ({
      ...download,
      canResume: true,
      canRetry: true,
    }));
  }

  async getActiveDownloadsWithProgress(downloadIds?: string[] | null) {
    const activeStatuses = [DownloadStatus.PENDING, DownloadStatus.PROCESSING, DownloadStatus.PAUSED];

    const whereConditions: any[] = [inArray(downloads.status, activeStatuses)];

    if (downloadIds && downloadIds.length > 0) {
      whereConditions.push(inArray(downloads.id, downloadIds));
    }

    const activeDownloads = await this.db
      .select({
        id: downloads.id,
        url: downloads.url,
        status: downloads.status,
        progress: downloads.progress,
        format: downloads.format,
        fileName: downloads.fileName,
        filePath: downloads.filePath,
        createdAt: downloads.createdAt,
        updatedAt: downloads.updatedAt,
      })
      .from(downloads)
      .where(and(...whereConditions))
      .orderBy(desc(downloads.createdAt));

    // Add queue position for pending downloads
    const jobs = await this.downloadQueue.getJobs(['waiting', 'delayed', 'active']);

    return activeDownloads.map((download) => {
      const job = jobs.find((j) => j.data.downloadId === download.id);
      return {
        ...download,
        queuePosition: job ? jobs.indexOf(job) + 1 : null,
        estimatedTimeRemaining: this.estimateTimeRemaining(download),
        canResume: download.status === DownloadStatus.PAUSED,
        canRetry: [DownloadStatus.FAILED, DownloadStatus.PAUSED, DownloadStatus.CANCELLED].includes(download.status as DownloadStatus),
        canPause: [DownloadStatus.PENDING, DownloadStatus.PROCESSING].includes(download.status as DownloadStatus),
      };
    });
  }

  private estimateTimeRemaining(download: any): number | null {
    if (download.status !== DownloadStatus.PROCESSING || !download.progress || download.progress <= 0) {
      return null;
    }

    // Simple estimation based on progress and elapsed time
    const elapsed = Date.now() - new Date(download.updatedAt).getTime();
    const progressRate = download.progress / elapsed; // percent per ms
    const remainingPercent = 100 - download.progress;
    const estimatedMs = remainingPercent / progressRate;

    return Math.round(estimatedMs / 1000); // return seconds
  }

  async getDownloadHistory() {
    const historyStatuses = [DownloadStatus.COMPLETED, DownloadStatus.FAILED];
    const history = await this.db
      .select()
      .from(downloads)
      .where(inArray(downloads.status, historyStatuses))
      .orderBy(desc(downloads.createdAt));

    return history;
  }

  async findOne(id: string) {
    const [download] = await this.db
      .select()
      .from(downloads)
      .where(eq(downloads.id, id));

    if (!download) {
      throw new NotFoundException(`Download with ID ${id} not found`);
    }

    return download;
  }

  async pauseDownload(id: string) {
    const download = await this.findOne(id);

    if (download.status === DownloadStatus.COMPLETED) {
      throw new BadRequestException('Cannot pause a completed download');
    }

    if (download.status === DownloadStatus.PAUSED) {
      throw new BadRequestException('Download is already paused');
    }

    if (download.status === DownloadStatus.CANCELLED) {
      throw new BadRequestException('Cannot pause a cancelled download');
    }

    // Try to remove the job from BullMQ queue (covers pending, delayed, active)
    try {
      const jobs = await this.downloadQueue.getJobs([
        'waiting',
        'delayed',
        'active',
        'paused',
      ]);
      const job = jobs.find((j) => j.data.downloadId === id);
      if (job) {
        await job.remove();
        this.logger.log(`Removed job for download ${id} from queue`);
      }
    } catch (err) {
      // Non-fatal: log and continue — DB will be the source of truth
      this.logger.warn(
        `Could not remove job from queue for download ${id}: ${err.message}`,
      );
    }

    // Mark as paused in DB - keeping partial files and progress
    const [paused] = await this.db
      .update(downloads)
      .set({ status: DownloadStatus.PAUSED, updatedAt: new Date() })
      .where(eq(downloads.id, id))
      .returning();

    this.logger.log(`Download ${id} paused at ${paused.progress}% progress`);

    return {
      ...paused,
      message: 'Download paused successfully. You can resume or retry later.',
      canResume: true,
      canRetry: true,
    };
  }

  async resumeDownload(id: string) {
    const download = await this.findOne(id);

    if (download.status !== DownloadStatus.PAUSED) {
      throw new BadRequestException('Only paused downloads can be resumed');
    }

    // Update status back to pending and add to queue
    const [resumed] = await this.db
      .update(downloads)
      .set({ status: DownloadStatus.PENDING, updatedAt: new Date() })
      .where(eq(downloads.id, id))
      .returning();

    // Add back to Queue with resume flag
    await this.downloadQueue.add('process-download', {
      downloadId: download.id,
      url: download.url,
      format: download.format,
      preferredName: download.fileName?.replace(/\.mp4$/, ''),
      resumeFrom: download.progress,
      filePath: download.filePath,
    });

    this.logger.log(`Download ${id} resumed from ${download.progress}%`);

    return {
      ...resumed,
      status: DownloadStatus.PENDING,
      message: 'Download resumed successfully',
    };
  }

  async retryDownload(id: string) {
    const download = await this.findOne(id);

    // Can retry failed, paused, or cancelled downloads
    const retryableStatuses = [
      DownloadStatus.FAILED,
      DownloadStatus.PAUSED,
      DownloadStatus.CANCELLED,
    ];

    if (!retryableStatuses.includes(download.status as DownloadStatus)) {
      throw new BadRequestException(
        `Cannot retry a download with status: ${download.status}. Only failed, paused, or cancelled downloads can be retried.`,
      );
    }

    // Clean up old partial file if exists (fresh start)
    if (download.filePath && fs.existsSync(download.filePath)) {
      try {
        fs.unlinkSync(download.filePath);
        this.logger.log(`Deleted old partial file for retry ${id}`);
      } catch (err) {
        this.logger.warn(
          `Could not delete old file for download ${id}: ${err.message}`,
        );
      }
    }

    // Reset progress and status
    const [retried] = await this.db
      .update(downloads)
      .set({
        status: DownloadStatus.PENDING,
        progress: 0,
        error: null,
        filePath: null,
        updatedAt: new Date(),
      })
      .where(eq(downloads.id, id))
      .returning();

    // Add to Queue
    await this.downloadQueue.add('process-download', {
      downloadId: download.id,
      url: download.url,
      format: download.format,
      preferredName: download.fileName?.replace(/\.mp4$/, ''),
    });

    this.logger.log(`Download ${id} retried (fresh start)`);

    return {
      ...retried,
      status: DownloadStatus.PENDING,
      message: 'Download retried successfully (fresh start)',
    };
  }

  async cancelDownload(id: string) {
    const download = await this.findOne(id);

    if (download.status === DownloadStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed download');
    }

    if (download.status === DownloadStatus.CANCELLED) {
      throw new BadRequestException('Download is already cancelled');
    }

    // Try to remove the job from BullMQ queue (covers pending, delayed, active)
    try {
      const jobs = await this.downloadQueue.getJobs([
        'waiting',
        'delayed',
        'active',
        'paused',
      ]);
      const job = jobs.find((j) => j.data.downloadId === id);
      if (job) {
        await job.remove();
        this.logger.log(`Removed job for download ${id} from queue`);
      }
    } catch (err) {
      // Non-fatal: log and continue — DB will be the source of truth
      this.logger.warn(
        `Could not remove job from queue for download ${id}: ${err.message}`,
      );
    }

    // Mark as cancelled in DB
    const [cancelled] = await this.db
      .update(downloads)
      .set({ status: DownloadStatus.CANCELLED, updatedAt: new Date() })
      .where(eq(downloads.id, id))
      .returning();

    // Clean up any partial file left on disk
    if (download.filePath && fs.existsSync(download.filePath)) {
      try {
        fs.unlinkSync(download.filePath);
        this.logger.log(`Deleted partial file for cancelled download ${id}`);
      } catch (err) {
        this.logger.warn(
          `Could not delete partial file for download ${id}: ${err.message}`,
        );
      }
    }

    return {
      ...cancelled,
      message: 'Download cancelled successfully',
      canRetry: true,
    };
  }

  async deleteDownload(id: string) {
    const download = await this.findOne(id);

    // 1. Remove from queue if exists
    try {
      const jobs = await this.downloadQueue.getJobs([
        'waiting',
        'delayed',
        'active',
        'paused',
        'completed',
        'failed',
      ]);
      const job = jobs.find((j) => j.data.downloadId === id);
      if (job) {
        await job.remove();
        this.logger.log(`Removed job for download ${id} from queue`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not remove job from queue for download ${id}: ${err.message}`,
      );
    }

    // 2. Delete file from disk if exists
    if (download.filePath && fs.existsSync(download.filePath)) {
      try {
        fs.unlinkSync(download.filePath);
        this.logger.log(`Deleted file for download ${id}: ${download.filePath}`);
      } catch (err) {
        this.logger.warn(
          `Could not delete file for download ${id}: ${err.message}`,
        );
      }
    }

    // 3. Delete from database
    await this.db.delete(downloads).where(eq(downloads.id, id));
    this.logger.log(`Deleted download record ${id} from database`);

    return {
      id,
      message: 'Download deleted successfully',
      fileDeleted: !!download.filePath,
    };
  }

  async getFilePath(filename: string): Promise<string> {
    const filePath = path.join(this.DOWNLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }
    return filePath;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldFiles() {
    this.logger.log('Running cleanup of old files...');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const oldDownloads = await this.db
      .select()
      .from(downloads)
      .where(lt(downloads.createdAt, twentyFourHoursAgo));

    for (const download of oldDownloads) {
      if (download.filePath && fs.existsSync(download.filePath)) {
        try {
          fs.unlinkSync(download.filePath);
          this.logger.log(`Deleted file: ${download.filePath}`);
        } catch (error) {
          this.logger.error(
            `Failed to delete file ${download.filePath}: ${error.message}`,
          );
        }
      }

      // Optionally delete record or mark as expired
      // await this.db.delete(downloads).where(eq(downloads.id, download.id));
    }
  }

  private isPrivateIp(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Basic check for localhost and private ranges
      // In production, use a library like 'ipaddr.js' or similar
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.')
      ) {
        return true;
      }
      return false;
    } catch (e) {
      return true; // Invalid URL treated as unsafe
    }
  }
}
