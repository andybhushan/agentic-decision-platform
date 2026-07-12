# API Specification - Agent Workflow Builder

## Overview

RESTful API built with Express.js and TypeScript, providing endpoints for managing verticals, agents, workflows, and AI interactions.

**Base URL:** `http://localhost:3000/api/v1`

**Authentication:** Not required for prototype (can be added later)

**Content-Type:** `application/json`

---

## API Endpoints

### Verticals

#### GET /verticals
Get all available industry verticals

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "claims",
      "name": "Claims",
      "description": "Insurance claims processing",
      "icon": "🏥",
      "agentCount": 7,
      "workflowCount": 3
    }
  ]
}
```

#### GET /verticals/:id
Get detailed information about a specific vertical

**Parameters:**
- `id` (path): Vertical ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "claims",
    "name": "Claims",
    "description": "Insurance claims processing",
    "icon": "🏥",
    "defaultAgents": ["intake-agent", "evidence-agent"],
    "sampleWorkflows": [...],
    "industryContext": {
      "keyTerms": ["FNOL", "Adjuster", "Subrogation"],
      "commonProcesses": ["First Notice of Loss", "Claims Investigation"],
      "regulatoryNotes": ["Must comply with state insurance regulations"]
    }
  }
}
```

---

### Agents

#### GET /agents
Get all agents (optionally filtered by vertical)

**Query Parameters:**
- `vertical` (optional): Filter by vertical ID
- `archetype` (optional): Filter by archetype
- `search` (optional): Search by name or purpose
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "intake-agent",
        "name": "Intake Agent",
        "archetype": "Intake",
        "vertical": "claims",
        "purpose": "Gathers information from the user",
        "authorityLevel": "supervised",
        "inputCount": 3,
        "outputCount": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 21,
      "pages": 2
    }
  }
}
```

#### GET /agents/:id
Get detailed agent definition

**Parameters:**
- `id` (path): Agent ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "fraud-agent",
    "name": "Fraud Agent",
    "archetype": "Fraud",
    "vertical": "claims",
    "purpose": "Looks for unusual patterns or conflicts",
    "inputs": [
      {
        "name": "claimData",
        "type": "object",
        "required": true,
        "description": "Complete claim information"
      }
    ],
    "outputs": [
      {
        "name": "riskAssessment",
        "type": "object",
        "description": "Risk level and reasoning"
      }
    ],
    "triggers": ["claim_submitted", "evidence_reviewed"],
    "constraints": [
      "Must complete analysis within 30 seconds",
      "Cannot deny claims autonomously"
    ],
    "authorityLevel": "supervised",
    "escalationRules": [
      {
        "condition": "riskLevel === 'high'",
        "action": "escalate",
        "target": "supervisor-agent"
      }
    ],
    "governanceControls": [
      {
        "type": "audit",
        "description": "Log all risk assessments",
        "enforcement": "blocking"
      }
    ],
    "internalLogic": "flowchart TD\n  Start --> CheckPatterns...",
    "promptTemplate": "You are a fraud detection agent..."
  }
}
```

#### POST /agents
Create a new custom agent

**Request Body:**
```json
{
  "name": "Custom Validation Agent",
  "archetype": "Validation",
  "vertical": "claims",
  "purpose": "Validates medical codes against policy",
  "inputs": [...],
  "outputs": [...],
  "authorityLevel": "autonomous",
  "constraints": [...]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "custom-validation-agent-123",
    "name": "Custom Validation Agent",
    ...
  },
  "message": "Agent created successfully"
}
```

#### PUT /agents/:id
Update an existing agent

**Parameters:**
- `id` (path): Agent ID

**Request Body:**
```json
{
  "purpose": "Updated purpose",
  "constraints": ["New constraint"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent-id",
    ...
  },
  "message": "Agent updated successfully"
}
```

#### DELETE /agents/:id
Delete a custom agent

**Parameters:**
- `id` (path): Agent ID

**Response:**
```json
{
  "success": true,
  "message": "Agent deleted successfully"
}
```

---

### Workflows

#### GET /workflows
Get all workflows (optionally filtered by vertical)

