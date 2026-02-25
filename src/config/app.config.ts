import { Configuration, Value } from '@itgorillaz/configify';
import { IsNotEmpty } from 'class-validator';

@Configuration()
export class AppConfig {
  @IsNotEmpty()
  @Value('PORT')
  port: number;

  @IsNotEmpty()
  @Value('NODE_ENV')
  nodeEnv: 'development' | 'production' | 'test';

  @IsNotEmpty()
  @Value('API_PREFIX')
  apiPrefix: string;

  @IsNotEmpty()
  @Value('JWT_SECRET')
  jwtSecret: string;

  @IsNotEmpty()
  @Value('JWT_REFRESH_SECRET')
  jwtRefreshSecret: string;

  @IsNotEmpty()
  @Value('JWT_EXPIRES_IN')
  jwtExpiresIn: string;

  @IsNotEmpty()
  @Value('JWT_REFRESH_EXPIRES_IN')
  jwtRefreshExpiresIn: string;

  @IsNotEmpty()
  @Value('BCRYPT_ROUNDS')
  bcryptRounds: number;

  @IsNotEmpty()
  @Value('RATE_LIMIT_TTL')
  rateLimitTtl: number;

  @IsNotEmpty()
  @Value('RATE_LIMIT_LIMIT')
  rateLimitLimit: number;
}
