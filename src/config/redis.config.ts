import { Configuration, Value } from '@itgorillaz/configify';
import { IsNotEmpty, IsOptional } from 'class-validator';

@Configuration()
export class RedisConfig {
  @IsNotEmpty()
  @Value('REDIS_HOST')
  host: string;
  @IsNotEmpty()
  @Value('REDIS_PORT')
  port: number;
  @IsOptional()
  @Value('REDIS_PASSWORD')
  password: string;

  @IsNotEmpty()
  @Value('CACHE_TTL')
  ttl: number;
}
