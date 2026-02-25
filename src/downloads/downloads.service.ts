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
import { eq, lt } from 'drizzle-orm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { downloads, DownloadStatus, DownloadFormat } from '../database/schema/downloads';
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
    const { url } = createDownloadDto;
    
    // SSRF Check (Basic implementation)
    if (this.isPrivateIp(url)) {
      throw new BadRequestException('Invalid URL: Private IP addresses are not allowed');
    }

    const format = url.endsWith('.m3u8') ? DownloadFormat.HLS : DownloadFormat.MP4;
    
    // Save to DB
    const [download] = await this.db
      .insert(downloads)
      .values({
        url,
        format,
        status: DownloadStatus.PENDING,
      })
      .returning();

    // Add to Queue
    await this.downloadQueue.add('process-download', {
      downloadId: download.id,
      url: download.url,
      format: download.format,
    });

    return download;
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
          this.logger.error(`Failed to delete file ${download.filePath}: ${error.message}`);
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
