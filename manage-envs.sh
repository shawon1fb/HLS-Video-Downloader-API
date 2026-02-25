#!/bin/bash

# Backend template - Environment Management Script

set -e

show_help() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the production environment"
    echo "  stop      Stop the production environment"
    echo "  restart   Restart the production environment"
    echo "  status    Show status of the production environment"
    echo "  logs      Show logs of the production environment"
    echo "  db        Database operations (migrate, seed, reset)"
    echo "  clean     Stop and remove all containers and volumes"
    echo ""
    echo "Database Commands:"
    echo "  $0 db migrate        # Run database migrations"
    echo "  $0 db seed           # Seed database with sample data"
    echo "  $0 db reset          # Reset database (drop and recreate)"
    echo ""
    echo "Examples:"
    echo "  $0 start             # Start production environment"
    echo "  $0 stop              # Stop production environment"
    echo "  $0 status            # Show status of production environment"
    echo "  $0 logs              # Show production environment logs"
    echo "  $0 db migrate        # Run migrations on production database"
}

start_env() {
    echo "Starting production environment..."
    docker compose up -d
}

stop_env() {
    echo "Stopping production environment..."
    docker compose down
}

restart_env() {
    echo "Restarting production environment..."
    stop_env
    sleep 2
    start_env
}

show_status() {
    echo "=== Production Environment Status ==="
    docker compose ps
    echo ""
    echo "=== All Running Containers ==="
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"
}

show_logs() {
    echo "=== Production Environment Logs ==="
    docker compose logs -f
}

# Database operations
db_operations() {
    local operation=$1
    
    case $operation in
        "migrate")
            echo "Running database migrations for production environment..."
            echo "Setting production database environment variables..."
            export DB_HOST=localhost
            export DB_PORT=5432
            export DB_USER=sports_user
            export DB_PASSWORD=sports_password_2024
            export DB_NAME=sports_admin
            yarn drizzle-kit push:pg
            ;;
        "seed")
            echo "Seeding database for production environment..."
            # Add seed command here when implemented
            echo "Seed functionality not yet implemented"
            ;;
        "reset")
            echo "Resetting database for production environment..."
            docker compose exec postgres psql -U sports_user -d sports_admin -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
            db_operations migrate
            ;;
        *)
            echo "Error: Unknown database operation '$operation'"
            echo "Available operations: migrate, seed, reset"
            exit 1
            ;;
    esac
}

clean_all() {
    echo "Cleaning up production environment..."
    echo "Stopping and removing all containers..."
    docker compose down -v 2>/dev/null || true
    
    echo "Removing orphaned containers..."
    docker container prune -f
    
    echo "Removing unused volumes..."
    docker volume prune -f
    
    echo "Cleanup completed!"
}

# Main script logic
if [ $# -eq 0 ]; then
    show_help
    exit 1
fi

command=$1

case $command in
    "start")
        start_env
        ;;
    "stop")
        stop_env
        ;;
    "restart")
        restart_env
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "db")
        if [ -z "$2" ]; then
            echo "Error: Database operation required"
            show_help
            exit 1
        fi
        db_operations $2
        ;;
    "clean")
        clean_all
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        echo "Error: Unknown command '$command'"
        show_help
        exit 1
        ;;
esac