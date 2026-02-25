import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ 
    description: 'Email address to send password reset link',
    example: 'user@example.com',
    format: 'email'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}
