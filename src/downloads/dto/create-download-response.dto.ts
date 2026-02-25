import { ApiProperty } from '@nestjs/swagger';

export class CreateDownloadResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the download job',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Current status of the download',
    example: 'pending',
    enum: ['pending', 'downloading', 'completed', 'failed', 'cancelled'],
  })
  status: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Download started successfully',
  })
  message: string;

  @ApiProperty({
    description: 'The video URL being downloaded',
    example: 'https://example.com/video.mp4',
  })
  url: string;

  @ApiProperty({
    description: 'Timestamp when the download was created',
    example: '2024-01-01T12:00:00.000Z',
  })
  createdAt: string;
}
