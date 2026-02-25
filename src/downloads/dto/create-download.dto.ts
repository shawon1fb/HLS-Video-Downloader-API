import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDownloadDto {
  @ApiProperty({
    description: 'The URL of the video to download (mp4 or m3u8)',
    example: 'https://example.com/video.mp4',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl({
    require_protocol: true,
    require_valid_protocol: true,
    protocols: ['http', 'https'],
  })
  url: string;
}
