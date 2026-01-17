#!/bin/bash

# Quick Docker Start Script
# This script provides the fastest way to get NairobiFlow running

echo "🚦 NairobiFlow - Quick Docker Start"
echo "===================================="

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "📖 Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.docker .env
    echo "✅ .env file created"
    echo "⚠️  Please edit .env file with your API keys:"
    echo "   - TOMTOM_API_KEY"
    echo "   - GOOGLE_MAPS_API_KEY"
    echo "   - MAPBOX_ACCESS_TOKEN"
    echo ""
    read -p "Press Enter to continue (or Ctrl+C to edit .env first)..."
fi

# Choose environment
echo ""
echo "Choose your environment:"
echo "1) Development (with hot-reload and debugging)"
echo "2) Production (optimized for production)"
echo "3) Development with Admin Tools (includes PgAdmin)"

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo "🚀 Starting Development Environment..."
        docker-compose -f docker-compose.dev.yml up -d --build
        echo ""
        echo "✅ Development environment is ready!"
        echo "🌐 Application: http://localhost:3000"
        echo "🗄️  Database: localhost:5433"
        echo "🔴 Redis: localhost:6380"
        echo "🐛 Debug: http://localhost:9229"
        ;;
    2)
        echo "🏭 Starting Production Environment..."
        docker-compose up -d --build
        echo ""
        echo "✅ Production environment is ready!"
        echo "🌐 Application: http://localhost:3000"
        echo "🗄️  Database: localhost:5432"
        echo "🔴 Redis: localhost:6379"
        ;;
    3)
        echo "🛠️  Starting Development with Admin Tools..."
        docker-compose -f docker-compose.dev.yml up -d --build
        docker-compose -f docker-compose.dev.yml --profile admin up -d
        echo ""
        echo "✅ Development with Admin Tools is ready!"
        echo "🌐 Application: http://localhost:3000"
        echo "🗄️  Database: localhost:5433"
        echo "🔴 Redis: localhost:6380"
        echo "🐛 Debug: http://localhost:9229"
        echo "📊 PgAdmin: http://localhost:5050 (admin@nairobiflow.com / admin)"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "📋 Useful Commands:"
echo "  View logs: docker-compose logs -f"
echo "  Stop all: docker-compose down"
echo "  Restart: docker-compose restart"
echo "  Enter app: docker-compose exec app sh"
echo ""
echo "🎉 NairobiFlow is now running! Open your browser to see the system."