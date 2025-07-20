using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace NotesApp.Data;

/// <summary>
/// Design-time factory for EF Core migrations and tooling.
/// This ensures migrations work consistently across different environments.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<NotesDbContext>
{
    public NotesDbContext CreateDbContext(string[] args)
    {
        // Build configuration from multiple sources
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: true)
            .AddJsonFile("appsettings.Production.json", optional: true, reloadOnChange: true)
            .AddEnvironmentVariables()
            .AddCommandLine(args) // Allow command-line overrides
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<NotesDbContext>();
        
        // Get connection string with fallback options
        var connectionString = GetConnectionString(configuration, args);
        
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                "Connection string not found. Ensure 'DefaultConnection' is configured in appsettings.json, " +
                "set the CONNECTION_STRING environment variable, or pass --connection as a command line argument.");
        }
        
        optionsBuilder.UseNpgsql(connectionString, options =>
        {
            options.MigrationsAssembly(typeof(NotesDbContext).Assembly.FullName);
            options.CommandTimeout(60); // Increase timeout for complex migrations
        });
        
        // Enable sensitive data logging in development
        if (IsDebugMode(configuration))
        {
            optionsBuilder.EnableSensitiveDataLogging();
            optionsBuilder.EnableDetailedErrors();
        }
        
        return new NotesDbContext(optionsBuilder.Options);
    }
    
    private static string? GetConnectionString(IConfiguration configuration, string[] args)
    {
        // Priority order: Command line args > Environment variable > Configuration
        
        // 1. Check command line arguments
        var connectionFromArgs = GetConnectionFromArgs(args);
        if (!string.IsNullOrEmpty(connectionFromArgs))
            return connectionFromArgs;
        
        // 2. Check environment variable
        var connectionFromEnv = Environment.GetEnvironmentVariable("CONNECTION_STRING");
        if (!string.IsNullOrEmpty(connectionFromEnv))
            return connectionFromEnv;
        
        // 3. Check configuration files
        return configuration.GetConnectionString("DefaultConnection");
    }
    
    private static string? GetConnectionFromArgs(string[] args)
    {
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i].Equals("--connection", StringComparison.OrdinalIgnoreCase))
            {
                return args[i + 1];
            }
        }
        return null;
    }
    
    private static bool IsDebugMode(IConfiguration configuration)
    {
        var environment = configuration["ASPNETCORE_ENVIRONMENT"] ?? 
                         Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? 
                         "Production";
        
        return environment.Equals("Development", StringComparison.OrdinalIgnoreCase);
    }
} 