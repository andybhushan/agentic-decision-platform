# Claims Vertical Slice Module

## Overview

A self-contained insurance claims adjudication module built on top of the Agent Workflow Builder platform. This module demonstrates a credible agentic insurance claims journey for stage demos, featuring decision-centric UX, evidence provenance tracking, and governed action execution.

## Architecture

### Backend Components

**Location:** `backend/src/`

#### Types (`backend/src/types/index.ts`)
- `Claim` - Core claim entity with full lifecycle data
- `EvidenceItem` - Evidence with provenance tracking
- `AnomalySignal` - Detected anomalies requiring human review
- `NarrativeElement` - Chronological claim narrative with verification status
- `RecommendedAction` - AI-recommended actions with confidence levels
- `DecisionOutcome` - Human decision records with audit trail
- `FNOLSubmission` - First Notice of Loss intake data

#### Service Layer (`backend/src/services/claimsService.ts`)
Follows the established `agentService.ts` pattern:
- `getAllClaims(filters?)` - List claims with optional filtering
- `getClaimById(id)` - Retrieve single claim
- `createClaim(submission)` - Create claim from FNOL intake
- `updateClaimDecision(id, outcome)` - Log decision outcome
- `getClaimEvidence(id)` - Retrieve evidence items

#### Routes (`backend/src/routes/claimsRoutes.ts`)
RESTful API endpoints:
- `GET /api/v1/claims` - List claims
- `GET /api/v1/claims/:id` - Get claim details
- `POST /api/v1/claims` - Create new claim
- `PUT /api/v1/claims/:id/decision` - Submit decision
- `GET /api/v1/claims/:id/evidence` - Get evidence items

#### Mock Data (`backend/data/claims.json`)
Three realistic auto insurance claim scenarios:
1. **High Confidence** - Straightforward rear-end collision
2. **Medium Confidence** - Multi-vehicle intersection incident with disputed liability
3. **Low Confidence** - Complex injury claim with anomalies requiring investigation

### Frontend Components

**Location:** `frontend/src/pages/`

#### 1. FNOL Intake Page (`/claims/intake`)
**File:** `FNOLIntakePage.tsx` + `.scss`

Structured form for first notice of loss capture:
- Incident type, date, time, location
- Parties involved (repeatable fields)
- Injury indicator and police report reference
- Immediate needs (multi-select)
- Preferred contact channel
- Free text incident description

**Flow:** Submit → Create claim → Redirect to queue with confirmation

#### 2. Decision Queue Page (`/claims/queue`)
**File:** `DecisionQueuePage.tsx` + `.scss`

Primary adjuster landing view showing ranked pending decisions:
- Decision type required (Coverage Verification, Anomaly Review, Settlement Approval)
- Reason for human attention
- Confidence indicators (high/medium/low with color coding)
- Last agent action and time in queue
- Priority badges

**Features:**
- Filter by decision type and confidence level
- Search by claim ID
- Click to navigate to Decision Mode

#### 3. Decision Mode Page (`/claims/:id/decision`)
**File:** `DecisionModePage.tsx` + `.scss`

Focused decision workspace with two-column layout:

**Left Column (Primary):**
- Narrative synthesis with verification status tags
- Anomaly signals with evidence sources
- Recommended action with confidence and rationale

**Right Column (Supporting):**
- Policy context with relevant clauses
- Evidence summary with provenance labels
- Claimant details

**Action Bar:**
- Approve Recommended Action → Preview
- Redirect/Reassign
- Request More Evidence
- Add Note

#### 4. Evidence & Policy Context Page (`/claims/:id/evidence`)
**File:** `EvidencePolicyPage.tsx` + `.scss`

Full evidence and policy detail view:
- Complete evidence list with source, date, status, provenance
- Policy document with extracted clauses
- Coverage applicability matrix
- Consent and authorization tracking

**Features:**
- Tabbed interface (Evidence, Policy, Coverage, Consent)
- Expandable evidence items
- Policy clause highlighting

#### 5. Governed Action Preview Page (`/claims/:id/preview-action`)
**File:** `ActionPreviewPage.tsx` + `.scss`

