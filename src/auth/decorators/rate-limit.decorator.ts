import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  ttl: number; // Time to live in seconds
  limit: number; // Maximum number of requests
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

// Predefined rate limit configurations
export const ApiRateLimit = () =>
  RateLimit({
    ttl: 60, // 1 minute
    limit: 100, // 100 requests per minute
  });

export const StrictApiRateLimit = () =>
  RateLimit({
    ttl: 60, // 1 minute
    limit: 20, // 20 requests per minute
  });

export const AuthRateLimit = () =>
  RateLimit({
    ttl: 900, // 15 minutes
    limit: 5, // 5 attempts per 15 minutes
    skipSuccessfulRequests: true,
  });