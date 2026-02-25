import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  ChangePasswordDto,
  UserResponseDto,
  PaginatedUserResponseDto,
} from './dto';
import { MessageResponseDto } from '../auth/dto/auth-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public, Roles, CurrentUser } from '../auth/decorators';
import { UserRole } from '../database/schema';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Public() // Allow public registration
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a new user',
    description: 'Creates a new user account. Public registration allowed.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User created successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data or validation errors'
  })
  @ApiResponse({ 
    status: 409, 
    description: 'User already exists with this email or username'
  })
  async create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ 
    summary: 'Get all users',
    description: 'Retrieves a paginated list of users with optional filtering and sorting. Admin or Moderator access required.'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for filtering users' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Filter by user role' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field (default: createdAt)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order (default: desc)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Users retrieved successfully',
    type: PaginatedUserResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin or Moderator access required'
  })
  async findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryDto: QueryUserDto,
  ): Promise<PaginatedUserResponseDto> {
    return this.usersService.findAll(queryDto);
  }

  @Get('profile')
  @ApiOperation({ 
    summary: 'Get current user profile',
    description: 'Retrieves the profile information of the currently authenticated user.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile retrieved successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  async getProfile(
    @CurrentUser() user: UserResponseDto,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ 
    summary: 'Get user by ID',
    description: 'Retrieves a specific user by their unique identifier. Admin or Moderator access required.'
  })
  @ApiParam({ name: 'id', description: 'User UUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User retrieved successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin or Moderator access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch('profile')
  @ApiOperation({ 
    summary: 'Update current user profile',
    description: 'Updates the profile information of the currently authenticated user. Only certain fields can be updated.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile updated successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data or validation errors'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  async updateProfile(
    @CurrentUser() user: UserResponseDto,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Users can only update their own profile (excluding sensitive fields)
    const allowedFields = {
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      profilePicture: updateUserDto.profilePicture,
    };

    // Remove undefined fields
    const filteredUpdate = Object.fromEntries(
      Object.entries(allowedFields).filter(([_, value]) => value !== undefined),
    );

    return this.usersService.update(user.id, filteredUpdate);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Update user by ID',
    description: 'Updates a specific user by their unique identifier. Admin access required.'
  })
  @ApiParam({ name: 'id', description: 'User UUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User updated successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data or validation errors'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Email or username already exists'
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Change user password',
    description: 'Changes the password for the currently authenticated user.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Password changed successfully',
    type: MessageResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data, password requirements not met, or passwords do not match'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid current password or missing authentication'
  })
  async changePassword(
    @CurrentUser() user: UserResponseDto,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Delete('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Delete current user profile',
    description: 'Soft deletes the currently authenticated user account.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Account deactivated successfully',
    type: MessageResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  async deleteProfile(
    @CurrentUser() user: UserResponseDto,
  ): Promise<{ message: string }> {
    // Soft delete for user's own account
    await this.usersService.softDelete(user.id);
    return { message: 'Account deactivated successfully' };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Delete user by ID',
    description: 'Permanently deletes a user by their unique identifier. Admin access required.'
  })
  @ApiParam({ name: 'id', description: 'User UUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User deleted successfully',
    type: MessageResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.usersService.remove(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Activate user',
    description: 'Activates a user account. Admin access required.'
  })
  @ApiParam({ name: 'id', description: 'User UUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User activated successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, { isActive: true });
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Deactivate user',
    description: 'Deactivates a user account. Admin access required.'
  })
  @ApiParam({ name: 'id', description: 'User UUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User deactivated successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, { isActive: false });
  }

  @Patch(':id/verify-email')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Verify user email',
    description: 'Marks a user email as verified. Admin or Moderator access required.'
  })
  @ApiParam({ name: 'id', description: 'User UUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User email verified successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin or Moderator access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  async verifyEmail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, { isEmailVerified: true });
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Update user role',
    description: 'Updates a user role. Admin access required.'
  })
  @ApiParam({ name: 'id', description: 'User UUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User role updated successfully',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid role'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin access required'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'User not found'
  })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('role') role: UserRole,
  ): Promise<UserResponseDto> {
    if (!Object.values(UserRole).includes(role)) {
      throw new Error('Invalid role');
    }
    return this.usersService.update(id, { role });
  }

  @Get('search/by-email')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ 
    summary: 'Find user by email',
    description: 'Searches for a user by email address. Admin or Moderator access required.'
  })
  @ApiQuery({ name: 'email', description: 'Email address to search for', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User found or null if not found',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Email parameter is required'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin or Moderator access required'
  })
  async findByEmail(
    @Query('email') email: string,
  ): Promise<UserResponseDto | null> {
    if (!email) {
      throw new Error('Email parameter is required');
    }
    return this.usersService.findByEmail(email);
  }

  @Get('search/by-username')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ 
    summary: 'Find user by username',
    description: 'Searches for a user by username. Admin or Moderator access required.'
  })
  @ApiQuery({ name: 'username', description: 'Username to search for', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'User found or null if not found',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Username parameter is required'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing authentication'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin or Moderator access required'
  })
  async findByUsername(
    @Query('username') username: string,
  ): Promise<UserResponseDto | null> {
    if (!username) {
      throw new Error('Username parameter is required');
    }
    return this.usersService.findByUsername(username);
  }
}
