import { Configuration, Value } from '@itgorillaz/configify';
import { IsNotEmpty } from 'class-validator';

@Configuration()
export class AppConfig {
  @IsNotEmpty()
  @Value('PORT', { parse: parseInt, default: 8000 })
  port: number;

  @IsNotEmpty()
  @Value('NODE_ENV', { default: 'development' })
  nodeEnv: 'development' | 'production' | 'test';

  @IsNotEmpty()
  @Value('API_PREFIX', { default: 'api/v1' })
  apiPrefix: string;

  @IsNotEmpty()
  @Value('JWT_SECRET', { default: 'change-me-dev' })
  jwtSecret: string;

  @IsNotEmpty()
  @Value('JWT_REFRESH_SECRET', { default: 'change-me-dev-refresh' })
  jwtRefreshSecret: string;

  @IsNotEmpty()
  @Value('JWT_EXPIRES_IN', { default: '15m' })
  jwtExpiresIn: string;

  @IsNotEmpty()
  @Value('JWT_REFRESH_EXPIRES_IN', { default: '7d' })
  jwtRefreshExpiresIn: string;

  @IsNotEmpty()
  @Value('BCRYPT_ROUNDS', { parse: parseInt, default: 12 })
  bcryptRounds: number;

  @IsNotEmpty()
  @Value('RATE_LIMIT_TTL', { parse: parseInt, default: 60 })
  rateLimitTtl: number;

  @IsNotEmpty()
  @Value('RATE_LIMIT_LIMIT', { parse: parseInt, default: 100 })
  rateLimitLimit: number;
}
