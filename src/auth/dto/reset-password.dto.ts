import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ 
    description: 'Password reset token received via email',
    example: 'abc123def456ghi789',
    minLength: 1
  })
  @IsString({ message: 'Token must be a string' })
  token: string;

  @ApiProperty({ 
    description: 'New password for the user account',
    example: 'NewSecurePassword123!',
    minLength: 8,
    format: 'password'
  })
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword: string;
}