**Query Parameters:**
- `vertical` (optional): Filter by vertical ID
- `search` (optional): Search by name or description

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "claims-standard-workflow",
      "name": "Standard Claims Processing",
      "description": "End-to-end claims workflow",
      "vertical": "claims",
      "agentCount": 7,
      "hasEscalations": true
    }
  ]
}
```

#### GET /workflows/:id
Get detailed workflow definition

**Parameters:**
- `id` (path): Workflow ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "claims-standard-workflow",
    "name": "Standard Claims Processing",
    "description": "End-to-end claims workflow",
    "vertical": "claims",
    "agents": [
      {
        "id": "node-1",
        "agentId": "intake-agent",
        "position": { "x": 100, "y": 100 },
        "config": {}
      }
    ],
    "connections": [
      {
        "from": "node-1",
        "to": "node-2",
        "condition": null,
        "label": "Next"
      }
    ],
    "mermaidDSL": "flowchart LR\n  Intake --> Evidence..."
  }
}
```

#### POST /workflows
Create a new workflow

**Request Body:**
```json
{
  "name": "Custom Claims Workflow",
  "description": "Simplified claims process",
  "vertical": "claims",
  "agents": [...],
  "connections": [...]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "custom-workflow-123",
    ...
  },
  "message": "Workflow created successfully"
}
```

#### PUT /workflows/:id
Update an existing workflow

**Parameters:**
- `id` (path): Workflow ID

**Request Body:**
```json
{
  "name": "Updated Workflow Name",
  "agents": [...],
  "connections": [...]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "workflow-id",
    ...
  },
  "message": "Workflow updated successfully"
}
```

#### DELETE /workflows/:id
Delete a workflow

**Parameters:**
- `id` (path): Workflow ID

**Response:**
```json
{
  "success": true,
  "message": "Workflow deleted successfully"
}
```

---

### AI Operations

#### POST /ai/generate-agent
Generate agent definition from natural language description

**Request Body:**
```json
{
  "description": "I need an agent that validates medical codes against insurance policies",
  "vertical": "healthcare",
  "context": {
    "existingAgents": ["intake-agent", "policy-agent"],
    "requirements": ["Must check ICD-10 codes", "Should escalate on uncertainty"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "agent": {
      "name": "Medical Code Validator",
      "archetype": "Validation",
      "purpose": "Validates medical codes against policy coverage",
      "inputs": [...],
      "outputs": [...],
      "authorityLevel": "supervised",
      "constraints": [...],
      "governanceControls": [...]
    },
    "confidence": 0.92,
    "suggestions": [
      "Consider adding a fallback to human review",
      "May need integration with ICD-10 database"
    ]
  }
}
```

#### POST /ai/generate-prompt
Generate prompt for an agent

**Request Body:**
```json
{
  "agentId": "fraud-agent",
  "input": {
    "claimNumber": "CLM-2024-001",
    "claimAmount": 50000,
    "claimantHistory": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prompt": "You are a fraud detection agent...\n\nAnalyze the following claim:\n...",
    "tokens": 450,
    "governanceApplied": [
      "Added audit logging requirement",
      "Included escalation criteria"
    ]
  }
}
```

#### POST /ai/simulate
Simulate agent execution

**Request Body:**
```json
{
  "agentId": "fraud-agent",
  "input": {
    "claimNumber": "CLM-2024-001",
    "claimAmount": 50000,
    "claimantHistory": []
  },
  "mode": "live"
}
```

**Query Parameters:**
- `mode` (optional): "mock" or "live" (default: "mock")

**Response:**
```json
{
  "success": true,
  "data": {
    "output": {
      "riskLevel": "medium",
      "confidence": 0.85,
      "reasoning": "Claim amount is within normal range...",
      "recommendation": "Supervisor review recommended"
    },
    "executionTime": 1250,
    "governanceChecks": [
      {
        "type": "audit",
        "status": "passed",
        "message": "Decision logged successfully"
      }
    ],
    "escalations": [
      {
        "triggered": true,
        "rule": "Medium risk requires supervisor review",
        "target": "supervisor-agent"
      }
    ]
  }
}
```

#### POST /ai/customize-agent
Get AI suggestions for customizing an agent

**Request Body:**
```json
{
  "agentId": "intake-agent",
  "customizationRequest": "Instead of asking for claim number, ask for policy number first"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestedChanges": {
      "inputs": [
        {
          "action": "modify",
          "field": "inputs[0]",
          "from": { "name": "claimNumber", ... },
          "to": { "name": "policyNumber", ... }
        }
      ],
      "purpose": "Updated to prioritize policy validation",
      "promptTemplate": "Updated prompt template..."
    },
    "impact": {
      "affectedWorkflows": ["claims-standard-workflow"],
      "breakingChanges": false,
      "recommendations": [
        "Update downstream agents to expect policy number",
        "Consider adding claim number as secondary input"
      ]
    }
  }
}
```

