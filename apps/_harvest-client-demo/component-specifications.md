# Component Specifications - Agent Workflow Builder

## Frontend Components

### 1. VerticalSelector Component

**Purpose:** Landing page component that displays available industry verticals

**Props:**
```typescript
interface VerticalSelectorProps {
  onVerticalSelect: (verticalId: string) => void;
  verticals: VerticalConfig[];
  loading?: boolean;
}
```

**Carbon Components Used:**
- `Tile` or `ClickableTile` for vertical cards
- `Grid` and `Column` for layout
- `SkeletonPlaceholder` for loading states

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Agent Workflow Builder                         │
│  Select an industry vertical to get started     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Claims   │  │Healthcare│  │ Customer │     │
│  │ 🏥       │  │ ⚕️       │  │ Service  │     │
│  │          │  │          │  │ 💬       │     │
│  │ 7 agents │  │ 7 agents │  │ 7 agents │     │
│  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────┘
```

**Interactions:**
- Hover: Tile elevates, shows description
- Click: Navigates to agent catalog for that vertical
- Keyboard: Tab navigation, Enter to select

---

### 2. AgentCatalog Component

**Purpose:** Browse and search available agents for selected vertical

**Props:**
```typescript
interface AgentCatalogProps {
  vertical: VerticalConfig;
  agents: AgentDefinition[];
  onAgentSelect: (agentId: string) => void;
  onCustomize: (agentId: string) => void;
  onCreateNew: () => void;
}
```

**Carbon Components Used:**
- `DataTable` with sorting and filtering
- `Search` for agent search
- `Tag` for agent archetypes
- `Button` for actions
- `Modal` for agent details

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ ← Back to Verticals    Claims Agents            │
│                                                  │
│ [Search agents...]              [+ Create New]  │
│                                                  │
│ ┌────────────────────────────────────────────┐ │
│ │ Name          │ Type    │ Authority │ ...  │ │
│ ├────────────────────────────────────────────┤ │
│ │ Intake Agent  │ Intake  │ Supervised│ View │ │
│ │ Evidence Agent│ Evidence│ Autonomous│ View │ │
│ │ Fraud Agent   │ Fraud   │ Supervised│ View │ │
│ └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Features:**
- Search by name, archetype, or purpose
- Filter by authority level
- Sort by name, type, or creation date
- Click row to view details
- Action buttons: View, Customize, Add to Workflow

---

### 3. AgentDetailModal Component

**Purpose:** Display comprehensive agent information

**Props:**
```typescript
interface AgentDetailModalProps {
  agent: AgentDefinition;
  open: boolean;
  onClose: () => void;
  onCustomize: () => void;
  onAddToWorkflow: () => void;
}
```

**Carbon Components Used:**
- `Modal` (large size)
- `Tabs` for different sections
- `StructuredList` for inputs/outputs
- `Tag` for constraints
- `CodeSnippet` for DSL/prompt

**Tabs:**
1. **Overview**: Purpose, archetype, description
2. **Inputs/Outputs**: Structured list of data requirements
3. **Governance**: Authority level, escalation rules, constraints
4. **Internal Logic**: Mermaid diagram of agent's decision process
5. **Prompt Template**: The actual prompt used (if available)

---

### 4. AgentBuilder Component

**Purpose:** Create or customize agent definitions

**Props:**
```typescript
interface AgentBuilderProps {
  mode: 'create' | 'customize';
  baseAgent?: AgentDefinition;
  vertical: VerticalConfig;
  onSave: (agent: AgentDefinition) => void;
  onCancel: () => void;
}
```

**Carbon Components Used:**
- `Form` with validation
- `TextInput`, `TextArea` for text fields
- `Select`, `MultiSelect` for dropdowns
- `Toggle` for boolean options
- `Accordion` for collapsible sections
- `InlineNotification` for validation errors

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Create New Agent                    [Save] [Cancel]│
│                                                  │
│ ▼ Basic Information                             │
│   Name: [_________________________]             │
│   Archetype: [Select ▼]                         │
│   Purpose: [_________________________]          │
│                                                  │
│ ▼ Inputs & Outputs                              │
│   Inputs:  [+ Add Input]                        │
│   - Claim Number (string, required)             │
│   - Policy Details (object, required)           │
│                                                  │
│ ▼ Governance Controls                           │
│   Authority Level: ○ Autonomous                 │
│                    ● Supervised                  │
│                    ○ Human Required              │
│                                                  │
│ ▼ Preview                                       │
│   [Generated agent definition preview]          │
└─────────────────────────────────────────────────┘
```

