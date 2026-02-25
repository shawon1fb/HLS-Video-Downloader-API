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
import { interval, map, Observable, switchMap } from 'rxjs';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('Downloads')
@Controller()
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Post('downloads')
  @ResponseMessage('Download started successfully')
  @ApiOperation({
    summary: 'Start a new video download',
    description:
      'Start downloading a video from the provided URL. Supports MP4 and M3U8 formats.',
  })
  @ApiBody({ type: CreateDownloadDto, description: 'Video download request body' })
  @ApiResponse({ status: 201, description: 'Download started successfully.', type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid URL or parameters' })
  create(@Body() createDownloadDto: CreateDownloadDto) {
    return this.downloadsService.create(createDownloadDto);
  }

  @Post('downloads/clear-queue')
  @ResponseMessage('Queue cleared successfully')
  @ApiOperation({ summary: 'Clear all jobs from the download queue' })
  @ApiResponse({ status: 200, description: 'Queue cleared successfully.', type: ApiResponseDto })
  clearQueue() {
    return this.downloadsService.clearQueue();
  }

  @Get('downloads/active')
  @ResponseMessage('Active downloads retrieved successfully')
  @ApiOperation({ summary: 'Get all active downloads with progress' })
  @ApiResponse({ status: 200, description: 'Return list of active downloads.', type: ApiResponseDto })
  getActive() {
    return this.downloadsService.getActiveDownloads();
  }

  @Get('downloads/history')
  @ResponseMessage('Download history retrieved successfully')
  @ApiOperation({ summary: 'Get download history (completed/failed)' })
  @ApiResponse({ status: 200, description: 'Return download history.', type: ApiResponseDto })
  getHistory() {
    return this.downloadsService.getDownloadHistory();
  }

  @Get('downloads/:id')
  @ResponseMessage('Download retrieved successfully')
  @ApiOperation({ summary: 'Get download status' })
  @ApiResponse({ status: 200, description: 'Return download status.', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: 'Download not found' })
  findOne(@Param('id') id: string) {
    return this.downloadsService.findOne(id);
  }

  @Get('downloads/paused')
  @ResponseMessage('Paused downloads retrieved successfully')
  @ApiOperation({
    summary: 'Get all paused downloads',
    description: 'Returns all downloads that are in PAUSED state with resume/retry options available.',
  })
  @ApiResponse({ status: 200, description: 'Return list of paused downloads.', type: ApiResponseDto })
  getPausedDownloads() {
    return this.downloadsService.getPausedDownloads();
  }

  @Post('downloads/:id/pause')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download paused successfully')
  @ApiOperation({
    summary: 'Pause a download',
    description:
      'Pauses a pending or processing download. Removes it from the queue, marks it as paused in the database, but keeps partial files on disk for resuming later. You can resume or retry a paused download.',
  })
  @ApiParam({ name: 'id', description: 'Download ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Download paused successfully.', type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Download is already completed, paused, or cancelled' })
  @ApiResponse({ status: 404, description: 'Download not found' })
  pauseDownload(@Param('id') id: string) {
    return this.downloadsService.pauseDownload(id);
  }

  @Post('downloads/:id/resume')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download resumed successfully')
  @ApiOperation({
    summary: 'Resume a paused download',
    description:
      'Resumes a paused download from where it left off. The download will continue from its previous progress.',
  })
  @ApiParam({ name: 'id', description: 'Download ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Download resumed successfully.', type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Only paused downloads can be resumed' })
  @ApiResponse({ status: 404, description: 'Download not found' })
  resumeDownload(@Param('id') id: string) {
    return this.downloadsService.resumeDownload(id);
  }

  @Post('downloads/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download retried successfully')
  @ApiOperation({
    summary: 'Retry a failed, paused, or cancelled download',
    description:
      'Retries a download from the beginning. This will delete any partial files and start fresh. Works for failed, paused, or cancelled downloads.',
  })
  @ApiParam({ name: 'id', description: 'Download ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Download retried successfully.', type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot retry - download must be failed, paused, or cancelled' })
  @ApiResponse({ status: 404, description: 'Download not found' })
  retryDownload(@Param('id') id: string) {
    return this.downloadsService.retryDownload(id);
  }

  @Post('downloads/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download cancelled successfully')
  @ApiOperation({
    summary: 'Cancel a download permanently',
    description:
      'Cancels a pending or processing download. Removes it from the queue, marks it as cancelled in the database, and deletes any partial files on disk. Use pause if you want to resume later.',
  })
  @ApiParam({ name: 'id', description: 'Download ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Download cancelled successfully.', type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Download is already completed or already cancelled' })
  @ApiResponse({ status: 404, description: 'Download not found' })
  cancelDownload(@Param('id') id: string) {
    return this.downloadsService.cancelDownload(id);
  }

  @Delete('downloads/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download deleted successfully')
  @ApiOperation({
    summary: 'Delete a download permanently',
    description:
      'Permanently deletes a download. Removes from queue, deletes from database, and deletes the file from disk.',
  })
  @ApiParam({ name: 'id', description: 'Download ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Download deleted successfully.', type: DeleteDownloadResponseDto })
  @ApiResponse({ status: 404, description: 'Download not found' })
  deleteDownload(@Param('id') id: string) {
    return this.downloadsService.deleteDownload(id);
  }

  @Sse('downloads/progress')
  @ApiOperation({
    summary: 'Get live download progress (SSE)',
    description:
      'Server-Sent Events endpoint that streams live progress updates for active downloads. Polls every second.',
  })
  @ApiQuery({
    name: 'downloadIds',
    required: false,
    description: 'Comma-separated list of download IDs to watch (optional, default: all active)',
    example: 'id1,id2,id3',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream with download progress updates',
  })
  getLiveProgress(@Query('downloadIds') downloadIds?: string): Observable<MessageEvent> {
    const ids = downloadIds ? downloadIds.split(',').map((id) => id.trim()) : null;

    return interval(1000).pipe(
      switchMap(async () => {
        const activeDownloads = await this.downloadsService.getActiveDownloadsWithProgress(ids);
        return {
          data: {
            timestamp: new Date().toISOString(),
            downloads: activeDownloads,
          },
        } as MessageEvent;
      }),
    );
  }

  @Get('files/:filename')
  @ApiOperation({ summary: 'Serve downloaded file' })
  async serveFile(
    @Param('filename') filename: string,
    @Res() res: FastifyReply,
  ) {
    const filePath = await this.downloadsService.getFilePath(filename);
    const stream = fs.createReadStream(filePath);
    res.type('video/mp4').send(stream);
  }
}
