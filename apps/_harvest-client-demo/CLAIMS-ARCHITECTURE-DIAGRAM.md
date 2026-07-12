# Claims Module - Architecture Diagrams

## System Overview

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI1[FNOL Intake Page]
        UI2[Decision Queue Page]
        UI3[Decision Mode Page]
        UI4[Evidence & Policy Page]
        UI5[Action Preview Page]
    end
    
    subgraph "Frontend Services"
        API[API Service]
        STORE[Zustand Store]
    end
    
    subgraph "Backend API Layer"
        ROUTES[Claims Routes]
    end
    
    subgraph "Business Logic Layer"
        SERVICE[Claims Service]
    end
    
    subgraph "Data Layer"
        DATA[claims.json]
    end
    
    UI1 --> API
    UI2 --> API
    UI3 --> API
    UI4 --> API
    UI5 --> API
    
    API --> ROUTES
    ROUTES --> SERVICE
    SERVICE --> DATA
    
    UI2 -.-> STORE
    UI3 -.-> STORE
```

## User Journey Flow

```mermaid
graph LR
    START([User Starts]) --> INTAKE[FNOL Intake]
    INTAKE -->|Submit Form| QUEUE[Decision Queue]
    QUEUE -->|Select Claim| DECISION[Decision Mode]
    DECISION -->|See All Evidence| EVIDENCE[Evidence & Policy]
    EVIDENCE -->|Back| DECISION
    DECISION -->|Approve Action| PREVIEW[Action Preview]
    PREVIEW -->|Confirm| QUEUE
    PREVIEW -->|Reject| DECISION
    QUEUE -->|New Claim| INTAKE
    
    style INTAKE fill:#e1f5ff
    style QUEUE fill:#fff4e1
    style DECISION fill:#e8f5e9
    style EVIDENCE fill:#f3e5f5
    style PREVIEW fill:#ffe0b2
```

## Component Hierarchy

```mermaid
graph TD
    APP[App.tsx]
    HEADER[AppHeader]
    CONTENT[AppContent]
    
    APP --> HEADER
    APP --> CONTENT
    
    CONTENT --> INTAKE[FNOLIntakePage]
    CONTENT --> QUEUE[DecisionQueuePage]
    CONTENT --> DECISION[DecisionModePage]
    CONTENT --> EVIDENCE[EvidencePolicyPage]
    CONTENT --> PREVIEW[ActionPreviewPage]
    
    HEADER --> MENU[Claims Demo Menu]
    MENU --> LINK1[FNOL Intake Link]
    MENU --> LINK2[Decision Queue Link]
    
    INTAKE --> FORM[Carbon Form Components]
    QUEUE --> TABLE[Carbon DataTable]
    DECISION --> GRID[Two-Column Grid]
    EVIDENCE --> TABS[Carbon Tabs]
    PREVIEW --> TILES[Governance Tiles]
    
    GRID --> LEFT[Narrative/Anomalies/Action]
    GRID --> RIGHT[Policy/Evidence/Claimant]
```

## Data Flow - FNOL Submission

```mermaid
sequenceDiagram
    participant User
    participant IntakePage
    participant API
    participant ClaimsRoutes
    participant ClaimsService
    participant DataFile
    participant QueuePage
    
    User->>IntakePage: Fill form
    User->>IntakePage: Click Submit
    IntakePage->>IntakePage: Validate form
    IntakePage->>API: createClaim(submission)
    API->>ClaimsRoutes: POST /api/v1/claims
    ClaimsRoutes->>ClaimsService: create(submission)
    ClaimsService->>ClaimsService: Generate claim ID
    ClaimsService->>ClaimsService: Create initial narrative
    ClaimsService->>ClaimsService: Generate recommended action
    ClaimsService->>DataFile: Save claim
    DataFile-->>ClaimsService: Success
    ClaimsService-->>ClaimsRoutes: New claim object
    ClaimsRoutes-->>API: APIResponse with claim
    API-->>IntakePage: Claim created
    IntakePage->>IntakePage: Show success notification
    IntakePage->>QueuePage: Navigate after 3s
    QueuePage->>API: getClaims()
    API->>ClaimsRoutes: GET /api/v1/claims
    ClaimsRoutes->>ClaimsService: getAll()
    ClaimsService->>DataFile: Load claims
    DataFile-->>ClaimsService: Claims array
    ClaimsService-->>ClaimsRoutes: Filtered claims
    ClaimsRoutes-->>API: APIResponse with claims
    API-->>QueuePage: Claims list
    QueuePage->>QueuePage: Display in table
