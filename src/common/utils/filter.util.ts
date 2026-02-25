import { sql, SQL } from 'drizzle-orm';
import { UserRole } from '../../database/schema';

export interface FilterOptions {
  role?: UserRole;
  isActive?: boolean;
  isEmailVerified?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class FilterUtil {
  static buildUserFilters(filters: FilterOptions): SQL<unknown>[] {
    const conditions: SQL<unknown>[] = [];

    // Role filter
    if (filters.role && Object.values(UserRole).includes(filters.role)) {
      conditions.push(sql`role = ${filters.role}`);
    }

    // Active status filter
    if (typeof filters.isActive === 'boolean') {
      conditions.push(sql`"isActive" = ${filters.isActive}`);
    }

    // Email verification filter
    if (typeof filters.isEmailVerified === 'boolean') {
      conditions.push(sql`"isEmailVerified" = ${filters.isEmailVerified}`);
    }

    // Search filter (searches across multiple fields)
    if (filters.search && filters.search.trim().length > 0) {
      const searchTerm = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push(
        sql`(
          LOWER(email) LIKE ${searchTerm} OR
          LOWER(username) LIKE ${searchTerm} OR
          LOWER("firstName") LIKE ${searchTerm} OR
          LOWER("lastName") LIKE ${searchTerm}
        )`,
      );
    }

    // Date range filter (for createdAt)
    if (filters.dateFrom) {
      conditions.push(sql`"created_at" >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`"created_at" <= ${filters.dateTo}`);
    }

    return conditions;
  }

  static validateDateRange(dateFrom?: Date, dateTo?: Date): void {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new Error('Date from cannot be greater than date to');
    }
  }

  static sanitizeSearchTerm(search?: string): string | undefined {
    if (!search) return undefined;

    // Remove special SQL characters and trim
    const sanitized = search
      .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
      .trim();

    return sanitized.length > 0 ? sanitized : undefined;
  }

  static buildSortCondition(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc',
  ): SQL<unknown> | undefined {
    if (!sortBy) {
      return sql`"created_at" DESC`; // Default sort
    }

    const allowedSortFields = [
      'id',
      'email',
      'username',
      'firstName',
      'lastName',
      'role',
      'isActive',
      'isEmailVerified',
      'createdAt',
      'updatedAt',
      'lastLoginAt',
    ];

    if (!allowedSortFields.includes(sortBy)) {
      return sql`"created_at" DESC`; // Fallback to default
    }

    // Handle camelCase to snake_case conversion for database fields
    const dbField = this.convertToDbField(sortBy);

    if (sortOrder === 'desc') {
      return sql.raw(`"${dbField}" DESC`);
    } else {
      return sql.raw(`"${dbField}" ASC`);
    }
  }

  private static convertToDbField(field: string): string {
    // Convert camelCase to database field names (snake_case)
    const fieldMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      isActive: 'is_active',
      isEmailVerified: 'is_email_verified',
      isTwoFactorEnabled: 'is_two_factor_enabled',
      
      profilePicture: 'profile_picture',
      lastLoginAt: 'last_login_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    return fieldMap[field] || field;
  }
}
