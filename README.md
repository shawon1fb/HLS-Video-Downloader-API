# Backend template

A comprehensive NestJS-based backend application for sports administration, built with modern technologies including Drizzle ORM, Redis, PostgreSQL, and BullMQ for job processing.

## 🏗️ Architecture Overview

- **Framework**: NestJS with Fastify adapter
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis
- **Job Queue**: BullMQ with Redis
- **Authentication**: JWT with Passport
- **Configuration**: @itgorillaz/configify
- **Package Manager**: Yarn

## 📋 Prerequisites

Before setting up the project, ensure you have the following installed:

### Required Software

- **Node.js**: v18.0.0 or higher
- **Yarn**: v1.22.0 or higher (Package manager)
- **Docker**: v20.0.0 or higher (for local development)
- **Docker Compose**: v2.0.0 or higher
- **PostgreSQL**: v15.0 or higher (if not using Docker)
- **Redis**: v6.2.0 or higher (if not using Docker)

### Version Verification

```bash
# Check Node.js version
node --version

# Check Yarn version
yarn --version

# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version
```

## 🚀 Project Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd backend-template
```

### 2. Install Dependencies

```bash
# Install all project dependencies
yarn install
```

### 3. Environment Configuration

#### Copy Environment Template

```bash
# Unix/Linux/macOS
cp .env.example .env

# Windows
copy .env.example .env
```

#### Configure Environment Variables

Edit the `.env` file with your specific configuration:

```bash
# Application Configuration
NODE_ENV=development
PORT=8000
API_PREFIX=api/v1

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=sports_user
DB_PASSWORD=sports_password_2024
DB_NAME=sports_admin
DB_SSL=false

# Database Pool Configuration
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_ACQUIRE=60000
DB_POOL_IDLE=10000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=0
REDIS_CONNECT_TIMEOUT=5000
REDIS_LAZY_CONNECT=3000
REDIS_RETRY_DELAY_ON_FAILOVER=3

# JWT & Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
```

**⚠️ Security Note**: Always change default passwords and secrets in production!

### 4. Start Infrastructure Services

#### Using Docker Compose (Recommended)

```bash
# Start PostgreSQL, Redis, and monitoring services
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs if needed
docker-compose logs -f
```

#### Manual Setup (Alternative)

If you prefer to run services manually:

**PostgreSQL Setup:**
```bash
# Create database and user
psql -U postgres
CREATE DATABASE sports_admin;
CREATE USER sports_user WITH PASSWORD 'sports_password_2024';
GRANT ALL PRIVILEGES ON DATABASE sports_admin TO sports_user;
\q
```

**Redis Setup:**
```bash
# Start Redis server
redis-server --requirepass redis_password
```

## 🗄️ Database Migration

### Database Initialization

#### 1. Generate Initial Migration

```bash
# Generate migration files from schema
yarn drizzle-kit generate
```

#### 2. Apply Migrations

**Development Environment:**
```bash
# Push schema changes to development database
yarn drizzle-kit push

# Alternative: Apply specific migration
yarn drizzle-kit migrate
```

**Production Environment:**
```bash
# Set production environment
export NODE_ENV=production

# Apply migrations safely
yarn drizzle-kit migrate
```

#### 3. Database Schema Verification

```bash
# Check database connection and schema
yarn drizzle-kit introspect

# View current schema
yarn drizzle-kit studio
```

### Migration Commands Reference

| Command | Description | Environment |
|---------|-------------|-------------|
| `yarn drizzle-kit generate` | Generate migration files | All |
| `yarn drizzle-kit push` | Push schema to database (dev) | Development |
| `yarn drizzle-kit migrate` | Apply migrations | Production |
| `yarn drizzle-kit studio` | Open database studio | Development |
| `yarn drizzle-kit introspect` | Introspect existing database | All |
| `yarn drizzle-kit drop` | Drop migration files | Development |

### Seed Data (Optional)

Currently, no seed data scripts are implemented. To add seed data:

1. Create a seed script in `src/database/seeds/`
2. Use Drizzle ORM to insert initial data
3. Run the seed script after migrations

## 🏃‍♂️ Running the Project

### Local Development

#### Start Development Server

```bash
# Start in watch mode (recommended for development)
yarn start:dev

# Start in debug mode
yarn start:debug

# Start without watch mode
yarn start
```

#### Verify Application

```bash
# Check if application is running
curl http://localhost:8000

# Check health endpoint (if implemented)
curl http://localhost:8000/api/v1/health
```

### Testing

#### Unit Tests

```bash
# Run all unit tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:cov

# Debug tests
yarn test:debug
```

#### End-to-End Tests

```bash
# Run e2e tests
yarn test:e2e
```

#### Test Database Setup

For testing, create a separate test database:

```bash
# Create test database
psql -U postgres
CREATE DATABASE sports_admin_test;
GRANT ALL PRIVILEGES ON DATABASE sports_admin_test TO sports_user;
\q
```

Update test configuration in `test/jest-e2e.json` if needed.

### Building for Production

#### Build Application

```bash
# Build the application
yarn build

