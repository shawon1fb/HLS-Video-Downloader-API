# Project Implementation Rules

## Overview
This document establishes mandatory implementation standards for the Backend template project. All developers must strictly adhere to these rules to ensure consistency, maintainability, and architectural integrity.

## 1. Database ORM Requirements

### ✅ MANDATORY
- **Drizzle ORM ONLY**: All database operations must exclusively use Drizzle ORM
- **Query Builder**: All database queries must be written using Drizzle's query builder syntax
- **Schema Definitions**: Database schemas must be implemented using Drizzle's schema syntax
- **Type Safety**: Leverage Drizzle's TypeScript integration for compile-time type checking

### ❌ PROHIBITED
- **Other ORMs**: TypeORM, Prisma, Sequelize, or any other ORM solutions are strictly forbidden
- **Raw SQL**: Direct SQL queries without Drizzle's query builder are not allowed
- **Mixed ORM Usage**: Using multiple ORM solutions within the same project

### Implementation Examples
```typescript
// ✅ CORRECT - Using Drizzle schema
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ✅ CORRECT - Using Drizzle query builder
const user = await db.select().from(users).where(eq(users.id, userId));
```

## 2. Configuration Management

### ✅ MANDATORY
- **@itgorillaz/configify ONLY**: All configuration management must use configify
- **Environment Variables**: All env vars must be managed through configify classes
- **Type Safety**: Configuration must be strongly typed using configify decorators
- **Validation**: All configuration values must be validated at startup

### ❌ PROHIBITED
- **NestJS ConfigModule**: The default NestJS configuration system is strictly forbidden
- **Direct process.env**: Accessing environment variables directly is not allowed
- **Other Config Libraries**: dotenv, config, or any other configuration libraries
- **Untyped Configuration**: Configuration without proper TypeScript typing

### Implementation Examples
```typescript
// ✅ CORRECT - Using configify
import { Configify, EnvVar } from '@itgorillaz/configify';

@Configify()
export class DatabaseConfig {
  @EnvVar('DB_HOST')
  host: string;

  @EnvVar('DB_PORT', { type: 'number', default: 5432 })
  port: number;

  @EnvVar('DB_NAME')
  database: string;
}

// ❌ WRONG - Using NestJS ConfigModule
import { ConfigModule } from '@nestjs/config'; // FORBIDDEN
```

## 3. HTTP Framework Requirements

### ✅ MANDATORY
- **Fastify ONLY**: All HTTP server functionality must exclusively use Fastify framework
- **Fastify Plugins**: All additional functionality must use official Fastify plugins or Fastify-compatible community plugins
- **Plugin Registration**: All plugins must be registered using Fastify's plugin system
- **Type Safety**: Leverage Fastify's TypeScript integration for request/response typing
- **Performance**: Utilize Fastify's high-performance features and optimizations

### ❌ PROHIBITED
- **Express.js**: Express framework and Express-specific middleware are strictly forbidden
- **Express Middleware**: Any Express-only middleware packages are not allowed
- **Mixed Framework Usage**: Using multiple HTTP frameworks within the same project
- **Express-to-Fastify Adapters**: Wrapper libraries that adapt Express middleware for Fastify

### Implementation Examples
```typescript
// ✅ CORRECT - Using Fastify with plugins
import Fastify from 'fastify';
import { FastifyInstance } from 'fastify';

const fastify: FastifyInstance = Fastify({
  logger: true
});

// Register Fastify plugins
await fastify.register(require('@fastify/cors'), {
  origin: true
});

await fastify.register(require('@fastify/helmet'));

// ✅ CORRECT - Fastify route definition
fastify.get('/api/users', async (request, reply) => {
  return { users: [] };
});

// ❌ WRONG - Express usage
import express from 'express'; // FORBIDDEN
const app = express(); // FORBIDDEN
```

### Plugin Selection Guidelines
1. **Official Fastify Plugins**: Prioritize plugins from the @fastify organization
2. **Community Plugins**: Use well-maintained community plugins with Fastify compatibility
3. **Plugin Verification**: Ensure plugins are actively maintained and support current Fastify versions
4. **Performance Impact**: Evaluate plugin performance impact before adoption

### Required Fastify Dependencies
```json
{
  "dependencies": {
    "fastify": "^latest",
    "@fastify/cors": "^latest",
    "@fastify/helmet": "^latest",
    "@fastify/rate-limit": "^latest",
    "@fastify/swagger": "^latest",
    "@fastify/swagger-ui": "^latest"
  }
}
```

### Prohibited HTTP Framework Dependencies
- `express` - Use Fastify instead
- `koa` - Use Fastify instead
- `hapi` - Use Fastify instead
- Any Express-specific middleware packages
- Express-to-Fastify adapter libraries

