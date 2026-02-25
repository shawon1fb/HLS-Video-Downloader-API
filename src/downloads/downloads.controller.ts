import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  Sse,
  Query,
} from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { CreateDownloadDto } from './dto/create-download.dto';
import { DeleteDownloadResponseDto } from './dto/delete-download-response.dto';
import { DownloadResponseDto, serializeDownload } from './dto/download-response.dto';
import { FastifyReply } from 'fastify';
import * as fs from 'fs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { interval, Observable, switchMap } from 'rxjs';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('Downloads')
@Controller()
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  @Post('downloads')
  @ResponseMessage('Download started successfully')
  @ApiOperation({ summary: 'Start a new video download' })
  @ApiBody({ type: CreateDownloadDto })
  @ApiResponse({ status: 201, type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid URL or parameters' })
  async create(@Body() dto: CreateDownloadDto): Promise<DownloadResponseDto> {
    const download = await this.downloadsService.create(dto);
    return serializeDownload(download);
  }

  // ── Queue ──────────────────────────────────────────────────────────────────

  @Post('downloads/clear-queue')
  @ResponseMessage('Queue cleared successfully')
  @ApiOperation({ summary: 'Clear all jobs from the download queue' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  clearQueue() {
    return this.downloadsService.clearQueue();
  }

  // ── Lists ──────────────────────────────────────────────────────────────────

  @Get('downloads/active')
  @ResponseMessage('Active downloads retrieved successfully')
  @ApiOperation({ summary: 'Get all active (pending/processing/paused) downloads' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getActive(): Promise<DownloadResponseDto[]> {
    const rows = await this.downloadsService.getActiveDownloads();
    return rows.map(serializeDownload);
  }

  @Get('downloads/paused')
  @ResponseMessage('Paused downloads retrieved successfully')
  @ApiOperation({ summary: 'Get all paused downloads' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getPausedDownloads(): Promise<DownloadResponseDto[]> {
    const rows = await this.downloadsService.getPausedDownloads();
    return rows.map(serializeDownload);
  }

  @Get('downloads/history')
  @ResponseMessage('Download history retrieved successfully')
  @ApiOperation({ summary: 'Get completed/failed/cancelled downloads' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  async getHistory(): Promise<DownloadResponseDto[]> {
    const rows = await this.downloadsService.getDownloadHistory();
    return rows.map(serializeDownload);
  }

  // ── Single download ────────────────────────────────────────────────────────

  @Get('downloads/:id')
  @ResponseMessage('Download retrieved successfully')
  @ApiOperation({ summary: 'Get a single download by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 404, description: 'Download not found' })
  async findOne(@Param('id') id: string): Promise<DownloadResponseDto> {
    const download = await this.downloadsService.findOne(id);
    return serializeDownload(download);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  @Post('downloads/:id/pause')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download paused successfully')
  @ApiOperation({ summary: 'Pause a pending or processing download' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404, description: 'Download not found' })
  async pauseDownload(@Param('id') id: string): Promise<DownloadResponseDto> {
    const download = await this.downloadsService.pauseDownload(id);
    return serializeDownload(download);
  }

  @Post('downloads/:id/resume')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download resumed successfully')
  @ApiOperation({ summary: 'Resume a paused download from its saved progress' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404, description: 'Download not found' })
  async resumeDownload(@Param('id') id: string): Promise<DownloadResponseDto> {
    const download = await this.downloadsService.resumeDownload(id);
    return serializeDownload(download);
  }

  @Post('downloads/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download retrying from the beginning')
  @ApiOperation({ summary: 'Retry a failed, paused, or cancelled download from scratch' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404, description: 'Download not found' })
  async retryDownload(@Param('id') id: string): Promise<DownloadResponseDto> {
    const download = await this.downloadsService.retryDownload(id);
    return serializeDownload(download);
  }

  @Post('downloads/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download cancelled successfully')
  @ApiOperation({ summary: 'Cancel a download permanently' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, type: ApiResponseDto })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404, description: 'Download not found' })
  async cancelDownload(@Param('id') id: string): Promise<DownloadResponseDto> {
    const download = await this.downloadsService.cancelDownload(id);
    return serializeDownload(download);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  @Delete('downloads/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download deleted successfully')
  @ApiOperation({ summary: 'Permanently delete a download record and its file' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, type: DeleteDownloadResponseDto })
  @ApiResponse({ status: 404, description: 'Download not found' })
  deleteDownload(@Param('id') id: string) {
    return this.downloadsService.deleteDownload(id);
  }

  // ── SSE progress stream ────────────────────────────────────────────────────

  @Sse('downloads/progress')
  @ApiOperation({
    summary: 'Live download progress (SSE)',
    description: 'Streams progress updates every second for active downloads.',
  })
  @ApiQuery({
    name: 'downloadIds',
    required: false,
    description: 'Comma-separated download IDs to watch (omit for all active)',
    example: 'id1,id2',
  })
  @ApiResponse({ status: 200, description: 'SSE stream' })
  getLiveProgress(@Query('downloadIds') downloadIds?: string): Observable<MessageEvent> {
    const ids = downloadIds ? downloadIds.split(',').map((id) => id.trim()) : null;

    return interval(1000).pipe(
      switchMap(async () => {
        const rows = await this.downloadsService.getActiveDownloadsWithProgress(ids);
        return {
          data: {
            timestamp: new Date().toISOString(),
            downloads: rows.map(serializeDownload),
          },
        } as MessageEvent;
      }),
    );
  }

  // ── File serve ─────────────────────────────────────────────────────────────

  @Get('files/:filename')
  @ApiOperation({ summary: 'Stream a downloaded video file' })
  async serveFile(
    @Param('filename') filename: string,
    @Res() res: FastifyReply,
  ) {
    const filePath = await this.downloadsService.getFilePath(filename);
    const stream = fs.createReadStream(filePath);
    res.type('video/mp4').send(stream);
  }
}
