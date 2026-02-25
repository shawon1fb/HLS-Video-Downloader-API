import { BadRequestException } from '@nestjs/common';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export class PaginationUtil {
  static readonly DEFAULT_PAGE = 1;
  static readonly DEFAULT_LIMIT = 10;
  static readonly MAX_LIMIT = 100;

  static validateAndNormalizePagination(options: PaginationOptions): {
    page: number;
    limit: number;
    offset: number;
    sortBy?: string;
    sortOrder: 'asc' | 'desc';
  } {
    const page = Math.max(1, options.page || this.DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(1, options.limit || this.DEFAULT_LIMIT),
      this.MAX_LIMIT,
    );
    const offset = (page - 1) * limit;
    const sortOrder = options.sortOrder === 'desc' ? 'desc' : 'asc';

    if (options.sortBy && !this.isValidSortField(options.sortBy)) {
      throw new BadRequestException(`Invalid sort field: ${options.sortBy}`);
    }

    return {
      page,
      limit,
      offset,
      sortBy: options.sortBy,
      sortOrder,
    };
  }

  static createPaginationResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginationResult<T> {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }

  private static isValidSortField(field: string): boolean {
    // Define allowed sort fields for users
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
    return allowedSortFields.includes(field);
  }

  static buildSearchConditions(searchTerm?: string): string[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const term = searchTerm.trim().toLowerCase();
    return [
      `LOWER(email) LIKE '%${term}%'`,
      `LOWER(username) LIKE '%${term}%'`,
      `LOWER("firstName") LIKE '%${term}%'`,
      `LOWER("lastName") LIKE '%${term}%'`,
    ];
  }
}
