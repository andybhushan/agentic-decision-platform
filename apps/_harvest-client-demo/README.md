# PROJECT IMAGINE

An AI-powered digital workforce platform for designing, managing, and orchestrating intelligent agents with enterprise-grade governance controls.

## 🚀 Demo Environment

> The app is **live on Azure** — no local setup needed to view it.

| Surface | URL |
|---------|-----|
| Frontend | https://black-meadow-047776203.7.azurestaticapps.net |
| API (via proxy) | https://black-meadow-047776203.7.azurestaticapps.net/api/v1 |

**Deployment & CI/CD:** See [`docs/deployment.md`](docs/deployment.md) for the full guide — including the one-time GitHub Actions setup, manual deployment procedures, troubleshooting, and how to add new environments.

---


PROJECT IMAGINE enables organizations to create, configure, and orchestrate AI agents across different business verticals. Built with IBM Carbon Design System, it provides an intuitive interface for managing complex agentic orchestrations with built-in governance, compliance, and simulation capabilities.

## ✨ Key Features

### 🤖 Agent Management
- **Agent Catalog**: Browse and search through pre-configured agents
- **Agent Builder**: Create custom agents with detailed configuration
- **Agent Editor**: Modify existing agents with version control
- **AI-Powered Generation**: Generate agents from natural language descriptions

### 📊 Orchestration Visualization
- **Interactive Diagrams**: Mermaid-based orchestration visualization
- **Drag-and-Drop Builder**: Visual orchestration composition
- **Export Capabilities**: Export orchestrations in multiple formats
- **Real-time Updates**: Live orchestration diagram rendering

### 🧪 Agent Simulation
- **Test Environment**: Safe testing of agent configurations
- **Prompt Generation**: View AI prompts before execution
- **Governance Validation**: Real-time governance check enforcement
- **Performance Metrics**: Execution time and token usage tracking

### 🛡️ Governance & Compliance
- **Configurable Controls**: Flexible governance rule configuration
- **Confidence Thresholds**: Automated quality assurance
- **Human Review Requirements**: Escalation workflows
- **Audit Logging**: Complete activity tracking
- **Compliance Tracking**: Industry-specific compliance support

### 📈 Executive Reporting
- **GitHub Project Integration**: Pulls live status from GitHub Project V2, issues, pull requests, and milestones
- **Leadership Summary View**: Highlights overall health, milestones, blockers, risks, and notable delivery signals
- **Professional Carbon UI**: IBM Carbon-based executive dashboard for concise stakeholder reporting
- **GitHub-Backed Metrics**: Builds HTML status reports directly from GitHub workflow activity

## 🏗️ Architecture

### Frontend (React + TypeScript + Vite)
```
frontend/
├── src/
│   ├── pages/           # Main application pages
│   │   ├── HomePage.tsx
│   │   ├── AgentCatalogPage.tsx
│   │   ├── AgentBuilderPage.tsx
│   │   ├── WorkflowPage.tsx (Agentic Orchestrations)
│   │   ├── SimulatorPage.tsx
│   │   └── ExecutiveReportPage.tsx
│   ├── components/      # Reusable components
│   │   └── layout/
│   ├── services/        # API client
│   │   └── api.ts
│   ├── store/          # State management (Zustand)
│   │   └── useStore.ts
│   ├── types/          # TypeScript definitions
│   │   └── index.ts
│   └── styles/         # Global styles
└── package.json
```

### Backend (Node.js + Express + TypeScript)
```
backend/
├── src/
│   ├── routes/         # API endpoints
│   │   ├── verticalRoutes.ts
│   │   ├── agentRoutes.ts
│   │   ├── workflowRoutes.ts (Orchestrations API)
│   │   ├── aiRoutes.ts
│   │   └── reportingRoutes.ts
│   ├── services/       # Business logic
│   │   ├── verticalService.ts
│   │   ├── agentService.ts
│   │   ├── workflowService.ts (Orchestrations Service)
│   │   ├── aiService.ts
│   │   └── ai/
│   │       └── aiProvider.ts
│   │   └── githubReportingService.ts
│   ├── types/          # Shared types
│   │   └── index.ts
│   └── server.ts       # Express server
├── data/               # JSON data storage
│   ├── verticals.json
│   ├── agents.json
│   └── workflows.json (Agentic Orchestrations)
└── package.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd agent-workflow-builder
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

3. **Configure environment variables**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# AI_PROVIDER=mock (or watsonx, azure, openai)
# PORT=3000
# CORS_ORIGIN=http://localhost:5173
# GITHUB_TOKEN=<personal-access-token>
# GITHUB_PROJECT_OWNER=IBM-Project-Imagine
# GITHUB_PROJECT_NUMBER=1
```

4. **Start development servers**

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

5. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

## 📚 API Documentation

### Verticals
- `GET /api/v1/verticals` - List all verticals
- `GET /api/v1/verticals/:id` - Get vertical details

