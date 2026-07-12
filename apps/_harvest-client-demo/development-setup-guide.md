# Development Setup Guide

Complete guide to setting up the Agent Workflow Builder development environment.

---

## Prerequisites

### Required Software

- **Node.js**: Version 20.x or higher
  - Download: https://nodejs.org/
  - Verify: `node --version`

- **npm or pnpm**: Package manager
  - npm comes with Node.js
  - pnpm (recommended): `npm install -g pnpm`
  - Verify: `npm --version` or `pnpm --version`

- **Git**: Version control
  - Download: https://git-scm.com/
  - Verify: `git --version`

- **VS Code** (recommended): Code editor
  - Download: https://code.visualstudio.com/
  - Extensions:
    - ESLint
    - Prettier
    - TypeScript and JavaScript Language Features
    - Carbon Components (if available)

### Optional Software

- **Docker**: For containerized development
- **Postman**: For API testing
- **MongoDB Compass**: If using MongoDB later

---

## Project Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone <repository-url>
cd agent-workflow-builder

# Or create new project
mkdir agent-workflow-builder
cd agent-workflow-builder
git init
```

### 2. Project Structure Setup

```bash
# Create project structure
mkdir -p frontend/src/{components,contexts,hooks,services,types,utils}
mkdir -p backend/src/{routes,services,models,utils,config}
mkdir -p data/{verticals,agents,workflows}
mkdir -p docs

# Initialize package.json for monorepo
npm init -y
```

### 3. Install Dependencies

#### Root Package (Monorepo Setup)

```bash
# Install workspace tools
npm install -D typescript @types/node
npm install -D eslint prettier
npm install -D concurrently
```

**package.json** (root):
```json
{
  "name": "agent-workflow-builder",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "frontend",
    "backend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && npm run dev",
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\""
  }
}
```

#### Frontend Setup

```bash
cd frontend

# Initialize Vite + React + TypeScript
npm create vite@latest . -- --template react-ts

# Install IBM Carbon Design System
npm install @carbon/react @carbon/styles

# Install additional dependencies
npm install react-router-dom
npm install mermaid
npm install @monaco-editor/react
npm install zustand  # State management (alternative to Context)
npm install zod      # Schema validation
npm install axios    # HTTP client

# Install dev dependencies
npm install -D @types/react @types/react-dom
npm install -D @vitejs/plugin-react
npm install -D eslint-plugin-react
```

**vite.config.ts**:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

#### Backend Setup

```bash
cd ../backend

# Initialize package.json
npm init -y

# Install Express and TypeScript
npm install express cors dotenv
npm install @types/express @types/cors @types/node

# Install additional dependencies
npm install zod          # Schema validation
npm install winston      # Logging

# Install dev dependencies
npm install -D typescript ts-node nodemon
npm install -D @types/express @types/cors @types/node
```

**tsconfig.json** (backend):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**package.json** (backend):
```json
{
  "name": "agent-workflow-builder-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src --ext .ts"
  }
}
```

---

## Configuration Files

### ESLint Configuration

**.eslintrc.json** (root):
```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["@typescript-eslint", "react"],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-explicit-any": "warn"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### Prettier Configuration

**.prettierrc** (root):
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### Environment Variables

**.env.example** (root):
```bash
# Application
NODE_ENV=development
PORT=3000

# AI Provider Configuration
AI_PROVIDER=mock

# WatsonX (if using)
WATSONX_API_KEY=
WATSONX_ENDPOINT=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=
WATSONX_MODEL=ibm/granite-13b-chat-v2

# Azure OpenAI (if using)
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# OpenAI (if using)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4
OPENAI_ORGANIZATION=

# CORS
CORS_ORIGIN=http://localhost:5173
```

**.gitignore**:
```
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
dist/
build/

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
logs/
*.log

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Misc
.cache/
```

---

## Initial Code Setup

### Backend Server

**backend/src/server.ts**:
```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api/v1/verticals', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'claims',
        name: 'Claims',
        description: 'Insurance claims processing',
        icon: '🏥',
        agentCount: 7,
        workflowCount: 3
      }
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
```

### Frontend App

**frontend/src/main.tsx**:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@carbon/styles/css/styles.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**frontend/src/App.tsx**:
```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Content, Theme } from '@carbon/react';
import HomePage from './pages/HomePage';

function App() {
  return (
    <Theme theme="g100">
      <Router>
        <Content>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </Content>
      </Router>
    </Theme>
  );
}

export default App;
```

