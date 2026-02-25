import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  json,
} from 'drizzle-orm/pg-core';

// User role enum
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

// Comprehensive User table schema with enhanced security and validation
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  password: varchar('password', { length: 255 }).notNull(), // Will store bcrypt hash
  role: varchar('role', { length: 50 }).notNull().default('user'), // user, admin, moderator
  profilePicture: varchar('profile_picture', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  lastLoginAt: timestamp('last_login_at'),
  loginAttempts: integer('login_attempts').default(0),
  lockUntil: timestamp('lock_until'),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  isTwoFactorEnabled: boolean('is_two_factor_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});



// Export all schemas
export const schema = {
  users,
};

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;