# Claims Module - Implementation Roadmap

## Overview

This roadmap provides a step-by-step guide for implementing the Claims Vertical Slice Module. Follow these phases in order to ensure proper integration with the existing Agent Workflow Builder application.

## Phase 1: Foundation (Backend Types & Data)

**Goal**: Establish the data model and mock data foundation

### Step 1.1: Add Claims Types to Backend
**File**: `backend/src/types/index.ts`

Add all claims-related TypeScript interfaces at the end of the file:
- `ConfidenceLevel`, `DecisionType`, `Priority`, `ClaimStage`, `IncidentType`
- `EvidenceProvenance`, `NarrativeStatus`, `CoverageStatus`
- `EvidenceItem`, `NarrativeElement`, `AnomalySignal`
- `RecommendedAction`, `PolicyContext`, `AuditEntry`
- `Claim`, `FNOLSubmission`, `DecisionOutcome`

**Reference**: See CLAIMS-MODULE-SPECIFICATION.md "Data Model" section

### Step 1.2: Create Mock Claims Data
**File**: `backend/data/claims.json`

Create 3 realistic auto insurance claim scenarios:

**Claim 1 - High Confidence Coverage Verification**
```json
{
  "id": "CLM-2024-001",
  "claimantName": "Sarah Johnson",
  "incidentType": "Auto",
  "incidentDate": "2024-05-28",
  "incidentLocation": "Interstate 95, Exit 42, Baltimore, MD",
  "injuryIndicated": false,
  "confidenceLevel": "high",
  "pendingDecisionType": "Coverage Verification",
  "priority": "normal",
  "narrativeSynthesis": [
    {
      "timestamp": "2024-05-28T14:30:00Z",
      "description": "Claimant vehicle rear-ended at stoplight by insured party",
      "status": "Confirmed",
      "source": "Police Report #MD-2024-5892"
    },
    // ... more elements
  ],
  "anomalySignals": [],
  "evidenceItems": [
    {
      "id": "EV-001-001",
      "type": "Police Report",
      "description": "Official accident report with diagram and witness statements",
      "source": "Baltimore Police Department",
      "provenance": "Public Record",
      "dateReceived": "2024-05-28T16:00:00Z",
      "status": "verified"
    },
    // ... more evidence
  ],
  "recommendedAction": {
    "actionType": "Approve Coverage",
    "description": "Approve claim for coverage verification and proceed to damage assessment",
    "confidence": "high",
    "rationale": "Clear liability, comprehensive evidence, policy coverage confirmed",
    "estimatedImpact": "Standard processing timeline, estimated settlement $4,500-$6,000"
  }
}
```

**Claim 2 - Medium Confidence Anomaly Review**
- Timeline inconsistencies
- Conflicting witness statements
- Some evidence pending
- Requires additional investigation

**Claim 3 - Low Confidence Settlement Approval**
- Multiple parties involved
- Disputed liability
- High settlement amount
- Policy ambiguity

**Reference**: See CLAIMS-MODULE-SPECIFICATION.md "Mock Data Requirements" section

### Step 1.3: Verify Data Structure
- Ensure all required fields are present
- Validate JSON syntax
- Check that data demonstrates diverse scenarios

**Validation**: Run `node -e "console.log(JSON.parse(require('fs').readFileSync('./backend/data/claims.json')))"` to verify JSON is valid

---

## Phase 2: Backend Services & API

**Goal**: Implement backend business logic and API endpoints

### Step 2.1: Create Claims Service
**File**: `backend/src/services/claimsService.ts`

Follow the pattern from `agentService.ts`:

```typescript
import { Claim, FNOLSubmission, DecisionOutcome, EvidenceItem } from '../types';
import fs from 'fs/promises';
import path from 'path';

export class ClaimsService {
  private dataPath: string;
  private claims: Claim[] | null = null;

  constructor() {
    this.dataPath = path.join(__dirname, '../../data/claims.json');
  }

  // Implement methods:
  // - private async loadClaims(): Promise<Claim[]>
  // - async getAll(filters?): Promise<Claim[]>
  // - async getById(id: string): Promise<Claim | null>
  // - async create(submission: FNOLSubmission): Promise<Claim>
  // - async updateDecision(id: string, outcome: DecisionOutcome): Promise<Claim | null>
  // - async getEvidence(id: string): Promise<EvidenceItem[]>
  // - private async saveClaims(claims: Claim[]): Promise<void>
  // - private generateId(): string
}
```

