#!/bin/bash

# Docker Helper Script for Collaborative Notes App
# Usage: ./docker-helper.sh [command] [environment]

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
    echo "Usage: ./docker-helper.sh [command] [environment]"
    echo ""
    echo "Commands:"
    echo "  up          Start services"
    echo "  down        Stop services"
    echo "  restart     Restart services"
    echo "  logs        Show logs"
    echo "  clean       Clean up containers, volumes, and images"
    echo "  status      Show status of services"
    echo "  shell       Open shell in running container"
    echo "  db          Connect to database"
    echo ""
    echo "Environments:"
    echo "  dev         Development environment (default)"
    echo "  prod        Production environment"
    echo ""
    echo "Examples:"
    echo "  ./docker-helper.sh up dev          # Start development environment"
    echo "  ./docker-helper.sh logs prod       # Show production logs"
    echo "  ./docker-helper.sh clean dev       # Clean development environment"
    echo "  ./docker-helper.sh db dev          # Connect to development database"
}

# Set environment
set_environment() {
    case "$1" in
        "dev"|"development"|"")
            PROFILE="dev"
            DB_SERVICE="postgres-dev"
            API_SERVICE="notes-api-dev"
            DB_NAME="NotesAppDev"
            DB_PORT="5432"
            ;;
        "prod"|"production")
            PROFILE="prod"
            DB_SERVICE="postgres-prod"
            API_SERVICE="notes-api-prod"
            DB_NAME="NotesApp"
            DB_PORT="5433"
            ;;
        *)
            error "Invalid environment: $1"
            usage
            exit 1
            ;;
    esac
    
    log "Using ${PROFILE} environment"
}

# Commands
cmd_up() {
    log "Starting ${PROFILE} environment..."
    docker-compose --profile ${PROFILE} up -d
    success "${PROFILE} environment started!"
    
    log "Waiting for services to be healthy..."
    sleep 5
    cmd_status
}

cmd_down() {
    log "Stopping ${PROFILE} environment..."
    docker-compose --profile ${PROFILE} down
    success "${PROFILE} environment stopped!"
}

cmd_restart() {
    log "Restarting ${PROFILE} environment..."
    docker-compose --profile ${PROFILE} restart
    success "${PROFILE} environment restarted!"
}

cmd_logs() {
    log "Showing logs for ${PROFILE} environment..."
    docker-compose --profile ${PROFILE} logs -f --tail=100
}

cmd_clean() {
    warning "This will remove all containers, volumes, and images for ${PROFILE} environment!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Cleaning ${PROFILE} environment..."
        docker-compose --profile ${PROFILE} down -v --rmi all
        success "${PROFILE} environment cleaned!"
    else
        log "Clean cancelled"
    fi
}

cmd_status() {
    log "Status of ${PROFILE} environment:"
    docker-compose --profile ${PROFILE} ps
    echo ""
    log "Health status:"
    docker-compose --profile ${PROFILE} exec ${DB_SERVICE} pg_isready -U postgres -d ${DB_NAME} 2>/dev/null && success "Database is healthy" || warning "Database is not ready"
    docker-compose --profile ${PROFILE} exec ${API_SERVICE} curl -f http://localhost/health 2>/dev/null > /dev/null && success "API is healthy" || warning "API is not ready"
}

cmd_shell() {
    log "Opening shell in ${API_SERVICE}..."
    docker-compose --profile ${PROFILE} exec ${API_SERVICE} /bin/bash
}

cmd_db() {
    log "Connecting to ${DB_SERVICE} database..."
    docker-compose --profile ${PROFILE} exec ${DB_SERVICE} psql -U postgres -d ${DB_NAME}
}

# Main logic
if [ $# -eq 0 ]; then
    usage
    exit 1
fi

COMMAND=$1
ENVIRONMENT=${2:-"dev"}

set_environment "$ENVIRONMENT"

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
    "help"|"-h"|"--help")
        usage
        ;;
    *)
        error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac 