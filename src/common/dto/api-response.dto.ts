import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from './paginated-response.dto';

export class ApiResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Operation successful' })
  message: string;

  @ApiPropertyOptional()
  data?: T | null;

  @ApiPropertyOptional({ type: () => PaginationMetaDto })
  meta?: PaginationMetaDto;

  static success<T>(
    data: T,
    message: string,
    statusCode = 200,
  ): ApiResponseDto<T> {
    const res = new ApiResponseDto<T>();
    res.success = true;
    res.statusCode = statusCode;
    res.message = message;
    res.data = data;
    return res;
  }

  static paginated<T>(
    data: T[],
    meta: PaginationMetaDto,
    message: string,
    statusCode = 200,
  ): ApiResponseDto<T[]> {
    const res = new ApiResponseDto<T[]>();
    res.success = true;
    res.statusCode = statusCode;
    res.message = message;
    res.data = data;
    res.meta = meta;
    return res;
  }
}
