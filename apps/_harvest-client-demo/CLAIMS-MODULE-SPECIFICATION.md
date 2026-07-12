# Claims Vertical Slice Module - Implementation Specification

## Overview

This document provides a complete specification for implementing a self-contained claims vertical slice module within the existing Agent Workflow Builder application. This is a **prototype** designed to demonstrate a credible agentic insurance claims journey and provide the development team with sufficient context for proper implementation.

## Purpose

- Demonstrate how the existing agent orchestration and governance engine can be applied to a real-world insurance claims domain
- Provide a working prototype that shows the complete user journey from FNOL intake through governed decision approval
- Serve as a reference implementation for building additional vertical slice modules
- Enable the development team to understand patterns, data structures, and UI/UX expectations

## Architecture Principles

### Self-Contained Module
- All claims-specific code is isolated and can be removed or promoted to standalone app without orphaned dependencies
- No modifications to existing pages, routes, services, or components (except navigation shell)
- Follows existing patterns: service layer, route structure, Carbon Design System, TypeScript types

### Platform Integration
- Built on top of existing agent orchestration and governance engine
- Reuses governance preview pattern from SimulatorPage
- Integrates with existing navigation and layout shell
- Uses same mock AI provider pattern (no real AI calls required)

## File Structure

```
backend/
├── data/
│   └── claims.json                    # Mock claims data (3 realistic scenarios)
├── src/
│   ├── routes/
│   │   └── claimsRoutes.ts           # Claims API endpoints
│   ├── services/
│   │   └── claimsService.ts          # Claims business logic
│   └── types/
│       └── index.ts                   # Add claims types here

frontend/
├── src/
│   ├── pages/
│   │   ├── FNOLIntakePage.tsx        # First Notice of Loss form
│   │   ├── FNOLIntakePage.scss
│   │   ├── DecisionQueuePage.tsx     # Prioritized decision list
│   │   ├── DecisionQueuePage.scss
│   │   ├── DecisionModePage.tsx      # Main adjuster workspace
│   │   ├── DecisionModePage.scss
│   │   ├── EvidencePolicyPage.tsx    # Full evidence/policy detail
│   │   ├── EvidencePolicyPage.scss
│   │   ├── ActionPreviewPage.tsx     # Governed action preview
│   │   └── ActionPreviewPage.scss
│   ├── types/
│   │   └── index.ts                   # Add claims types here
│   ├── services/
│   │   └── api.ts                     # Add claims API methods
│   └── components/
│       └── layout/
│           └── AppHeader.tsx          # Add Claims Demo menu

```

## Data Model

### Core Types (Backend & Frontend)

