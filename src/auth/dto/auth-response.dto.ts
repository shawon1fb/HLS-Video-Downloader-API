import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class LoginResponseDto {
  @ApiProperty({ 
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({ 
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  refreshToken: string;

  @ApiProperty({ 
    description: 'User information',
    type: UserResponseDto
  })
  user: UserResponseDto;

  @ApiProperty({ 
    description: 'Token expiration time in seconds',
    example: 3600
  })
  expiresIn: number;
}

export class RefreshResponseDto {
  @ApiProperty({ 
    description: 'New JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({ 
    description: 'New JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  refreshToken: string;

  @ApiProperty({ 
    description: 'Token expiration time in seconds',
    example: 3600
  })
  expiresIn: number;
}

export class RegisterResponseDto {
  @ApiProperty({ 
    description: 'Success message',
    example: 'User registered successfully'
  })
  message: string;

  @ApiProperty({ 
    description: 'User information',
    type: UserResponseDto
  })
  user: UserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({ 
    description: 'Response message',
    example: 'Operation completed successfully'
  })
  message: string;
}