---

### Workflow Generation

#### POST /workflows/generate
Generate workflow from description

**Request Body:**
```json
{
  "description": "Create a workflow for processing auto insurance claims with fraud detection",
  "vertical": "claims",
  "requirements": [
    "Must include fraud check",
    "Supervisor approval for amounts over $10,000",
    "Compliance check at the end"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflow": {
      "name": "Auto Insurance Claims with Fraud Detection",
      "description": "Generated workflow for auto claims",
      "agents": [...],
      "connections": [...],
      "mermaidDSL": "flowchart LR..."
    },
    "explanation": "This workflow starts with intake, performs fraud detection...",
    "alternatives": [
      {
        "name": "Simplified Version",
        "description": "Removes some validation steps for faster processing"
      }
    ]
  }
}
```

#### POST /workflows/validate
Validate a workflow definition

**Request Body:**
```json
{
  "workflow": {
    "agents": [...],
    "connections": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "issues": [],
    "warnings": [
      "No escalation path defined for high-risk cases",
      "Consider adding compliance check at the end"
    ],
    "suggestions": [
      "Add supervisor agent for oversight",
      "Include audit logging"
    ]
  }
}
```

---

### Configuration

#### GET /config/ai-providers
Get available AI providers and current configuration

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "provider": "mock",
      "model": null,
      "configured": true
    },
    "available": [
      {
        "id": "watsonx",
        "name": "IBM watsonx.ai",
        "configured": false,
        "models": ["ibm/granite-13b-chat-v2", "meta-llama/llama-2-70b-chat"]
      },
      {
        "id": "azure",
        "name": "Azure OpenAI",
        "configured": false,
        "models": ["gpt-4", "gpt-35-turbo"]
      },
      {
        "id": "openai",
        "name": "OpenAI",
        "configured": false,
        "models": ["gpt-4", "gpt-3.5-turbo"]
      },
      {
        "id": "mock",
        "name": "Mock Provider (Demo)",
        "configured": true,
        "models": ["mock-model"]
      }
    ]
  }
}
```

#### PUT /config/ai-providers
Update AI provider configuration

**Request Body:**
```json
{
  "provider": "watsonx",
  "apiKey": "your-api-key",
  "endpoint": "https://us-south.ml.cloud.ibm.com",
  "model": "ibm/granite-13b-chat-v2",
  "parameters": {
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": "watsonx",
    "configured": true,
    "model": "ibm/granite-13b-chat-v2"
  },
  "message": "AI provider configured successfully"
}
```

#### POST /config/ai-providers/test
Test AI provider connection

**Request Body:**
```json
{
  "provider": "watsonx",
  "apiKey": "your-api-key",
  "endpoint": "https://us-south.ml.cloud.ibm.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "latency": 245,
    "models": ["ibm/granite-13b-chat-v2", "meta-llama/llama-2-70b-chat"]
  }
}
```

---

### Export

#### POST /export/workflow
Export workflow in various formats

**Request Body:**
```json
{
  "workflowId": "claims-standard-workflow",
  "format": "mermaid"
}
```

**Query Parameters:**
- `format`: "mermaid" | "json" | "png" | "svg"

**Response (format=mermaid):**
```json
{
  "success": true,
  "data": {
    "content": "flowchart LR\n  Intake --> Evidence...",
    "filename": "claims-standard-workflow.mmd"
  }
}
```

**Response (format=png):**
```json
{
  "success": true,
  "data": {
    "content": "base64-encoded-image-data",
    "filename": "claims-standard-workflow.png",
    "mimeType": "image/png"
  }
}
```

#### POST /export/agent
Export agent definition

**Request Body:**
```json
{
  "agentId": "fraud-agent",
  "format": "json"
}
```

**Query Parameters:**
- `format`: "json" | "yaml" | "markdown"

**Response:**
```json
{
  "success": true,
  "data": {
    "content": "{\"id\": \"fraud-agent\", ...}",
    "filename": "fraud-agent.json"
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `AI_PROVIDER_ERROR` | 502 | AI provider request failed |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid agent definition",
    "details": {
      "inputs": "At least one input is required",
      "authorityLevel": "Must be one of: autonomous, supervised, human-required"
    }
  }
}
```

---

## Rate Limiting

**Limits:**
- 100 requests per minute per IP
- 1000 requests per hour per IP
- AI operations: 20 requests per minute

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1620000000
```

---

## Pagination

For endpoints that return lists, pagination is supported:

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## Filtering and Sorting

