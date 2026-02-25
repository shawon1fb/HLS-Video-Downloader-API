import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean, IsString, IsDate } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({ 
    description: 'Whether the user account is active',
    example: true
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean value' })
  isActive?: boolean;

  @ApiPropertyOptional({ 
    description: 'Whether the user email is verified',
    example: false
  })
  @IsOptional()
  @IsBoolean({ message: 'isEmailVerified must be a boolean value' })
  isEmailVerified?: boolean;

  @ApiPropertyOptional({ 
    description: 'Whether two-factor authentication is enabled',
    example: false
  })
  @IsOptional()
  @IsBoolean({ message: 'isTwoFactorEnabled must be a boolean value' })
  isTwoFactorEnabled?: boolean;

  @ApiPropertyOptional({ 
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
    maxLength: 128,
    format: 'password'
  })
  @IsOptional()
  @IsString({ message: 'password must be a string' })
  password?: string;

  @ApiPropertyOptional({ 
    description: 'Password reset token',
    example: 'abc123def456',
    nullable: true
  })
  @IsOptional()
  @IsString({ message: 'passwordResetToken must be a string' })
  passwordResetToken?: string | null;

  @ApiPropertyOptional({ 
    description: 'Password reset token expiration date',
    example: '2024-12-31T23:59:59.000Z',
    nullable: true
  })
  @IsOptional()
  @IsDate({ message: 'passwordResetExpires must be a valid date' })
  passwordResetExpires?: Date | null;
}
