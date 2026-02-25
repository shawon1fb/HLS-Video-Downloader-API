import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ 
    description: 'Current password for verification',
    example: 'CurrentPassword123!',
    format: 'password'
  })
  @IsString({ message: 'Current password must be a string' })
  currentPassword: string;

  @ApiProperty({ 
    description: 'New password to set',
    example: 'NewSecurePassword123!',
    minLength: 8,
    maxLength: 255,
    format: 'password'
  })
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(255, { message: 'New password cannot exceed 255 characters' })
  newPassword: string;

  @ApiProperty({ 
    description: 'Confirmation of the new password',
    example: 'NewSecurePassword123!',
    format: 'password'
  })
  @IsString({ message: 'Confirm password must be a string' })
  confirmPassword: string;
}