```

## Data Flow - Decision Approval

```mermaid
sequenceDiagram
    participant User
    participant DecisionPage
    participant PreviewPage
    participant API
    participant ClaimsRoutes
    participant ClaimsService
    participant DataFile
    participant QueuePage
    
    User->>DecisionPage: View claim details
    User->>DecisionPage: Click "Approve Action"
    DecisionPage->>PreviewPage: Navigate with claim ID
    PreviewPage->>API: getClaim(id)
    API->>ClaimsRoutes: GET /api/v1/claims/:id
    ClaimsRoutes->>ClaimsService: getById(id)
    ClaimsService->>DataFile: Load claims
    DataFile-->>ClaimsService: Claims array
    ClaimsService-->>ClaimsRoutes: Claim object
    ClaimsRoutes-->>API: APIResponse with claim
    API-->>PreviewPage: Claim data
    PreviewPage->>PreviewPage: Display governance preview
    User->>PreviewPage: Click "Confirm and Execute"
    PreviewPage->>API: submitDecision(id, outcome)
    API->>ClaimsRoutes: PUT /api/v1/claims/:id/decision
    ClaimsRoutes->>ClaimsService: updateDecision(id, outcome)
    ClaimsService->>ClaimsService: Update claim status
    ClaimsService->>ClaimsService: Add audit entry
    ClaimsService->>DataFile: Save updated claim
    DataFile-->>ClaimsService: Success
    ClaimsService-->>ClaimsRoutes: Updated claim
    ClaimsRoutes-->>API: APIResponse with claim
    API-->>PreviewPage: Decision recorded
    PreviewPage->>PreviewPage: Show success notification
    PreviewPage->>QueuePage: Navigate to queue
```

## Backend Service Architecture

```mermaid
graph TB
    subgraph "Express Server"
        SERVER[server.ts]
        MIDDLEWARE[Middleware: CORS, JSON, Logging]
    end
    
    subgraph "Route Layer"
        CLAIMS_ROUTES[claimsRoutes.ts]
        AGENT_ROUTES[agentRoutes.ts]
        OTHER_ROUTES[Other Routes...]
    end
    
    subgraph "Service Layer"
        CLAIMS_SERVICE[ClaimsService]
        AGENT_SERVICE[AgentService]
        OTHER_SERVICES[Other Services...]
    end
    
    subgraph "Data Layer"
        CLAIMS_DATA[claims.json]
        AGENTS_DATA[agents.json]
        OTHER_DATA[Other Data...]
    end
    
    SERVER --> MIDDLEWARE
    MIDDLEWARE --> CLAIMS_ROUTES
    MIDDLEWARE --> AGENT_ROUTES
    MIDDLEWARE --> OTHER_ROUTES
    
    CLAIMS_ROUTES --> CLAIMS_SERVICE
    AGENT_ROUTES --> AGENT_SERVICE
    OTHER_ROUTES --> OTHER_SERVICES
    
    CLAIMS_SERVICE --> CLAIMS_DATA
    AGENT_SERVICE --> AGENTS_DATA
    OTHER_SERVICES --> OTHER_DATA
    
    style CLAIMS_ROUTES fill:#e1f5ff
    style CLAIMS_SERVICE fill:#e1f5ff
    style CLAIMS_DATA fill:#e1f5ff
