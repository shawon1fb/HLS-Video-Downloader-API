import { Exclude, Expose, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from './create-user.dto';

export class UserResponseDto {
  @ApiProperty({ 
    description: 'Unique user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid'
  })
  @Expose()
  id: string;

  @ApiProperty({ 
    description: 'User email address',
    example: 'john.doe@example.com',
    format: 'email'
  })
  @Expose()
  email: string;

  @ApiProperty({ 
    description: 'Unique username',
    example: 'johndoe'
  })
  @Expose()
  username: string;

  @ApiProperty({ 
    description: 'User first name',
    example: 'John'
  })
  @Expose()
  firstName: string;

  @ApiProperty({ 
    description: 'User last name',
    example: 'Doe'
  })
  @Expose()
  lastName: string;

  @ApiProperty({ 
    description: 'User full name (computed from first and last name)',
    example: 'John Doe'
  })
  @Expose()
  @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
  fullName: string;

  @ApiProperty({ 
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER
  })
  @Expose()
  role: UserRole;

  @ApiPropertyOptional({ 
    description: 'URL to user profile picture',
    example: 'https://example.com/avatars/johndoe.jpg',
    nullable: true
  })
  @Expose()
  profilePicture?: string;

  @ApiProperty({ 
    description: 'Whether the user account is active',
    example: true
  })
  @Expose()
  isActive: boolean;

  @ApiProperty({ 
    description: 'Whether the user email is verified',
    example: false
  })
  @Expose()
  isEmailVerified: boolean;

  @ApiProperty({ 
    description: 'Whether two-factor authentication is enabled',
    example: false
  })
  @Expose()
  isTwoFactorEnabled: boolean;

  @ApiPropertyOptional({ 
    description: 'Date when the user last logged in',
    example: '2023-12-01T09:15:00.000Z',
    format: 'date-time',
    nullable: true
  })
  @Expose()
  lastLoginAt?: Date;

  @ApiProperty({ 
    description: 'Date when the user account was created',
    example: '2023-01-15T10:30:00.000Z',
    format: 'date-time'
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({ 
    description: 'Date when the user account was last updated',
    example: '2023-06-20T14:45:00.000Z',
    format: 'date-time'
  })
  @Expose()
  updatedAt: Date;

  // Exclude sensitive fields from response
  @Exclude()
  password: string;

  @Exclude()
  emailVerificationToken?: string;

  @Exclude()
  passwordResetToken?: string;

  @Exclude()
  passwordResetExpires?: Date;

  @Exclude()
  loginAttempts: number;

  @Exclude()
  lockUntil?: Date;

  @Exclude()
  twoFactorSecret?: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