```typescript
// Confidence level for AI-generated insights
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Decision types that require human attention
export type DecisionType =
  | 'Coverage Verification'
  | 'Anomaly Review'
  | 'Settlement Approval'
  | 'Policy Interpretation'
  | 'Fraud Investigation'
  | 'Duplicate Claim Review';

// Priority levels for queue ordering
export type Priority = 'urgent' | 'high' | 'normal' | 'low';

// Claim lifecycle stages
export type ClaimStage = 
  | 'intake'
  | 'investigation'
  | 'evaluation'
  | 'settlement'
  | 'closed';

// Incident types
export type IncidentType = 'Auto' | 'Property' | 'Medical';

// Evidence provenance labels
export type EvidenceProvenance =
  | 'Claimant Provided'
  | 'Third Party'
  | 'Public Record'
  | 'Agent Inferred';

// Intake channel tracking
export type IntakeChannel =
  | 'Web Portal'
  | 'Mobile App'
  | 'Phone'
  | 'Email'
  | 'Agent Assisted';

// Narrative element status
export type NarrativeStatus = 
  | 'Confirmed'
  | 'Disputed'
  | 'Inferred'
  | 'Pending';

// Coverage applicability
export type CoverageStatus = 'covered' | 'excluded' | 'ambiguous';

// Evidence item interface
export interface EvidenceItem {
  id: string;
  type: string;
  description: string;
  source: string;
  provenance: EvidenceProvenance;
  dateReceived: string;
  status: 'pending' | 'verified' | 'disputed';
  url?: string;
}

// Narrative synthesis element
export interface NarrativeElement {
  timestamp: string;
  description: string;
  status: NarrativeStatus;
  source: string;
}

// Anomaly signal
export interface AnomalySignal {
  id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  evidenceSource: string;
  explanation: string;
}

// Recommended action
export interface RecommendedAction {
  actionType: string;
  description: string;
  confidence: ConfidenceLevel;
  rationale: string;
  estimatedImpact: string;
  agentId?: string;
  agentName?: string;
  claimantMessage?: string;
  financialImpact?: {
    estimatedAmount?: number;
    currency?: string;
    breakdown?: Array<{
      category: string;
      amount: number;
      description: string;
    }>;
  };
}

// Policy context
export interface PolicyContext {
  policyNumber: string;
  coverageType: string;
  relevantClauses: string[];
  coverageApplicability: CoverageStatus;
  ambiguityIndicators?: string[];
}

// Audit trail entry
export interface AuditEntry {
  timestamp: string;
  userId: string;
  action: string;
  rationale?: string;
  outcome: string;
}

// Related claim match
export interface RelatedClaimMatch {
  claimId: string;
  matchScore: number;
  matchReason: string;
  claimantName: string;
  incidentDate: string;
}

// Main Claim interface
export interface Claim {
  id: string;
  claimantName: string;
  claimantEmail?: string;
  claimantPhone?: string;
  incidentType: IncidentType;
  incidentDate: string;
  incidentTime?: string;
  incidentLocation: string;
  partiesInvolved: Array<{ name: string; role: string }>;
  injuryIndicated: boolean;
  policeReportRef?: string;
  immediateNeeds: string[];
  preferredContactChannel: 'Email' | 'SMS' | 'Phone';
  incidentDescription: string;
  intakeChannel?: IntakeChannel;
  
  // Policy and coverage
  policyRef: string;
  policyContext: PolicyContext;
  
  // Claim status
  claimStage: ClaimStage;
  pendingDecisionType: DecisionType;
  blockerReason: string;
  confidenceLevel: ConfidenceLevel;
  lastAgentAction: string;
  timeInQueue: string;
  priority: Priority;
  
  // Analysis and evidence
  narrativeSynthesis: NarrativeElement[];
  anomalySignals: AnomalySignal[];
  evidenceItems: EvidenceItem[];
  recommendedAction: RecommendedAction;
  relatedClaims?: RelatedClaimMatch[];
  
  // Audit
  auditTrail: AuditEntry[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// FNOL form submission
export interface FNOLSubmission {
  claimantName: string;
  claimantEmail?: string;
  claimantPhone?: string;
  incidentType: IncidentType;
  incidentDate: string;
  incidentTime?: string;
  incidentLocation: string;
  partiesInvolved: Array<{ name: string; role: string }>;
  injuryIndicated: boolean;
  policeReportRef?: string;
  immediateNeeds: string[];
  preferredContactChannel: 'Email' | 'SMS' | 'Phone';
  incidentDescription: string;
}

// Decision outcome
export interface DecisionOutcome {
  claimId: string;
  decision: 'approved' | 'rejected' | 'escalated' | 'more_info_needed';
  rationale: string;
  userId: string;
  timestamp: string;
  nextAction?: string;
}
```

## API Endpoints

### Backend Routes (`/api/v1/claims`)

```typescript
// GET /api/v1/claims
// List all claims with optional filters
// Query params: ?stage=investigation&priority=high&decisionType=Anomaly Review
Response: APIResponse<Claim[]>

// GET /api/v1/claims/:id
// Get single claim by ID
Response: APIResponse<Claim>

// POST /api/v1/claims
// Create new claim from FNOL intake
Body: FNOLSubmission
Response: APIResponse<Claim>

// PUT /api/v1/claims/:id/decision
// Log a decision outcome
Body: DecisionOutcome
Response: APIResponse<Claim>

// GET /api/v1/claims/:id/evidence
// Get evidence items for a claim
Response: APIResponse<EvidenceItem[]>
```

## Mock Data Requirements

Create 3 realistic auto insurance claim scenarios in `backend/data/claims.json`:

### Scenario 1: High Confidence - Coverage Verification
- **Purpose**: Demonstrate straightforward case with clear coverage
- **Confidence**: High
- **Decision Type**: Coverage Verification
- **Characteristics**:
  - Clear incident description (rear-end collision)
  - All required evidence present
  - No anomalies detected
  - Policy coverage clearly applies
  - Recommended action: Approve claim processing

### Scenario 2: Medium Confidence - Anomaly Review
- **Purpose**: Show AI detecting potential issues requiring human judgment
- **Confidence**: Medium
- **Decision Type**: Anomaly Review
- **Characteristics**:
  - Minor inconsistencies in timeline
  - Conflicting witness statements
  - Some evidence pending verification
  - Coverage applies but requires interpretation
  - Recommended action: Request additional evidence