```

## Frontend State Management

```mermaid
graph TB
    subgraph "React Components"
        INTAKE[FNOLIntakePage]
        QUEUE[DecisionQueuePage]
        DECISION[DecisionModePage]
        EVIDENCE[EvidencePolicyPage]
        PREVIEW[ActionPreviewPage]
    end
    
    subgraph "Local State - useState"
        FORM_STATE[Form Fields]
        CLAIM_STATE[Current Claim]
        FILTER_STATE[Filters & Search]
        LOADING_STATE[Loading States]
        ERROR_STATE[Error States]
    end
    
    subgraph "API Service"
        API[api.ts]
    end
    
    subgraph "Optional Global State - Zustand"
        STORE[useStore]
        CACHE[Claims Cache]
    end
    
    INTAKE --> FORM_STATE
    QUEUE --> FILTER_STATE
    DECISION --> CLAIM_STATE
    EVIDENCE --> CLAIM_STATE
    PREVIEW --> CLAIM_STATE
    
    INTAKE --> API
    QUEUE --> API
    DECISION --> API
    EVIDENCE --> API
    PREVIEW --> API
    
    QUEUE -.-> STORE
    DECISION -.-> STORE
    
    STORE -.-> CACHE
    
    style INTAKE fill:#e1f5ff
    style QUEUE fill:#e1f5ff
    style DECISION fill:#e1f5ff
    style EVIDENCE fill:#e1f5ff
    style PREVIEW fill:#e1f5ff
```

## Type System Architecture

```mermaid
graph TB
    subgraph "Shared Types"
        CORE[Core Domain Types]
        CONF[ConfidenceLevel]
        DEC[DecisionType]
        PRIO[Priority]
        STAGE[ClaimStage]
    end
    
    subgraph "Backend Types"
        BE_TYPES[backend/src/types/index.ts]
        CLAIM_BE[Claim]
        EVIDENCE_BE[EvidenceItem]
        NARRATIVE_BE[NarrativeElement]
        ANOMALY_BE[AnomalySignal]
    end
    
    subgraph "Frontend Types"
        FE_TYPES[frontend/src/types/index.ts]
        CLAIM_FE[Claim]
        EVIDENCE_FE[EvidenceItem]
        NARRATIVE_FE[NarrativeElement]
        ANOMALY_FE[AnomalySignal]
    end
    
    subgraph "API Types"
        API_RESP[APIResponse<T>]
        FNOL[FNOLSubmission]
        OUTCOME[DecisionOutcome]
    end
    
    CORE --> BE_TYPES
    CORE --> FE_TYPES
    
    BE_TYPES --> CLAIM_BE
    BE_TYPES --> EVIDENCE_BE
    BE_TYPES --> NARRATIVE_BE
    BE_TYPES --> ANOMALY_BE
    
    FE_TYPES --> CLAIM_FE
    FE_TYPES --> EVIDENCE_FE
    FE_TYPES --> NARRATIVE_FE
    FE_TYPES --> ANOMALY_FE
    
    BE_TYPES --> API_RESP
    FE_TYPES --> API_RESP
    
    BE_TYPES --> FNOL
    FE_TYPES --> FNOL
    
    BE_TYPES --> OUTCOME
    FE_TYPES --> OUTCOME
    
    style CORE fill:#fff4e1
    style BE_TYPES fill:#e1f5ff
    style FE_TYPES fill:#e8f5e9
```

## Routing Architecture

```mermaid
graph TB
    ROOT["/"]
    
    AGENTS["/agents"]
    AGENTS_NEW["/agents/new"]
    AGENTS_EDIT["/agents/:id/edit"]
    
    ORCH["/orchestrations"]
    SIM["/simulator"]
    REPORTS["/reports/executive"]
    
    CLAIMS["/claims"]
    CLAIMS_QUEUE["/claims/queue"]
    CLAIMS_DECISION["/claims/:id/decision"]
    CLAIMS_EVIDENCE["/claims/:id/evidence"]
    CLAIMS_PREVIEW["/claims/:id/preview-action"]
    CLAIMS_INTAKE["/claims/intake"]
    
    ROOT --> AGENTS
    ROOT --> AGENTS_NEW
    ROOT --> AGENTS_EDIT
    ROOT --> ORCH
    ROOT --> SIM
    ROOT --> REPORTS
    ROOT --> CLAIMS
    
    CLAIMS --> CLAIMS_QUEUE
    CLAIMS_QUEUE --> CLAIMS_DECISION
    CLAIMS_DECISION --> CLAIMS_EVIDENCE
    CLAIMS_DECISION --> CLAIMS_PREVIEW
    CLAIMS_PREVIEW --> CLAIMS_QUEUE
    CLAIMS_QUEUE --> CLAIMS_INTAKE
    CLAIMS_INTAKE --> CLAIMS_QUEUE
    
    style CLAIMS fill:#e1f5ff
    style CLAIMS_QUEUE fill:#e1f5ff
    style CLAIMS_DECISION fill:#e1f5ff
    style CLAIMS_EVIDENCE fill:#e1f5ff
    style CLAIMS_PREVIEW fill:#e1f5ff
    style CLAIMS_INTAKE fill:#e1f5ff
