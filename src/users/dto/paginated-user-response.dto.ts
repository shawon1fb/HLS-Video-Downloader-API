import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';

export class PaginatedUserResponseDto {
  @ApiProperty({ 
    description: 'Array of users for the current page',
    type: [UserResponseDto]
  })
  data: UserResponseDto[];

  @ApiProperty({ 
    description: 'Pagination metadata',
    type: PaginationMetaDto
  })
  meta: PaginationMetaDto;
}