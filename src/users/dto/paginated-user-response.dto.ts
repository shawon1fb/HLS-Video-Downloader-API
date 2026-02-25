import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';

export class PaginatedUserResponseDto {
  @ApiProperty({
    description: 'Array of users for the current page',
    type: [UserResponseDto],
  })
  data: UserResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta: PaginationMetaDto;

  constructor(
    data: UserResponseDto[],
    total: number,
    page: number,
    limit: number,
  ) {
    this.data = data;
    const totalPages = Math.ceil(total / limit);
    this.meta = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
