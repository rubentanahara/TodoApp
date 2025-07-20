#!/bin/bash

# Migration Helper Script for NotesApp
# Usage: ./migrate.sh [command] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="Development"
CONNECTION_STRING=""
MIGRATION_NAME=""

# Function to display usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  add <name>     Create a new migration"
    echo "  update         Apply pending migrations"
    echo "  list           List all migrations"
    echo "  remove         Remove the last migration"
    echo "  status         Show migration status"
    echo ""
    echo "Options:"
    echo "  -e, --env      Environment (Development|Production) [default: Development]"
    echo "  -c, --conn     Connection string override"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 add AddNewFeature"
    echo "  $0 update --env Production"
    echo "  $0 list"
    echo "  $0 update --conn \"Host=localhost;Database=MyDb;...\""
}

# Parse command line arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        add|update|list|remove|status)
            COMMAND="$1"
            shift
            if [[ "$COMMAND" == "add" && $# -gt 0 && ! "$1" =~ ^- ]]; then
                MIGRATION_NAME="$1"
                shift
            fi
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--conn)
            CONNECTION_STRING="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Validate command
if [[ -z "$COMMAND" ]]; then
    echo -e "${RED}Error: No command specified${NC}"
    usage
    exit 1
fi

# Set environment
export ASPNETCORE_ENVIRONMENT="$ENVIRONMENT"

# Build connection string arguments
CONN_ARGS=""
if [[ -n "$CONNECTION_STRING" ]]; then
    CONN_ARGS="--connection \"$CONNECTION_STRING\""
fi

echo -e "${GREEN}Running EF Core migration command: $COMMAND${NC}"
echo -e "${YELLOW}Environment: $ENVIRONMENT${NC}"

# Execute the appropriate command
case $COMMAND in
    add)
        if [[ -z "$MIGRATION_NAME" ]]; then
            echo -e "${RED}Error: Migration name is required for 'add' command${NC}"
            exit 1
        fi
        echo -e "${YELLOW}Creating migration: $MIGRATION_NAME${NC}"
        eval "dotnet ef migrations add \"$MIGRATION_NAME\" $CONN_ARGS"
        ;;
    update)
        echo -e "${YELLOW}Applying migrations...${NC}"
        eval "dotnet ef database update $CONN_ARGS"
        ;;
    list)
        echo -e "${YELLOW}Listing migrations...${NC}"
        eval "dotnet ef migrations list $CONN_ARGS"
        ;;
    remove)
        echo -e "${YELLOW}Removing last migration...${NC}"
        eval "dotnet ef migrations remove $CONN_ARGS"
        ;;
    status)
        echo -e "${YELLOW}Migration status:${NC}"
        eval "dotnet ef migrations list $CONN_ARGS"
        echo ""
        echo -e "${YELLOW}Database info:${NC}"
        eval "dotnet ef dbcontext info $CONN_ARGS"
        ;;
esac

echo -e "${GREEN}Command completed successfully!${NC}" 