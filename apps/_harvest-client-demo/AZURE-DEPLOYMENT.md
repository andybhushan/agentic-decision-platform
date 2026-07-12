# Azure Deployment Guide - GitHub Status Reporter

## Overview

This guide covers deploying the GitHub Status Reporter application to Azure, consisting of:
- **Backend API** (Node.js/Express) → Azure App Service
- **Frontend Dashboard** (React/Vite) → Azure Static Web Apps or App Service
- **Environment Configuration** → Azure Key Vault (optional)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Azure Cloud                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │  Static Web App      │      │   App Service        │    │
│  │  (Frontend)          │─────▶│   (Backend API)      │    │
│  │  Port: 443 (HTTPS)   │      │   Port: 443 (HTTPS)  │    │
│  └──────────────────────┘      └──────────────────────┘    │
│           │                              │                   │
│           │                              │                   │
│           │                              ▼                   │
│           │                     ┌──────────────────┐        │
│           │                     │  Key Vault       │        │
│           │                     │  (Secrets)       │        │
│           │                     └──────────────────┘        │
│           │                                                  │
│           └──────────────────────┬───────────────────────┘  │
│                                  │                           │
└──────────────────────────────────┼───────────────────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │   GitHub API     │
                          └──────────────────┘
```

## Prerequisites

1. **Azure Account** with active subscription
2. **Azure CLI** installed: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
3. **GitHub Personal Access Token** (already configured in `.env`)
4. **Node.js 18+** and npm installed

## Deployment Options

### Option 1: Azure Static Web Apps + App Service (Recommended)
- **Frontend**: Azure Static Web Apps (free tier available)
- **Backend**: Azure App Service (Basic B1 or higher)
- **Best for**: Production deployments with custom domains

### Option 2: Two App Services
- **Frontend**: Azure App Service
- **Backend**: Azure App Service
- **Best for**: Enterprise environments with existing App Service plans

### Option 3: Azure Container Instances
- **Both**: Containerized deployment
- **Best for**: Microservices architecture or Kubernetes migration path

## Option 1: Static Web Apps + App Service (Recommended)

### Step 1: Prepare the Application

#### 1.1 Update Frontend Configuration

Create production environment file:

```bash
# github-status-reporter/.env.production
VITE_API_URL=https://your-api-name.azurewebsites.net
```

#### 1.2 Update Backend for Production

Modify `github-status-reporter-api/src/server.ts`:

```typescript
// Add after existing imports
const allowedOrigins = [
  process.env.GITHUB_REPORTER_CORS_ORIGIN,
  'https://your-static-web-app.azurestaticapps.net',
  'https://your-custom-domain.com'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
```

### Step 2: Deploy Backend API to Azure App Service

#### 2.1 Login to Azure

```bash
az login
```

#### 2.2 Create Resource Group

```bash
az group create \
  --name github-reporter-rg \
  --location eastus
```

#### 2.3 Create App Service Plan

```bash
az appservice plan create \
  --name github-reporter-plan \
  --resource-group github-reporter-rg \
  --sku B1 \
  --is-linux
```

#### 2.4 Create Web App

```bash
az webapp create \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --plan github-reporter-plan \
  --runtime "NODE:18-lts"
```

#### 2.5 Configure Environment Variables

```bash
az webapp config appsettings set \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --settings \
    NODE_ENV=production \
    GITHUB_TOKEN="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" \
    GITHUB_PROJECT_OWNER="IBM-Project-Imagine" \
    GITHUB_PROJECT_NUMBER="1" \
    GITHUB_REPORTER_PORT="8080" \
    GITHUB_REPORTER_CORS_ORIGIN="https://your-static-web-app.azurestaticapps.net"
```

#### 2.6 Deploy Backend Code

```bash
cd github-status-reporter-api

# Build the application
npm install
npm run build

# Create deployment package
zip -r deploy.zip . -x "node_modules/*" -x ".git/*"

# Deploy to Azure
az webapp deployment source config-zip \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --src deploy.zip
```

#### 2.7 Verify Backend Deployment

```bash
# Check deployment status
az webapp show \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --query "defaultHostName" -o tsv

# Test the API
curl https://github-reporter-api.azurewebsites.net/health
```

### Step 3: Deploy Frontend to Azure Static Web Apps

#### 3.1 Build Frontend

```bash
cd github-status-reporter

# Update API URL in .env.production
echo "VITE_API_URL=https://github-reporter-api.azurewebsites.net" > .env.production

# Build for production
npm install
npm run build
```

#### 3.2 Create Static Web App

```bash
az staticwebapp create \
  --name github-reporter-dashboard \
  --resource-group github-reporter-rg \
  --location eastus2 \
  --source . \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --login-with-github
```

#### 3.3 Deploy Static Content

```bash
# Install Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist \
  --app-name github-reporter-dashboard \
  --resource-group github-reporter-rg \
  --env production
```

#### 3.4 Configure Custom Domain (Optional)

```bash
# Add custom domain
az staticwebapp hostname set \
  --name github-reporter-dashboard \
  --resource-group github-reporter-rg \
  --hostname reports.yourdomain.com
```

### Step 4: Configure CORS and Security

#### 4.1 Update Backend CORS

```bash
# Update CORS origin to match Static Web App URL
az webapp config appsettings set \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --settings \
    GITHUB_REPORTER_CORS_ORIGIN="https://github-reporter-dashboard.azurestaticapps.net"
```

#### 4.2 Enable HTTPS Only

```bash
az webapp update \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --https-only true
```

## Option 2: Using Azure Key Vault for Secrets

### Step 1: Create Key Vault

```bash
az keyvault create \
  --name github-reporter-kv \
  --resource-group github-reporter-rg \
  --location eastus
```

### Step 2: Store Secrets

```bash
az keyvault secret set \
  --vault-name github-reporter-kv \
  --name github-token \
  --value "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"
```

### Step 3: Grant App Service Access

```bash
# Enable managed identity
az webapp identity assign \
  --name github-reporter-api \
  --resource-group github-reporter-rg

# Get the principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --query principalId -o tsv)

# Grant access to Key Vault
az keyvault set-policy \
  --name github-reporter-kv \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

### Step 4: Update App Settings to Use Key Vault

```bash
az webapp config appsettings set \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --settings \
    GITHUB_TOKEN="@Microsoft.KeyVault(SecretUri=https://github-reporter-kv.vault.azure.net/secrets/github-token/)"
```

## Continuous Deployment with GitHub Actions

### Step 1: Create GitHub Actions Workflow

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [ main ]
  workflow_dispatch:

env:
  AZURE_WEBAPP_NAME: github-reporter-api
  NODE_VERSION: '18.x'

jobs:
  build-and-deploy-backend:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
    
    - name: Install dependencies
      run: |
        cd github-status-reporter-api
        npm ci
    
    - name: Build
      run: |
        cd github-status-reporter-api
        npm run build
    
    - name: Deploy to Azure Web App
      uses: azure/webapps-deploy@v2
      with:
        app-name: ${{ env.AZURE_WEBAPP_NAME }}
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: github-status-reporter-api

  build-and-deploy-frontend:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
    
    - name: Install and build
      run: |
        cd github-status-reporter
        npm ci
        npm run build
      env:
        VITE_API_URL: https://github-reporter-api.azurewebsites.net
    
    - name: Deploy to Static Web App
      uses: Azure/static-web-apps-deploy@v1
      with:
        azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        action: "upload"
        app_location: "github-status-reporter"
        output_location: "dist"
```

### Step 2: Configure GitHub Secrets

1. Get Azure publish profile:
```bash
az webapp deployment list-publishing-profiles \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --xml
```

2. Add to GitHub Secrets:
   - `AZURE_WEBAPP_PUBLISH_PROFILE` - Output from above command
   - `AZURE_STATIC_WEB_APPS_API_TOKEN` - From Static Web App deployment token

## Monitoring and Logging

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app github-reporter-insights \
  --location eastus \
  --resource-group github-reporter-rg

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app github-reporter-insights \
  --resource-group github-reporter-rg \
  --query instrumentationKey -o tsv)

# Configure App Service
az webapp config appsettings set \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY="$INSTRUMENTATION_KEY"
```

### View Logs

```bash
# Stream logs
az webapp log tail \
  --name github-reporter-api \
  --resource-group github-reporter-rg

# Download logs
az webapp log download \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --log-file logs.zip
```

## Scaling Configuration

### Auto-scaling Rules

```bash
# Create autoscale setting
az monitor autoscale create \
  --resource-group github-reporter-rg \
  --resource github-reporter-api \
  --resource-type Microsoft.Web/serverfarms \
  --name autoscale-rules \
  --min-count 1 \
  --max-count 3 \
  --count 1

# Add scale-out rule (CPU > 70%)
az monitor autoscale rule create \
  --resource-group github-reporter-rg \
  --autoscale-name autoscale-rules \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 1

# Add scale-in rule (CPU < 30%)
az monitor autoscale rule create \
  --resource-group github-reporter-rg \
  --autoscale-name autoscale-rules \
  --condition "Percentage CPU < 30 avg 5m" \
  --scale in 1
```

## Cost Optimization

### Recommended Tiers

**Development/Testing:**
- App Service: Free (F1) or Shared (D1)
- Static Web Apps: Free tier
- **Estimated Cost**: $0-10/month

**Production:**
- App Service: Basic (B1) - $13/month
- Static Web Apps: Standard - $9/month
- Application Insights: Pay-as-you-go
- **Estimated Cost**: $25-50/month

### Cost-Saving Tips

1. **Use deployment slots** for staging instead of separate environments
2. **Enable auto-shutdown** for non-production environments
3. **Use Azure Reserved Instances** for 1-3 year commitments (up to 72% savings)
4. **Monitor with Azure Cost Management**

```bash
# Stop app service during off-hours
az webapp stop \
  --name github-reporter-api \
  --resource-group github-reporter-rg

# Start when needed
az webapp start \
  --name github-reporter-api \
  --resource-group github-reporter-rg
```

## Troubleshooting

### Common Issues

**1. CORS Errors**
```bash
# Check CORS settings
az webapp cors show \
  --name github-reporter-api \
  --resource-group github-reporter-rg

# Add allowed origin
az webapp cors add \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --allowed-origins "https://your-frontend-url.azurestaticapps.net"
```

**2. Environment Variables Not Loading**
```bash
# Verify settings
az webapp config appsettings list \
  --name github-reporter-api \
  --resource-group github-reporter-rg
```

**3. Build Failures**
```bash
# Check build logs
az webapp log deployment show \
  --name github-reporter-api \
  --resource-group github-reporter-rg
```

**4. API Not Responding**
```bash
# Check app service status
az webapp show \
  --name github-reporter-api \
  --resource-group github-reporter-rg \
  --query "state"

# Restart if needed
az webapp restart \
  --name github-reporter-api \
  --resource-group github-reporter-rg
```

## Security Best Practices

1. **Use Managed Identities** instead of storing credentials
2. **Enable HTTPS only** for all services
3. **Store secrets in Key Vault** not in app settings
4. **Implement rate limiting** in the API
5. **Use Azure Front Door** for DDoS protection
6. **Enable diagnostic logging** for security monitoring
7. **Rotate GitHub tokens** regularly

## Backup and Disaster Recovery

### Backup Configuration

```bash
# Enable backup
az webapp config backup create \
  --resource-group github-reporter-rg \
  --webapp-name github-reporter-api \
  --backup-name daily-backup \
  --container-url "https://yourstorageaccount.blob.core.windows.net/backups?[SAS-token]"
```

### Restore from Backup

```bash
az webapp config backup restore \
  --resource-group github-reporter-rg \
  --webapp-name github-reporter-api \
  --backup-name daily-backup \
  --container-url "https://yourstorageaccount.blob.core.windows.net/backups?[SAS-token]"
```

## Production Checklist

- [ ] Environment variables configured in Azure
- [ ] CORS settings updated for production URLs
- [ ] HTTPS enforced on all services
- [ ] Application Insights enabled
- [ ] Auto-scaling rules configured
- [ ] Backup strategy implemented
- [ ] Custom domain configured (if needed)
- [ ] GitHub Actions workflow tested
- [ ] Monitoring alerts set up
- [ ] Cost alerts configured
- [ ] Security scan completed
- [ ] Load testing performed

## Useful Commands Reference

```bash
# View all resources
az resource list --resource-group github-reporter-rg --output table

# Get app service URL
az webapp show --name github-reporter-api --resource-group github-reporter-rg --query "defaultHostName" -o tsv

# View deployment history
az webapp deployment list --name github-reporter-api --resource-group github-reporter-rg

# Delete all resources (cleanup)
az group delete --name github-reporter-rg --yes --no-wait
```

## Support and Resources

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
- [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)