## 4. Code Structure Standards

### Configuration Files
- Must follow configify's class-based structure
- Each configuration domain should have its own class
- All classes must be decorated with `@Configify()`
- Environment variables must use `@EnvVar()` decorator

### Database Schema
- Schema files must be organized in `src/database/schema/` directory
- Each entity should have its own schema file
- Use Drizzle's table definition syntax
- Maintain consistent naming conventions (snake_case for database, camelCase for TypeScript)

### Service Layer
- All database interactions must go through Drizzle
- Services must inject the database connection
- Use Drizzle's transaction support for complex operations
- Implement proper error handling for database operations

## 5. Dependency Requirements

### Required Dependencies
```json
{
  "dependencies": {
    "@itgorillaz/configify": "^latest",
    "drizzle-orm": "^latest",
    "drizzle-kit": "^latest",
    "pg": "^latest",
    "fastify": "^latest",
    "@fastify/cors": "^latest",
    "@fastify/helmet": "^latest",
    "@fastify/rate-limit": "^latest",
    "@fastify/swagger": "^latest",
    "@fastify/swagger-ui": "^latest"
  },
  "devDependencies": {
    "@types/pg": "^latest"
  }
}
```

### Prohibited Dependencies
- `@nestjs/config` - Use configify instead
- `typeorm` - Use Drizzle ORM instead
- `prisma` - Use Drizzle ORM instead
- `sequelize` - Use Drizzle ORM instead
- `express` - Use Fastify instead
- `koa` - Use Fastify instead
- `hapi` - Use Fastify instead
- Any Express-specific middleware packages
- Express-to-Fastify adapter libraries

### Package Manager Requirements
- **Yarn ONLY**: All package management operations must use Yarn
- **npm PROHIBITED**: Never use npm for installing, updating, or managing dependencies

## 6. Implementation Guidelines

### Configuration Loading
1. Initialize configify in the main application bootstrap
2. Load all configuration classes before starting the application
3. Validate all required environment variables at startup
4. Fail fast if any required configuration is missing

### Database Connection
1. Use configify-provided database settings
2. Establish connection through Drizzle's connection pool
3. Implement proper connection error handling
4. Use environment-specific connection settings

### Service Implementation
1. Inject database connection into services
2. Use Drizzle's query builder for all operations
3. Implement proper transaction handling
4. Use Drizzle's type-safe query results

## 7. Migration and Schema Management

### Schema Changes
- All schema changes must be done through Drizzle migrations
- Use `drizzle-kit` for generating migrations
- Maintain migration history in version control
- Test migrations in development before production deployment

### Migration Commands
```bash
# Generate migration
yarn drizzle-kit generate:pg

# Run migrations
yarn drizzle-kit push:pg
```

## 8. Testing Requirements

### Database Testing
- Use Drizzle with test database instances
- Implement proper test data seeding using Drizzle
- Clean up test data after each test
- Use transactions for test isolation

### Configuration Testing
- Test configuration loading with various environment setups
- Validate error handling for missing required configuration
- Test configuration validation rules

## 9. Code Review Checklist

### Before Merging
- [ ] No usage of prohibited ORMs or configuration libraries
- [ ] All database operations use Drizzle ORM
- [ ] All configuration uses @itgorillaz/configify
- [ ] All HTTP functionality uses Fastify framework exclusively
- [ ] No Express.js or Express-specific middleware usage
- [ ] All plugins are Fastify-compatible
- [ ] Yarn is used exclusively (no npm commands)
- [ ] Proper TypeScript typing throughout
- [ ] Migration files are included for schema changes
- [ ] Tests pass with the new implementation
- [ ] No direct environment variable access
- [ ] Proper error handling implemented

## 10. Enforcement

### Automated Checks
- ESLint rules to detect prohibited imports
- Pre-commit hooks to validate code structure
- CI/CD pipeline checks for dependency compliance

### Manual Review
- All pull requests must be reviewed for compliance
- Architecture decisions must align with these rules
- Any exceptions require explicit approval and documentation

## 11. Documentation Requirements

### Code Documentation
- Document all configuration classes and their purpose
- Provide examples for complex Drizzle queries
- Maintain up-to-date schema documentation
- Document migration procedures

### README Updates
- Keep setup instructions current with configify requirements
- Document environment variable requirements
- Provide troubleshooting guides for common issues

---

**Note**: These rules are mandatory and non-negotiable. Any deviation requires explicit architectural review and approval. Violations will result in pull request rejection and required refactoring.

**Last Updated**: 2025-01-27
**Version**: 1.1.0