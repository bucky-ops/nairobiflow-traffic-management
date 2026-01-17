# NairobiFlow Docker Setup

This document provides comprehensive instructions for running NairobiFlow using Docker.

## 🐳 Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM
- 10GB+ free disk space

### 1. Clone and Setup
```bash
git clone https://github.com/bucky-ops/nairobiflow-traffic-management.git
cd nairobiflow-traffic-management
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.docker .env

# Edit with your API keys
nano .env
```

### 3. One-Command Setup
```bash
# Make setup script executable
chmod +x scripts/docker-setup.sh

# Run setup (development)
./scripts/docker-setup.sh dev

# Or with admin tools
./scripts/docker-setup.sh dev --with-admin

# For production
./scripts/docker-setup.sh prod
```

## 🏗️ Docker Compose Files

### `docker-compose.yml` (Production)
- **App:** Node.js application with multi-stage build
- **Database:** PostgreSQL 15 with persistent storage
- **Cache:** Redis 7 with persistence
- **Proxy:** Nginx (optional, with `--profile production`)
- **Monitoring:** Prometheus + Grafana (optional, with `--profile monitoring`)

### `docker-compose.dev.yml` (Development)
- **Hot-reload:** Live code reloading
- **Debug port:** Node.js debugging on 9229
- **Admin tools:** PgAdmin (optional, with `--profile admin`)
- **Different ports:** Avoids conflicts with production

## 🛠️ Dockerfiles

### `Dockerfile` (Production)
- **Multi-stage build:** Optimized size and security
- **Non-root user:** Security best practices
- **Health checks:** Built-in health monitoring
- **Alpine Linux:** Minimal attack surface

### `Dockerfile.dev` (Development)
- **Development dependencies:** Debugging tools included
- **Volume mounting:** Live code synchronization
- **Debug port:** Node.js inspector exposed

## 🔧 Configuration

### Environment Variables
```bash
# Required
NODE_ENV=production|development
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=nairobiflow
DB_USER=nairobiflow
DB_PASSWORD=your_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# API Keys
TOMTOM_API_KEY=your_tomtom_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Security
ALLOWED_ORIGINS=http://localhost:3000
VALID_API_KEYS=your_api_keys

# Performance
CACHE_TTL=300
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000
```

## 📊 Services

### Core Services
| Service | Image | Port | Description |
|---------|-------|------|-------------|
| app | node:18-alpine | 3000 | NairobiFlow application |
| postgres | postgres:15-alpine | 5432/5433 | PostgreSQL database |
| redis | redis:7-alpine | 6379/6380 | Redis cache |

### Optional Services
| Service | Image | Port | Profile | Description |
|---------|-------|------|---------|-------------|
| nginx | nginx:alpine | 80,443 | production | Reverse proxy |
| pgadmin | dpage/pgadmin4 | 5050 | admin | Database admin |
| prometheus | prom/prometheus | 9090 | monitoring | Metrics collection |
| grafana | grafana/grafana | 3001 | monitoring | Visualization dashboard |

## 🚀 Usage Examples

### Development Environment
```bash
# Start development stack
./scripts/docker-setup.sh dev

# With admin tools
./scripts/docker-setup.sh dev --with-admin

# View logs
./scripts/docker-setup.sh logs dev

# Stop containers
./scripts/docker-setup.sh stop
```

### Production Environment
```bash
# Start production stack
./scripts/docker-setup.sh prod

# With monitoring
./scripts/docker-setup.sh prod
./scripts/docker-setup.sh monitoring

# View logs
./scripts/docker-setup.sh logs
```

### Monitoring Setup
```bash
# Setup monitoring stack
./scripts/docker-setup.sh monitoring

# Access services
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
```

## 🔍 Health Checks

### Built-in Health Checks
All containers include health checks:
- **App:** HTTP request to `/api/health`
- **Database:** PostgreSQL connection test
- **Redis:** Redis ping command

### Manual Health Check
```bash
# Check container health
docker-compose ps

# Check application health
curl http://localhost:3000/api/health

# View health logs
docker-compose logs app | grep health
```

## 🔧 Development Workflow

### Hot Reloading
```bash
# Development setup enables hot reloading
./scripts/docker-setup.sh dev

# Code changes are reflected immediately
# Application restarts automatically
```

### Database Access
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U nairobiflow -d nairobiflow

# Access Redis CLI
docker-compose exec redis redis-cli
```

### Debugging
```bash
# Access container shell
docker-compose exec app sh

# View Node.js debugger at http://localhost:9229/json
```

## 📦 Building Images

### Manual Build
```bash
# Build production image
docker build -t nairobiflow:latest .

# Build development image
docker build -f Dockerfile.dev -t nairobiflow:dev .
```

### Multi-platform Build
```bash
# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 -t nairobiflow:latest .
```

## 🔒 Security Considerations

### Production Security
- Non-root user in all containers
- Limited container capabilities
- Network isolation with custom subnet
- Environment variable protection
- Health checks for monitoring

### Best Practices
```bash
# Use specific image versions
FROM node:18-alpine

# Run as non-root user
USER nairobiflow

# Use multi-stage builds
FROM node:18-alpine AS builder
# ... build stages
FROM node:18-alpine AS runner
```

## 📊 Monitoring

### Metrics Collection
Prometheus collects metrics from:
- Application performance
- Database query times
- Cache hit rates
- API request rates
- System resources

### Grafana Dashboards
Pre-configured dashboards include:
- Traffic data analytics
- System performance
- API monitoring
- Database metrics

## 🛠️ Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :3000

# Kill conflicting processes
sudo fuser -k 3000/tcp
```

#### Permission Issues
```bash
# Fix volume permissions
sudo chown -R 1001:1001 ./logs
```

#### Memory Issues
```bash
# Increase Docker memory limit
# In Docker Desktop settings: Memory ≥ 4GB
```

#### Network Issues
```bash
# Reset Docker network
docker network prune
docker-compose down
docker-compose up --build
```

### Logs
```bash
# View application logs
docker-compose logs -f app

# View database logs
docker-compose logs -f postgres

# View all logs
./scripts/docker-setup.sh logs
```

## 🔄 Updates and Maintenance

### Updating Containers
```bash
# Pull latest images
docker-compose pull

# Recreate containers
docker-compose up --force-recreate

# Clean up old images
docker image prune -f
```

### Database Backups
```bash
# Backup database
docker-compose exec postgres pg_dump -U nairobiflow nairobiflow > backup.sql

# Restore database
docker-compose exec -T postgres psql -U nairobiflow nairobiflow < backup.sql
```

### Cleanup
```bash
# Remove all containers and volumes
./scripts/docker-setup.sh cleanup

# Remove Docker system
docker system prune -a --volumes
```

## 🌐 Deployment

### Production Deployment
```bash
# Set production environment
export NODE_ENV=production

# Start production stack
./scripts/docker-setup.sh prod

# Add SSL certificates (Nginx)
# Place certificates in nginx/ssl/

# Update DNS to point to your server
```

### Reverse Proxy
```bash
# Enable Nginx proxy
docker-compose --profile production up -d

# Update nginx.conf for your domain
# Place SSL certificates
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [Node.js Docker Hub](https://hub.docker.com/_/node)

## 🆘 Support

For issues with Docker setup:
1. Check logs: `./scripts/docker-setup.sh logs`
2. Verify environment: `./scripts/docker-setup.sh --help`
3. Create an issue on GitHub
4. Check system requirements