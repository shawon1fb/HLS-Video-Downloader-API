import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from './create-user.dto';
import { UserResponseDto } from './user-response.dto';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum UserSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  EMAIL = 'email',
  USERNAME = 'username',
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  LAST_LOGIN_AT = 'lastLoginAt',
}

export class QueryUserDto {
  @ApiPropertyOptional({ 
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 10;

  @ApiPropertyOptional({ 
    description: 'Search term for filtering users by name, email, or username',
    example: 'john'
  })
  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by user role',
    enum: UserRole,
    example: UserRole.USER
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be one of: user, admin, moderator' })
  role?: UserRole;

  @ApiPropertyOptional({ 
    description: 'Filter by active status',
    example: true
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  @ApiPropertyOptional({ 
    description: 'Filter by email verification status',
    example: true
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'isEmailVerified must be a boolean' })
  isEmailVerified?: boolean;

  @ApiPropertyOptional({ 
    description: 'Filter users created from this date',
    example: '2023-01-01T00:00:00Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateFrom must be a valid date string' })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  dateFrom?: Date;

  @ApiPropertyOptional({ 
    description: 'Filter users created until this date',
    example: '2023-12-31T23:59:59Z'
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateTo must be a valid date string' })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  dateTo?: Date;

  @ApiPropertyOptional({ 
    description: 'Field to sort by',
    enum: UserSortField,
    example: UserSortField.CREATED_AT,
    default: UserSortField.CREATED_AT
  })
  @IsOptional()
  @IsEnum(UserSortField, {
    message:
      'sortBy must be one of: createdAt, updatedAt, email, username, firstName, lastName, lastLoginAt',
  })
  sortBy?: UserSortField = UserSortField.CREATED_AT;

  @ApiPropertyOptional({ 
    description: 'Sort order',
    enum: SortOrder,
    example: SortOrder.DESC,
    default: SortOrder.DESC
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: 'sortOrder must be either asc or desc' })
  sortOrder?: SortOrder = SortOrder.DESC;
}

export class PaginatedUserResponseDto {
  data: UserResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  constructor(
    data: UserResponseDto[],
    total: number,
    page: number,
    limit: number,
  ) {
    this.data = data;
    const totalPages = Math.ceil(total / limit);
    this.meta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
