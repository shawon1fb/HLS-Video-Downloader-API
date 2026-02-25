import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ 
    description: 'Current page number',
    example: 1,
    minimum: 1
  })
  page: number;

  @ApiProperty({ 
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100
  })
  limit: number;

  @ApiProperty({ 
    description: 'Total number of items',
    example: 150,
    minimum: 0
  })
  total: number;

  @ApiProperty({ 
    description: 'Total number of pages',
    example: 15,
    minimum: 0
  })
  totalPages: number;

  @ApiProperty({ 
    description: 'Whether there is a next page',
    example: true
  })
  hasNext: boolean;

  @ApiProperty({ 
    description: 'Whether there is a previous page',
    example: false
  })
  hasPrev: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ 
    description: 'Array of items for the current page',
    isArray: true
  })
  data: T[];

  @ApiProperty({ 
    description: 'Pagination metadata',
    type: PaginationMetaDto
  })
  meta: PaginationMetaDto;
}