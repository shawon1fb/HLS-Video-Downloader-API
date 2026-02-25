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
} from '@nestjs/swagger';
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

  @Post('downloads/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Download cancelled successfully')
  @ApiOperation({
    summary: 'Cancel a download',
    description:
      'Cancels a pending or processing download. Removes it from the queue, marks it as cancelled in the database, and cleans up any partial files on disk.',
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