```

## Decision Mode Page Layout

```mermaid
graph TB
    PAGE[Decision Mode Page]
    
    subgraph "Header"
        TITLE[Claim ID & Status]
    end
    
    subgraph "Main Content - Two Column Grid"
        subgraph "Left Column - 8 units"
            NARRATIVE[Narrative Synthesis Section]
            ANOMALIES[Anomaly Signals Section]
            ACTION[Recommended Action Section]
        end
        
        subgraph "Right Column - 4 units"
            POLICY[Policy Context Tile]
            EVIDENCE[Evidence Summary Tile]
            CLAIMANT[Claimant Details Tile]
        end
    end
    
    subgraph "Bottom Action Bar"
        BTN1[Approve Action]
        BTN2[Request Evidence]
        BTN3[Redirect/Reassign]
        BTN4[Add Note]
    end
    
    PAGE --> TITLE
    PAGE --> NARRATIVE
    PAGE --> ANOMALIES
    PAGE --> ACTION
    PAGE --> POLICY
    PAGE --> EVIDENCE
    PAGE --> CLAIMANT
    PAGE --> BTN1
    PAGE --> BTN2
    PAGE --> BTN3
    PAGE --> BTN4
    
    NARRATIVE --> TAGS1[Status Tags]
    ANOMALIES --> ACCORDION[Accordion Items]
    ACTION --> TAGS2[Confidence Tag]
    POLICY --> TAGS3[Coverage Tag]
    EVIDENCE --> TAGS4[Provenance Tags]
    EVIDENCE --> LINK[See All Link]
    
    BTN1 --> PREVIEW[Navigate to Preview]
    LINK --> EVIDENCE_PAGE[Navigate to Evidence Page]
```

## Carbon Design System Component Usage

```mermaid
graph TB
    subgraph "Layout Components"
        GRID[Grid]
        COLUMN[Column]
        STACK[Stack]
    end
    
    subgraph "Form Components"
        FORM[Form]
        TEXT_INPUT[TextInput]
        DROPDOWN[Dropdown]
        DATE_PICKER[DatePicker]
        TIME_PICKER[TimePicker]
        TOGGLE[Toggle]
        CHECKBOX[CheckboxGroup]
        RADIO[RadioButtonGroup]
        TEXT_AREA[TextArea]
    end
    
    subgraph "Data Display"
        DATA_TABLE[DataTable]
        STRUCTURED_LIST[StructuredList]
        ACCORDION[Accordion]
        TABS[Tabs]
        CODE_SNIPPET[CodeSnippet]
    end
    
    subgraph "Feedback Components"
        TAG[Tag]
        NOTIFICATION[InlineNotification]
        LOADING[Loading]
    end
    
    subgraph "Action Components"
        BUTTON[Button]
        BUTTON_SET[ButtonSet]
    end
    
    subgraph "Container Components"
        TILE[Tile]
        HEADER[Header]
        HEADER_MENU[HeaderMenu]
    end
    
    INTAKE_PAGE[FNOLIntakePage] --> FORM
    INTAKE_PAGE --> TEXT_INPUT
    INTAKE_PAGE --> DROPDOWN
    INTAKE_PAGE --> DATE_PICKER
    INTAKE_PAGE --> TOGGLE
    INTAKE_PAGE --> CHECKBOX
    INTAKE_PAGE --> TEXT_AREA
    
    QUEUE_PAGE[DecisionQueuePage] --> DATA_TABLE
    QUEUE_PAGE --> TAG
    QUEUE_PAGE --> DROPDOWN
    
    DECISION_PAGE[DecisionModePage] --> GRID
    DECISION_PAGE --> STRUCTURED_LIST
    DECISION_PAGE --> ACCORDION
    DECISION_PAGE --> TILE
    DECISION_PAGE --> TAG
    
    EVIDENCE_PAGE[EvidencePolicyPage] --> TABS
    EVIDENCE_PAGE --> DATA_TABLE
    EVIDENCE_PAGE --> CODE_SNIPPET
    
    PREVIEW_PAGE[ActionPreviewPage] --> TILE
    PREVIEW_PAGE --> NOTIFICATION
    PREVIEW_PAGE --> BUTTON_SET
    
    APP_HEADER[AppHeader] --> HEADER
    APP_HEADER --> HEADER_MENU
