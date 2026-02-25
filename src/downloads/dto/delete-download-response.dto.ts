import { ApiProperty } from '@nestjs/swagger';

export class DeleteDownloadResponseDto {
  @ApiProperty({
    description: 'ID of the deleted download',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Download deleted successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Whether the file was deleted from disk',
    example: true,
  })
  fileDeleted: boolean;
}
