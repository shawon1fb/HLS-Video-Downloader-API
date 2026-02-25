#!/bin/bash

# Database Fresh/Reset Script
# This script completely resets the database with proper error handling and safety checks
#
# Usage:
#   ./db-fresh.sh                    # Interactive mode with confirmation
#   ./db-fresh.sh --force            # Skip confirmation prompt
#   ./db-fresh.sh reset              # Skip confirmation (alias for reset)
#   ./db-fresh.sh reset database     # Skip confirmation (full reset command)
#
# This script will:
#   1. Drop ALL existing tables, sequences, views, functions, and types
#   2. Recreate the database schema from Drizzle definitions
#   3. Verify the new schema

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_danger() {
    echo -e "${MAGENTA}[DANGER]${NC} $1"
}

# Function to check if required environment variables are set
check_env_vars() {
    print_status "Checking required environment variables..."
    
    local required_vars=("DB_HOST" "DB_PORT" "DB_USER" "DB_PASSWORD" "DB_NAME")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required environment variables: ${missing_vars[*]}"
        print_error "Please ensure your .env file is properly configured."
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Function to check database connectivity
check_db_connection() {
    print_status "Testing database connection..."
    
    # Use pg_isready to check if PostgreSQL is accepting connections
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
            print_success "Database connection successful"
        else
            print_error "Cannot connect to database. Please check your database configuration and ensure PostgreSQL is running."
            exit 1
        fi
    else
        print_warning "pg_isready not found. Skipping connection test."
    fi
}

# Function to check if drizzle-kit is available
check_drizzle_kit() {
    print_status "Checking Drizzle Kit availability..."
    
    if ! command -v drizzle-kit >/dev/null 2>&1; then
        if [[ ! -f "node_modules/.bin/drizzle-kit" ]]; then
            print_error "Drizzle Kit not found. Please run 'yarn install' first."
            exit 1
        fi
    fi
    
    print_success "Drizzle Kit is available"
}

# Function to check if psql is available
check_psql() {
    print_status "Checking PostgreSQL client availability..."
    
    if ! command -v psql >/dev/null 2>&1; then
        print_error "PostgreSQL client (psql) not found."
        print_error "Please install PostgreSQL client tools:"
        print_error "  - macOS: brew install postgresql"
        print_error "  - Ubuntu/Debian: sudo apt-get install postgresql-client"
        print_error "  - CentOS/RHEL: sudo yum install postgresql"
        exit 1
    fi
    
    print_success "PostgreSQL client is available"
}

# Function to check environment safety
check_environment_safety() {
    print_status "Checking environment safety..."
    
    # Check if we're in production
    if [[ "${NODE_ENV:-}" == "production" ]]; then
        print_danger "PRODUCTION ENVIRONMENT DETECTED!"
        print_error "This script should NOT be run in production environment."
        print_error "It will completely destroy all data in the database."
        exit 1
    fi
    
    # Check database name for production indicators
    if [[ "$DB_NAME" =~ (prod|production) ]]; then
        print_danger "Production database name detected: $DB_NAME"
        print_error "Refusing to reset what appears to be a production database."
        exit 1
    fi
    
    print_success "Environment safety check passed"
}

# Function to get user confirmation
get_user_confirmation() {
    echo ""
    print_danger "⚠️  DESTRUCTIVE OPERATION WARNING ⚠️"
    echo ""
    print_warning "This operation will:"
    print_warning "  • DROP ALL TABLES in database: $DB_NAME"
    print_warning "  • DELETE ALL DATA permanently"
    print_warning "  • RECREATE the database schema from scratch"
    echo ""
    print_danger "THIS ACTION CANNOT BE UNDONE!"
    echo ""
    
    # Skip confirmation if --force flag is provided or if any argument contains 'reset'
    if [[ "$*" == *"--force"* ]] || [[ "$*" == *"reset"* ]]; then
        if [[ "$*" == *"--force"* ]]; then
            print_warning "Force flag detected. Skipping confirmation."
        else
            print_warning "Reset command detected. Skipping confirmation."
        fi
        return 0
    fi
    
    read -p "Are you absolutely sure you want to continue? (type 'yes' to confirm): " confirmation
    
    if [[ "$confirmation" != "yes" ]]; then
        print_status "Operation cancelled by user."
        exit 0
    fi
    
    print_status "User confirmation received. Proceeding with database reset..."
}

# Function to backup current schema (optional)
backup_current_schema() {
    print_status "Creating backup of current database schema..."
    
    local backup_dir="backups"
    local backup_file="$backup_dir/schema_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$backup_dir"
    
    # Create schema backup using pg_dump
    if command -v pg_dump >/dev/null 2>&1; then
        if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --schema-only > "$backup_file" 2>/dev/null; then
            print_success "Schema backup created: $backup_file"
        else
            print_warning "Failed to create schema backup, but continuing..."
        fi
    else
        print_warning "pg_dump not found. Skipping schema backup."
    fi
}

# Function to drop all tables
drop_all_tables() {
    print_status "Dropping all existing tables..."
    
    # Create a temporary SQL script to drop all tables
    local drop_script="/tmp/drop_all_tables_$$.sql"
    
    # Generate SQL to drop all tables in the current database
    cat > "$drop_script" << 'EOF'
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all sequences
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
    
    -- Drop all views
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as argtypes FROM pg_proc INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'public') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.argtypes || ') CASCADE';
    END LOOP;
    
    -- Drop all types
    FOR r IN (SELECT typname FROM pg_type INNER JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'public' AND typtype = 'c') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
END $$;
EOF
    
    # Execute the drop script
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$drop_script" >/dev/null 2>&1; then
        print_success "All tables dropped successfully"
    else
        print_error "Failed to drop existing tables"
        rm -f "$drop_script"
        exit 1
    fi
    
    # Clean up temporary script
    rm -f "$drop_script"
}

# Function to reset database
reset_database() {
    print_status "Starting database reset process..."
    
    # First, drop all existing tables
    drop_all_tables
    
    # Generate any pending migrations
    print_status "Generating latest migrations..."
    if yarn drizzle-kit generate; then
        print_success "Migration generation completed"
    else
        print_warning "Migration generation failed, but continuing with reset..."
    fi
    
    # Push the schema to create fresh tables
    print_status "Creating fresh database schema..."
    if yarn drizzle-kit push; then
        print_success "Database reset completed successfully"
    else
        print_error "Failed to create fresh database schema"
        exit 1
    fi
}

# Function to verify reset
verify_reset() {
    print_status "Verifying database reset..."
    
    # Check if we can connect and query the database
    if yarn drizzle-kit check; then
        print_success "Database schema verification passed"
    else
        print_warning "Schema verification failed, but database reset may have succeeded"
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "     Database Fresh/Reset Script"
    echo "=========================================="
    echo ""
    
    # Load environment variables if .env file exists
    if [[ -f ".env" ]]; then
        print_status "Loading environment variables from .env file..."
        set -a  # Automatically export all variables
        source .env
        set +a  # Stop automatically exporting
    else
        print_warning "No .env file found. Using system environment variables."
    fi
    
    # Run all checks
    check_env_vars
    check_drizzle_kit
    check_psql
    check_db_connection
    check_environment_safety
    
    # Get user confirmation
    get_user_confirmation "$@"
    
    # Create backup (optional)
    backup_current_schema
    
    # Reset database
    reset_database
    
    # Verify reset
    verify_reset
    
    echo ""
    print_success "Database fresh/reset completed successfully!"
    print_status "Your database has been completely reset with the latest schema."
    echo "=========================================="
}

# Execute main function with all arguments
main "$@"