**Key Implementation Notes**:
- Use in-memory caching like `agentService.ts`
- Generate IDs in format: `CLM-YYYY-NNN`
- When creating from FNOL, generate initial narrative, evidence, and recommended action
- Filter support for: stage, priority, decisionType
- Update audit trail on decision submission

### Step 2.2: Create Claims Routes
**File**: `backend/src/routes/claimsRoutes.ts`

Follow the pattern from `agentRoutes.ts`:

```typescript
import { Router } from 'express';
import { ClaimsService } from '../services/claimsService';

const router = Router();
const claimsService = new ClaimsService();

// GET /api/v1/claims - List claims with filters
router.get('/', async (req, res, next) => { /* ... */ });

// GET /api/v1/claims/:id - Get single claim
router.get('/:id', async (req, res, next) => { /* ... */ });

// POST /api/v1/claims - Create from FNOL
router.post('/', async (req, res, next) => { /* ... */ });

// PUT /api/v1/claims/:id/decision - Submit decision
router.put('/:id/decision', async (req, res, next) => { /* ... */ });

// GET /api/v1/claims/:id/evidence - Get evidence
router.get('/:id/evidence', async (req, res, next) => { /* ... */ });

export default router;
```

**Key Implementation Notes**:
- Use consistent error handling with try/catch and next(error)
- Return APIResponse format: `{ success: true, data: ..., meta: { ... } }`
- 404 responses for not found
- 201 status for POST creation

### Step 2.3: Register Claims Routes
**File**: `backend/src/server.ts`

Add after existing route registrations:

```typescript
import claimsRoutes from './routes/claimsRoutes';

// Add with other routes:
app.use('/api/v1/claims', claimsRoutes);
```

### Step 2.4: Test Backend API
- Start backend: `npm run dev:backend`
- Test endpoints with curl or Postman:
  - `GET http://localhost:3000/api/v1/claims`
  - `GET http://localhost:3000/api/v1/claims/CLM-2024-001`
  - `POST http://localhost:3000/api/v1/claims` (with FNOL data)

---

## Phase 3: Frontend Foundation

**Goal**: Set up frontend types and API integration

### Step 3.1: Add Claims Types to Frontend
**File**: `frontend/src/types/index.ts`

Copy all claims types from backend (they should be identical):
- All type aliases and interfaces from Phase 1.1

**Note**: Keep frontend and backend types in sync

### Step 3.2: Add Claims API Methods
**File**: `frontend/src/services/api.ts`

Add claims methods to the API class:

```typescript
// Add to existing API class:

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

### Step 3.3: Test API Integration
- Verify TypeScript compilation: `npm run build:frontend`
- Check that types are properly imported and used

---

## Phase 4: Page Components (Part 1 - Intake & Queue)

**Goal**: Build the entry points to the claims workflow

### Step 4.1: Create FNOL Intake Page
**Files**: 
- `frontend/src/pages/FNOLIntakePage.tsx`
- `frontend/src/pages/FNOLIntakePage.scss`

**Component Structure**:
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form, Grid, Column, Heading, TextInput, Dropdown, DatePicker,
  DatePickerInput, TimePicker, TimePickerSelect, Toggle, CheckboxGroup,
  Checkbox, RadioButtonGroup, RadioButton, TextArea, ButtonSet, Button,
  InlineNotification, Stack
} from '@carbon/react';
import { api } from '../services/api';
import type { FNOLSubmission, IncidentType } from '../types';
import './FNOLIntakePage.scss';

export const FNOLIntakePage = () => {
  // State for form fields
  // Form submission handler
  // Validation logic
  // Success notification with claim ID
  // Auto-redirect after 3 seconds
};
```

**Key Features**:
- Form validation before submission
- Repeatable parties involved section (add/remove)
- Immediate needs multi-select checkboxes
- Success notification with claim ID
- Auto-redirect to queue after 3 seconds

**Styling**: Follow existing page patterns with Carbon spacing tokens

