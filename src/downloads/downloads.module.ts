import { Module } from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { DownloadsController } from './downloads.controller';
import { DownloadProcessor } from './download.processor';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'downloads',
    }),
    HttpModule,
  ],
  controllers: [DownloadsController],
  providers: [DownloadsService, DownloadProcessor],
  exports: [DownloadsService],
})
export class DownloadsModule {}
