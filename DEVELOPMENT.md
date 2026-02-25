# Development Environment Setup

This project uses Docker for containerized services to ensure consistent development and deployment.

## Environment Configuration

### Production Environment (`docker-compose.yml`)
- **Redis**: Port 6379, Container: `redis`
- **Redis BullMQ**: Port 6380, Container: `redis-bullmq`
- **Bull Board**: Port 3000, Container: `redis-bullboard`
- **PostgreSQL**: Port 5432, Container: `postgres`
- **Network**: `admin_sports_network`

## Usage

### Using Management Script
The project includes a management script for easy environment control:

```bash
# Start all services
./manage-envs.sh start

# Stop all services
./manage-envs.sh stop

# Restart all services
./manage-envs.sh restart

# Check status
./manage-envs.sh status

# View logs
./manage-envs.sh logs

# Database operations
./manage-envs.sh db migrate
./manage-envs.sh db reset

# Clean up (remove all containers and volumes)
./manage-envs.sh clean
```

### Manual Docker Commands
```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Access Services
- **Redis**: `localhost:6379`
- **Redis BullMQ**: `localhost:6380`
- **Bull Board UI**: `http://localhost:3000`
- **PostgreSQL**: `localhost:5432`

## Database Setup

### Environment Variables
Configure your database connection in `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=sports_user
DB_PASSWORD=sports_password_2024
DB_NAME=sports_admin
DB_SSL=false
```

### Running Migrations
```bash
# Using management script
./manage-envs.sh db migrate

# Or manually
yarn drizzle-kit push
```

## Benefits

- **Containerized Services**: Consistent environment across different machines
- **Easy Management**: Simple script commands for common operations
- **Data Persistence**: Named volumes ensure data survives container restarts
- **Service Isolation**: Each service runs in its own container
- **Development Ready**: All services configured for immediate development use

## Environment Variables

All services use environment variables for configuration. Copy `.env.example` to `.env` and adjust values as needed for your local development setup.