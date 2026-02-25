import { Configuration, Value } from '@itgorillaz/configify';
import { IsNotEmpty, IsOptional } from 'class-validator';

@Configuration()
export class DatabaseConfig {
  @IsNotEmpty()
  @Value('DB_HOST', { default: 'localhost' })
  host: string;

  @IsNotEmpty()
  @Value('DB_PORT', { parse: parseInt, default: 5432 })
  port: number;

  @IsNotEmpty()
  @Value('DB_NAME', { default: 'sports_admin' })
  database: string;

  @IsNotEmpty()
  @Value('DB_USER', { default: 'sports_user' })
  username: string;

  @IsNotEmpty()
  @Value('DB_PASSWORD', { default: 'sports_password_2024' })
  password: string;

  @IsOptional()
  @Value('DB_SSL', { default: false })
  ssl: boolean;

  getDatabaseUrl(): string {
    const sslParam = this.ssl ? '?sslmode=require' : '';
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}${sslParam}`;
  }
}