Adapts SimulatorPage governance pattern for claims:
- Action summary with confidence level
- Agent execution details and capabilities
- Data read/write operations
- Audit and compliance checks
- Estimated impact assessment
- Claimant-facing message preview

**Actions:**
- Confirm and Execute → Log decision → Return to queue
- Reject → Provide reason → Return to queue

### Navigation

**Updated:** `frontend/src/components/layout/AppHeader.tsx`

Added top-level "Claims Demo" menu with sub-items:
- FNOL Intake
- Decision Queue

### Routing

**Updated:** `frontend/src/App.tsx`

New routes:
```
/claims                        → redirects to /claims/queue
/claims/queue                  → Decision Queue page
/claims/intake                 → FNOL Intake page
/claims/:id/decision           → Decision Mode page
/claims/:id/evidence           → Evidence & Policy Context page
/claims/:id/preview-action     → Governed Action Preview page
```

## Key Features

### 1. Decision-Centric UX
Unlike traditional claim management systems that show flat lists of claims, this module surfaces **decisions requiring human attention** with clear context about why the agent needs help.

### 2. Evidence Provenance
All evidence items are labeled with their source:
- **Claimant Provided** - Documents submitted by claimant
- **Third Party** - Police reports, witness statements
- **Public Record** - DMV records, property records
- **Agent Inferred** - AI-derived insights

### 3. Confidence Indicators
Every decision shows confidence level (high/medium/low) with:
- Color-coded tags (green/cyan/red)
- Rationale for confidence assessment
- Impact on recommended actions

### 4. Narrative Synthesis
Claims are presented as chronological narratives with verification status:
- **Confirmed** - Verified by multiple sources
- **Disputed** - Conflicting information
- **Inferred** - AI-derived from available data
- **Pending** - Awaiting verification

### 5. Governed Actions
All actions go through governance preview showing:
- What the agent will do
- What data it will access
- Compliance implications
- Claimant communication preview

### 6. Audit Trail
Every decision is logged with:
- Timestamp
- User ID
- Decision outcome (approved/rejected)
- Rationale
- System state at time of decision

## Design Patterns

### Carbon Design System
All components use IBM Carbon Design System:
- `DataTable` for queue and evidence lists
- `Tile` for content sections
- `Tag` for status indicators
- `Modal` for confirmations
- `InlineNotification` for feedback
- `Form` components for data entry

### Service Layer Pattern
Backend follows established patterns:
- JSON file-based storage
- Synchronous CRUD operations
- Consistent error handling
- Type-safe interfaces

### Self-Contained Module
The claims module is architecturally isolated:
- No modifications to existing pages/routes/services
- Can be removed without breaking existing functionality
- Can be promoted to standalone app
- Uses platform capabilities without tight coupling

## Mock Data Scenarios

### Claim CLM-2024-001 (High Confidence)
**Type:** Auto - Rear-end collision  
**Confidence:** High  
**Decision:** Coverage Verification  
**Narrative:** Clear liability, consistent evidence, straightforward policy application

### Claim CLM-2024-002 (Medium Confidence)
**Type:** Auto - Intersection collision  
**Confidence:** Medium  
**Decision:** Anomaly Review  
**Narrative:** Disputed liability, conflicting witness statements, requires investigation

### Claim CLM-2024-003 (Low Confidence)
**Type:** Auto - Multi-vehicle with injury  
**Confidence:** Low  
**Decision:** Settlement Approval  
**Narrative:** Complex injury claim, medical record inconsistencies, high-value settlement

## User Journey

### Complete Flow
1. **Intake:** Adjuster or claimant submits FNOL form
2. **Queue:** Claim appears in decision queue with priority and confidence
3. **Decision:** Adjuster reviews narrative, evidence, policy context, and anomalies
4. **Evidence:** Adjuster can drill into full evidence and policy details
5. **Preview:** Adjuster approves recommended action and reviews governance preview
6. **Execute:** Action is executed, logged, and claimant is notified
7. **Queue:** Adjuster returns to queue to handle next decision

### Alternative Paths
- **Request More Evidence:** Returns claim to pending state
- **Reject Action:** Logs rejection reason and returns to queue
- **Redirect/Reassign:** Transfers to different adjuster or team

## API Integration

### Frontend API Client
**File:** `frontend/src/services/api.ts`

