#!/bin/bash

# Docker Helper Script for Collaborative Notes App
# Usage: ./docker-helper.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
usage() {
    echo "Docker Helper for Collaborative Notes App"
    echo ""
    echo "Usage: ./docker-helper.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up          Start services"
    echo "  down        Stop services"
    echo "  restart     Restart services"
    echo "  logs        Show logs"
    echo "  clean       Clean up containers, volumes, and images"
    echo "  status      Show status of services"
    echo "  shell       Open shell in running API container"
    echo "  db          Connect to database"
    echo "  build       Build the services"
    echo ""
    echo "Examples:"
    echo "  ./docker-helper.sh up           # Start development environment"
    echo "  ./docker-helper.sh logs         # Show logs"
    echo "  ./docker-helper.sh clean        # Clean development environment"
    echo "  ./docker-helper.sh db           # Connect to development database"
}

# Set service names
DB_SERVICE="postgres"
API_SERVICE="notes-api"
DB_NAME="NotesAppDev"

# Commands
cmd_up() {
    log "Starting development environment..."
    docker-compose up -d --build
    success "Development environment started!"
    
    log "Waiting for services to be healthy..."
    sleep 5
    cmd_status
}

cmd_down() {
    log "Stopping development environment..."
    docker-compose down
    success "Development environment stopped!"
}

cmd_restart() {
    log "Restarting development environment..."
    docker-compose restart
    success "Development environment restarted!"
}

cmd_logs() {
    log "Showing logs for development environment..."
    docker-compose logs -f --tail=100
}

cmd_clean() {
    warning "This will remove all containers, volumes, and images for the development environment!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Cleaning development environment..."
        docker-compose down -v --rmi all
        success "Development environment cleaned!"
    else
        log "Clean cancelled"
    fi
}

cmd_status() {
    log "Status of development environment:"
    docker-compose ps
    echo ""
    log "Health status:"
    docker-compose exec ${DB_SERVICE} pg_isready -U postgres -d ${DB_NAME} 2>/dev/null && success "Database is healthy" || warning "Database is not ready"
    curl -f http://localhost:8080/health 2>/dev/null > /dev/null && success "API is healthy" || warning "API is not ready"
}

cmd_shell() {
    log "Opening shell in ${API_SERVICE}..."
    docker-compose exec ${API_SERVICE} /bin/bash
}

cmd_db() {
    log "Connecting to ${DB_SERVICE} database..."
    docker-compose exec ${DB_SERVICE} psql -U postgres -d ${DB_NAME}
}

cmd_build() {
    log "Building development environment..."
    docker-compose build --no-cache
    success "Build completed!"
}

# Main logic
if [ $# -eq 0 ]; then
    usage
    exit 1
fi

COMMAND=$1

case "$COMMAND" in
    "up")
        cmd_up
        ;;
    "down")
        cmd_down
        ;;
    "restart")
        cmd_restart
        ;;
    "logs")
        cmd_logs
        ;;
    "clean")
        cmd_clean
        ;;
    "status")
        cmd_status
        ;;
    "shell")
        cmd_shell
        ;;
    "db")
        cmd_db
        ;;
    "build")
        cmd_build
        ;;
    "help"|"-h"|"--help")
        usage
        ;;
    *)
        error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac 