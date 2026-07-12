# Claims Module - Quick Start Guide

## For Development Team

This guide provides everything you need to understand and implement the Claims Vertical Slice Module prototype.

## 📚 Documentation Overview

Read these documents in order:

1. **CLAIMS-MODULE-SPECIFICATION.md** (this is the main spec)
   - Complete technical specification
   - Data models and API contracts
   - Page-by-page requirements
   - Acceptance criteria

2. **CLAIMS-IMPLEMENTATION-ROADMAP.md** (step-by-step guide)
   - 8 implementation phases
   - Detailed steps for each phase
   - Code examples and patterns
   - Testing checklist

3. **CLAIMS-ARCHITECTURE-DIAGRAM.md** (visual reference)
   - System architecture diagrams
   - Data flow sequences
   - Component hierarchies
   - Routing structure

4. **This document** (quick reference)
   - Key concepts
   - File checklist
   - Common patterns
   - Quick commands

## 🎯 What You're Building

A **self-contained insurance claims module** that demonstrates:
- How the existing agent orchestration platform applies to a real-world domain
- Complete user journey from claim intake through governed decision approval
- Proper integration patterns for vertical slice modules

**This is a prototype**, not a demo. It should provide sufficient context for building the production version.

## 🏗️ Architecture at a Glance

```
Frontend (React + TypeScript + Carbon)
    ↓
API Service Layer
    ↓
Backend Routes (Express)
    ↓
Service Layer (Business Logic)
    ↓
Data Layer (JSON files → Database in production)
```

## 📁 Files You'll Create

### Backend (7 files)
- [ ] `backend/data/claims.json` - Mock data (3 claims)
- [ ] `backend/src/services/claimsService.ts` - Business logic
- [ ] `backend/src/routes/claimsRoutes.ts` - API endpoints

### Frontend (10 files)
- [ ] `frontend/src/pages/FNOLIntakePage.tsx` + `.scss`
- [ ] `frontend/src/pages/DecisionQueuePage.tsx` + `.scss`
- [ ] `frontend/src/pages/DecisionModePage.tsx` + `.scss`
- [ ] `frontend/src/pages/EvidencePolicyPage.tsx` + `.scss`
- [ ] `frontend/src/pages/ActionPreviewPage.tsx` + `.scss`

### Modified Files (6 files)
- [ ] `backend/src/types/index.ts` - Add claims types
- [ ] `backend/src/server.ts` - Register claims routes
- [ ] `frontend/src/types/index.ts` - Add claims types
- [ ] `frontend/src/services/api.ts` - Add claims methods
- [ ] `frontend/src/App.tsx` - Add claims routes
- [ ] `frontend/src/components/layout/AppHeader.tsx` - Add claims menu

**Total: 23 files (17 new, 6 modified)**

## 🚀 Quick Start Commands

```bash
# Install dependencies (if not already done)
npm run install:all

# Start development servers
npm run dev

# Or start individually:
npm run dev:backend  # Backend on http://localhost:3000
npm run dev:frontend # Frontend on http://localhost:5173

# Build for production
npm run build

# Run linter
npm run lint
```

## 🔑 Key Concepts

### 1. Self-Contained Module
- All claims code is isolated
- Can be removed without breaking existing features
- No modifications to existing pages/services (except navigation)

### 2. Three Mock Claim Scenarios
- **High Confidence**: Clear coverage verification
- **Medium Confidence**: Anomaly review needed
- **Low Confidence**: Complex settlement requiring human expertise

### 3. User Journey
```
FNOL Intake → Decision Queue → Decision Mode → Action Preview → Back to Queue
                                      ↓
                              Evidence & Policy (optional)
```

### 4. Governance Integration
- Reuses existing governance preview pattern from SimulatorPage
- Shows how domain apps leverage platform capabilities

## 📋 Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Add claims types to `backend/src/types/index.ts`
- [ ] Create `backend/data/claims.json` with 3 realistic claims
- [ ] Verify JSON is valid

### Phase 2: Backend Services
- [ ] Create `backend/src/services/claimsService.ts`
- [ ] Create `backend/src/routes/claimsRoutes.ts`
- [ ] Register routes in `backend/src/server.ts`
- [ ] Test API endpoints with curl/Postman

### Phase 3: Frontend Foundation
- [ ] Add claims types to `frontend/src/types/index.ts`
- [ ] Add claims methods to `frontend/src/services/api.ts`
- [ ] Verify TypeScript compilation

### Phase 4: Pages (Part 1)
- [ ] Create FNOLIntakePage (form)
- [ ] Create DecisionQueuePage (table)
- [ ] Test intake → queue flow

### Phase 5: Pages (Part 2)
- [ ] Create DecisionModePage (two-column layout)
- [ ] Create EvidencePolicyPage (tabs)
- [ ] Create ActionPreviewPage (governance preview)
- [ ] Test complete decision flow

### Phase 6: Navigation
- [ ] Add routes to `frontend/src/App.tsx`
- [ ] Add Claims Demo menu to `frontend/src/components/layout/AppHeader.tsx`
- [ ] Test all navigation paths

### Phase 7: Testing
- [ ] Manual testing of complete user journey
- [ ] Verify all acceptance criteria
- [ ] Check existing features still work

### Phase 8: Documentation
- [ ] Add code comments
- [ ] Document any deviations from spec
- [ ] Note production considerations

## 🎨 Carbon Design System Components

You'll use these Carbon components:

**Forms**: `Form`, `TextInput`, `Dropdown`, `DatePicker`, `TimePicker`, `Toggle`, `CheckboxGroup`, `RadioButtonGroup`, `TextArea`

**Data Display**: `DataTable`, `StructuredList`, `Accordion`, `Tabs`, `CodeSnippet`

**Layout**: `Grid`, `Column`, `Stack`, `Tile`

**Feedback**: `Tag`, `InlineNotification`, `Loading`

**Actions**: `Button`, `ButtonSet`

**Navigation**: `HeaderMenu`, `HeaderMenuItem`

## 🔍 Pattern Reference

### Backend Service Pattern
```typescript
// Follow agentService.ts pattern
export class ClaimsService {
  private dataPath: string;
  private claims: Claim[] | null = null;

  constructor() {
    this.dataPath = path.join(__dirname, '../../data/claims.json');
  }

  private async loadClaims(): Promise<Claim[]> { /* ... */ }
  async getAll(filters?): Promise<Claim[]> { /* ... */ }
  async getById(id: string): Promise<Claim | null> { /* ... */ }
  async create(submission: FNOLSubmission): Promise<Claim> { /* ... */ }
  // ... more methods
}
```

### Backend Route Pattern
```typescript
// Follow agentRoutes.ts pattern
import { Router } from 'express';
import { ClaimsService } from '../services/claimsService';

const router = Router();
const claimsService = new ClaimsService();

router.get('/', async (req, res, next) => {
  try {
    const claims = await claimsService.getAll(/* filters */);
    res.json({ success: true, data: claims });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### Frontend Page Pattern
```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Column, Heading, /* ... */ } from '@carbon/react';
import { api } from '../services/api';
import type { Claim } from '../types';
import './PageName.scss';

export const PageName = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load data on mount
  }, []);

  return (
    <Grid className="page-name">
      <Column lg={16}>
        <Heading>Page Title</Heading>
        {/* Content */}
      </Column>
    </Grid>
  );
};
```

### SCSS Pattern
```scss
@use '@carbon/react/scss/spacing' as *;
@use '@carbon/react/scss/theme' as *;
@use '@carbon/react/scss/breakpoint' as *;

.page-name {
  padding: $spacing-05;
  
  &__section {
    margin-bottom: $spacing-07;
  }
  
  @include breakpoint-down(md) {
    padding: $spacing-03;
  }
}
```

## 🧪 Testing Quick Reference

### Backend API Testing
```bash
# List all claims
curl http://localhost:3000/api/v1/claims

# Get specific claim
curl http://localhost:3000/api/v1/claims/CLM-2024-001

# Create claim (POST with JSON body)
curl -X POST http://localhost:3000/api/v1/claims \
  -H "Content-Type: application/json" \
  -d '{"claimantName":"Test User","incidentType":"Auto",...}'

# Submit decision
curl -X PUT http://localhost:3000/api/v1/claims/CLM-2024-001/decision \
  -H "Content-Type: application/json" \
  -d '{"decision":"approved","rationale":"...",...}'
