# Agent Catalog - Gap Analysis & Implementation Plan

## Executive Summary

The Agent Catalog has a solid foundation with comprehensive governance controls, but lacks the critical AI integration features needed to generate deployment-ready specifications and deploy agents to Azure AI Foundry.

## Current State Analysis

### ✅ EXISTING Governance & Agent Infrastructure

#### Rich Governance Model (EXCELLENT)
Each agent includes:
- **Governance Profile**:
  - Authority levels (signal, advisory, autonomous)
  - Escalation paths with clear hierarchy
  - Autonomy descriptions and boundaries
  - Human-in-the-loop triggers
  - Confidence thresholds (minimum & review-required)

- **Governance Controls** (per agent):
  - Data validation with required fields
  - Audit logging
  - Confidence scoring
  - Compliance checks (HIPAA, GDPR, etc.)
  - Sentiment analysis thresholds
  - Amount-based escalation

- **Complete Agent Metadata**:
  - System prompts
  - Capabilities & limitations
  - Escalation criteria
  - Inputs/outputs with examples
  - Archetype & workflow role

#### Existing Technical Stack
- Frontend: React + Carbon Design + TypeScript
- Backend: Express + TypeScript + JSON file storage
- 13 pre-built agents across 3 verticals (Claims, Healthcare, Customer Service)
- Full CRUD API for agent management

### ❌ CRITICAL GAPS - AI Integration & Deployment

#### 1. AI-Powered Specification Generation (CRITICAL)

**Purpose**: Transform agent metadata into production-ready Azure AI Foundry specifications using GPT-4o.

**Missing Service**: `backend/src/services/agentSpecGenerator.ts`

**Required Functionality**:

A. **Context Builder** - Extract from existing agent data:
```typescript
interface AgentSpecContext {
  // Core Identity
  agentId: string;
  name: string;
  description: string;
  archetype: string;
  workflowRole: string;
  
  // Governance (ALREADY EXISTS - use it!)
  authorityLevel: string;
  escalationPath: string;
  autonomyDescription: string;
  boundaries: string[];
  humanInTheLoop: string[];
  confidenceThresholds: {
    minimum: number;
    reviewRequired: number;
  };
  
  // Behavior
  systemPrompt: string;
  capabilities: string[];
  limitations: string[];
  escalationCriteria: string[];
  
  // I/O Contracts
  inputs: Array<{name, type, description, required, example}>;
  outputs: Array<{name, type, description, example}>;
  
  // Controls (ALREADY EXISTS - leverage it!)
  governanceControls: Array<{
    type: string;
    description: string;
    enabled: boolean;
    parameters?: any;
  }>;
}
```

B. **GPT-4o System Prompt** - Instruct AI to generate 9-section spec:
1. **YAML Frontmatter** - Azure AI Foundry agent config
2. **Overview** - 2-3 sentence purpose
3. **System Prompt** - Production-ready with DEMO MODE block
4. **Intents/Topics** - 4-6 user phrase examples
5. **Actions & Integrations** - Specific actions with I/O contracts
6. **Scope Boundaries** - What agent will NOT do
7. **Handoff & Escalation** - When/how to escalate (use existing escalationPath!)
8. **Azure AI Foundry Setup** - Step-by-step config
9. **Testing Checklist** - 5-8 acceptance criteria

C. **Governance Integration** - The spec MUST include:
- Authority level and decision boundaries
- Confidence thresholds for escalation
- Human-in-the-loop triggers
- Governance controls as guardrails
- Audit logging requirements

**Missing API Endpoint**: `POST /api/v1/agents/:id/generate-spec`

**Response**:
```json
{
  "success": true,
  "data": {
    "markdown": "# Agent Specification\n\n...",
    "metadata": {
      "generatedAt": "2026-06-03T11:00:00Z",
      "model": "gpt-4o",
      "governanceLevel": "High"
    }
  }
}
```

#### 2. Azure AI Foundry Deployment (CRITICAL)

**Purpose**: Deploy generated specs as live agents in Azure AI Foundry with one click.

**Missing Service**: `backend/src/services/foundryAgentDeployer.ts`

**Required Functionality**:

A. **Spec Parser**:
- Extract system prompt from Markdown (regex on "## System Prompt" section)
- Sanitize agent name (alphanumeric + hyphens, max 64 chars)
- Validate spec completeness

