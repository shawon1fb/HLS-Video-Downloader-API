#!/bin/bash

# Database Migration Script
# This script runs database migrations with proper error handling and validation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Function to run migrations
run_migrations() {
    print_status "Starting database migration process..."
    
    # Generate migration if schema changes exist
    print_status "Generating migrations for schema changes..."
    if yarn drizzle-kit generate; then
        print_success "Migration generation completed"
    else
        print_error "Failed to generate migrations"
        exit 1
    fi
    
    # Apply migrations to database
    print_status "Applying migrations to database..."
    if yarn drizzle-kit push; then
        print_success "Database migration completed successfully"
    else
        print_error "Failed to apply migrations"
        exit 1
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "     Database Migration Script"
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
    check_db_connection
    
    # Run migrations
    run_migrations
    
    echo ""
    print_success "Migration process completed successfully!"
    echo "=========================================="
}

# Execute main function
main "$@"