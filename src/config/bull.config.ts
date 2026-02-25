import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class BullMQRedisConfig {
  @Value('BULLMQ_REDIS_HOST')
  host: string;
  @Value('BULLMQ_REDIS_PORT')
  port: number;
  @Value('BULLMQ_REDIS_PASSWORD')
  password: string;
}
