# Use the official .NET 9 SDK image for building
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

# Set the working directory
WORKDIR /app

# Copy the project file and restore dependencies
COPY NotesApp.csproj ./
RUN dotnet restore NotesApp.csproj

# Copy the source code
COPY . ./

# Build the application
RUN dotnet publish NotesApp.csproj -c Release -o /app/publish

# Use the official .NET 9 runtime image for the final stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime

# Set the working directory
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd -r notesapp && useradd -r -g notesapp notesapp

# Create directories and set permissions
RUN mkdir -p /app/logs && chown -R notesapp:notesapp /app

# Copy the published application from the build stage
COPY --from=build /app/publish .

# Change ownership to the non-root user
RUN chown -R notesapp:notesapp /app

# Switch to the non-root user
USER notesapp

# Expose the port
EXPOSE 80
EXPOSE 443

# Set the entry point
ENTRYPOINT ["dotnet", "NotesApp.dll"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1 