**Features:**
- Real-time validation
- AI-assisted field suggestions
- Preview pane showing generated definition
- Diff view when customizing existing agent
- Save to workspace or catalog

---

### 5. WorkflowVisualizer Component

**Purpose:** Display and interact with workflow diagrams

**Props:**
```typescript
interface WorkflowVisualizerProps {
  workflow: WorkflowDefinition;
  agents: AgentDefinition[];
  onAgentClick: (agentId: string) => void;
  onExport: (format: 'png' | 'svg' | 'mermaid') => void;
  editable?: boolean;
}
```

**Carbon Components Used:**
- `Tile` for diagram container
- `Button` for export options
- `OverflowMenu` for actions
- Custom Mermaid renderer

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Claims Workflow                [Export ▼]       │
│                                                  │
│ ┌────────────────────────────────────────────┐ │
│ │                                            │ │
│ │    [Intake] → [Evidence] → [Fraud]        │ │
│ │                    ↓                       │ │
│ │              [Supervisor]                  │ │
│ │                    ↓                       │ │
│ │    [Policy] → [Settlement] → [Approval]   │ │
│ │                                            │ │
│ └────────────────────────────────────────────┘ │
│                                                  │
│ Click any agent to view details                 │
└─────────────────────────────────────────────────┘
```

**Features:**
- Interactive nodes (click to see agent details)
- Zoom and pan controls
- Export to multiple formats
- Highlight critical paths
- Show escalation routes

---

### 6. AgentSimulator Component

**Purpose:** Simulate agent execution and show generated prompts

**Props:**
```typescript
interface AgentSimulatorProps {
  agent: AgentDefinition;
  onSimulate: (input: any) => Promise<SimulationResult>;
  aiProvider: AIProviderConfig;
}
```

**Carbon Components Used:**
- `Tabs` for Input/Output/Prompt views
- `CodeSnippet` for prompt display
- `TextArea` for input
- `Button` for simulation trigger
- `Loading` for async operations
- `InlineNotification` for results

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Simulate: Fraud Agent                           │
│                                                  │
│ [Input] [Prompt] [Output] [Governance]          │
│                                                  │
│ Test Input:                                     │
│ ┌────────────────────────────────────────────┐ │
│ │ {                                          │ │
│ │   "claimNumber": "CLM-2024-001",          │ │
│ │   "claimAmount": 50000,                   │ │
│ │   "claimantHistory": [...]                │ │
│ │ }                                          │ │
│ └────────────────────────────────────────────┘ │
│                                                  │
│                          [Run Simulation]       │
│                                                  │
│ Result:                                         │
│ ┌────────────────────────────────────────────┐ │
│ │ Risk Level: MEDIUM                         │ │
│ │ Confidence: 0.85                           │ │
│ │ Recommendation: Supervisor Review          │ │
│ │ Reasoning: [AI explanation]                │ │
│ └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Features:**
- JSON input editor with validation
- View generated prompt before execution
- Run simulation (mock or live)
- Display results with confidence scores
- Show governance controls applied
- Trace decision path

---

### 7. GovernancePanel Component

**Purpose:** Display and configure governance controls

**Props:**
```typescript
interface GovernancePanelProps {
  agent: AgentDefinition;
  onUpdate: (controls: GovernanceControl[]) => void;
  readOnly?: boolean;
}
```

**Carbon Components Used:**
- `StructuredList` for controls
- `Tag` for control types
- `Toggle` for enable/disable
- `Accordion` for detailed settings

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Governance Controls                             │
│                                                  │
│ ▼ Audit Controls                                │
│   ✓ Log all decisions                           │
│   ✓ Record input/output pairs                   │
│   ✓ Track execution time                        │
│                                                  │
│ ▼ Approval Requirements                         │
│   ✓ Supervisor approval for high-risk cases     │
│   ✓ Human review for amounts > $10,000          │
│                                                  │
│ ▼ Constraints                                   │
│   ✓ Maximum processing time: 30 seconds         │
│   ✓ Confidence threshold: 0.75                  │
│   ✓ Escalation on uncertainty                   │
│                                                  │
│ ▼ Validation Rules                              │
│   ✓ Required fields check                       │
│   ✓ Data format validation                      │
│   ✓ Business rule compliance                    │
└─────────────────────────────────────────────────┘
```