**Query Parameters:**
- `sort`: Field to sort by (prefix with `-` for descending)
- `filter[field]`: Filter by field value

**Example:**
```
GET /api/v1/agents?vertical=claims&sort=-createdAt&filter[archetype]=Fraud
```

---

## WebSocket Events (Future Enhancement)

For real-time updates:

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

**Events:**
- `agent:created` - New agent created
- `agent:updated` - Agent updated
- `workflow:created` - New workflow created
- `simulation:started` - Simulation started
- `simulation:completed` - Simulation completed

---

## API Client Example

### JavaScript/TypeScript

```typescript
class AgentWorkflowAPI {
  private baseURL = 'http://localhost:3000/api/v1';

  async getVerticals(): Promise<VerticalConfig[]> {
    const response = await fetch(`${this.baseURL}/verticals`);
    const data = await response.json();
    return data.data;
  }

  async getAgents(vertical?: string): Promise<AgentDefinition[]> {
    const url = new URL(`${this.baseURL}/agents`);
    if (vertical) url.searchParams.set('vertical', vertical);
    
    const response = await fetch(url.toString());
    const data = await response.json();
    return data.data.agents;
  }

  async createAgent(agent: Partial<AgentDefinition>): Promise<AgentDefinition> {
    const response = await fetch(`${this.baseURL}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent)
    });
    const data = await response.json();
    return data.data;
  }

  async simulateAgent(agentId: string, input: any, mode: 'mock' | 'live' = 'mock') {
    const response = await fetch(`${this.baseURL}/ai/simulate?mode=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, input })
    });
    const data = await response.json();
    return data.data;
  }
}
```

---

## Backend Service Architecture

### Service Layer Structure

```typescript
// services/verticalService.ts
export class VerticalService {
  async getAll(): Promise<VerticalConfig[]>
  async getById(id: string): Promise<VerticalConfig>
  async getAgents(verticalId: string): Promise<AgentDefinition[]>
}

// services/agentService.ts
export class AgentService {
  async getAll(filters?: AgentFilters): Promise<AgentDefinition[]>
  async getById(id: string): Promise<AgentDefinition>
  async create(agent: Partial<AgentDefinition>): Promise<AgentDefinition>
  async update(id: string, updates: Partial<AgentDefinition>): Promise<AgentDefinition>
  async delete(id: string): Promise<void>
  async validate(agent: AgentDefinition): Promise<ValidationResult>
}

// services/workflowService.ts
export class WorkflowService {
  async getAll(filters?: WorkflowFilters): Promise<WorkflowDefinition[]>
  async getById(id: string): Promise<WorkflowDefinition>
  async create(workflow: Partial<WorkflowDefinition>): Promise<WorkflowDefinition>
  async update(id: string, updates: Partial<WorkflowDefinition>): Promise<WorkflowDefinition>
  async delete(id: string): Promise<void>
  async validate(workflow: WorkflowDefinition): Promise<ValidationResult>
  async generateMermaid(workflow: WorkflowDefinition): Promise<string>
}

// services/aiProviderService.ts
export class AIProviderService {
  async generateAgent(description: string, context: any): Promise<AgentDefinition>
  async generatePrompt(agent: AgentDefinition, input: any): Promise<string>
  async simulate(agentId: string, input: any): Promise<SimulationResult>
  async customize(agentId: string, request: string): Promise<CustomizationSuggestion>
  async testConnection(config: AIProviderConfig): Promise<ConnectionTest>
}
```

---

## Data Validation Schemas (Zod)

```typescript
import { z } from 'zod';

export const AgentInputSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  required: z.boolean(),
  description: z.string()
});

export const AgentOutputSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  description: z.string()
});

export const GovernanceControlSchema = z.object({
  type: z.enum(['audit', 'approval', 'constraint', 'validation']),
  description: z.string(),
  enforcement: z.enum(['blocking', 'warning', 'logging'])
});

export const AgentDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  archetype: z.string(),
  vertical: z.string(),
  purpose: z.string().min(10),
  inputs: z.array(AgentInputSchema).min(1),
  outputs: z.array(AgentOutputSchema).min(1),
  triggers: z.array(z.string()),
  constraints: z.array(z.string()),
  authorityLevel: z.enum(['autonomous', 'supervised', 'human-required']),
  escalationRules: z.array(z.any()),
  governanceControls: z.array(GovernanceControlSchema),
  internalLogic: z.string().optional(),
  promptTemplate: z.string().optional()
});
```

---

*Last Updated: 2026-05-13*