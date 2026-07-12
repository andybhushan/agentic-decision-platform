# Testing Guide

Comprehensive testing strategy and guidelines for the Agent Workflow Builder.

## 📋 Testing Overview

### Testing Pyramid
```
        /\
       /  \      E2E Tests (10%)
      /____\
     /      \    Integration Tests (30%)
    /________\
   /          \  Unit Tests (60%)
  /____________\
```

## 🧪 Test Types

### 1. Unit Tests
Test individual components and functions in isolation.

### 2. Integration Tests
Test interactions between components and services.

### 3. End-to-End Tests
Test complete user workflows through the UI.

### 4. API Tests
Test backend endpoints and data flow.

## 🚀 Running Tests

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- AgentCatalogPage.test.tsx
```

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test suite
npm test -- agentService.test.ts
```

### E2E Tests

```bash
# Install Playwright
npm install -D @playwright/test

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium
```

## 📝 Writing Tests

### Frontend Component Tests (React Testing Library)

```typescript
// frontend/src/pages/__tests__/AgentCatalogPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AgentCatalogPage } from '../AgentCatalogPage';
import { api } from '../../services/api';

jest.mock('../../services/api');

describe('AgentCatalogPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders agent catalog page', async () => {
    const mockAgents = [
      {
        id: 'agent_1',
        name: 'Test Agent',
        description: 'Test description',
        archetype: 'Analyst',
        authorityLevel: 'Low',
      },
    ];

    (api.getAgents as jest.Mock).mockResolvedValue(mockAgents);
    (api.getVerticals as jest.Mock).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <AgentCatalogPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Agent')).toBeInTheDocument();
    });
  });

  it('filters agents by search term', async () => {
    const user = userEvent.setup();
    
    render(
      <BrowserRouter>
        <AgentCatalogPage />
      </BrowserRouter>
    );

    const searchInput = screen.getByPlaceholderText('Search agents...');
    await user.type(searchInput, 'fraud');

    await waitFor(() => {
      expect(api.getAgents).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'fraud' })
      );
    });
  });

  it('navigates to agent builder on create button click', async () => {
    const user = userEvent.setup();
    
    render(
      <BrowserRouter>
        <AgentCatalogPage />
      </BrowserRouter>
    );

    const createButton = screen.getByText('Create New Agent');
    await user.click(createButton);

    expect(window.location.pathname).toBe('/agents/new');
  });
});
```

### Backend Service Tests (Jest)

```typescript
// backend/src/services/__tests__/agentService.test.ts
import { AgentService } from '../agentService';
import fs from 'fs/promises';

jest.mock('fs/promises');

describe('AgentService', () => {
  let agentService: AgentService;

  beforeEach(() => {
    agentService = new AgentService();
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all agents', async () => {
      const mockAgents = [
        { id: 'agent_1', name: 'Agent 1' },
        { id: 'agent_2', name: 'Agent 2' },
      ];

      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockAgents)
      );

      const agents = await agentService.getAll();

      expect(agents).toEqual(mockAgents);
      expect(agents).toHaveLength(2);
    });

    it('filters agents by verticalId', async () => {
      const mockAgents = [
        { id: 'agent_1', verticalId: 'claims', name: 'Agent 1' },
        { id: 'agent_2', verticalId: 'healthcare', name: 'Agent 2' },
      ];

      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify(mockAgents)
      );

      const agents = await agentService.getAll({ verticalId: 'claims' });

      expect(agents).toHaveLength(1);
      expect(agents[0].verticalId).toBe('claims');
    });
  });

  describe('create', () => {
    it('creates a new agent', async () => {
      const newAgent = {
        name: 'New Agent',
        verticalId: 'claims',
        archetype: 'Analyst',
        authorityLevel: 'Low',
      };

      (fs.readFile as jest.Mock).mockResolvedValue('[]');
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const created = await agentService.create(newAgent);

      expect(created).toMatchObject(newAgent);
      expect(created.id).toBeDefined();
      expect(created.createdAt).toBeDefined();
    });
  });

  describe('update', () => {
    it('updates an existing agent', async () => {
      const existingAgent = {
        id: 'agent_1',
        name: 'Old Name',
        verticalId: 'claims',
      };

      (fs.readFile as jest.Mock).mockResolvedValue(
        JSON.stringify([existingAgent])
      );
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const updated = await agentService.update('agent_1', {
        name: 'New Name',
      });

      expect(updated?.name).toBe('New Name');
      expect(updated?.updatedAt).toBeDefined();
    });

    it('returns null for non-existent agent', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('[]');

      const updated = await agentService.update('non_existent', {
        name: 'New Name',
      });

      expect(updated).toBeNull();
    });
  });
});
```

### API Integration Tests (Supertest)