---

### 8. WorkflowBuilder Component

**Purpose:** Drag-and-drop workflow creation

**Props:**
```typescript
interface WorkflowBuilderProps {
  vertical: VerticalConfig;
  availableAgents: AgentDefinition[];
  onSave: (workflow: WorkflowDefinition) => void;
}
```

**Carbon Components Used:**
- `Tile` for agent palette
- Custom canvas for workflow
- `Button` for actions
- `Modal` for connection configuration

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Build Workflow                    [Save] [Test] │
│                                                  │
│ Agent Palette        │ Canvas                   │
│ ┌─────────────────┐ │ ┌────────────────────┐  │
│ │ Intake Agent    │ │ │                    │  │
│ │ Evidence Agent  │ │ │  [Drag agents      │  │
│ │ Fraud Agent     │ │ │   here to build    │  │
│ │ Policy Agent    │ │ │   workflow]        │  │
│ │ Settlement Agent│ │ │                    │  │
│ │ Supervisor      │ │ │                    │  │
│ └─────────────────┘ │ └────────────────────┘  │
│                                                  │
│ [Generate Mermaid] [Preview] [Export]           │
└─────────────────────────────────────────────────┘
```

**Features:**
- Drag agents from palette to canvas
- Connect agents with conditional logic
- Auto-layout option
- Generate Mermaid DSL
- Validate workflow completeness
- Test workflow with sample data

---

## Shared Components

### 9. PromptViewer Component

**Purpose:** Display formatted AI prompts with syntax highlighting

**Props:**
```typescript
interface PromptViewerProps {
  prompt: string;
  language?: string;
  copyable?: boolean;
  editable?: boolean;
  onChange?: (value: string) => void;
}
```

**Carbon Components Used:**
- `CodeSnippet` (multi-line)
- `Button` for copy action
- Monaco Editor for editable mode

---

### 10. MermaidRenderer Component

**Purpose:** Render Mermaid diagrams with interactivity

**Props:**
```typescript
interface MermaidRendererProps {
  dsl: string;
  interactive?: boolean;
  onNodeClick?: (nodeId: string) => void;
  theme?: 'light' | 'dark';
}
```

**Implementation:**
- Uses mermaid.js library
- Adds click handlers to SVG elements
- Supports zoom/pan
- Responsive sizing

---

### 11. AgentCard Component

**Purpose:** Compact agent display for lists and grids

**Props:**
```typescript
interface AgentCardProps {
  agent: AgentDefinition;
  onClick: () => void;
  actions?: AgentAction[];
  compact?: boolean;
}
```

**Carbon Components Used:**
- `Tile` or `ClickableTile`
- `Tag` for archetype
- `OverflowMenu` for actions

**Layout:**
```
┌──────────────────────────┐
│ Intake Agent        [⋮]  │
│ Intake Archetype         │
│                          │
│ Gathers information from │
│ users and asks follow-up │
│ questions...             │
│                          │
│ Authority: Supervised    │
│ Inputs: 3 | Outputs: 1   │
└──────────────────────────┘
```

---

### 12. ValidationMessage Component

**Purpose:** Display validation errors and warnings

**Props:**
```typescript
interface ValidationMessageProps {
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  details?: string[];
  dismissible?: boolean;
}
```

**Carbon Components Used:**
- `InlineNotification` or `ToastNotification`

---

## Component Hierarchy

```
App
├── Header (Carbon)
├── Router
│   ├── HomePage
│   │   └── VerticalSelector
│   ├── VerticalPage
│   │   ├── AgentCatalog
│   │   │   ├── AgentCard (multiple)
│   │   │   └── AgentDetailModal
│   │   ├── WorkflowVisualizer
│   │   │   └── MermaidRenderer
│   │   └── AgentBuilder
│   │       ├── GovernancePanel
│   │       └── PromptViewer
│   └── SimulatorPage
│       └── AgentSimulator
│           ├── PromptViewer
│           └── ValidationMessage
└── Footer (Carbon)
```

---

## State Management

### Global State (React Context)

```typescript
interface AppState {
  // Current vertical
  selectedVertical: VerticalConfig | null;
  
