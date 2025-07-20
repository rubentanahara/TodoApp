# Entity Framework Migrations Guide

## Overview

This guide covers best practices for managing EF Core migrations without needing temporary design-time factories.

## ✅ Recommended Solutions

### 1. Permanent Design-Time Factory (Current Implementation)

The project includes a permanent `DesignTimeDbContextFactory` that handles:
- Multiple configuration sources (appsettings, environment variables, command line)
- Environment-specific settings
- Robust error handling
- Fallback connection string resolution

**Benefits:**
- Works consistently across all environments
- No temporary files needed
- Supports multiple configuration sources
- Production-ready

### 2. Migration Helper Scripts

Use the included scripts for streamlined migrations:

**Linux/macOS:**
```bash
# Create migration
./scripts/migrate.sh add MyNewMigration

# Apply migrations
./scripts/migrate.sh update

# List migrations
./scripts/migrate.sh list

# Production deployment
./scripts/migrate.sh update --env Production
```

**Windows PowerShell:**
```powershell
# Create migration
.\scripts\migrate.ps1 add MyNewMigration

# Apply migrations
.\scripts\migrate.ps1 update

# List migrations
.\scripts\migrate.ps1 list

# Production deployment
.\scripts\migrate.ps1 update -Environment Production
```

### 3. Environment Variable Approach

Set connection string via environment variable:

```bash
export CONNECTION_STRING="Host=localhost;Database=NotesAppDev;Username=postgres;Password=YourPassword123!;Port=5432;"
dotnet ef migrations add MyMigration
```

**Windows:**
```cmd
set CONNECTION_STRING=Host=localhost;Database=NotesAppDev;Username=postgres;Password=YourPassword123!;Port=5432;
dotnet ef migrations add MyMigration
```

## 🚀 Usage Examples

### Development Workflow

```bash
# 1. Create new migration
./scripts/migrate.sh add AddUserProfiles

# 2. Review generated migration
# Edit: Migrations/[timestamp]_AddUserProfiles.cs

# 3. Apply migration
./scripts/migrate.sh update

# 4. Verify migration
./scripts/migrate.sh status
```

### Production Deployment

```bash
# Set production environment
export ASPNETCORE_ENVIRONMENT=Production

# Apply migrations with production connection
./scripts/migrate.sh update --env Production
```

### CI/CD Pipeline

```yaml
# Example GitHub Actions step
- name: Apply Migrations
  run: |
    cd backend
    export CONNECTION_STRING="${{ secrets.DB_CONNECTION_STRING }}"
    ./scripts/migrate.sh update --env Production
```

## 🔧 Configuration Hierarchy

The design-time factory resolves connection strings in this priority order:

1. **Command line arguments** (highest priority)
   ```bash
   dotnet ef migrations add Test --connection "Host=..."
   ```

2. **Environment variables**
   ```bash
   export CONNECTION_STRING="Host=..."
   ```

3. **Configuration files** (lowest priority)
   - `appsettings.{Environment}.json`
   - `appsettings.json`

## 📁 Configuration Files

### appsettings.Development.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=NotesAppDev;Username=postgres;Password=YourPassword123!;Port=5432;"
  }
}
```

### appsettings.Production.json
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=${DB_HOST};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD};Port=${DB_PORT:-5432};SSL Mode=Require;"
  }
}
```

## 🛠️ Advanced Scenarios

### Custom Connection String
```bash
dotnet ef migrations add MyMigration --connection "Host=custom-host;Database=custom-db;..."
```

### Multiple Databases
```bash
# Different connection for different environments
export CONNECTION_STRING_DEV="Host=dev-server;..."
export CONNECTION_STRING_PROD="Host=prod-server;..."

# Use appropriate connection
./scripts/migrate.sh update --env Development
./scripts/migrate.sh update --env Production
```

### Docker Environments
```bash
# Use Docker network connection
export CONNECTION_STRING="Host=postgres-container;Database=NotesApp;Username=postgres;Password=password;Port=5432;"
./scripts/migrate.sh update
```

## 🚨 Troubleshooting

### Common Issues

**1. "Unable to create DbContext" Error**
- ✅ Ensure `DesignTimeDbContextFactory` exists
- ✅ Verify connection string in configuration
- ✅ Check environment variables

**2. Connection String Not Found**
- ✅ Verify `DefaultConnection` in appsettings.json
- ✅ Check environment variable `CONNECTION_STRING`
- ✅ Ensure correct environment is set

**3. Migration Already Applied**
- ✅ Check migration status: `./scripts/migrate.sh status`
- ✅ Use `dotnet ef migrations remove` to undo
- ✅ Create new migration with different name

**4. Database Connection Issues**
- ✅ Verify database server is running
- ✅ Check connection string format
- ✅ Test connection with `dotnet ef dbcontext info`

### Debug Commands

```bash
# Check current configuration
dotnet ef dbcontext info

# List pending migrations
dotnet ef migrations list

# Validate migration
dotnet ef migrations script --idempotent

# Check database status
./scripts/migrate.sh status
```

## 📋 Best Practices

### ✅ Do's
- Always use the permanent design-time factory
- Keep connection strings in configuration files
- Use environment-specific settings
- Test migrations in development first
- Use migration scripts for consistency
- Document breaking changes
- Use semantic migration names

### ❌ Don'ts
- Don't create temporary design-time factories
- Don't hard-code connection strings in code
- Don't skip migration testing
- Don't apply untested migrations to production
- Don't delete migration files manually
- Don't mix different connection string formats

## 🔐 Security Considerations

- Never commit connection strings with real credentials
- Use environment variables for production secrets
- Enable SSL for production connections
- Use least-privilege database accounts
- Rotate database credentials regularly
- Audit migration applications

## 🏗️ Architecture Benefits

This approach provides:
- **Consistency**: Same process across all environments
- **Security**: No hardcoded credentials
- **Flexibility**: Multiple configuration sources
- **Maintainability**: Centralized migration logic
- **DevOps Friendly**: Easy CI/CD integration
- **Error Resilience**: Robust error handling 