# Database Management Scripts

This document describes the comprehensive database management scripts available in this project.

## Overview

The project includes robust database management scripts with proper error handling, prerequisite checks, and clear console output. These scripts ensure safe and reliable database operations.

## Available Scripts

### 1. Migration Script (`migrate`)

**Purpose**: Execute database migrations safely with comprehensive validation.

**Usage**:
```bash
# Using yarn
yarn migrate
# or
yarn db:migrate

# Direct execution
./scripts/db-migrate.sh
```

**Features**:
- ✅ Environment variable validation
- ✅ Database connectivity testing
- ✅ Drizzle Kit availability check
- ✅ Automatic migration generation
- ✅ Safe migration application
- ✅ Colored console output
- ✅ Detailed progress reporting

**Prerequisites**:
- All required environment variables must be set
- Database must be accessible
- Drizzle Kit must be installed

### 2. Fresh/Reset Script (`fresh`)

**Purpose**: Completely reset and rebuild the database from scratch.

**Usage**:
```bash
# Using yarn (with confirmation prompt)
yarn fresh
# or
yarn db:fresh

# Force reset without confirmation
yarn db:fresh:force

# Direct execution
./scripts/db-fresh.sh
./scripts/db-fresh.sh --force
```

**Features**:
- ⚠️ **DESTRUCTIVE OPERATION** - Deletes all data
- ✅ Production environment protection
- ✅ User confirmation requirement
- ✅ Automatic schema backup creation
- ✅ Complete database reset
- ✅ Schema verification after reset
- ✅ Force flag for automation

**Safety Measures**:
- Refuses to run in production environment
- Detects production database names
- Requires explicit user confirmation
- Creates automatic backups

## Required Environment Variables

Both scripts require the following environment variables:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database_name
```

## Script Features

### Error Handling
- **Exit on Error**: Scripts use `set -e` to exit immediately on any error
- **Validation**: Comprehensive prerequisite checking before execution
- **Clear Messages**: Colored output with clear error descriptions
- **Safe Defaults**: Conservative approach to prevent data loss

### Console Output
- **Colored Output**: Different colors for info, success, warning, and error messages
- **Progress Tracking**: Step-by-step progress reporting
- **Clear Formatting**: Well-structured output with headers and separators

### Safety Features
- **Environment Protection**: Prevents accidental production database operations
- **Confirmation Prompts**: User confirmation for destructive operations
- **Backup Creation**: Automatic schema backups before destructive operations
- **Connection Testing**: Database connectivity verification before operations

## Additional Database Scripts

### Basic Drizzle Operations

```bash
# Generate migrations only
yarn db:generate

# Open Drizzle Studio
yarn db:studio

# Check schema validity
yarn db:check
```

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   [ERROR] Missing required environment variables: DB_HOST DB_PASSWORD
   ```
   **Solution**: Ensure your `.env` file contains all required variables.

2. **Database Connection Failed**
   ```
   [ERROR] Cannot connect to database
   ```
   **Solution**: Check database configuration and ensure PostgreSQL is running.

3. **Drizzle Kit Not Found**
   ```
   [ERROR] Drizzle Kit not found
   ```
   **Solution**: Run `yarn install` to install dependencies.

4. **Production Environment Protection**
   ```
   [ERROR] This script should NOT be run in production environment
   ```
   **Solution**: This is intentional protection. Use appropriate environment.

### Debug Mode

To debug script execution, you can run them with bash debug mode:

```bash
bash -x ./scripts/db-migrate.sh
bash -x ./scripts/db-fresh.sh
```

## Best Practices

1. **Always use the migration script** for regular schema updates
2. **Only use fresh script** for development environment resets
3. **Backup important data** before running destructive operations
4. **Test scripts in development** before using in other environments
5. **Review migration files** before applying them

## Script Locations

- Migration Script: `scripts/db-migrate.sh`
- Fresh/Reset Script: `scripts/db-fresh.sh`
- Package.json Scripts: `package.json` (scripts section)

## Dependencies

- **Drizzle Kit**: For database operations
- **PostgreSQL Client Tools**: For connection testing (optional)
- **Bash**: For script execution
- **Yarn**: For package management

---

**Note**: These scripts are designed for development and staging environments. Always exercise caution when working with databases, especially in production environments.