**frontend/src/pages/HomePage.tsx**:
```typescript
import { Tile, Grid, Column } from '@carbon/react';

function HomePage() {
  return (
    <Grid>
      <Column lg={16}>
        <h1>Agent Workflow Builder</h1>
        <p>Select an industry vertical to get started</p>
      </Column>
      <Column lg={5}>
        <Tile>
          <h3>Claims 🏥</h3>
          <p>Insurance claims processing</p>
          <p>7 agents available</p>
        </Tile>
      </Column>
    </Grid>
  );
}

export default HomePage;
```

---

## Running the Application

### Development Mode

```bash
# From root directory
npm run dev

# Or run separately
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Health Check: http://localhost:3000/health

### Production Build

```bash
# Build both frontend and backend
npm run build

# Run production server
cd backend
npm start
```

---

## VS Code Setup

### Recommended Extensions

Install these extensions in VS Code:

1. **ESLint** (dbaeumer.vscode-eslint)
2. **Prettier** (esbenp.prettier-vscode)
3. **TypeScript and JavaScript Language Features** (built-in)
4. **ES7+ React/Redux/React-Native snippets** (dsznajder.es7-react-js-snippets)
5. **Path Intellisense** (christian-kohler.path-intellisense)
6. **Auto Rename Tag** (formulahendry.auto-rename-tag)
7. **GitLens** (eamodio.gitlens)

### VS Code Settings

**.vscode/settings.json**:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### VS Code Launch Configuration

**.vscode/launch.json**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal"
    }
  ]
}
```

---

## Testing Setup

### Frontend Testing

```bash
cd frontend

# Install testing libraries
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event jsdom
```

**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

### Backend Testing

```bash
cd backend

# Install testing libraries
npm install -D jest @types/jest ts-jest supertest @types/supertest
```

**jest.config.js**:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
```

---

## AI Provider Setup

### Using Mock Provider (Default)

No setup required - works out of the box for development.

### Using IBM watsonx.ai

1. **Get API Key:**
   - Go to https://cloud.ibm.com/iam/apikeys
   - Create new API key
   - Copy the key

2. **Get Project ID:**
   - Go to watsonx.ai project
   - Copy project ID from settings

3. **Configure:**
   ```bash
   # In .env file
   AI_PROVIDER=watsonx
   WATSONX_API_KEY=your-api-key
   WATSONX_PROJECT_ID=your-project-id
   ```

### Using Azure OpenAI

1. **Create Azure OpenAI Resource:**
   - Go to Azure Portal
   - Create OpenAI resource
   - Deploy a model (e.g., gpt-4)

2. **Get Credentials:**
   - Go to resource → Keys and Endpoint
   - Copy key and endpoint
   - Note deployment name

3. **Configure:**
   ```bash
   # In .env file
   AI_PROVIDER=azure
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_ENDPOINT=your-endpoint
   AZURE_OPENAI_DEPLOYMENT=your-deployment-name
   ```

### Using OpenAI

1. **Get API Key:**
   - Go to https://platform.openai.com/api-keys
   - Create new API key
   - Copy the key

2. **Configure:**
   ```bash
   # In .env file
   AI_PROVIDER=openai
   OPENAI_API_KEY=your-api-key
   OPENAI_MODEL=gpt-4
   ```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

#### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript Errors

```bash
# Rebuild TypeScript
npm run build

# Check TypeScript version
npx tsc --version
```

#### CORS Issues

Ensure backend CORS is configured correctly:
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
```

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/agent-catalog
```

### 2. Make Changes

- Write code
- Test locally
- Run linter: `npm run lint`
- Format code: `npm run format`

### 3. Commit Changes

```bash
git add .
git commit -m "feat: add agent catalog component"
```

### 4. Push and Create PR

```bash
git push origin feature/agent-catalog
```

---

## Next Steps

After setup is complete:

1. ✅ Verify all services are running
2. ✅ Test API endpoints with Postman
3. ✅ Create sample data files
4. ✅ Implement first component
5. ✅ Set up CI/CD pipeline (optional)

---

## Useful Commands

```bash
# Install dependencies
npm install

# Run development servers
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Format code
npm run format

# Run tests
npm test

# Check for outdated packages
npm outdated

# Update packages
npm update
```

---

## Resources

- **IBM Carbon Design**: https://carbondesignsystem.com/
- **React Documentation**: https://react.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Vite Guide**: https://vitejs.dev/guide/
- **Express.js**: https://expressjs.com/
- **Mermaid.js**: https://mermaid.js.org/

---

*Last Updated: 2026-05-13*