```

## Error Handling Flow

```mermaid
graph TB
    USER_ACTION[User Action]
    
    USER_ACTION --> VALIDATION{Client Validation}
    VALIDATION -->|Invalid| SHOW_ERROR[Show Inline Error]
    VALIDATION -->|Valid| API_CALL[API Call]
    
    API_CALL --> NETWORK{Network Request}
    NETWORK -->|Success| BACKEND{Backend Processing}
    NETWORK -->|Failure| NETWORK_ERROR[Show Network Error]
    
    BACKEND -->|Success| UPDATE_UI[Update UI]
    BACKEND -->|404| NOT_FOUND[Show Not Found]
    BACKEND -->|500| SERVER_ERROR[Show Server Error]
    BACKEND -->|400| VALIDATION_ERROR[Show Validation Error]
    
    UPDATE_UI --> SUCCESS[Show Success Notification]
    
    SHOW_ERROR --> USER_ACTION
    NETWORK_ERROR --> USER_ACTION
    NOT_FOUND --> REDIRECT[Redirect to Queue]
    SERVER_ERROR --> SHOW_NOTIFICATION[Show Error Notification]
    VALIDATION_ERROR --> SHOW_NOTIFICATION
    
    style SHOW_ERROR fill:#ffebee
    style NETWORK_ERROR fill:#ffebee
    style NOT_FOUND fill:#ffebee
    style SERVER_ERROR fill:#ffebee
    style VALIDATION_ERROR fill:#ffebee
    style SUCCESS fill:#e8f5e9
```

## Deployment Architecture (Future)

```mermaid
graph TB
    subgraph "Client Browser"
        BROWSER[React SPA]
    end
    
    subgraph "Frontend Server"
        NGINX[Nginx / CDN]
        STATIC[Static Assets]
    end
    
    subgraph "Backend Server"
        NODE[Node.js / Express]
        API_LAYER[API Routes]
    end
    
    subgraph "Data Layer"
        DB[(Database)]
        CACHE[(Redis Cache)]
        STORAGE[(Document Storage)]
    end
    
    subgraph "External Services"
        AI[AI Provider]
        EMAIL[Email Service]
        SMS[SMS Service]
    end
    
    BROWSER --> NGINX
    NGINX --> STATIC
    BROWSER --> NODE
    NODE --> API_LAYER
    API_LAYER --> DB
    API_LAYER --> CACHE
    API_LAYER --> STORAGE
    API_LAYER --> AI
    API_LAYER --> EMAIL
    API_LAYER --> SMS
    
    style BROWSER fill:#e1f5ff
    style NODE fill:#e8f5e9
    style DB fill:#fff4e1
```

## Module Isolation Strategy

```mermaid
graph TB
    subgraph "Existing Platform"
        PLATFORM[Agent Workflow Builder]
        AGENTS[Agent Catalog]
        WORKFLOWS[Orchestrations]
        SIMULATOR[Simulator]
        REPORTS[Reports]
    end
    
    subgraph "Claims Module - Self-Contained"
        CLAIMS_TYPES[Claims Types]
        CLAIMS_SERVICE[Claims Service]
        CLAIMS_ROUTES[Claims Routes]
        CLAIMS_DATA[Claims Data]
        CLAIMS_PAGES[Claims Pages]
        CLAIMS_NAV[Claims Navigation]
    end
    
    subgraph "Shared Infrastructure"
        CARBON[Carbon Design System]
        ROUTER[React Router]
        API_CLIENT[API Client]
        LAYOUT[Layout Shell]
    end
    
    PLATFORM --> CARBON
    PLATFORM --> ROUTER
    PLATFORM --> API_CLIENT
    PLATFORM --> LAYOUT
    
    CLAIMS_TYPES --> CLAIMS_SERVICE
    CLAIMS_SERVICE --> CLAIMS_ROUTES
    CLAIMS_ROUTES --> CLAIMS_DATA
    CLAIMS_PAGES --> CLAIMS_SERVICE
    CLAIMS_NAV --> CLAIMS_PAGES
    
    CLAIMS_PAGES --> CARBON
    CLAIMS_PAGES --> ROUTER
    CLAIMS_PAGES --> API_CLIENT
    CLAIMS_PAGES --> LAYOUT
    
    style CLAIMS_TYPES fill:#e1f5ff
    style CLAIMS_SERVICE fill:#e1f5ff
    style CLAIMS_ROUTES fill:#e1f5ff
    style CLAIMS_DATA fill:#e1f5ff
    style CLAIMS_PAGES fill:#e1f5ff
    style CLAIMS_NAV fill:#e1f5ff
