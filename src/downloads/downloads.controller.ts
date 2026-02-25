import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { CreateDownloadDto } from './dto/create-download.dto';
import { FastifyReply } from 'fastify';
import * as fs from 'fs';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
// import { ThrottlerGuard } from '@nestjs/throttler'; // Uncomment if ThrottlerModule is configured

@ApiTags('Downloads')
@Controller()
// @UseGuards(ThrottlerGuard)
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Post('downloads')
  @ApiOperation({ summary: 'Start a new video download' })
  @ApiBody({ type: CreateDownloadDto })
  @ApiResponse({ status: 201, description: 'Download started successfully.' })
  create(@Body() createDownloadDto: CreateDownloadDto) {
    return this.downloadsService.create(createDownloadDto);
  }

  @Get('downloads/:id')
  @ApiOperation({ summary: 'Get download status' })
  @ApiResponse({ status: 200, description: 'Return download status.' })
  findOne(@Param('id') id: string) {
    return this.downloadsService.findOne(id);
  }

  @Get('files/:filename')
  @ApiOperation({ summary: 'Serve downloaded file' })
  async serveFile(@Param('filename') filename: string, @Res() res: FastifyReply) {
    const filePath = await this.downloadsService.getFilePath(filename);
    const stream = fs.createReadStream(filePath);
    res.type('video/mp4').send(stream);
  }
}
