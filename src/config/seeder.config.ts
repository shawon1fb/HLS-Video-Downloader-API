import { Configuration, Value } from '@itgorillaz/configify';
import { IsOptional, IsNumber, Min, Max, IsBoolean } from 'class-validator';

@Configuration()
export class SeederConfig {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  @Value('SEEDER_USER_COUNT', { parse: parseInt, default: 50 })
  userCount: number;

  @IsOptional()
  @IsBoolean()
  @Value('SEEDER_CLEAR_EXISTING', { default: true })
  clearExisting: boolean;

  @IsOptional()
  @IsBoolean()
  @Value('SEEDER_VERBOSE_LOGGING', { default: true })
  verboseLogging: boolean;

  @IsOptional()
  @Value('SEEDER_ENVIRONMENT', { default: 'development' })
  environment: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Value('SEEDER_BATCH_SIZE', { parse: parseInt, default: 10 })
  batchSize: number;

  // Safety check to prevent running in production
  isProductionEnvironment(): boolean {
    return this.environment?.toLowerCase()?.includes('prod') || 
           this.environment?.toLowerCase()?.includes('production') || false;
  }

  // Get user roles distribution (percentages)
  getUserRoleDistribution(): { admin: number; moderator: number; user: number } {
    return {
      admin: 0.05,     // 5% admins
      moderator: 0.15, // 15% moderators
      user: 0.80       // 80% regular users
    };
  }
}