  // Available data
  verticals: VerticalConfig[];
  agents: Record<string, AgentDefinition[]>; // keyed by vertical
  workflows: Record<string, WorkflowDefinition[]>;
  
  // User workspace
  customAgents: AgentDefinition[];
  customWorkflows: WorkflowDefinition[];
  
  // Configuration
  aiProvider: AIProviderConfig;
  
  // UI state
  loading: boolean;
  error: string | null;
}
```

### Actions

```typescript
interface AppActions {
  selectVertical: (verticalId: string) => void;
  loadAgents: (verticalId: string) => Promise<void>;
  createAgent: (agent: AgentDefinition) => Promise<void>;
  updateAgent: (agentId: string, updates: Partial<AgentDefinition>) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  createWorkflow: (workflow: WorkflowDefinition) => Promise<void>;
  simulateAgent: (agentId: string, input: any) => Promise<SimulationResult>;
  updateAIProvider: (config: AIProviderConfig) => void;
}
```

---

## Responsive Design

### Breakpoints (Carbon Design)
- Small: 320px - 671px (mobile)
- Medium: 672px - 1055px (tablet)
- Large: 1056px - 1311px (desktop)
- X-Large: 1312px+ (large desktop)

### Responsive Behaviors

**VerticalSelector:**
- Small: 1 column
- Medium: 2 columns
- Large: 3 columns

**AgentCatalog:**
- Small: List view only
- Medium: List or grid toggle
- Large: Grid view default

**WorkflowVisualizer:**
- Small: Vertical layout, scrollable
- Medium: Horizontal layout with zoom
- Large: Full canvas with pan/zoom

**AgentBuilder:**
- Small: Single column, accordion sections
- Medium: Two columns (form + preview)
- Large: Three columns (form + preview + help)

---

## Accessibility

### WCAG 2.1 AA Compliance

**Keyboard Navigation:**
- All interactive elements accessible via Tab
- Enter/Space to activate buttons
- Arrow keys for lists and menus
- Escape to close modals

**Screen Reader Support:**
- Semantic HTML elements
- ARIA labels for custom components
- Live regions for dynamic content
- Descriptive link text

**Visual:**
- Minimum contrast ratio 4.5:1
- Focus indicators on all interactive elements
- No color-only information
- Resizable text up to 200%

**Carbon Design Built-in:**
- All Carbon components are accessible by default
- Follow Carbon accessibility guidelines
- Use Carbon's focus management

---

## Performance Considerations

### Code Splitting
- Lazy load routes
- Lazy load heavy components (Monaco Editor, Mermaid)
- Dynamic imports for AI provider modules

### Optimization
- Memoize expensive computations
- Virtualize long lists (react-window)
- Debounce search inputs
- Cache API responses

### Bundle Size
- Tree-shake unused Carbon components
- Use production builds
- Compress assets
- CDN for static resources

---

## Testing Strategy

### Unit Tests (Vitest)
- Component rendering
- User interactions
- State management
- Utility functions

### Integration Tests
- Component composition
- API integration
- Workflow generation
- Agent simulation

### E2E Tests (Playwright)
- Complete user flows
- Cross-browser testing
- Accessibility testing
- Performance testing

---

## Component Development Checklist

For each component:
- [ ] TypeScript interfaces defined
- [ ] Props validated with PropTypes or Zod
- [ ] Responsive design implemented
- [ ] Accessibility tested
- [ ] Unit tests written
- [ ] Storybook story created
- [ ] Documentation updated
- [ ] Performance optimized

---

*Last Updated: 2026-05-13*