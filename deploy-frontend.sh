#!/bin/bash

echo "🌐 Deploying Frontend to Azure Static Web Apps..."

# Navigate to frontend directory  
cd frontend

# Create production environment file
echo "⚙️ Setting up production environment..."
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://collaborative-notes-api.azurewebsites.net
NEXT_PUBLIC_SIGNALR_URL=https://collaborative-notes-api.azurewebsites.net/hubs/collaboration
EOF

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build for production
echo "🔨 Building for production..."
npm run build

# Get deployment token from Azure
echo "🔑 Getting deployment token..."
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name collaborative-notes-web \
  --resource-group collaborative-notes \
  --query properties.apiKey \
  --output tsv)

# Install SWA CLI if not installed
echo "📦 Installing Static Web Apps CLI..."
npm install -g @azure/static-web-apps-cli

# Deploy to Static Web Apps
echo "🚀 Deploying to Static Web Apps..."
npx @azure/static-web-apps-cli deploy \
  --deployment-token $DEPLOYMENT_TOKEN \
  --app-location "." \
  --output-location "out"

echo "✅ Frontend deployment completed!"
echo "🌐 Frontend URL: https://collaborative-notes-web.azurestaticapps.net" 