```typescript
// backend/src/__tests__/api.test.ts
import request from 'supertest';
import express from 'express';
import agentRoutes from '../routes/agentRoutes';

const app = express();
app.use(express.json());
app.use('/api/v1/agents', agentRoutes);

describe('Agent API', () => {
  describe('GET /api/v1/agents', () => {
    it('returns list of agents', async () => {
      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('filters agents by vertical', async () => {
      const response = await request(app)
        .get('/api/v1/agents?verticalId=claims')
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((agent: any) => {
        expect(agent.verticalId).toBe('claims');
      });
    });
  });

  describe('POST /api/v1/agents', () => {
    it('creates a new agent', async () => {
      const newAgent = {
        name: 'Test Agent',
        description: 'Test description',
        verticalId: 'claims',
        archetype: 'Analyst',
        authorityLevel: 'Low',
        inputs: [],
        outputs: [],
        governanceControls: [],
        capabilities: [],
        limitations: [],
        version: '1.0.0',
      };

      const response = await request(app)
        .post('/api/v1/agents')
        .send(newAgent)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Agent');
      expect(response.body.data.id).toBeDefined();
    });

    it('validates required fields', async () => {
      const invalidAgent = {
        name: 'Test Agent',
        // missing required fields
      };

      const response = await request(app)
        .post('/api/v1/agents')
        .send(invalidAgent)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/agent-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Agent Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('complete agent creation workflow', async ({ page }) => {
    // Navigate to agent catalog
    await page.click('text=Agents');
    await expect(page).toHaveURL(/.*agents/);

    // Click create new agent
    await page.click('text=Create New Agent');
    await expect(page).toHaveURL(/.*agents\/new/);

    // Fill in basic info
    await page.fill('input[name="name"]', 'E2E Test Agent');
    await page.fill('textarea[name="description"]', 'Created by E2E test');
    
    // Select vertical
    await page.click('#vertical-select');
    await page.click('text=Claims Processing');

    // Add input
    await page.click('text=Add Input');
    await page.fill('input[name="inputs[0].name"]', 'testInput');
    
    // Add output
    await page.click('text=Add Output');
    await page.fill('input[name="outputs[0].name"]', 'testOutput');

    // Save agent
    await page.click('text=Save Agent');

    // Verify success
    await expect(page.locator('text=Agent created successfully')).toBeVisible();
    await expect(page).toHaveURL(/.*agents/);
  });

  test('simulate agent execution', async ({ page }) => {
    // Navigate to simulator
    await page.click('text=Simulator');
    await expect(page).toHaveURL(/.*simulator/);

    // Select an agent
    await page.click('#agent-select');
    await page.click('text=Claims Intake Agent');

    // Enter test input
    await page.fill('textarea[name="input"]', JSON.stringify({
      claimNumber: 'TEST-001',
      amount: 5000
    }));

    // Run simulation
    await page.click('text=Run Simulation');

    // Wait for results
    await expect(page.locator('text=Confidence')).toBeVisible({ timeout: 10000 });
    
    // Verify output is displayed
    await expect(page.locator('text=Output')).toBeVisible();
  });

  test('view workflow diagram', async ({ page }) => {
    // Navigate to workflows
    await page.click('text=Workflows');
    await expect(page).toHaveURL(/.*workflows/);

    // Click on a workflow
    await page.click('text=Standard Claims Processing');

    // Verify diagram is displayed
    await expect(page.locator('.mermaid-diagram')).toBeVisible();
    
    // Check for workflow details
    await expect(page.locator('text=Diagram')).toBeVisible();
    await expect(page.locator('text=Details')).toBeVisible();
    await expect(page.locator('text=Agents')).toBeVisible();
  });
});
```

## 🎯 Test Coverage Goals

### Minimum Coverage Targets
- **Unit Tests**: 80% coverage
- **Integration Tests**: 70% coverage
- **E2E Tests**: Critical user paths

### Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

## 🔍 Testing Best Practices

### 1. Test Structure (AAA Pattern)
```typescript
test('should do something', () => {
  // Arrange - Set up test data
  const input = { value: 10 };
  
  // Act - Execute the code
  const result = myFunction(input);
  
  // Assert - Verify the result
  expect(result).toBe(20);
});
```

### 2. Test Isolation
- Each test should be independent
- Use `beforeEach` to reset state
- Mock external dependencies
- Clean up after tests

### 3. Descriptive Test Names
```typescript
// Good
test('returns error when agent ID is invalid', () => {});

// Bad
test('test1', () => {});
```

### 4. Test Edge Cases
- Empty inputs
- Null/undefined values
- Boundary conditions
- Error scenarios

### 5. Mock External Dependencies
```typescript
jest.mock('../services/api', () => ({
  api: {
    getAgents: jest.fn(),
    createAgent: jest.fn(),
  },
}));
```

## 🐛 Debugging Tests

### Frontend Tests
```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Use Chrome DevTools
chrome://inspect
```

### Backend Tests
```bash
# Run with debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Add breakpoints in code
debugger;
```

### E2E Tests
```bash
# Run in headed mode
npx playwright test --headed

# Run with debug mode
npx playwright test --debug

# Generate trace
npx playwright test --trace on
```

## 📊 Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run frontend tests
        run: cd frontend && npm test -- --coverage
      
      - name: Run backend tests
        run: cd backend && npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/lcov.info,./backend/coverage/lcov.info
      
      - name: Run E2E tests
        run: |
          npm run build
          npm run start:test &
          npx playwright test
```

## 🔧 Test Utilities

### Custom Test Helpers

```typescript
// frontend/src/test-utils.tsx
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

export function renderWithRouter(ui: React.ReactElement) {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
}

export const mockAgent = {
  id: 'test_agent',
  name: 'Test Agent',
  description: 'Test description',
  verticalId: 'claims',
  archetype: 'Analyst',
  authorityLevel: 'Low',
  inputs: [],
  outputs: [],
  governanceControls: [],
  capabilities: [],
  limitations: [],
  version: '1.0.0',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};
```

## 📈 Performance Testing

### Load Testing with Artillery

```yaml
# artillery.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 120
      arrivalRate: 50
      name: Sustained load

scenarios:
  - name: 'Get agents'
    flow:
      - get:
          url: '/api/v1/agents'
      - think: 1
```

Run load tests:
```bash
npm install -g artillery
artillery run artillery.yml
```

## ✅ Pre-Commit Checklist

Before committing code:
- [ ] All tests pass
- [ ] Coverage meets minimum thresholds
- [ ] No console errors or warnings
- [ ] Code is linted and formatted
- [ ] New features have tests
- [ ] Documentation is updated

---

**Last Updated: 2026-05-13**