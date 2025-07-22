#!/bin/bash

echo "🚀 Deploying Backend to Azure App Service..."

# Navigate to backend directory
cd backend

# Add Azure packages (if not already added)
echo "📦 Adding Azure packages..."
dotnet add package Azure.Extensions.AspNetCore.Configuration.Secrets --version 1.3.2
dotnet add package Azure.Identity --version 1.13.1  
dotnet add package Azure.Storage.Blobs --version 12.22.2

# Build and publish
echo "🔨 Building and publishing..."
dotnet publish -c Release -o ./publish

# Create deployment package
echo "📦 Creating deployment package..."
cd publish
zip -r ../backend-deploy.zip .
cd ..

# Deploy to Azure App Service
echo "🚀 Deploying to App Service..."
az webapp deployment source config-zip \
  --resource-group collaborative-notes \
  --name collaborative-notes-api \
  --src backend-deploy.zip

# Check deployment logs
echo "📋 Checking deployment status..."
az webapp log show \
  --name collaborative-notes-api \
  --resource-group collaborative-notes

echo "✅ Backend deployment completed!"
echo "🌐 Backend URL: https://collaborative-notes-api.azurewebsites.net"
echo "📚 API Docs: https://collaborative-notes-api.azurewebsites.net/swagger" 