### Step 4.2: Create Decision Queue Page
**Files**:
- `frontend/src/pages/DecisionQueuePage.tsx`
- `frontend/src/pages/DecisionQueuePage.scss`

**Component Structure**:
```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Column, Heading, DataTable, TableContainer, Table, TableHead,
  TableRow, TableHeader, TableBody, TableCell, Dropdown, Search, Button,
  Tag, Pagination, Loading
} from '@carbon/react';
import { api } from '../services/api';
import type { Claim } from '../types';
import './DecisionQueuePage.scss';

export const DecisionQueuePage = () => {
  // State for claims, filters, search
  // Load claims on mount
  // Filter and search logic
  // Row click navigation
  // Tag color coding for confidence and priority
};
```

**Key Features**:
- Filter by decision type and confidence level
- Search by claim ID
- Sortable columns (priority, time in queue)
- Color-coded tags for confidence and priority
- Click row to navigate to decision mode

**Tag Colors**:
- High confidence: `<Tag type="green">`
- Medium confidence: `<Tag type="yellow">`
- Low confidence: `<Tag type="red">`
- Urgent: `<Tag type="red">`
- High: `<Tag type="orange">`
- Normal: `<Tag type="blue">`
- Low: `<Tag type="gray">`

---

## Phase 5: Page Components (Part 2 - Decision Workspace)

**Goal**: Build the core decision-making interface

### Step 5.1: Create Decision Mode Page
**Files**:
- `frontend/src/pages/DecisionModePage.tsx`
- `frontend/src/pages/DecisionModePage.scss`

**Component Structure**:
```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Grid, Column, Heading, Tile, Tag, StructuredListWrapper, StructuredListHead,
  StructuredListRow, StructuredListCell, StructuredListBody, Accordion,
  AccordionItem, ButtonSet, Button, Loading, InlineNotification
} from '@carbon/react';
import { api } from '../services/api';
import type { Claim } from '../types';
import './DecisionModePage.scss';

export const DecisionModePage = () => {
  // Load claim by ID from URL params
  // Two-column layout (8/4 split)
  // Left: Narrative, Anomalies, Recommended Action
  // Right: Policy Context, Evidence Summary, Claimant Details
  // Bottom: Action buttons
};
```

**Layout**:
- Left column (8 units): Primary decision information
- Right column (4 units): Supporting context
- Bottom action bar: Full width button set

**Key Features**:
- Chronological narrative with status tags
- Expandable anomaly accordion
- Recommended action tile with confidence
- Evidence summary with "See All" link
- Action buttons with navigation

### Step 5.2: Create Evidence & Policy Page
**Files**:
- `frontend/src/pages/EvidencePolicyPage.tsx`
- `frontend/src/pages/EvidencePolicyPage.scss`

**Component Structure**:
```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Grid, Column, Heading, Tabs, TabList, Tab, TabPanels, TabPanel,
  DataTable, TableContainer, Table, TableHead, TableRow, TableHeader,
  TableBody, TableCell, TableExpandRow, TableExpandedRow, TableExpandHeader,
  CodeSnippet, Tag, Button, Loading
} from '@carbon/react';
import { api } from '../services/api';
import type { Claim, EvidenceItem } from '../types';
import './EvidencePolicyPage.scss';

export const EvidencePolicyPage = () => {
  // Load claim and evidence
  // Tabbed interface: Evidence / Policy / Consent
  // Expandable evidence table
  // Policy clause display
  // Back button to decision mode
};
```

**Key Features**:
- Three tabs: Evidence, Policy, Consent
- Expandable evidence rows for details
- Code snippet for policy clauses
- Coverage applicability matrix
- Back navigation

### Step 5.3: Create Action Preview Page
**Files**:
- `frontend/src/pages/ActionPreviewPage.tsx`
- `frontend/src/pages/ActionPreviewPage.scss`

**Component Structure**:
```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Grid, Column, Heading, Tile, InlineNotification, ButtonSet, Button,
  Loading, Tag, CodeSnippet
} from '@carbon/react';
import { api } from '../services/api';
import type { Claim, DecisionOutcome } from '../types';
import './ActionPreviewPage.scss';

export const ActionPreviewPage = () => {
  // Load claim
  // Display recommended action details
  // Show governance implications
  // Preview claimant message
  // Confirm/reject buttons
  // Submit decision on confirm
};
```

