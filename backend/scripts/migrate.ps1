# Migration Helper Script for NotesApp (PowerShell)
# Usage: .\migrate.ps1 [command] [options]

param(
    [Parameter(Position=0)]
    [ValidateSet('add', 'update', 'list', 'remove', 'status')]
    [string]$Command,
    
    [Parameter(Position=1)]
    [string]$MigrationName,
    
    [Alias('e')]
    [ValidateSet('Development', 'Production')]
    [string]$Environment = 'Development',
    
    [Alias('c')]
    [string]$ConnectionString,
    
    [Alias('h')]
    [switch]$Help
)

function Show-Usage {
    Write-Host "Usage: .\migrate.ps1 [COMMAND] [OPTIONS]" -ForegroundColor Green
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  add <name>     Create a new migration"
    Write-Host "  update         Apply pending migrations"
    Write-Host "  list           List all migrations"
    Write-Host "  remove         Remove the last migration"
    Write-Host "  status         Show migration status"
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Environment   Environment (Development|Production) [default: Development]"
    Write-Host "  -ConnectionString  Connection string override"
    Write-Host "  -Help          Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\migrate.ps1 add AddNewFeature"
    Write-Host "  .\migrate.ps1 update -Environment Production"
    Write-Host "  .\migrate.ps1 list"
    Write-Host "  .\migrate.ps1 update -ConnectionString 'Host=localhost;Database=MyDb;...'"
}

# Show help if requested or no command provided
if ($Help -or -not $Command) {
    Show-Usage
    if (-not $Command) {
        Write-Host "Error: No command specified" -ForegroundColor Red
        exit 1
    }
    exit 0
}

# Set environment variable
$env:ASPNETCORE_ENVIRONMENT = $Environment

# Build connection string arguments
$connArgs = @()
if ($ConnectionString) {
    $connArgs += "--connection"
    $connArgs += $ConnectionString
}

Write-Host "Running EF Core migration command: $Command" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Execute the appropriate command
try {
    switch ($Command) {
        'add' {
            if (-not $MigrationName) {
                Write-Host "Error: Migration name is required for 'add' command" -ForegroundColor Red
                exit 1
            }
            Write-Host "Creating migration: $MigrationName" -ForegroundColor Yellow
            & dotnet ef migrations add $MigrationName @connArgs
        }
        'update' {
            Write-Host "Applying migrations..." -ForegroundColor Yellow
            & dotnet ef database update @connArgs
        }
        'list' {
            Write-Host "Listing migrations..." -ForegroundColor Yellow
            & dotnet ef migrations list @connArgs
        }
        'remove' {
            Write-Host "Removing last migration..." -ForegroundColor Yellow
            & dotnet ef migrations remove @connArgs
        }
        'status' {
            Write-Host "Migration status:" -ForegroundColor Yellow
            & dotnet ef migrations list @connArgs
            Write-Host ""
            Write-Host "Database info:" -ForegroundColor Yellow
            & dotnet ef dbcontext info @connArgs
        }
    }
    
    Write-Host "Command completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Error executing command: $_" -ForegroundColor Red
    exit 1
} 