### Scenario 3: Low Confidence - Settlement Approval
- **Purpose**: Demonstrate complex case requiring human expertise
- **Confidence**: Low
- **Decision Type**: Settlement Approval
- **Characteristics**:
  - Multiple parties involved
  - Disputed liability
  - High settlement amount
  - Policy ambiguity on coverage limits
  - Recommended action: Escalate to senior adjuster

Each claim should include:
- Complete narrative synthesis (5-8 chronological elements)
- 2-4 anomaly signals (for scenarios 2 & 3)
- 4-6 evidence items with varied provenance
- Realistic policy context with extracted clauses
- Audit trail showing agent actions

## Page Specifications

### 1. FNOL Intake Page (`/claims/intake`)

**Purpose**: Structured form for first notice of loss capture

**Layout**: Single column form using Carbon Form components

**Components**:
- `Form` wrapper
- `Dropdown` for incident type
- `DatePicker` and `TimePicker` for incident date/time
- `TextInput` for location
- `Stack` with repeatable `TextInput` pairs for parties involved (name + role)
- `Toggle` for injury indicator
- `TextInput` for police report reference
- `CheckboxGroup` for immediate needs
- `RadioButtonGroup` for preferred contact channel
- `TextArea` for incident description
- `ButtonSet` with Submit and Cancel buttons

**Behavior**:
- Form validation before submission
- On submit: POST to `/api/v1/claims`
- Show inline `InlineNotification` with claim ID and next steps
- Auto-redirect to `/claims/queue` after 3 seconds
- Cancel returns to queue

**Validation Rules**:
- Required: claimantName, incidentType, incidentDate, incidentLocation, incidentDescription
- Email format validation if provided
- Phone format validation if provided
- At least one party involved

### 2. Decision Queue Page (`/claims/queue`)

**Purpose**: Primary adjuster landing view showing prioritized decisions

**Layout**: Full-width with filter bar and data table

**Components**:
- `Grid` with filter controls:
  - `Dropdown` for decision type filter
  - `Dropdown` for confidence level filter
  - `Search` for claim ID search
  - `Button` to clear filters
- `DataTable` with columns:
  - Claim ID (link)
  - Decision Type Required
  - Reason for Human Attention
  - Confidence Level (with `Tag` color coding)
  - Last Agent Action
  - Time in Queue
  - Priority (with `Tag`)
- `Pagination` if needed

**Tag Color Coding**:
- High confidence: green
- Medium confidence: yellow
- Low confidence: red
- Urgent priority: red
- High priority: orange
- Normal priority: blue
- Low priority: gray

**Behavior**:
- Load claims on mount: GET `/api/v1/claims`
- Filter and search client-side
- Click row navigates to `/claims/:id/decision`
- Sort by priority and time in queue by default

### 3. Decision Mode Page (`/claims/:id/decision`)

**Purpose**: Focused decision workspace for adjuster

**Layout**: Two-column Carbon Grid (8/4 split)

**Left Column (Primary)**:
- `Heading` with claim ID
- `Section` for Narrative Synthesis:
  - `StructuredList` of chronological elements
  - Each element shows timestamp, description, and status `Tag`
- `Section` for Anomaly Signals:
  - `Accordion` with each anomaly as an item
  - Shows severity, explanation, and evidence source
- `Section` for Recommended Action:
  - `Tile` with action description
  - Confidence level with `Tag`
  - Rationale text
  - Estimated impact

**Right Column (Supporting)**:
- `Tile` for Policy Context:
  - Policy number
  - Coverage type
  - Relevant clauses (expandable)
  - Coverage applicability with `Tag`
- `Tile` for Evidence Summary:
  - List of evidence items
  - Provenance labels with `Tag`
  - "See All" link to evidence page
- `Tile` for Claimant Details:
  - Name, contact info
  - Preferred contact channel

**Bottom Action Bar**:
- `ButtonSet` with:
  - Primary: "Approve Recommended Action" → navigates to preview
  - Secondary: "Request More Evidence"
  - Secondary: "Redirect / Reassign"
  - Tertiary: "Add Note"
  - Tertiary: "AI Command" → opens AI command interface (optional enhancement)

**AI Command Interface** (Optional Enhancement for PRD FR-19):
- Inline command input with context awareness
- Suggested actions based on current claim state
- Natural language query support
- Example: "Explain the coverage ambiguity" or "Request medical records"