**Key Features**:
- Adapt SimulatorPage governance preview pattern
- Show action summary and implications
- Preview claimant-facing message
- Governance check display
- Confirm and execute flow
- Success notification and queue navigation

**Reference**: Study `SimulatorPage.tsx` lines 200-300 for governance preview pattern

---

## Phase 6: Navigation & Routing

**Goal**: Integrate claims module into application navigation

### Step 6.1: Add Routes to App.tsx
**File**: `frontend/src/App.tsx`

Add imports:
```typescript
import { FNOLIntakePage } from './pages/FNOLIntakePage';
import { DecisionQueuePage } from './pages/DecisionQueuePage';
import { DecisionModePage } from './pages/DecisionModePage';
import { EvidencePolicyPage } from './pages/EvidencePolicyPage';
import { ActionPreviewPage } from './pages/ActionPreviewPage';
```

Add routes (before the catch-all `*` route):
```typescript
<Route path="/claims" element={<Navigate to="/claims/queue" replace />} />
<Route path="/claims/queue" element={<DecisionQueuePage />} />
<Route path="/claims/:id/decision" element={<DecisionModePage />} />
<Route path="/claims/:id/evidence" element={<EvidencePolicyPage />} />
<Route path="/claims/:id/preview-action" element={<ActionPreviewPage />} />
<Route path="/claims/intake" element={<FNOLIntakePage />} />
```

### Step 6.2: Update Navigation Header
**File**: `frontend/src/components/layout/AppHeader.tsx`

Add import:
```typescript
import { HeaderMenu } from '@carbon/react';
```