# Verify build output
ls -la dist/
```

#### Production Start

```bash
# Start production build
yarn start:prod
```

### Code Quality

```bash
# Lint code
yarn lint

# Format code
yarn format

# Type checking
yarn build
```

## 🚀 Deployment

### Server Requirements

#### Minimum System Requirements

- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04 LTS or CentOS 8+

#### Recommended System Requirements

- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **OS**: Ubuntu 22.04 LTS

#### Required Software on Server

- Node.js v18+
- Yarn v1.22+
- PostgreSQL 15+
- Redis 6.2+
- PM2 (for process management)
- Nginx (for reverse proxy)

### Deployment Checklist

#### Pre-Deployment

- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Security configurations reviewed
- [ ] SSL certificates prepared
- [ ] Backup strategy implemented
- [ ] Monitoring setup configured

#### Deployment Steps

1. **Server Preparation**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Yarn
   npm install -g yarn
   
   # Install PM2
   npm install -g pm2
   ```

2. **Application Deployment**
   ```bash
   # Clone repository
   git clone <repository-url>
   cd backend-template
   
   # Install dependencies
   yarn install --production
   
   # Build application
   yarn build
   
   # Set up environment
   cp .env.example .env
   # Edit .env with production values
   ```

3. **Database Setup**
   ```bash
   # Run migrations
   NODE_ENV=production yarn drizzle-kit migrate
   ```

4. **Process Management**
   ```bash
   # Start with PM2
   pm2 start dist/main.js --name "backend-template"
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

5. **Nginx Configuration**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Post-Deployment Verification

#### Health Checks

```bash
# Check application status
pm2 status

# Check application logs
pm2 logs backend-template

# Test API endpoints
curl https://your-domain.com/api/v1/health

# Check database connectivity
psql -h localhost -U sports_user -d sports_admin -c "SELECT 1;"

# Check Redis connectivity
redis-cli -h localhost -p 6379 ping
```

#### Performance Monitoring

```bash
# Monitor PM2 processes
pm2 monit

# Check system resources
htop
df -h
free -m
```

#### Security Verification

- [ ] Firewall configured (only necessary ports open)
- [ ] SSL/TLS certificates installed
- [ ] Database access restricted
- [ ] Environment variables secured
- [ ] Log files properly configured

### Monitoring and Maintenance

#### Log Management

```bash
# View application logs
pm2 logs backend-template --lines 100

# Rotate logs
pm2 install pm2-logrotate
```

#### Backup Strategy

```bash
# Database backup
pg_dump -h localhost -U sports_user sports_admin > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script (add to crontab)
#!/bin/bash
BACKUP_DIR="/var/backups/sports-admin"
mkdir -p $BACKUP_DIR
pg_dump -h localhost -U sports_user sports_admin > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

#### Updates and Maintenance

```bash
# Update application
git pull origin main
yarn install --production
yarn build
pm2 restart backend-template

# Update system packages
sudo apt update && sudo apt upgrade -y
```

## 🔧 Development Tools

### Available Services

- **Application**: http://localhost:8000
- **Bull Board**: http://localhost:3000 (Job queue monitoring)
- **Drizzle Studio**: `yarn drizzle-kit studio`
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Redis BullMQ**: localhost:6380

### Useful Commands

```bash
# View all available scripts
yarn run

# Check dependencies
yarn list

# Update dependencies
yarn upgrade

# Clean node_modules
rm -rf node_modules yarn.lock && yarn install
```

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connectivity
psql -h localhost -U sports_user -d sports_admin

# Reset database connection
docker-compose restart postgres
```

#### Redis Connection Issues

```bash
# Check Redis status
redis-cli ping

# Restart Redis
docker-compose restart redis
```

#### Port Conflicts

```bash
# Check what's using port 8000
lsof -i :8000

# Kill process using port
kill -9 <PID>
```

#### Migration Issues

```bash
# Reset migrations (development only)
yarn drizzle-kit drop
yarn drizzle-kit generate
yarn drizzle-kit push
```

### Getting Help

- Check application logs: `yarn start:dev` or `pm2 logs`
- Review environment configuration
- Verify all services are running
- Check network connectivity
- Review database permissions

## 📝 Additional Notes

### OS-Specific Instructions

#### Windows Users

- Use PowerShell or Command Prompt
- Replace `cp` with `copy`
- Replace `rm -rf` with `rmdir /s`
- Consider using WSL2 for better compatibility

#### macOS Users

- Install Homebrew for package management
- Use `brew install postgresql redis` for local setup

#### Linux Users

- Use your distribution's package manager
- Ensure proper permissions for Docker

### Performance Optimization

- Enable Redis caching for frequently accessed data
- Use connection pooling for database connections
- Implement proper indexing on database tables
- Monitor and optimize slow queries
- Use PM2 cluster mode for production

---

**Last Updated**: 2025-01-24  
**Version**: 1.0.0  
**Maintainer**: Backend template Team