**Behavior**:
- Load claim on mount: GET `/api/v1/claims/:id`
- Display related claims warning if matches found (PRD FR-7)
- Action buttons show confirmation modals
- Approve button navigates to `/claims/:id/preview-action`
- AI Command opens contextual assistant interface

### 4. Evidence & Policy Context Page (`/claims/:id/evidence`)

**Purpose**: Full evidence and policy detail view

**Layout**: Two-column layout with tabs

**Components**:
- `Tabs` for Evidence / Policy / Consent sections
- Evidence tab:
  - `DataTable` with all evidence items
  - Columns: Type, Description, Source, Provenance, Date, Status
  - Expandable rows for additional details
- Policy tab:
  - Policy document reference
  - `CodeSnippet` for extracted clauses
  - Coverage applicability matrix
  - Ambiguity indicators if present
- Consent tab:
  - Authorization tracking status
  - Required consents checklist

**Behavior**:
- Load evidence: GET `/api/v1/claims/:id/evidence`
- Back button returns to decision mode

### 5. Governed Action Preview Page (`/claims/:id/preview-action`)

**Purpose**: Preview and confirm governed action before execution

**Layout**: Adapt SimulatorPage governance preview pattern

**Components**:
- `Heading` with action summary
- `Tile` sections for:
  - Agent that will execute
  - Data read/write operations
  - Audit and compliance implications
  - Estimated impact
  - Claimant-facing message preview
- `InlineNotification` for governance checks
- `ButtonSet`:
  - Primary: "Confirm and Execute"
  - Secondary: "Edit or Reject"

**Behavior**:
- Display recommended action details
- On confirm: PUT `/api/v1/claims/:id/decision`
- Show success notification
- Navigate back to queue
- On reject: return to decision mode

## Navigation Implementation

Update `AppHeader.tsx` to add Claims Demo menu:

```typescript
import { HeaderMenu, HeaderMenuItem } from '@carbon/react';

// Add to HeaderNavigation:
<HeaderMenu aria-label="Claims Demo" menuLinkName="Claims Demo">
  <HeaderMenuItem
    href="/claims/intake"
    onClick={(e) => {
      e.preventDefault();
      navigate('/claims/intake');
    }}
  >
    FNOL Intake
  </HeaderMenuItem>
  <HeaderMenuItem
    href="/claims/queue"
    onClick={(e) => {
      e.preventDefault();
      navigate('/claims/queue');
    }}
  >
    Decision Queue
  </HeaderMenuItem>
</HeaderMenu>
```

## Routing Configuration

Add to `App.tsx`:

```typescript
import { FNOLIntakePage } from './pages/FNOLIntakePage';
import { DecisionQueuePage } from './pages/DecisionQueuePage';
import { DecisionModePage } from './pages/DecisionModePage';
import { EvidencePolicyPage } from './pages/EvidencePolicyPage';
import { ActionPreviewPage } from './pages/ActionPreviewPage';

// Add routes:
<Route path="/claims" element={<Navigate to="/claims/queue" replace />} />
<Route path="/claims/queue" element={<DecisionQueuePage />} />
<Route path="/claims/:id/decision" element={<DecisionModePage />} />
<Route path="/claims/:id/evidence" element={<EvidencePolicyPage />} />
<Route path="/claims/:id/preview-action" element={<ActionPreviewPage />} />
<Route path="/claims/intake" element={<FNOLIntakePage />} />
```

## Service Implementation Pattern

Follow `agentService.ts` pattern:

```typescript
export class ClaimsService {
  private dataPath: string;
  private claims: Claim[] | null = null;

  constructor() {
    this.dataPath = path.join(__dirname, '../../data/claims.json');
  }

  private async loadClaims(): Promise<Claim[]> { /* ... */ }
  async getAll(filters?: { /* ... */ }): Promise<Claim[]> { /* ... */ }
  async getById(id: string): Promise<Claim | null> { /* ... */ }
  async create(submission: FNOLSubmission): Promise<Claim> { /* ... */ }
  async updateDecision(id: string, outcome: DecisionOutcome): Promise<Claim | null> { /* ... */ }
  async getEvidence(id: string): Promise<EvidenceItem[]> { /* ... */ }
  private async saveClaims(claims: Claim[]): Promise<void> { /* ... */ }
  private generateId(): string { /* ... */ }
}
```

## Frontend API Methods

Add to `services/api.ts`:

```typescript
// Claims API methods
async getClaims(filters?: {
  stage?: string;
  priority?: string;
  decisionType?: string;
}): Promise<Claim[]> {
  const response = await this.client.get<APIResponse<Claim[]>>('/claims', {
    params: filters,
  });
  return response.data.data || [];
}

async getClaim(id: string): Promise<Claim> {
  const response = await this.client.get<APIResponse<Claim>>(`/claims/${id}`);
  if (!response.data.data) {
    throw new Error('Claim not found');
  }
  return response.data.data;
}

async createClaim(submission: FNOLSubmission): Promise<Claim> {
  const response = await this.client.post<APIResponse<Claim>>('/claims', submission);
  if (!response.data.data) {
    throw new Error('Failed to create claim');
  }
  return response.data.data;
}

async submitDecision(id: string, outcome: DecisionOutcome): Promise<Claim> {
  const response = await this.client.put<APIResponse<Claim>>(
    `/claims/${id}/decision`,
    outcome
  );
  if (!response.data.data) {
    throw new Error('Failed to submit decision');
  }
  return response.data.data;
}

async getClaimEvidence(id: string): Promise<EvidenceItem[]> {
  const response = await this.client.get<APIResponse<EvidenceItem[]>>(
    `/claims/${id}/evidence`
  );
  return response.data.data || [];
}
```

## Styling Guidelines

All SCSS files should follow existing patterns:

```scss
@use '@carbon/react/scss/spacing' as *;
@use '@carbon/react/scss/theme' as *;
@use '@carbon/react/scss/breakpoint' as *;

.page-name {
  padding: $spacing-05;
  
  &__section {
    margin-bottom: $spacing-07;
  }
  
  &__header {
    margin-bottom: $spacing-05;
  }
  
  // Responsive breakpoints
  @include breakpoint-down(md) {
    padding: $spacing-03;
  }
}
```

## Acceptance Criteria

The module is complete when:

1. ✅ A user can submit an FNOL form and land in the decision queue
2. ✅ The queue shows at least three prioritized decisions with confidence levels
3. ✅ An adjuster can open one decision and see evidence, policy context, narrative synthesis and anomaly signals
4. ✅ The adjuster can approve a governed action and see a preview before it executes
5. ✅ A confirmation and audit log entry is recorded on approval
6. ✅ All routes are reachable from the existing navigation without breaking any existing functionality
7. ✅ The module is self-contained and can be removed without orphaned dependencies
8. ✅ All components use IBM Carbon Design System consistently
9. ✅ The prototype provides sufficient context for the development team to build the production solution

## Development Handoff Notes

### For the Development Team

This prototype demonstrates:

1. **Domain Modeling**: How to structure claims data with proper types and relationships
2. **User Journey**: Complete flow from intake through decision approval
3. **Governance Integration**: How to adapt the existing governance preview pattern for domain-specific actions
4. **UI/UX Patterns**: Carbon Design System usage for forms, tables, and decision workspaces
5. **API Design**: RESTful endpoint structure for claims operations
6. **Mock Data**: Realistic scenarios showing different confidence levels and decision types

### Production Considerations

When building the production version, consider:

1. **Real AI Integration**: Replace mock responses with actual AI provider calls
2. **Database**: Replace JSON file storage with proper database (PostgreSQL, MongoDB, etc.)
3. **Authentication**: Add user authentication and role-based access control
4. **Real-time Updates**: Consider WebSocket for queue updates
5. **Document Storage**: Integrate with document management system for evidence files
6. **Audit Logging**: Implement comprehensive audit trail with compliance requirements
7. **Performance**: Add pagination, caching, and optimization for large datasets
8. **Testing**: Add unit tests, integration tests, and E2E tests
9. **Error Handling**: Implement comprehensive error handling and recovery
10. **Accessibility**: Ensure WCAG 2.1 AA compliance

### Extension Points

The module can be extended with:

1. **Additional Decision Types**: Fraud investigation, subrogation, etc.
2. **Workflow Automation**: Integrate with existing orchestration engine
3. **Analytics Dashboard**: Claims metrics and performance tracking
4. **Communication Module**: Email/SMS integration for claimant communication
5. **Document OCR**: Automatic evidence extraction from uploaded documents
6. **Fraud Detection**: ML-based fraud scoring and investigation triggers

## References

- Existing patterns: [`agentService.ts`](backend/src/services/agentService.ts), [`SimulatorPage.tsx`](frontend/src/pages/SimulatorPage.tsx)
- Carbon Design System: https://carbondesignsystem.com/
- TypeScript types: [`backend/src/types/index.ts`](backend/src/types/index.ts), [`frontend/src/types/index.ts`](frontend/src/types/index.ts)