```

## Testing Strategy

```mermaid
graph TB
    subgraph "Unit Tests"
        SERVICE_TESTS[Claims Service Tests]
        COMPONENT_TESTS[Component Tests]
        UTIL_TESTS[Utility Tests]
    end
    
    subgraph "Integration Tests"
        API_TESTS[API Endpoint Tests]
        ROUTE_TESTS[Route Integration Tests]
        DATA_FLOW_TESTS[Data Flow Tests]
    end
    
    subgraph "E2E Tests"
        FNOL_FLOW[FNOL Submission Flow]
        DECISION_FLOW[Decision Approval Flow]
        NAVIGATION_FLOW[Navigation Flow]
    end
    
    subgraph "Manual Testing"
        UI_TESTING[UI/UX Testing]
        ACCEPTANCE[Acceptance Criteria]
        REGRESSION[Regression Testing]
    end
    
    SERVICE_TESTS --> API_TESTS
    COMPONENT_TESTS --> ROUTE_TESTS
    API_TESTS --> FNOL_FLOW
    ROUTE_TESTS --> DECISION_FLOW
    DATA_FLOW_TESTS --> NAVIGATION_FLOW
    
    FNOL_FLOW --> UI_TESTING
    DECISION_FLOW --> UI_TESTING
    NAVIGATION_FLOW --> UI_TESTING
    
    UI_TESTING --> ACCEPTANCE
    ACCEPTANCE --> REGRESSION
```

---

## Key Architectural Decisions

### 1. Self-Contained Module Design
- All claims code is isolated in dedicated files
- No modifications to existing platform code (except navigation)
- Can be removed or promoted to standalone app cleanly

### 2. Service Layer Pattern
- Business logic separated from routes
- Consistent with existing platform architecture
- Easy to swap data layer (JSON → Database)

### 3. Type Safety
- Shared types between frontend and backend
- TypeScript ensures compile-time safety
- Clear contracts for API communication

### 4. Carbon Design System
- Consistent UI/UX with existing platform
- Accessible components out of the box
- Responsive design built-in

### 5. Mock Data Approach
- Realistic scenarios for prototype
- No real AI integration required
- Easy to replace with production services

### 6. Governance Integration
- Reuses existing governance preview pattern
- Demonstrates platform extensibility
- Shows how domain apps leverage platform capabilities

---

## Extension Points for Production

### 1. Database Integration
Replace JSON file storage with:
- PostgreSQL for relational data
- MongoDB for document storage
- Redis for caching

### 2. Real-time Updates
Add WebSocket support for:
- Queue updates
- Claim status changes
- Collaborative editing

### 3. Document Management
Integrate with:
- AWS S3 for document storage
- OCR service for evidence extraction
- Document versioning

### 4. AI Integration
Connect to:
- OpenAI / Anthropic for analysis
- Custom ML models for fraud detection
- NLP for narrative synthesis

### 5. Communication Services
Integrate with:
- SendGrid for email
- Twilio for SMS
- In-app notifications

### 6. Analytics & Reporting
Add:
- Claims metrics dashboard
- Performance tracking
- Compliance reporting
- Audit trail visualization

---

## References

- **Specification**: `CLAIMS-MODULE-SPECIFICATION.md`
- **Implementation Roadmap**: `CLAIMS-IMPLEMENTATION-ROADMAP.md`
- **Carbon Design System**: https://carbondesignsystem.com/
- **Mermaid Diagrams**: https://mermaid.js.org/