```

### Frontend Testing Checklist
- [ ] Navigate to Claims Demo → FNOL Intake
- [ ] Submit form and see confirmation
- [ ] Auto-redirect to queue
- [ ] See 3 claims with different confidence levels
- [ ] Filter by decision type
- [ ] Search by claim ID
- [ ] Click claim to open decision mode
- [ ] See narrative, anomalies, recommended action
- [ ] Click "See All" to view evidence
- [ ] Return to decision mode
- [ ] Click "Approve Action"
- [ ] See governance preview
- [ ] Confirm and execute
- [ ] See success notification
- [ ] Return to queue

## 🚨 Common Pitfalls

### 1. Type Mismatches
**Problem**: Frontend and backend types don't match
**Solution**: Keep types in sync between `backend/src/types/index.ts` and `frontend/src/types/index.ts`

### 2. Route Order
**Problem**: Routes not matching correctly
**Solution**: Put specific routes before general ones in `App.tsx`
```typescript
// Correct order:
<Route path="/claims/intake" element={<FNOLIntakePage />} />
<Route path="/claims/:id/decision" element={<DecisionModePage />} />
<Route path="/claims" element={<Navigate to="/claims/queue" />} />
```

### 3. CORS Issues
**Problem**: Frontend can't reach backend
**Solution**: Check CORS configuration in `backend/src/server.ts` includes frontend URL

### 4. Missing Carbon Imports
**Problem**: Components not rendering
**Solution**: Import from `@carbon/react`, not individual packages

### 5. State Not Updating
**Problem**: UI doesn't reflect data changes
**Solution**: Use proper React state management with `useState` and `useEffect`

## 📊 Data Structure Quick Reference

### Claim Object (Simplified)
```typescript
{
  id: "CLM-2024-001",
  claimantName: "Sarah Johnson",
  incidentType: "Auto",
  incidentDate: "2024-05-28",
  confidenceLevel: "high",
  pendingDecisionType: "Coverage Verification",
  priority: "normal",
  narrativeSynthesis: [...],
  anomalySignals: [...],
  evidenceItems: [...],
  recommendedAction: {...},
  policyContext: {...},
  auditTrail: [...]
}
```

### API Response Format
```typescript
{
  success: true,
  data: { /* claim or claims array */ },
  meta: {
    timestamp: "2024-05-28T10:00:00Z",
    count: 3
  }
}
```

## 🎯 Acceptance Criteria

The prototype is complete when:

1. ✅ User can submit FNOL form and land in decision queue
2. ✅ Queue shows 3+ prioritized decisions with confidence levels
3. ✅ Adjuster can open decision and see all required information
4. ✅ Adjuster can approve governed action with preview
5. ✅ Confirmation and audit log entry recorded
6. ✅ All routes reachable from navigation
7. ✅ No existing functionality broken
8. ✅ Module is self-contained
9. ✅ Uses Carbon Design System consistently
10. ✅ Provides sufficient context for production implementation

## 🔗 Useful Links

- **Carbon Design System**: https://carbondesignsystem.com/
- **React Router**: https://reactrouter.com/
- **TypeScript**: https://www.typescriptlang.org/
- **Express.js**: https://expressjs.com/

## 💡 Tips for Success

1. **Start with backend**: Get data and API working first
2. **Test incrementally**: Test each phase before moving to next
3. **Follow patterns**: Use existing code as reference
4. **Keep it simple**: This is a prototype, not production
5. **Document deviations**: Note any changes from spec
6. **Ask questions**: Clarify requirements before implementing

## 🎓 Learning from Existing Code

Study these files to understand patterns:

**Backend**:
- `backend/src/services/agentService.ts` - Service pattern
- `backend/src/routes/agentRoutes.ts` - Route pattern
- `backend/src/types/index.ts` - Type definitions

**Frontend**:
- `frontend/src/pages/SimulatorPage.tsx` - Governance preview pattern
- `frontend/src/pages/AgentCatalogPage.tsx` - Data table pattern
- `frontend/src/pages/AgentBuilderPage.tsx` - Form pattern
- `frontend/src/components/layout/AppHeader.tsx` - Navigation pattern

## 📞 Support

If you encounter issues:

1. Check the detailed specification in `CLAIMS-MODULE-SPECIFICATION.md`
2. Review the implementation roadmap in `CLAIMS-IMPLEMENTATION-ROADMAP.md`
3. Study the architecture diagrams in `CLAIMS-ARCHITECTURE-DIAGRAM.md`
4. Look at existing code patterns in the codebase
5. Verify your environment setup (Node.js, npm versions)

## 🚀 Next Steps After Prototype

Once the prototype is complete:

1. **Review with stakeholders**: Gather feedback on UX and workflow
2. **Technical review**: Assess architecture and patterns
3. **Production planning**: Create detailed production implementation plan
4. **Database design**: Plan schema for production data layer
5. **AI integration**: Design integration with real AI providers
6. **Security review**: Plan authentication, authorization, audit logging
7. **Performance testing**: Identify optimization opportunities
8. **Deployment planning**: Design production deployment architecture

## 📝 Production Considerations

When building the production version, address:

- **Database**: Replace JSON with PostgreSQL/MongoDB
- **Authentication**: Add user auth and RBAC
- **Real AI**: Integrate with OpenAI/Anthropic
- **Document Storage**: Add S3/Azure Blob Storage
- **Real-time Updates**: Add WebSocket support
- **Email/SMS**: Integrate communication services
- **Audit Logging**: Comprehensive compliance logging
- **Error Handling**: Production-grade error handling
- **Testing**: Unit, integration, and E2E tests
- **Monitoring**: Add logging, metrics, alerting
- **Performance**: Caching, pagination, optimization
- **Security**: Input validation, rate limiting, encryption

---

## Summary

You're building a **self-contained claims module prototype** that demonstrates how the existing agent orchestration platform applies to insurance claims. Follow the implementation roadmap, use existing patterns, and focus on creating a credible prototype that provides sufficient context for the development team to build the production solution.

**Key Success Factors**:
- Follow existing patterns
- Keep it self-contained
- Test incrementally
- Document thoroughly
- Think production-ready

Good luck! 🎉