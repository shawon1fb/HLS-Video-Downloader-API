import { Configuration, Value } from '@itgorillaz/configify';
import { IsNotEmpty, IsOptional } from 'class-validator';

@Configuration()
export class RedisConfig {
  @IsNotEmpty()
  @Value('REDIS_HOST', { default: 'localhost' })
  host: string;
  @IsNotEmpty()
  @Value('REDIS_PORT', { parse: parseInt, default: 6379 })
  port: number;
  @IsOptional()
  @Value('REDIS_PASSWORD')
  password: string;

  @IsNotEmpty()
  @Value('CACHE_TTL', { parse: parseInt, default: 3600000 })
  ttl: number;
}
