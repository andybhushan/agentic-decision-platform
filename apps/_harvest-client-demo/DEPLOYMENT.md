# Deployment Guide

Complete guide for deploying the Agent Workflow Builder to production environments.

## 📋 Pre-Deployment Checklist

### Environment Setup
- [ ] Node.js 18+ installed on production server
- [ ] Environment variables configured
- [ ] SSL certificates obtained (for HTTPS)
- [ ] Domain name configured
- [ ] Firewall rules configured
- [ ] Monitoring tools set up

### Security
- [ ] API keys secured in environment variables
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] Security headers configured
- [ ] Dependencies audited (`npm audit`)

### Performance
- [ ] Production build tested
- [ ] Bundle size optimized
- [ ] Caching strategy implemented
- [ ] CDN configured (optional)
- [ ] Database indexes created (if using DB)

## 🚀 Deployment Options

### Option 1: Traditional Server Deployment

#### 1. Prepare the Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install -y nginx
```

#### 2. Clone and Build

```bash
# Clone repository
git clone <your-repo-url> /var/www/agent-workflow-builder
cd /var/www/agent-workflow-builder

# Install dependencies
npm install
cd frontend && npm install && npm run build
cd ../backend && npm install && npm run build

# Set up environment
cp .env.example .env
nano .env  # Edit with production values
```

#### 3. Configure PM2

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'agent-workflow-backend',
    script: './backend/dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

Start the application:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4. Configure Nginx

Create `/etc/nginx/sites-available/agent-workflow-builder`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/agent-workflow-builder/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/agent-workflow-builder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Set Up SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo systemctl reload nginx
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile for Backend

`backend/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

#### 2. Create Dockerfile for Frontend

`frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 3. Create docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - AI_PROVIDER=${AI_PROVIDER}
    volumes:
      - ./backend/data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: unless-stopped
    volumes:
      - ./ssl:/etc/nginx/ssl:ro

  # Optional: Add monitoring
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    restart: unless-stopped
```

#### 4. Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option 3: Cloud Platform Deployment

#### AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init -p node.js-18 agent-workflow-builder

# Create environment
eb create production

# Deploy
eb deploy

# Open application
eb open
```

#### Azure App Service

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login
az login

# Create resource group
az group create --name agent-workflow-rg --location eastus

# Create app service plan
az appservice plan create --name agent-workflow-plan --resource-group agent-workflow-rg --sku B1 --is-linux

# Create web app
az webapp create --resource-group agent-workflow-rg --plan agent-workflow-plan --name agent-workflow-app --runtime "NODE|18-lts"

# Deploy
az webapp deployment source config-zip --resource-group agent-workflow-rg --name agent-workflow-app --src deploy.zip
```

#### Google Cloud Platform

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Initialize
gcloud init

# Deploy backend
gcloud app deploy backend/app.yaml

# Deploy frontend
gcloud app deploy frontend/app.yaml
```

## 🔧 Production Configuration

### Environment Variables

Create `.env` file:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-domain.com

# AI Provider (choose one)
AI_PROVIDER=mock
# AI_PROVIDER=watsonx
# AI_PROVIDER=azure
# AI_PROVIDER=openai

# WatsonX Configuration (if using)
# WATSONX_API_KEY=your_api_key
# WATSONX_PROJECT_ID=your_project_id
# WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Azure OpenAI Configuration (if using)
# AZURE_OPENAI_KEY=your_api_key
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
# AZURE_OPENAI_DEPLOYMENT=your_deployment_name

# OpenAI Configuration (if using)
# OPENAI_API_KEY=your_api_key
# OPENAI_ORG_ID=your_org_id

# Security
SESSION_SECRET=your_random_secret_key_here
JWT_SECRET=your_jwt_secret_here

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Build Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "cd backend && npm run build",
    "build:frontend": "cd frontend && npm run build",
    "start:prod": "cd backend && node dist/server.js",
    "deploy": "npm run build && npm run start:prod"
  }
}
```

## 📊 Monitoring & Logging

### Application Monitoring

#### Using PM2

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart on high memory
pm2 start ecosystem.config.js --max-memory-restart 500M
```

#### Using Prometheus + Grafana

1. Add metrics endpoint to backend
2. Configure Prometheus scraping
3. Create Grafana dashboards

### Log Management

#### Centralized Logging with Winston

```typescript
// backend/src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

## 🔒 Security Best Practices

### 1. Environment Security
- Never commit `.env` files
- Use secrets management (AWS Secrets Manager, Azure Key Vault)
- Rotate API keys regularly
- Use strong, unique passwords

### 2. Application Security
- Enable HTTPS only
- Implement rate limiting
- Sanitize user inputs
- Use security headers
- Keep dependencies updated

### 3. Network Security
- Configure firewall rules
- Use VPC/private networks
- Implement DDoS protection
- Enable WAF (Web Application Firewall)

## 🧪 Testing Production Build

```bash
# Build for production
npm run build

# Test backend
cd backend
NODE_ENV=production node dist/server.js

# Test frontend (serve static files)
cd frontend
npx serve -s dist -p 5173

# Run smoke tests
npm run test:e2e
```

## 📈 Performance Optimization

### Frontend Optimization
- Enable gzip compression
- Implement code splitting
- Use CDN for static assets
- Enable browser caching
- Optimize images

### Backend Optimization
- Enable response compression
- Implement caching (Redis)
- Use connection pooling
- Optimize database queries
- Enable clustering

## 🔄 CI/CD Pipeline

### GitHub Actions Example

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/agent-workflow-builder
            git pull
            npm install
            npm run build
            pm2 restart all
```

## 🆘 Troubleshooting

### Common Issues

**Issue: Application won't start**
```bash
# Check logs
pm2 logs
# Check port availability
sudo lsof -i :3000
```

**Issue: High memory usage**
```bash
# Restart with memory limit
pm2 restart app --max-memory-restart 500M
```

**Issue: Slow response times**
```bash
# Check system resources
htop
# Check application metrics
pm2 monit
```

## 📞 Support

For deployment issues:
- Check logs: `pm2 logs` or `docker-compose logs`
- Review health check: `curl http://localhost:3000/health`
- Contact DevOps team
- Create GitHub issue

---

**Last Updated: 2026-05-13**