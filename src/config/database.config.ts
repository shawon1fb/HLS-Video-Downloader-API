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
  @Value('DB_NAME', { default: 'video_downloader_db' })
  database: string;

  @IsNotEmpty()
  @Value('DB_USER', { default: 'video_downloader_user' })
  username: string;

  @IsNotEmpty()
  @Value('DB_PASSWORD', { default: 'video_downloader_password_2026' })
  password: string;

  @IsOptional()
  @Value('DB_SSL', { default: false })
  ssl: boolean;

  getDatabaseUrl(): string {
    const sslParam = this.ssl ? '?sslmode=require' : '';
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}${sslParam}`;
  }
}