B. **Azure Authentication**:
- Use `DefaultAzureCredential` from `@azure/identity`
- Acquire token for `https://ai.azure.com/.default`
- Requires "Azure AI Developer" role on Foundry project

C. **Foundry API Integration**:
```typescript
POST https://openaidigitalworker.services.ai.azure.com/api/projects/Acre/assistants
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "claims-intake-agent",
  "model": "gpt-4o",
  "instructions": "<extracted system prompt with governance controls>",
  "tools": []  // Can add code_interpreter, bing_grounding later
}
```

D. **Governance Enforcement**:
- Include governance controls in system prompt
- Set confidence thresholds as instructions
- Document escalation paths
- Enable audit logging

**Missing API Endpoint**: `POST /api/v1/agents/:id/deploy-to-foundry`

**Request**:
```json
{
  "markdown": "<optional - reuse generated spec>",
  "model": "gpt-4o"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "agentId": "asst_abc123",
    "agentName": "claims-intake-agent",
    "portalUrl": "https://ai.azure.com/resource/agentsList?wsid=...",
    "deployedAt": "2026-06-03T11:00:00Z"
  }
}
```

#### 3. Agent Testing via Chat Interface (HIGH PRIORITY)

**Purpose**: Test deployed agents directly from the catalog before production use.

**Missing Functionality**:

A. **Thread Management**:
- Create new conversation thread
- Reuse existing thread for multi-turn conversations
- Store thread ID client-side

B. **Message Flow**:
```typescript
1. POST message to thread
2. Create run against assistant
3. Poll run status (1s interval, 30s timeout)
4. Fetch assistant reply when complete
5. Return reply + threadId
```

C. **Governance Validation**:
- Test confidence thresholds
- Verify escalation triggers
- Validate boundary enforcement
- Check audit logging

**Missing API Endpoint**: `POST /api/v1/agents/:id/chat`

**Request**:
```json
{
  "assistantId": "asst_abc123",
  "message": "Process claim CLM-2026-001234",
  "threadId": "thread_xyz789"  // optional - for continuing conversation
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "reply": "I've validated the claim. Confidence: 92%. Proceeding to fraud check.",
    "threadId": "thread_xyz789",
    "metadata": {
      "confidence": 0.92,
      "escalationTriggered": false,
      "governanceChecksPassed": true
    }
  }
}
```

#### 4. Frontend UI Enhancements (MEDIUM PRIORITY)

**Missing in AgentCatalogPage.tsx**:

A. **Agent Card Actions**:
- "Generate Spec" button (with loading state)
- "Deploy to Foundry" button (enabled after spec generation)
- "Test Agent" button (enabled after deployment)

B. **Spec Preview Panel** (slide-out):
- Markdown rendering with `react-markdown` + `remark-gfm`
- Raw/rendered toggle
- Copy to clipboard button
- Governance controls highlighted
- Download as .md file

C. **Deployment Status**:
- Loading spinner during deployment
- Success message with agent ID
- "View in Foundry" link (opens Azure portal)
- Error handling with retry option

D. **Chat Interface** (modal or slide-out):
- Message input with send button
- Conversation history
- Confidence scores displayed
- Escalation warnings highlighted
- Clear conversation button

E. **Governance Visibility**:
- Show authority level badge
- Display confidence thresholds
- Highlight escalation criteria
- Show active governance controls

#### 5. Environment Configuration (REQUIRED)

**Add to `.env.example`**:
```env
# Azure OpenAI - Spec Generation
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_KEY=<key>  # Optional - falls back to DefaultAzureCredential
AZURE_OPENAI_API_VERSION=2025-01-01-preview

# Azure AI Foundry - Agent Deployment
# Uses DefaultAzureCredential (az login required)
# Identity needs "Azure AI Developer" role on project
FOUNDRY_SUBSCRIPTION_ID=e60686cf-a276-4f6b-a73e-4a3b342f4096
FOUNDRY_RESOURCE_GROUP=rgDigitalWorker
FOUNDRY_ACCOUNT_NAME=OpenAIDigitalWorker
FOUNDRY_PROJECT_NAME=Acre
```

## Implementation Plan - Prioritized

### Phase 1: Core AI Integration (CRITICAL - 6-8 hours)

**1.1 Agent Spec Generator Service**
File: `backend/src/services/agentSpecGenerator.ts`

