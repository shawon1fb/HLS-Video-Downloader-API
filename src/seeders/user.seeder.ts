import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();
import { createDatabaseConnection, closeDatabaseConnection } from '../database/connection';
import { users, UserRole } from '../database/schema';

// Simple database configuration class without decorators for standalone usage
class SimpleDatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;

  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = parseInt(process.env.DB_PORT || '5432');
    this.database = process.env.DB_NAME || 'task_db';
    this.username = process.env.DB_USER || 'task_user';
    this.password = process.env.DB_PASSWORD || 'task_password_2024';
    this.ssl = process.env.DB_SSL === 'true';
  }

  getDatabaseUrl(): string {
    const sslParam = this.ssl ? '?sslmode=require' : '';
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}${sslParam}`;
  }
}
// Simple configuration class without decorators for standalone usage
class SimpleSeederConfig {
  userCount: number;
  clearExisting: boolean;
  verboseLogging: boolean;
  environment: string;
  batchSize: number;

  constructor() {
    this.userCount = parseInt(process.env.SEEDER_USER_COUNT || '50');
    this.clearExisting = process.env.SEEDER_CLEAR_EXISTING !== 'false';
    this.verboseLogging = process.env.SEEDER_VERBOSE_LOGGING !== 'false';
    this.environment = process.env.SEEDER_ENVIRONMENT || process.env.NODE_ENV || 'development';
    this.batchSize = parseInt(process.env.SEEDER_BATCH_SIZE || '10');
  }

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
export class UserSeeder {
  private db: ReturnType<typeof createDatabaseConnection>;
  private databaseConfig: SimpleDatabaseConfig;
  private seederConfig: SimpleSeederConfig;
  private readonly saltRounds = 12;

  constructor() {
    // Initialize configurations
    this.databaseConfig = new SimpleDatabaseConfig();
    this.seederConfig = new SimpleSeederConfig();
    
    // Initialize database connection
    this.db = createDatabaseConnection(this.databaseConfig);
  }

  /**
   * Main seeder execution method
   */
  async run(): Promise<void> {
    try {
      this.log('🌱 Starting User Seeder...');
      
      // Safety check for production environment
      this.checkEnvironmentSafety();
      
      // Clear existing test data if configured
      if (this.seederConfig.clearExisting) {
        await this.clearExistingTestUsers();
      }
      
      // Generate and insert users
      await this.generateUsers();
      
      this.log('✅ User seeding completed successfully!');
      
    } catch (error) {
      this.logError('❌ User seeding failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Check if it's safe to run the seeder
   */
  private checkEnvironmentSafety(): void {
    if (this.seederConfig.isProductionEnvironment()) {
      throw new Error(
        '🚫 Seeder cannot run in production environment for safety reasons. ' +
        'Please check your SEEDER_ENVIRONMENT configuration.'
      );
    }
    
    this.log(`🔍 Environment check passed: ${this.seederConfig.environment}`);
  }

  /**
   * Clear existing test users from the database
   */
  private async clearExistingTestUsers(): Promise<void> {
    try {
      this.log('🧹 Clearing existing test users...');
      
      // Delete users with test email domains or specific test patterns
      const testEmailPatterns = [
        '%@test.com',
        '%@example.com',
        '%@fake.com',
        '%test%',
        '%seed%'
      ];
      
      let totalDeleted = 0;
      
      for (const pattern of testEmailPatterns) {
        const result = await this.db
          .delete(users)
          .where(sql`email LIKE ${pattern}`)
          .returning({ id: users.id });
        
        totalDeleted += result.length;
      }
      
      this.log(`🗑️  Deleted ${totalDeleted} existing test users`);
      
    } catch (error) {
      this.logError('Failed to clear existing test users:', error);
      throw error;
    }
  }

  /**
   * Generate and insert users in batches
   */
  private async generateUsers(): Promise<void> {
    const totalUsers = this.seederConfig.userCount;
    const batchSize = this.seederConfig.batchSize;
    const roleDistribution = this.seederConfig.getUserRoleDistribution();
    
    this.log(`👥 Generating ${totalUsers} users in batches of ${batchSize}...`);
    
    let createdCount = 0;
    
    for (let i = 0; i < totalUsers; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalUsers - i);
      const batch = await this.generateUserBatch(currentBatchSize, roleDistribution, i);
      
      try {
        await this.db.insert(users).values(batch);
        createdCount += currentBatchSize;
        
        this.log(`📝 Created batch ${Math.floor(i / batchSize) + 1}: ${currentBatchSize} users (Total: ${createdCount}/${totalUsers})`);
        
      } catch (error) {
        this.logError(`Failed to insert batch starting at index ${i}:`, error);
        throw error;
      }
    }
    
    this.log(`🎉 Successfully created ${createdCount} users!`);
  }

  /**
   * Generate a batch of user data
   */
  private async generateUserBatch(
    batchSize: number, 
    roleDistribution: { admin: number; moderator: number; user: number },
    startIndex: number
  ): Promise<Array<typeof users.$inferInsert>> {
    const batch: Array<typeof users.$inferInsert> = [];
    
    for (let i = 0; i < batchSize; i++) {
      const userIndex = startIndex + i;
      const role = this.determineUserRole(userIndex, roleDistribution);
      const userData = await this.generateSingleUser(role, userIndex);
      batch.push(userData);
    }
    
    return batch;
  }

  /**
   * Generate a single user with realistic data
   */
  private async generateSingleUser(
    role: UserRole, 
    index: number
  ): Promise<typeof users.$inferInsert> {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const username = this.generateUniqueUsername(firstName, lastName, index);
    const email = this.generateUniqueEmail(firstName, lastName, index);
    
    // Generate a secure password and hash it
    const password = this.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);
    
    // Generate realistic dates
    const createdAt = faker.date.recent({ days: 365 });
    const lastLoginAt = faker.datatype.boolean(0.7) ? faker.date.recent({ days: 30 }) : null;
    
    return {
      email,
      username,
      firstName,
      lastName,
      password: hashedPassword,
      role,
      profilePicture: faker.datatype.boolean(0.3) ? faker.image.avatar() : null,
      isActive: faker.datatype.boolean(0.9), // 90% active users
      isEmailVerified: faker.datatype.boolean(0.8), // 80% verified emails
      emailVerificationToken: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      lastLoginAt,
      loginAttempts: faker.number.int({ min: 0, max: 2 }),
      lockUntil: null,
      twoFactorSecret: null,
      isTwoFactorEnabled: faker.datatype.boolean(0.1), // 10% use 2FA
      createdAt,
      updatedAt: createdAt,
    };
  }

  /**
   * Determine user role based on distribution
   */
  private determineUserRole(
    index: number, 
    distribution: { admin: number; moderator: number; user: number }
  ): UserRole {
    const random = Math.random();
    
    if (random < distribution.admin) {
      return UserRole.ADMIN;
    } else if (random < distribution.admin + distribution.moderator) {
      return UserRole.MODERATOR;
    } else {
      return UserRole.USER;
    }
  }

  /**
   * Generate unique username
   */
  private generateUniqueUsername(firstName: string, lastName: string, index: number): string {
    const baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`
      .replace(/[^a-z0-9.]/g, '')
      .substring(0, 20);
    
    return `${baseUsername}.test${index.toString().padStart(4, '0')}`;
  }

  /**
   * Generate unique email
   */
  private generateUniqueEmail(firstName: string, lastName: string, index: number): string {
    const domains = ['test.com', 'example.com', 'fake.com', 'seed.dev'];
    const domain = domains[index % domains.length];
    const baseEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`
      .replace(/[^a-z0-9.]/g, '')
      .substring(0, 20);
    
    return `${baseEmail}.test${index.toString().padStart(4, '0')}@${domain}`;
  }

  /**
   * Generate a secure password
   */
  private generateSecurePassword(): string {
    return faker.internet.password({
      length: 12,
      memorable: false,
      pattern: /[A-Za-z0-9!@#$%^&*]/,
    });
  }

  /**
   * Cleanup database connection
   */
  private async cleanup(): Promise<void> {
    try {
      await closeDatabaseConnection();
      this.log('🔌 Database connection closed');
    } catch (error) {
      this.logError('Failed to close database connection:', error);
    }
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    // Always log for debugging purposes
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${message}`, error);
  }
}

/**
 * Execute the seeder if this file is run directly
 */
if (require.main === module) {
  const seeder = new UserSeeder();
  seeder.run()
    .then(() => {
      console.log('✅ Seeder execution completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeder execution failed:', error);
      process.exit(1);
    });
}