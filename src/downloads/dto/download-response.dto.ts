import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DownloadStatus } from '../../database/schema/downloads';

export class DownloadResponseDto {
  @ApiProperty({ example: 'ea5a5e24-3c01-4652-8d0c-4e2a982ba626' })
  id: string;

  @ApiProperty({ example: 'https://example.com/video.m3u8' })
  url: string;

  @ApiProperty({ enum: DownloadStatus, example: DownloadStatus.PENDING })
  status: string;

  @ApiProperty({ enum: ['mp4', 'hls'], example: 'hls' })
  format: string;

  @ApiPropertyOptional({ example: '/downloads/video.mp4', nullable: true })
  filePath: string | null;

  @ApiPropertyOptional({ example: 'video.mp4', nullable: true })
  fileName: string | null;

  @ApiProperty({ example: 35 })
  progress: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  error: string | null;

  @ApiProperty({ example: '2026-02-25T16:23:43.823Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-02-25T16:34:52.966Z' })
  updatedAt: string;

  @ApiProperty({ example: false, description: 'Can this download be paused?' })
  canPause: boolean;

  @ApiProperty({ example: true, description: 'Can this download be resumed?' })
  canResume: boolean;

  @ApiProperty({ example: true, description: 'Can this download be retried from scratch?' })
  canRetry: boolean;

  @ApiProperty({ example: true, description: 'Can this download be cancelled?' })
  canCancel: boolean;
}

type RawDownload = {
  id: string;
  url: string;
  status: string;
  format: string;
  filePath?: string | null;
  fileName?: string | null;
  progress?: number | null;
  error?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: any;
};

export function serializeDownload(raw: RawDownload): DownloadResponseDto {
  const status = raw.status as DownloadStatus;

  return {
    id: raw.id,
    url: raw.url,
    status: raw.status,
    format: raw.format,
    filePath: raw.filePath ?? null,
    fileName: raw.fileName ?? null,
    progress: raw.progress ?? 0,
    error: raw.error ?? null,
    createdAt: raw.createdAt instanceof Date
      ? raw.createdAt.toISOString()
      : raw.createdAt,
    updatedAt: raw.updatedAt instanceof Date
      ? raw.updatedAt.toISOString()
      : raw.updatedAt,
    canPause:
      status === DownloadStatus.PENDING ||
      status === DownloadStatus.PROCESSING,
    canResume: status === DownloadStatus.PAUSED,
    canRetry:
      status === DownloadStatus.FAILED ||
      status === DownloadStatus.PAUSED ||
      status === DownloadStatus.CANCELLED,
    canCancel:
      status !== DownloadStatus.COMPLETED &&
      status !== DownloadStatus.CANCELLED,
  };
}
