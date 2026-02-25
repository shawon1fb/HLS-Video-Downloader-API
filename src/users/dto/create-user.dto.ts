import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export class CreateUserDto {
  @ApiProperty({ 
    description: 'User email address',
    example: 'user@example.com',
    format: 'email'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase())
  email: string;

  @ApiProperty({ 
    description: 'Unique username',
    example: 'johndoe',
    minLength: 3,
    maxLength: 100
  })
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(100, { message: 'Username cannot exceed 100 characters' })
  @Transform(({ value }) => value?.toLowerCase())
  username: string;

  @ApiProperty({ 
    description: 'User first name',
    example: 'John',
    minLength: 1,
    maxLength: 100
  })
  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(100, { message: 'First name cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  firstName: string;

  @ApiProperty({ 
    description: 'User last name',
    example: 'Doe',
    minLength: 1,
    maxLength: 100
  })
  @IsString({ message: 'Last name must be a string' })
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(100, { message: 'Last name cannot exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  lastName: string;

  @ApiProperty({ 
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
    maxLength: 255,
    format: 'password'
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(255, { message: 'Password cannot exceed 255 characters' })
  password: string;

  @ApiPropertyOptional({ 
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be one of: user, admin, moderator' })
  role?: UserRole;



  @ApiPropertyOptional({ 
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
    maxLength: 500
  })
  @IsOptional()
  @IsString({ message: 'Profile picture must be a string' })
  @MaxLength(500, {
    message: 'Profile picture URL cannot exceed 500 characters',
  })
  profilePicture?: string;
}
