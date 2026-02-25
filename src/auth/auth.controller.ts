import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService, LoginDto, AuthResponse } from './auth.service';
import { CreateUserDto } from '../users/dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public, CurrentUser } from './decorators';
import { UserResponseDto } from '../users/dto';
import { RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { LoginResponseDto, RefreshResponseDto, RegisterResponseDto, MessageResponseDto } from './dto/auth-response.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Register a new user',
    description: 'Creates a new user account with the provided credentials.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully',
    type: RegisterResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data or validation errors'
  })
  @ApiResponse({ 
    status: 409, 
    description: 'User already exists with this email or username'
  })
  async register(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createUserDto: CreateUserDto,
  ): Promise<AuthResponse> {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticates a user with email and password, returns access and refresh tokens.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    type: LoginResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid credentials or account locked'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data'
  })
  async login(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    loginDto: LoginDto,
  ): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: 'Generates a new access token using a valid refresh token.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token refreshed successfully',
    type: RefreshResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid or expired refresh token'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data'
  })
  async refresh(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'User logout',
    description: 'Invalidates the refresh token and logs out the user.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Logout successful',
    type: MessageResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  async logout(
    @CurrentUser() user: UserResponseDto,
  ): Promise<{ message: string }> {
    return this.authService.logout(user.id);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Request password reset',
    description: 'Sends a password reset email to the specified email address.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Password reset email sent successfully',
    type: MessageResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid email format'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found with this email'
  })
  async forgotPassword(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Reset password',
    description: 'Resets the user password using a valid reset token.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Password reset successfully',
    type: MessageResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data or password requirements not met'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid or expired reset token'
  })
  async resetPassword(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
}
