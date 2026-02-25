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
import { eq, lt, inArray, desc, and } from 'drizzle-orm';
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

const JOB_OPTIONS = {
  attempts: 1,          // No auto-retry — pause/cancel must be user-initiated
  removeOnComplete: true,
  removeOnFail: true,
} as const;

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

    if (this.isPrivateIp(url)) {
      throw new BadRequestException('Invalid URL: Private IP addresses are not allowed');
    }

    const [existing] = await this.db
      .select()
      .from(downloads)
      .where(eq(downloads.url, url));

    if (existing) {
      this.logger.log(`Download already exists for URL: ${url}`);
      return {
        id: existing.id,
        status: existing.status,
        message: 'Download already exists',
        url: existing.url,
        createdAt: existing.createdAt.toISOString(),
      };
    }

    const format = url.endsWith('.m3u8') ? DownloadFormat.HLS : DownloadFormat.MP4;

    const [download] = await this.db
      .insert(downloads)
      .values({ url, format, status: DownloadStatus.PENDING, fileName: name })
      .returning();

    await this.downloadQueue.add(
      'process-download',
      { downloadId: download.id, url: download.url, format: download.format, preferredName: name },
      JOB_OPTIONS,
    );

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

    const rows = await this.db
      .select()
      .from(downloads)
      .where(inArray(downloads.status, activeStatuses))
      .orderBy(desc(downloads.createdAt));

    return rows.map((d) => ({
      ...d,
      canPause: d.status === DownloadStatus.PENDING || d.status === DownloadStatus.PROCESSING,
      canResume: d.status === DownloadStatus.PAUSED,
      canRetry: d.status === DownloadStatus.PAUSED,
      canCancel: d.status !== DownloadStatus.CANCELLED,
    }));
  }

  async getPausedDownloads() {
    const rows = await this.db
      .select()
      .from(downloads)
      .where(eq(downloads.status, DownloadStatus.PAUSED))
      .orderBy(desc(downloads.createdAt));

    return rows.map((d) => ({ ...d, canResume: true, canRetry: true }));
  }

  async getActiveDownloadsWithProgress(downloadIds?: string[] | null) {
    const activeStatuses = [
      DownloadStatus.PENDING,
      DownloadStatus.PROCESSING,
      DownloadStatus.PAUSED,
    ];

    const conditions: any[] = [inArray(downloads.status, activeStatuses)];
    if (downloadIds && downloadIds.length > 0) {
      conditions.push(inArray(downloads.id, downloadIds));
    }

    const rows = await this.db
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
      .where(and(...conditions))
      .orderBy(desc(downloads.createdAt));

    const jobs = await this.downloadQueue.getJobs(['waiting', 'delayed', 'active']);

    return rows.map((d) => {
      const job = jobs.find((j) => j.data.downloadId === d.id);
      return {
        ...d,
        queuePosition: job ? jobs.indexOf(job) + 1 : null,
        estimatedTimeRemaining: this.estimateTimeRemaining(d),
        canPause: d.status === DownloadStatus.PENDING || d.status === DownloadStatus.PROCESSING,
        canResume: d.status === DownloadStatus.PAUSED,
        canRetry: d.status === DownloadStatus.PAUSED,
        canCancel: d.status !== DownloadStatus.CANCELLED,
      };
    });
  }

  private estimateTimeRemaining(download: any): number | null {
    if (
      download.status !== DownloadStatus.PROCESSING ||
      !download.progress ||
      download.progress <= 0
    ) {
      return null;
    }

    const elapsed = Date.now() - new Date(download.updatedAt).getTime();
    const progressRate = download.progress / elapsed;
    const remaining = 100 - download.progress;
    return Math.round(remaining / progressRate / 1000);
  }

  async getDownloadHistory() {
    return this.db
      .select()
      .from(downloads)
      .where(inArray(downloads.status, [DownloadStatus.COMPLETED, DownloadStatus.FAILED, DownloadStatus.CANCELLED]))
      .orderBy(desc(downloads.createdAt));
  }

  async findOne(id: string) {
    const [download] = await this.db.select().from(downloads).where(eq(downloads.id, id));
    if (!download) throw new NotFoundException(`Download with ID ${id} not found`);
    return download;
  }

  /**
   * PAUSE — Sets DB status to PAUSED immediately.
   * If the job is still waiting in queue, remove it.
   * If actively processing, the processor detects PAUSED via DB poll (≤2s) and stops gracefully.
   * Partial file is KEPT on disk for resume.
   */
  async pauseDownload(id: string) {
    const download = await this.findOne(id);

    const pauseable = [DownloadStatus.PENDING, DownloadStatus.PROCESSING];
    if (!pauseable.includes(download.status as DownloadStatus)) {
      throw new BadRequestException(
        `Cannot pause a download with status: ${download.status}`,
      );
    }

    // Set PAUSED in DB first — this is the signal for the processor to stop
    const [paused] = await this.db
      .update(downloads)
      .set({ status: DownloadStatus.PAUSED, updatedAt: new Date() })
      .where(eq(downloads.id, id))
      .returning();

    this.logger.log(`Download ${id} paused at ${paused.progress}%`);

    // Remove from queue only if waiting (active jobs can't be force-removed by BullMQ design)
    await this.tryRemoveFromQueue(id, ['waiting', 'delayed']);

    return {
      ...paused,
      message:
        download.status === DownloadStatus.PROCESSING
          ? 'Download is being paused and will stop within 2 seconds.'
          : 'Download paused successfully.',
      canResume: true,
      canRetry: true,
    };
  }

  /**
   * RESUME — Re-queues a paused download continuing from its saved progress/filePath.
   * Guards against double-resume with status check.
   */
  async resumeDownload(id: string) {
    const download = await this.findOne(id);

    if (download.status !== DownloadStatus.PAUSED) {
      throw new BadRequestException(
        `Cannot resume: download is not paused (current status: ${download.status})`,
      );
    }

    const [resumed] = await this.db
      .update(downloads)
      .set({ status: DownloadStatus.PENDING, updatedAt: new Date() })
      .where(eq(downloads.id, id))
      .returning();

    await this.downloadQueue.add(
      'process-download',
      {
        downloadId: download.id,
        url: download.url,
        format: download.format,
        preferredName: download.fileName?.replace(/\.[^.]+$/, ''),
        resumeFrom: download.progress ?? 0,
        filePath: download.filePath,
      },
      JOB_OPTIONS,
    );

    this.logger.log(`Download ${id} re-queued, resuming from ${download.progress}%`);

    return {
      ...resumed,
      status: DownloadStatus.PENDING,
      message: `Download resumed from ${download.progress}%`,
    };
  }

  /**
   * RETRY — Fresh restart from 0. Works for failed, paused, or cancelled downloads.
   * Deletes partial file and resets all progress.
   */
  async retryDownload(id: string) {
    const download = await this.findOne(id);

    const retryable = [
      DownloadStatus.FAILED,
      DownloadStatus.PAUSED,
      DownloadStatus.CANCELLED,
    ];

    if (!retryable.includes(download.status as DownloadStatus)) {
      throw new BadRequestException(
        `Cannot retry: status is ${download.status}. Only failed, paused, or cancelled downloads can be retried.`,
      );
    }

    // Delete partial file — fresh start
    this.tryDeleteFile(download.filePath, `retry ${id}`);

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

    await this.downloadQueue.add(
      'process-download',
      {
        downloadId: download.id,
        url: download.url,
        format: download.format,
        preferredName: download.fileName?.replace(/\.[^.]+$/, ''),
      },
      JOB_OPTIONS,
    );

    this.logger.log(`Download ${id} retrying from scratch`);

    return {
      ...retried,
      status: DownloadStatus.PENDING,
      message: 'Download retrying from the beginning',
    };
  }

  /**
   * CANCEL — Permanently stops and deletes partial file.
   * For PROCESSING downloads: sets CANCELLED in DB; processor detects this within 2s
   * and handles file cleanup itself. Service does NOT delete the file immediately
   * to avoid race conditions with the active write stream.
   * For all other statuses: file is deleted immediately here.
   */
  async cancelDownload(id: string) {
    const download = await this.findOne(id);

    if (download.status === DownloadStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed download');
    }

    if (download.status === DownloadStatus.CANCELLED) {
      throw new BadRequestException('Download is already cancelled');
    }

    const wasActivelyProcessing = download.status === DownloadStatus.PROCESSING;

    // Set CANCELLED in DB first — processor polls this and stops within 2s
    const [cancelled] = await this.db
      .update(downloads)
      .set({ status: DownloadStatus.CANCELLED, updatedAt: new Date() })
      .where(eq(downloads.id, id))
      .returning();

    // Remove from queue if waiting (active jobs can't be force-removed)
    await this.tryRemoveFromQueue(id, ['waiting', 'delayed', 'paused']);

    if (wasActivelyProcessing) {
      // Don't delete the file here — the processor is still writing to it.
      // The processor will detect CANCELLED status and delete the file itself.
      this.logger.log(`Download ${id} cancel signalled — processor will clean up file within 2s`);
    } else {
      // Not processing — safe to delete immediately
      this.tryDeleteFile(download.filePath, `cancel ${id}`);
    }

    return {
      ...cancelled,
      message: 'Download cancelled successfully',
      canRetry: true,
    };
  }

  async deleteDownload(id: string) {
    const download = await this.findOne(id);

    if (download.status === DownloadStatus.PROCESSING) {
      throw new BadRequestException(
        'Cannot delete an actively processing download. Cancel it first.',
      );
    }

    await this.tryRemoveFromQueue(id, ['waiting', 'delayed', 'active', 'paused', 'completed', 'failed']);
    this.tryDeleteFile(download.filePath, `delete ${id}`);

    await this.db.delete(downloads).where(eq(downloads.id, id));
    this.logger.log(`Deleted download record ${id}`);

    return { id, message: 'Download deleted successfully', fileDeleted: !!download.filePath };
  }

  async getFilePath(filename: string): Promise<string> {
    const filePath = path.join(this.DOWNLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found');
    return filePath;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldFiles() {
    this.logger.log('Running daily cleanup...');
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const old = await this.db
      .select()
      .from(downloads)
      .where(lt(downloads.createdAt, cutoff));

    for (const d of old) {
      this.tryDeleteFile(d.filePath, `cleanup ${d.id}`);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async tryRemoveFromQueue(downloadId: string, states: string[]): Promise<void> {
    try {
      const jobs = await this.downloadQueue.getJobs(states as any);
      const job = jobs.find((j) => j.data.downloadId === downloadId);
      if (job) {
        await job.remove();
        this.logger.log(`Removed queued job for download ${downloadId}`);
      }
    } catch (err) {
      // Non-fatal: active jobs are locked and can't be removed by design
      this.logger.warn(`Could not remove job for ${downloadId} from queue: ${(err as Error).message}`);
    }
  }

  private tryDeleteFile(filePath: string | null | undefined, context: string): void {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted file [${context}]: ${filePath}`);
      }
    } catch (err) {
      this.logger.warn(`Could not delete file [${context}] ${filePath}: ${(err as Error).message}`);
    }
  }

  private isPrivateIp(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.')
      );
    } catch {
      return true;
    }
  }
}
