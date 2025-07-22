#!/bin/bash

# Configuration variables
RESOURCE_GROUP="collaborative-notes"
LOCATION="eastus"
APP_NAME="collaborative-notes-api"
DB_SERVER_NAME="collaborative-notes-db"
STORAGE_ACCOUNT="collaborativenotesstorage$(date +%s | tail -c 6)"  # Add random suffix for uniqueness
STATIC_WEB_APP="collaborative-notes-web"
KEY_VAULT_NAME="collaborative-notes-kv$(date +%s | tail -c 6)"  # Add random suffix for uniqueness

# Database configuration
DB_ADMIN_USER="notesadmin"
DB_ADMIN_PASSWORD="SecurePassword123!"
DB_NAME="NotesApp"
JWT_SECRET="jwt-secret-$(openssl rand -hex 32)"

echo "🚀 Deploying Collaborative Notes to Azure..."
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Key Vault: $KEY_VAULT_NAME"

# 1. Create Resource Group
echo "📦 Creating Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Create Key Vault
echo "🔐 Creating Key Vault..."
az keyvault create \
  --name $KEY_VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --enabled-for-template-deployment true \
  --sku standard

# 3. Create PostgreSQL Database
echo "🗄️ Creating PostgreSQL Database..."
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password $DB_ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 14 \
  --public-access 0.0.0.0

az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name $DB_NAME

az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# 4. Create Storage Account
echo "💾 Creating Storage Account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

az storage container create \
  --name uploads \
  --account-name $STORAGE_ACCOUNT \
  --public-access blob

# 5. Store secrets in Key Vault
echo "🔑 Storing secrets in Key Vault..."
CONNECTION_STRING=$(az postgres flexible-server show-connection-string \
  --server-name $DB_SERVER_NAME \
  --database-name $DB_NAME \
  --admin-user $DB_ADMIN_USER \
  --admin-password $DB_ADMIN_PASSWORD \
  --query connectionStrings.dotnet_npgsql \
  --output tsv)

STORAGE_KEY=$(az storage account keys list \
  --resource-group $RESOURCE_GROUP \
  --account-name $STORAGE_ACCOUNT \
  --query '[0].value' \
  --output tsv)

STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=$STORAGE_ACCOUNT;AccountKey=$STORAGE_KEY;EndpointSuffix=core.windows.net"

az keyvault secret set --vault-name $KEY_VAULT_NAME --name "DatabaseConnectionString" --value "$CONNECTION_STRING"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "JwtSecretKey" --value "$JWT_SECRET"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "StorageConnectionString" --value "$STORAGE_CONNECTION_STRING"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "JwtIssuer" --value "NotesApp"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "JwtAudience" --value "NotesApp"

# 6. Create App Service
echo "🏗️ Creating App Service..."
az appservice plan create \
  --name "collaborative-notes-plan" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku B1 \
  --is-linux true

az webapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan "collaborative-notes-plan" \
  --runtime "DOTNETCORE:9.0"

# 7. Enable Managed Identity
echo "🆔 Enabling Managed Identity..."
az webapp identity assign --name $APP_NAME --resource-group $RESOURCE_GROUP

PRINCIPAL_ID=$(az webapp identity show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query principalId \
  --output tsv)

az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list

# 8. Create Static Web App
echo "🌐 Creating Static Web App..."
az staticwebapp create \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# 9. Configure App Service settings
echo "⚙️ Configuring App Service..."
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    ASPNETCORE_ENVIRONMENT="Production" \
    Azure__KeyVault__VaultUri="https://${KEY_VAULT_NAME}.vault.azure.net/" \
    ConnectionStrings__DefaultConnection="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=DatabaseConnectionString)" \
    JWT__SecretKey="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=JwtSecretKey)" \
    JWT__Issuer="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=JwtIssuer)" \
    JWT__Audience="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=JwtAudience)" \
    JWT__ExpiryHours="24" \
    Azure__StorageConnectionString="@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=StorageConnectionString)" \
    Azure__StorageContainerName="uploads" \
    Cors__AllowedOrigins__0="https://${STATIC_WEB_APP}.azurestaticapps.net"

az webapp config set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --web-sockets-enabled true

echo "✅ Infrastructure deployed!"
echo ""
echo "📋 Deployment Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Resource Group:     $RESOURCE_GROUP"
echo "Key Vault:          $KEY_VAULT_NAME"
echo "Backend API:        https://${APP_NAME}.azurewebsites.net"
echo "Frontend Web App:   https://${STATIC_WEB_APP}.azurestaticapps.net"
echo "Database Server:    ${DB_SERVER_NAME}.postgres.database.azure.com"
echo "Storage Account:    ${STORAGE_ACCOUNT}.blob.core.windows.net"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔧 Next Steps:"
echo "1. Deploy your backend code"
echo "2. Deploy your frontend code"
echo "3. Your app will be live!" 