### Agents
- `GET /api/v1/agents` - List agents (with filters)
- `GET /api/v1/agents/:id` - Get agent details
- `POST /api/v1/agents` - Create new agent
- `PUT /api/v1/agents/:id` - Update agent
- `DELETE /api/v1/agents/:id` - Delete agent

### Agentic Orchestrations (Workflows)
- `GET /api/v1/workflows` - List orchestrations
- `GET /api/v1/workflows/:id` - Get orchestration details
- `POST /api/v1/workflows` - Create orchestration
- `PUT /api/v1/workflows/:id` - Update orchestration
- `DELETE /api/v1/workflows/:id` - Delete orchestration

### AI Services
- `POST /api/v1/ai/generate-agent` - Generate agent from description
- `POST /api/v1/ai/customize-agent` - Customize existing agent
- `POST /api/v1/ai/generate-prompt` - Generate agent prompt
- `POST /api/v1/ai/simulate` - Simulate agent execution
- `GET /api/v1/ai/test-connection` - Test AI provider connection

### Executive Reporting
- `GET /api/v1/reporting/executive` - Generate executive status report from GitHub project data
  - Optional query params: `owner`, `projectNumber`, `repository`, `milestone`, `reportingWindowDays`

## 🎨 Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **IBM Carbon Design System** - UI components
- **Zustand** - State management
- **React Router** - Navigation
- **Axios** - HTTP client
- **Mermaid** - Diagram rendering

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **Zod** - Schema validation
- **CORS** - Cross-origin support

## 📦 Sample Data

### Verticals (3)
1. **Claims Processing** - Insurance claims workflows
2. **Healthcare Services** - Medical service coordination
3. **Customer Service** - Support ticket management

### Agents (10)
- Claims Intake Agent
- Fraud Detection Agent
- Settlement Calculation Agent
- Policy Verification Agent
- Patient Intake Agent
- Diagnosis Support Agent
- Treatment Planning Agent
- Ticket Routing Agent
- Sentiment Analysis Agent
- Knowledge Base Agent

### Agentic Orchestrations (3)
- Standard Claims Processing
- Patient Care Coordination
- Customer Support Resolution

## 🔧 Configuration

### GitHub Executive Reporting Configuration

To enable the executive report UI, configure a GitHub personal access token with access to:
- Projects
- Issues
- Pull requests
- Repository metadata

Recommended environment variables in [`.env.example`](.env.example):
- `GITHUB_TOKEN` - personal access token used by the backend server
- `GITHUB_PROJECT_OWNER` - organization or user that owns the GitHub Project V2
- `GITHUB_PROJECT_NUMBER` - numeric GitHub Project identifier

Once configured, the executive report is available in the application at `/reports/executive`.

### AI Provider Configuration

The application supports multiple AI providers through an abstraction layer:

**Mock Provider (Default)**
- No configuration required
- Simulates AI responses for development
- No API costs

**WatsonX** (Coming Soon)
```env
AI_PROVIDER=watsonx
WATSONX_API_KEY=your_api_key
WATSONX_PROJECT_ID=your_project_id
```

**Azure OpenAI** (Coming Soon)
```env
AI_PROVIDER=azure
AZURE_OPENAI_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=your_endpoint
```

**OpenAI** (Coming Soon)
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key
```

## 🧪 Testing

### Run Tests
```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
npm test
```

### Manual Testing
1. Navigate to http://localhost:5173
2. Browse the agent catalog
3. Create a new agent
4. Build an agentic orchestration
5. Simulate agent execution

## 📖 User Guide

### Creating an Agent

1. Navigate to **Agent Catalog**
2. Click **Create New Agent**
3. Fill in the **Basic Info** tab:
   - Name, description, vertical
   - Archetype and authority level
   - Capabilities and limitations
4. Configure **Inputs & Outputs**:
   - Define expected inputs
   - Specify output format
5. Set **Governance Controls**:
   - Add compliance checks
   - Configure escalation rules
6. (Optional) Add custom **System Prompt**
7. Click **Save Agent**

### Building an Agentic Orchestration

1. Navigate to **Orchestrations**
2. Click **Create New Orchestration**
3. Add agents from the palette
4. Connect agents with transitions
5. Configure conditional logic
6. Preview the Mermaid diagram
7. Save and export

### Simulating an Agent

1. Navigate to **Simulator**
2. Select an agent
3. Provide test input (JSON format)
4. (Optional) Add context
5. Click **Run Simulation**
6. Review:
   - Generated prompts
   - Execution output
   - Governance check results
   - Performance metrics

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- IBM Carbon Design System
- Mermaid diagram library
- React and TypeScript communities

## 📞 Support

For issues, questions, or contributions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

## 🗺️ Roadmap

### Phase 1 (Completed) ✅
- Core UI implementation
- Agent management
- Agentic orchestration visualization
- Simulation capabilities

### Phase 2 (Planned)
- Real AI provider integrations
- Database persistence
- User authentication
- Advanced orchestration builder

### Phase 3 (Future)
- Orchestration execution engine
- Multi-agent coordination
- Analytics dashboard
- Mobile application

---

**Built with ❤️ using IBM Carbon Design System**

*Last Updated: 2026-05-13*