Add Claims Demo menu (after Reports menu item):
```typescript
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

**Note**: Ensure existing navigation items remain unchanged

---

## Phase 7: Testing & Validation

**Goal**: Verify complete user journey and acceptance criteria

### Step 7.1: Manual Testing Checklist

**FNOL Intake Flow**:
- [ ] Navigate to Claims Demo → FNOL Intake
- [ ] Fill out form with all required fields
- [ ] Submit form successfully
- [ ] See confirmation notification with claim ID
- [ ] Auto-redirect to decision queue after 3 seconds

**Decision Queue Flow**:
- [ ] See at least 3 claims in queue
- [ ] Verify confidence level tags (high/medium/low with correct colors)
- [ ] Verify priority tags
- [ ] Filter by decision type
- [ ] Filter by confidence level
- [ ] Search by claim ID
- [ ] Click claim row to navigate to decision mode

**Decision Mode Flow**:
- [ ] See narrative synthesis with status tags
- [ ] See anomaly signals (if present)
- [ ] See recommended action with confidence
- [ ] See policy context in right column
- [ ] See evidence summary with provenance tags
- [ ] Click "See All" to navigate to evidence page
- [ ] Click "Approve Recommended Action" to navigate to preview

**Evidence & Policy Flow**:
- [ ] See evidence tab with all items
- [ ] See policy tab with clauses
- [ ] See consent tab
- [ ] Navigate back to decision mode

**Action Preview Flow**:
- [ ] See action summary
- [ ] See governance implications
- [ ] See claimant message preview
- [ ] Click "Confirm and Execute"
- [ ] See success notification
- [ ] Navigate back to queue
- [ ] Verify audit trail updated

### Step 7.2: Integration Testing

**Navigation**:
- [ ] All existing navigation items still work
- [ ] Claims Demo menu appears in header
- [ ] Sub-menu items navigate correctly
- [ ] No broken links

**Data Flow**:
- [ ] Backend API responds correctly
- [ ] Frontend displays data properly
- [ ] Form submissions create claims
- [ ] Decision submissions update claims
- [ ] Audit trail records actions

**Error Handling**:
- [ ] Invalid claim ID shows error
- [ ] Network errors display notifications
- [ ] Form validation works
- [ ] 404 routes redirect properly

### Step 7.3: Acceptance Criteria Verification

Verify all acceptance criteria from specification:

1. ✅ User can submit FNOL form and land in decision queue
2. ✅ Queue shows at least three prioritized decisions with confidence levels
3. ✅ Adjuster can open decision and see all required information
4. ✅ Adjuster can approve governed action and see preview
5. ✅ Confirmation and audit log entry recorded on approval
6. ✅ All routes reachable from navigation
7. ✅ No existing functionality broken
8. ✅ Module is self-contained
9. ✅ Uses Carbon Design System consistently
10. ✅ Provides sufficient context for development team

---

## Phase 8: Documentation & Handoff

**Goal**: Prepare for development team handoff

### Step 8.1: Code Documentation
- [ ] Add JSDoc comments to all service methods
- [ ] Add inline comments for complex logic
- [ ] Document component props with TypeScript
- [ ] Add README section for claims module

### Step 8.2: Create Handoff Checklist

**Files Created**:
- [ ] `backend/data/claims.json`
- [ ] `backend/src/services/claimsService.ts`
- [ ] `backend/src/routes/claimsRoutes.ts`
- [ ] `frontend/src/pages/FNOLIntakePage.tsx` + `.scss`
- [ ] `frontend/src/pages/DecisionQueuePage.tsx` + `.scss`
- [ ] `frontend/src/pages/DecisionModePage.tsx` + `.scss`
- [ ] `frontend/src/pages/EvidencePolicyPage.tsx` + `.scss`
- [ ] `frontend/src/pages/ActionPreviewPage.tsx` + `.scss`

**Files Modified**:
- [ ] `backend/src/types/index.ts` (added claims types)
- [ ] `backend/src/server.ts` (registered claims routes)
- [ ] `frontend/src/types/index.ts` (added claims types)
- [ ] `frontend/src/services/api.ts` (added claims methods)
- [ ] `frontend/src/App.tsx` (added claims routes)
- [ ] `frontend/src/components/layout/AppHeader.tsx` (added claims menu)

**No Files Modified** (verify these remain unchanged):
- [ ] All existing pages (HomePage, AgentCatalogPage, etc.)
- [ ] All existing services (agentService, verticalService, etc.)
- [ ] All existing routes (agentRoutes, verticalRoutes, etc.)

### Step 8.3: Production Readiness Notes

Document for development team:

**Immediate Production Needs**:
1. Replace JSON file storage with database
2. Add authentication and authorization
3. Integrate real AI provider
4. Add comprehensive error handling
5. Implement audit logging to persistent storage
6. Add unit and integration tests

**Future Enhancements**:
1. Real-time queue updates (WebSocket)
2. Document upload and OCR
3. Email/SMS integration
4. Advanced fraud detection
5. Analytics dashboard
6. Workflow automation integration

---

## Troubleshooting Guide

### Common Issues

**Backend won't start**:
- Check `claims.json` is valid JSON
- Verify all imports are correct
- Check port 3000 is not in use

**Frontend compilation errors**:
- Ensure types are synced between frontend/backend
- Check all imports are correct
- Verify Carbon components are imported properly

**Routes not working**:
- Check route order in App.tsx (specific before general)
- Verify Navigate redirect is correct
- Check URL params match route definitions

**Data not loading**:
- Check backend API is running
- Verify CORS settings
- Check browser console for errors
- Verify API base URL in frontend

**Styling issues**:
- Ensure SCSS files are imported in components
- Check Carbon theme is applied
- Verify spacing tokens are used correctly

---

## Success Metrics

The implementation is successful when:

1. **Functional**: All user journeys work end-to-end
2. **Consistent**: UI matches existing application style
3. **Self-contained**: Module can be removed cleanly
4. **Documented**: Development team has clear context
5. **Extensible**: Clear extension points identified
6. **Production-ready**: Path to production is documented

---

## Next Steps After Prototype

1. **Review with stakeholders**: Gather feedback on UX and workflow
2. **Technical review**: Assess architecture and patterns
3. **Production planning**: Create detailed production implementation plan
4. **Team handoff**: Transfer knowledge to development team
5. **Iteration**: Refine based on feedback

---

## References

- **Main Specification**: `CLAIMS-MODULE-SPECIFICATION.md`
- **Existing Patterns**: 
  - Backend: `backend/src/services/agentService.ts`
  - Routes: `backend/src/routes/agentRoutes.ts`
  - Frontend: `frontend/src/pages/SimulatorPage.tsx`
- **Carbon Design System**: https://carbondesignsystem.com/
- **React Router**: https://reactrouter.com/