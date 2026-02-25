import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
} from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { CreateDownloadDto } from './dto/create-download.dto';
import { FastifyReply } from 'fastify';
import * as fs from 'fs';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
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
