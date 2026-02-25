import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto, UserResponseDto } from '../users/dto';
import { AppConfig } from '../config/app.config';

import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: 'User email address',
    example: 'user@example.com',
    format: 'email'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ 
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 1,
    format: 'password'
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(1, { message: 'Password is required' })
  password: string;
}

export interface AuthResponse {
  user: UserResponseDto;
  accessToken: string;
  refreshToken?: string;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private appConfig: AppConfig,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    // Create user through users service (handles validation and password hashing)
    const user = await this.usersService.create(createUserDto);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Check if account is locked
    const isLocked = await this.usersService.isAccountLocked(email);
    if (isLocked) {
      throw new UnauthorizedException(
        'Account is temporarily locked due to too many failed login attempts',
      );
    }

    // Find user by email
    const user = await this.findUserForAuthentication(email);
    if (!user) {
      await this.usersService.updateLoginAttempts(email, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      await this.usersService.updateLoginAttempts(email, false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Reset login attempts on successful login
    await this.usersService.updateLoginAttempts(email, true);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Transform user to response DTO (exclude sensitive fields)
    const userResponse = await this.usersService.findOne(user.id);

    return {
      user: userResponse,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async validateUser(payload: JwtPayload): Promise<UserResponseDto | null> {
    try {
      const user = await this.usersService.findOne(payload.sub);

      if (!user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.appConfig.jwtRefreshSecret,
      });

      const user = await this.usersService.findOne(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    // In a more complex implementation, you might want to:
    // 1. Blacklist the current tokens
    // 2. Increment token version in database
    // 3. Clear refresh tokens from database

    // For now, we'll just return a success message
    // The client should remove tokens from storage
    return { message: 'Logged out successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(userId, {
      currentPassword,
      newPassword,
      confirmPassword: newPassword,
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Generate password reset token
    const resetToken = this.generatePasswordResetToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Update user with reset token
    await this.usersService.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    });

    // TODO: Send email with reset link
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Find user by reset token
    const users = await this.usersService.findAll({ limit: 1000 }); // This is not efficient, should be improved
    const user = users.data.find(
      (u) =>
        u.passwordResetToken === token &&
        u.passwordResetExpires &&
        u.passwordResetExpires > new Date(),
    );

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Update password and clear reset token
    await this.usersService.update(user.id, {
      password: await this.hashPassword(newPassword),
      passwordResetToken: null,
      passwordResetExpires: null,
    });

    return { message: 'Password reset successfully' };
  }

  // Private helper methods
  private async findUserForAuthentication(email: string): Promise<any> {
    // We need to get the user with password for authentication
    // This is a workaround since our UserResponseDto excludes password
    const db = this.usersService['databaseService'].getDatabase();
    const { users } = await import('../database/schema');
    const { eq } = await import('drizzle-orm');

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));
    return user;
  }

  private async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.appConfig.bcryptRounds);
  }

  private async generateTokens(
    user: UserResponseDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenVersion: 1, // In production, this should come from database
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.appConfig.jwtSecret,
        expiresIn: this.appConfig.jwtExpiresIn,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.appConfig.jwtRefreshSecret,
        expiresIn: this.appConfig.jwtRefreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generatePasswordResetToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
