#!/bin/bash

# Self-contained startup script for Tallman Super Agent
# This script ensures all dependencies are available and starts the application

set -e

echo "🚀 Starting Tallman Super Agent..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed or not in PATH"
    exit 1
fi

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
    echo "❌ .env.docker file not found. Please ensure all environment variables are configured."
    exit 1
fi

echo "✅ All prerequisites met"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down || true

# Build and start containers
echo "🏗️ Building and starting containers..."
docker-compose up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check if services are running
echo "🔍 Checking service health..."

# Check backend health
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3251/api/health || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    echo "✅ Backend service is healthy"
else
    echo "❌ Backend service health check failed (HTTP $BACKEND_HEALTH)"
fi

# Check frontend availability
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3250 || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "✅ Frontend service is healthy"
else
    echo "❌ Frontend service health check failed (HTTP $FRONTEND_HEALTH)"
fi

# Show container status
echo "📊 Container status:"
docker-compose ps

echo ""
echo "🎉 Tallman Super Agent is now running!"
echo ""
echo "🌐 Frontend: http://localhost:3250"
echo "🔧 Backend API: http://localhost:3251"
echo ""
echo "To stop the application, run: docker-compose down"
echo "To view logs, run: docker-compose logs -f"