```typescript
// Key components:
- AgentSpecContext interface (maps to existing agent schema)
- SYSTEM_PROMPT constant (GPT-4o architect persona)
- buildContext(agent: Agent): string
- generateAgentSpec(agent: Agent): Promise<string>
```

**Governance Integration Points**:
- Extract `governanceProfile` → include in spec
- Map `governanceControls` → guardrails section
- Use `escalationCriteria` → handoff protocol
- Include `confidenceThresholds` → decision boundaries

**1.2 Foundry Deployer Service**
File: `backend/src/services/foundryAgentDeployer.ts`

```typescript
// Key components:
- FoundryAgentResult interface
- extractSystemPrompt(markdown: string): string
- sanitizeAgentName(name: string): string
- deployAgentToFoundry(name, spec, model): Promise<FoundryAgentResult>
```

**Governance Enforcement**:
- Embed governance controls in system prompt
- Set confidence thresholds as instructions
- Document escalation paths clearly
- Enable audit logging by default

**1.3 API Routes**
Add to `backend/src/routes/agentRoutes.ts`:
- `POST /:id/generate-spec` → calls agentSpecGenerator
- `POST /:id/deploy-to-foundry` → calls foundryAgentDeployer
- `POST /:id/chat` → Foundry threads/runs API

### Phase 2: Frontend Integration (HIGH - 4-6 hours)

**2.1 Update AgentCatalogPage.tsx**
- Add spec generation UI
- Add deployment UI
- Add chat interface
- Show governance controls prominently

**2.2 Update api.ts Service**
- `generateAgentSpec(agentId)`
- `deployToFoundry(agentId, markdown?)`
- `chatWithAgent(agentId, assistantId, message, threadId?)`

**2.3 Install Dependencies**
```bash
npm install react-markdown remark-gfm
npm install @azure/openai @azure/identity
```

### Phase 3: Testing & Documentation (MEDIUM - 2-3 hours)

**3.1 Test Scenarios**
- Generate spec for each agent archetype
- Verify governance controls in generated specs
- Deploy to Foundry (requires Azure credentials)
- Test chat with confidence threshold validation
- Test escalation triggers

**3.2 Documentation Updates**
- Update README with new features
- Document governance control mapping
- Add Azure setup instructions
- Create deployment guide

## Key Governance Features to Highlight

### In Generated Specs
1. **Authority Level Section** - Clear statement of decision-making power
2. **Confidence Thresholds** - Minimum confidence & review-required levels
3. **Escalation Protocol** - When and how to escalate (use existing escalationPath)
4. **Boundaries** - Explicit list of what agent cannot do
5. **Human-in-the-Loop** - Specific triggers for human review
6. **Audit Requirements** - Logging and compliance controls

### In Deployed Agents
1. **System Prompt** - Include governance rules as instructions
2. **Confidence Scoring** - Return confidence with every response
3. **Escalation Detection** - Flag when thresholds are breached
4. **Audit Trail** - Log all interactions with metadata

### In Chat Interface
1. **Confidence Display** - Show confidence score for each response
2. **Escalation Warnings** - Highlight when escalation is triggered
3. **Governance Status** - Show which controls are active
4. **Audit Log** - Display interaction history

## Success Criteria

### Technical
1. ✅ Generate 9-section spec from any agent using GPT-4o
2. ✅ Spec includes all governance controls from agent data
3. ✅ Deploy spec to Azure AI Foundry with one click
4. ✅ Return agent ID and portal URL
5. ✅ Chat interface maintains conversation threads
6. ✅ Confidence scores displayed in chat

### Governance
7. ✅ Authority levels enforced in system prompts
8. ✅ Confidence thresholds trigger escalations
9. ✅ Human-in-the-loop triggers are documented
10. ✅ Audit logging enabled by default
11. ✅ Boundaries clearly stated in specs
12. ✅ Escalation paths documented and functional

## Next Steps

**IMMEDIATE**: Implement Phase 1 (Core AI Integration)
- Start with `agentSpecGenerator.ts`
- Focus on governance control integration
- Test with existing agent data

**Questions for Clarification**:
1. Do you have Azure OpenAI and Foundry credentials ready?
2. Should we prioritize specific agent archetypes for testing?
3. Are there additional governance controls needed beyond what exists?
4. Should chat interface be modal or slide-out panel?