Claims methods added to existing `APIClient` class:
```typescript
api.getClaims(filters?)      // List claims
api.getClaim(id)             // Get single claim
api.createClaim(submission)  // Create from FNOL
api.submitDecision(id, outcome) // Log decision
api.getClaimEvidence(id)     // Get evidence items
```

### Type Safety
All API methods use TypeScript types from `frontend/src/types/index.ts` ensuring type safety across the stack.

## Testing the Module

### Prerequisites
1. Backend server running on port 3001
2. Frontend dev server running on port 5173
3. No additional dependencies required

### Test Scenarios

#### 1. FNOL Submission
1. Navigate to "Claims Demo" → "FNOL Intake"
2. Fill out form with test data
3. Submit and verify redirect to queue
4. Confirm new claim appears in queue

#### 2. Decision Review
1. Navigate to "Claims Demo" → "Decision Queue"
2. Click on a claim (e.g., CLM-2024-002)
3. Review narrative synthesis and anomaly signals
4. Check evidence provenance labels
5. Review policy context in right column

#### 3. Evidence Deep Dive
1. From Decision Mode, click "See All Evidence"
2. Review evidence items in tabbed interface
3. Expand evidence items for details
4. Check policy clauses and coverage matrix

#### 4. Action Approval
1. From Decision Mode, click "Approve Recommended Action"
2. Review governance preview
3. Check compliance checks (all should pass)
4. Review claimant message preview
5. Click "Confirm and Execute"
6. Verify success notification and return to queue

#### 5. Action Rejection
1. From Action Preview, click "Reject Action"
2. Provide rejection reason
3. Submit and verify return to queue
4. Check that claim remains in queue with updated status

### Expected Behavior
- All pages load without errors
- Navigation works correctly
- Forms validate input
- API calls succeed
- Notifications appear on actions
- Data persists across page navigation
- Responsive design works on mobile

## Acceptance Criteria

✅ **Complete** - All criteria met:

1. ✅ User can submit FNOL form and land in decision queue
2. ✅ Queue shows at least three prioritized decisions with confidence levels
3. ✅ Adjuster can open decision and see evidence, policy context, narrative synthesis, and anomaly signals
4. ✅ Adjuster can approve governed action and see preview before execution
5. ✅ Confirmation and audit log entry recorded on approval
6. ✅ All routes reachable from navigation without breaking existing functionality

## Future Enhancements

### Phase 2 Considerations
- Real-time collaboration (multiple adjusters)
- Document upload and OCR
- Integration with actual policy management systems
- Machine learning model integration for confidence scoring
- Advanced analytics and reporting
- Mobile-optimized adjuster app
- Claimant self-service portal
- Integration with payment processing
- Fraud detection signals
- Regulatory compliance reporting

## Maintenance

### Adding New Claims
Edit `backend/data/claims.json` following the existing schema.

### Modifying Mock Data
Update claim objects in `claims.json` - changes are reflected immediately (no restart required with nodemon).

### Extending Types
Add new fields to types in both:
- `backend/src/types/index.ts`
- `frontend/src/types/index.ts`

### Adding New Pages
Follow the established pattern:
1. Create page component in `frontend/src/pages/`
2. Create corresponding SCSS file
3. Add route to `App.tsx`
4. Update navigation in `AppHeader.tsx` if needed

## Documentation

Additional documentation available:
- `CLAIMS-MODULE-SPECIFICATION.md` - Complete technical specification
- `CLAIMS-IMPLEMENTATION-ROADMAP.md` - 8-phase implementation guide
- `CLAIMS-ARCHITECTURE-DIAGRAM.md` - Mermaid diagrams and architecture
- `CLAIMS-QUICK-START.md` - Quick reference guide
- `PRD-ALIGNMENT-ANALYSIS.md` - PRD compliance verification (93% coverage)

## Support

For questions or issues:
1. Check existing documentation
2. Review mock data structure in `claims.json`
3. Examine similar patterns in existing pages (SimulatorPage, AgentCatalogPage)
4. Verify API endpoints are registered in `server.ts`

## License

Part of the Agent Workflow Builder platform.

---

**Made with Bob** - Claims Vertical Slice Module v1.0