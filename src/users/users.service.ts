import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq, and, or, like, desc, asc, count, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { users } from '../database/schema';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  ChangePasswordDto,
  UserResponseDto,
  PaginatedUserResponseDto,
  UserSortField,
  SortOrder,
} from './dto';
import { plainToClass } from 'class-transformer';
import { PaginationUtil, FilterUtil } from '../common/utils';

@Injectable()
export class UsersService {
  private readonly saltRounds = 12;
  private readonly maxLoginAttempts = 5;
  private readonly lockTime = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  constructor(private readonly databaseService: DatabaseService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const db = this.databaseService.getDatabase();

    // Check if user already exists
    await this.checkUserExists(createUserDto.email, createUserDto.username);

    // Hash password
    const hashedPassword = await this.hashPassword(createUserDto.password);

    try {
      const [newUser] = await db
        .insert(users)
        .values({
          ...createUserDto,
          password: hashedPassword,
        })
        .returning();

      return this.transformToResponseDto(newUser);
    } catch (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        throw new ConflictException(
          'User with this email or username already exists',
        );
      }
      throw error;
    }
  }

  async findAll(queryDto: QueryUserDto): Promise<PaginatedUserResponseDto> {
    const {
      search,
      role,
      isActive,
      isEmailVerified,
      dateFrom,
      dateTo,
      ...paginationOptions
    } = queryDto;

    // Validate and normalize pagination
    const { page, limit, offset, sortBy, sortOrder } =
      PaginationUtil.validateAndNormalizePagination(paginationOptions);

    // Validate date range
    FilterUtil.validateDateRange(dateFrom, dateTo);

    const db = this.databaseService.getDatabase();

    // Build filter conditions
    const filterConditions = FilterUtil.buildUserFilters({
      role,
      isActive,
      isEmailVerified,
      search: FilterUtil.sanitizeSearchTerm(search),
      dateFrom,
      dateTo,
    });

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    // Build sort condition
    const orderByClause = FilterUtil.buildSortCondition(sortBy, sortOrder);

    // Get total count
    const countQuery = db.select({ total: count() }).from(users);

    if (whereClause) {
      countQuery.where(whereClause);
    }

    const [{ total }] = await countQuery;

    // Get paginated results
    const dataQuery = db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        profilePicture: users.profilePicture,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified,
        isTwoFactorEnabled: users.isTwoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .limit(limit)
      .offset(offset);

    if (whereClause) {
      dataQuery.where(whereClause);
    }

    if (orderByClause) {
      dataQuery.orderBy(orderByClause);
    }

    const userList = await dataQuery;

    const userResponseList = userList.map((user) =>
      this.transformToResponseDto({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
      }),
    );

    return new PaginatedUserResponseDto(userResponseList, total, page, limit);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.findUserById(id);
    return this.transformToResponseDto(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const db = this.databaseService.getDatabase();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()));

    return user ? this.transformToResponseDto(user) : null;
  }

  async findByUsername(username: string): Promise<UserResponseDto | null> {
    const db = this.databaseService.getDatabase();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()));

    return user ? this.transformToResponseDto(user) : null;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const db = this.databaseService.getDatabase();

    // Check if user exists
    await this.findUserById(id);

    // Check for email/username conflicts if they're being updated
    if (updateUserDto.email || updateUserDto.username) {
      await this.checkUserExists(
        updateUserDto.email,
        updateUserDto.username,
        id,
      );
    }

    const updateData = {
      ...updateUserDto,
      updatedAt: new Date(),
    };

    try {
      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      return this.transformToResponseDto(updatedUser);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'User with this email or username already exists',
        );
      }
      throw error;
    }
  }

  async changePassword(
    id: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword, confirmPassword } = changePasswordDto;

    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }

    const db = this.databaseService.getDatabase();
    const user = await this.findUserById(id);

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await this.hashPassword(newPassword);

    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return { message: 'Password changed successfully' };
  }

  async remove(id: string): Promise<{ message: string }> {
    const db = this.databaseService.getDatabase();

    // Check if user exists
    await this.findUserById(id);

    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User deleted successfully' };
  }

  async softDelete(id: string): Promise<UserResponseDto> {
    const updateData = { isActive: false, updatedAt: new Date() };
    return this.update(id, updateData);
  }

  async updateLoginAttempts(
    email: string,
    reset: boolean = false,
  ): Promise<void> {
    const db = this.databaseService.getDatabase();

    if (reset) {
      await db
        .update(users)
        .set({
          loginAttempts: 0,
          lockUntil: null,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.email, email));
    } else {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      if (user) {
        const attempts = (user.loginAttempts || 0) + 1;
        const lockUntil =
          attempts >= this.maxLoginAttempts
            ? new Date(Date.now() + this.lockTime)
            : null;

        await db
          .update(users)
          .set({
            loginAttempts: attempts,
            lockUntil,
            updatedAt: new Date(),
          })
          .where(eq(users.email, email));
      }
    }
  }

  async isAccountLocked(email: string): Promise<boolean> {
    const db = this.databaseService.getDatabase();
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user || !user.lockUntil) {
      return false;
    }

    if (user.lockUntil > new Date()) {
      return true;
    }

    // Lock time has expired, reset attempts
    await this.updateLoginAttempts(email, true);
    return false;
  }

  // Private helper methods
  private async findUserById(id: string) {
    const db = this.databaseService.getDatabase();
    const [user] = await db.select().from(users).where(eq(users.id, id));

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async checkUserExists(
    email?: string,
    username?: string,
    excludeId?: string,
  ): Promise<void> {
    if (!email && !username) return;

    const db = this.databaseService.getDatabase();
    const conditions: any[] = [];

    if (email) {
      conditions.push(eq(users.email, email.toLowerCase()));
    }

    if (username) {
      conditions.push(eq(users.username, username.toLowerCase()));
    }

    let whereClause = or(...conditions);

    if (excludeId) {
      whereClause = and(whereClause, sql`${users.id} <> ${excludeId}`);
    }

    const [existingUser] = await db.select().from(users).where(whereClause);

    if (existingUser) {
      if (existingUser.email === email?.toLowerCase()) {
        throw new ConflictException('User with this email already exists');
      }
      if (existingUser.username === username?.toLowerCase()) {
        throw new ConflictException('User with this username already exists');
      }
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  private transformToResponseDto(user: any): UserResponseDto {
    return plainToClass(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
