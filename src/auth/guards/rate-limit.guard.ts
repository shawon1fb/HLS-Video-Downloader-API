import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(request, context);
    
    const { ttl, limit } = rateLimitOptions;
    
    // Get current count from cache
    const current = await this.cacheManager.get<number>(key) || 0;
    
    if (current >= limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          error: 'Rate limit exceeded',
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment counter
    await this.cacheManager.set(key, current + 1, ttl * 1000);
    
    return true;
  }

  private generateKey(request: any, context: ExecutionContext): string {
    const ip = this.getClientIp(request);
    const route = context.getHandler().name;
    const controller = context.getClass().name;
    
    // Include API key if present for API-specific rate limiting
    const apiKey = request.headers['x-api-key'] || 
                   (request.headers.authorization?.startsWith('Bearer ') 
                     ? request.headers.authorization.substring(7) 
                     : '');
    
    const identifier = apiKey || ip;
    
    return `rate_limit:${controller}:${route}:${identifier}`;
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}