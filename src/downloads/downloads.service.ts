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
import { eq, lt, inArray, desc, notInArray } from 'drizzle-orm';
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
    const activeStatuses = [DownloadStatus.PENDING, DownloadStatus.PROCESSING];
    const activeDownloads = await this.db
      .select()
      .from(downloads)
      .where(inArray(downloads.status, activeStatuses))
      .orderBy(desc(downloads.createdAt));

    return activeDownloads;
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
