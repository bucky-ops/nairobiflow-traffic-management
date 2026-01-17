#!/bin/bash

# NairobiFlow Docker Setup Script
# This script helps you set up and run NairobiFlow using Docker

set -e

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

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Function to create .env file if it doesn't exist
create_env_file() {
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from .env.docker template..."
        cp .env.docker .env
        print_status "Please edit .env file with your API keys and configuration"
    else
        print_status ".env file already exists"
    fi
}

# Function to setup development environment
setup_dev() {
    print_status "Setting up development environment..."
    
    # Create necessary directories
    mkdir -p logs database/init database/migrations monitoring
    
    # Copy environment file
    create_env_file
    
    # Build and start development containers
    docker-compose -f docker-compose.dev.yml build
    docker-compose -f docker-compose.dev.yml up -d
    
    print_success "Development environment is ready!"
    print_status "Application: http://localhost:3000"
    print_status "Database: localhost:5433"
    print_status "Redis: localhost:6380"
    
    if [ "$1" = "--with-admin" ]; then
        print_status "PgAdmin: http://localhost:5050"
        docker-compose -f docker-compose.dev.yml --profile admin up -d
    fi
}

# Function to setup production environment
setup_prod() {
    print_status "Setting up production environment..."
    
    # Create necessary directories
    mkdir -p logs database/init database/migrations nginx/ssl monitoring
    
    # Copy environment file
    create_env_file
    
    # Build and start production containers
    docker-compose build
    docker-compose up -d
    
    print_success "Production environment is ready!"
    print_status "Application: http://localhost:3000"
    print_status "Database: localhost:5432"
    print_status "Redis: localhost:6379"
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring stack..."
    
    # Create monitoring directories
    mkdir -p monitoring/grafana/dashboards monitoring/grafana/datasources
    
    # Create Prometheus config
    cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'nairobiflow'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
EOF

    # Create Grafana datasource config
    cat > monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

    # Start monitoring stack
    docker-compose --profile monitoring up -d
    
    print_success "Monitoring stack is ready!"
    print_status "Prometheus: http://localhost:9090"
    print_status "Grafana: http://localhost:3001 (admin/admin)"
}

# Function to stop containers
stop_containers() {
    print_status "Stopping containers..."
    docker-compose down
    docker-compose -f docker-compose.dev.yml down
    print_success "Containers stopped"
}

# Function to clean up
cleanup() {
    print_status "Cleaning up Docker resources..."
    docker-compose down -v --remove-orphans
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans
    docker system prune -f
    print_success "Cleanup completed"
}

# Function to show logs
show_logs() {
    if [ "$1" = "dev" ]; then
        docker-compose -f docker-compose.dev.yml logs -f
    else
        docker-compose logs -f
    fi
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    docker-compose exec app npm run migrate
    print_success "Migrations completed"
}

# Function to show help
show_help() {
    echo "NairobiFlow Docker Setup Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  dev           Setup development environment"
    echo "  prod          Setup production environment"
    echo "  monitoring    Setup monitoring stack (Prometheus + Grafana)"
    echo "  stop          Stop all containers"
    echo "  cleanup       Clean up Docker resources"
    echo "  logs [dev]    Show logs (dev for development)"
    echo "  migrate       Run database migrations"
    echo "  help          Show this help message"
    echo ""
    echo "Options:"
    echo "  --with-admin  Include PgAdmin (for dev command)"
    echo ""
    echo "Examples:"
    echo "  $0 dev                    # Setup development environment"
    echo "  $0 dev --with-admin       # Setup development with PgAdmin"
    echo "  $0 prod                   # Setup production environment"
    echo "  $0 monitoring             # Setup monitoring stack"
    echo "  $0 logs dev                # Show development logs"
}

# Main script logic
case "$1" in
    "dev")
        check_docker
        setup_dev "$2"
        ;;
    "prod")
        check_docker
        setup_prod
        ;;
    "monitoring")
        check_docker
        setup_monitoring
        ;;
    "stop")
        stop_containers
        ;;
    "cleanup")
        cleanup
        ;;
    "logs")
        show_logs "$2"
        ;;
    "migrate")
        run_migrations
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac