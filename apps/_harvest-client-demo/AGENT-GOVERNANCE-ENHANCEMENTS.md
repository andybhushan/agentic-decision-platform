# Agent Governance & Design Enhancements

## Overview

This document describes the enhancements made to the Agent Catalog system to transform it into a comprehensive Agent Governance and Design environment. All changes are **additive** and preserve existing functionality.

## What Was Enhanced

### 1. Data Model Extensions

#### New Agent Fields
- **`workflowRole`**: Categorizes agents by their role in workflows
  - Options: Intake, Evidence, Fraud, Policy, Settlement, Supervision, Compliance, Generic
  - Enables better filtering and relationship mapping

- **`governanceProfile`**: Comprehensive governance configuration
  - `authorityLevel`: signal | advisory | authoritative | bounded-authority
  - `escalationPath`: Human escalation chain
  - `autonomyDescription`: Plain-language autonomy description
  - `boundaries`: List of operational boundaries
  - `humanInTheLoop`: Human review requirements
  - `confidenceThresholds`: Minimum and review-required thresholds

- **`relatedAgents`**: Automatic relationship mapping
  - `dependsOn`: Agents this agent requires
  - `supports`: Agents this agent provides input to
  - `oftenUsedWith`: Frequently co-used agents

### 2. New Components

#### GovernanceProfileSection
**Location**: `frontend/src/components/GovernanceProfileSection.tsx`

Displays and edits governance profiles with:
- Authority level selection
- Escalation path configuration
- Autonomy description
- Boundaries management
- Human-in-the-loop requirements
- Confidence threshold settings

**Usage**:
```tsx
<GovernanceProfileSection
  profile={agent.governanceProfile}
  onChange={(profile) => handleProfileChange(profile)}
  readOnly={false}
/>
```

#### DSLPreview
**Location**: `frontend/src/components/DSLPreview.tsx`

Generates and displays agent DSL in multiple formats:
- **Simple**: Compact, demo-friendly format
- **Detailed**: Full governance and configuration
- **Workflow**: Relationship-focused view

**Features**:
- Copy to clipboard
- Download as .dsl file
- Tabbed interface for multiple variants

**Usage**:
```tsx
<DSLPreview 
  agent={agent} 
  variant="all" 
  showActions={true} 
/>
```

#### RelatedAgentsSection
**Location**: `frontend/src/components/RelatedAgentsSection.tsx`

Displays agent relationships with:
- Dependency visualization
- Support relationships
- Common usage patterns
- Automatic inference based on workflow roles

**Usage**:
```tsx
<RelatedAgentsSection
  agent={agent}
  allAgents={agents}
  relatedAgents={agent.relatedAgents}
/>
```

### 3. DSL Generator Utility

**Location**: `frontend/src/utils/dslGenerator.ts`

Provides functions for generating agent DSL:

- **`generateAgentDSL(agent)`**: Simple, compact DSL
- **`generateDetailedAgentDSL(agent)`**: Full configuration DSL
- **`generateWorkflowDSL(agent)`**: Relationship-focused DSL
- **`inferRelatedAgents(agent, allAgents)`**: Automatic relationship detection

**Example Output**:
```dsl
agent ClaimsIntakeAgent {
  role: intake
  authority: signal
  archetype: coordinator
  inputs: [claimData, attachments]
  outputs: [claimId, validationStatus, nextSteps]
  governance: [data_validation, audit_logging]
  escalates: true
}
```

### 4. Enhanced Agent Catalog

**Location**: `frontend/src/pages/AgentCatalogPage.tsx`

**New Features**:
- Workflow Role filter dropdown
- Workflow role tags on agent cards
- Improved visual hierarchy

**Preserved Features**:
- All existing filters (Vertical, Archetype, Authority)
- Search functionality
- Card layout
- Navigation to edit/details

### 5. Enhanced Agent Builder

**Location**: `frontend/src/pages/AgentBuilderPage.tsx`

**New Features**:
- Workflow Role selection dropdown
- Governance Profile tab with full configuration
- DSL Preview tab with live updates
- Validation for governance settings

**New Tabs**:
1. **Basic Info** - Includes workflow role selector
2. **Inputs & Outputs** - Unchanged
3. **Governance** - Now includes GovernanceProfileSection
4. **DSL Preview** - Live DSL generation
5. **Advanced** - System prompt (unchanged)

**Preserved Features**:
- Field-based agent creation
- All existing form fields
- Validation logic
- Save/Cancel functionality

### 6. Enhanced Test Platform

**Location**: `frontend/src/pages/SimulatorPage.tsx`

**New Features**:
- Expected inputs display with types and requirements
- Expected outputs display
- Workflow role tag in agent info
- Improved visual layout for I/O information

**Preserved Features**:
- Agent selection
- Input JSON editor
- Context editor
- Prompt generation
- Simulation execution
- Governance checks display

### 7. Sample Data Updates

**Location**: `backend/data/agents.json`

Updated sample agents with:
- Workflow roles assigned
- Complete governance profiles
- Realistic boundaries and escalation paths
- Confidence thresholds

**Example Agents**:
- **Claims Intake Agent**: Intake role, signal authority
- **Fraud Detection Agent**: Fraud role, advisory authority
- **Settlement Calculation Agent**: Settlement role, bounded-authority

## Integration Points

### How Components Work Together

1. **Agent Creation Flow**:
   ```
   User fills form → Governance profile configured → DSL preview updates live → Save agent
   ```

2. **Agent Viewing Flow**:
   ```
   Catalog → View agent → See governance profile → View DSL → See relationships
   ```

3. **Testing Flow**:
   ```
   Select agent → See expected I/O → Provide input → Run simulation → View results
   ```

### Relationship Inference

The system automatically infers agent relationships based on:
- **Workflow roles**: Intake → Evidence → Fraud → Policy → Settlement → Compliance
- **Vertical context**: Agents in same vertical are often used together
- **Dependency patterns**: Role-based dependency chains

## Usage Guidelines

### Creating a New Agent

1. Navigate to Agent Catalog
2. Click "Create New Agent"
3. Fill in Basic Info including **Workflow Role**
4. Configure Inputs & Outputs
5. Set up **Governance Profile**:
   - Choose authority level
   - Define escalation path
   - Set boundaries
   - Configure human-in-the-loop requirements
6. Preview DSL in real-time
7. Save agent

### Viewing Agent Governance

1. Open agent in edit mode or details view
2. Navigate to Governance tab
3. Review governance profile
4. Check DSL Preview tab for generated DSL
5. View Related Agents section for relationships

### Testing an Agent

1. Go to Agent Simulator
2. Select agent from dropdown
3. Review expected inputs and outputs
4. Provide test input JSON
5. Run simulation
6. Review output and governance checks

## Technical Details

### Type Definitions

```typescript
// Workflow Role
type WorkflowRole = 
  | 'Intake' 
  | 'Evidence' 
  | 'Fraud' 
  | 'Policy' 
  | 'Settlement' 
  | 'Supervision' 
  | 'Compliance' 
  | 'Generic';

// Governance Profile
interface GovernanceProfile {
  authorityLevel: 'signal' | 'advisory' | 'authoritative' | 'bounded-authority';
  escalationPath?: string;
  autonomyDescription?: string;
  boundaries?: string[];
  humanInTheLoop?: string[];
  confidenceThresholds?: {
    minimum?: number;
    reviewRequired?: number;
  };
}

// Related Agents
interface RelatedAgents {
  dependsOn?: string[];
  supports?: string[];
  oftenUsedWith?: string[];
}
```

### File Structure

```
frontend/src/
├── components/
│   ├── DSLPreview.tsx              # DSL display component
│   ├── DSLPreview.scss
│   ├── GovernanceProfileSection.tsx # Governance config
│   ├── GovernanceProfileSection.scss
│   ├── RelatedAgentsSection.tsx    # Relationship display
│   └── RelatedAgentsSection.scss
├── utils/
│   └── dslGenerator.ts             # DSL generation logic
├── pages/
│   ├── AgentCatalogPage.tsx        # Enhanced catalog
│   ├── AgentBuilderPage.tsx        # Enhanced builder
│   └── SimulatorPage.tsx           # Enhanced simulator
└── types/
    └── index.ts                    # Extended type definitions

backend/data/
└── agents.json                     # Updated sample data
```

## Benefits

### For Users
- **Better Visibility**: Clear governance rules and boundaries
- **Improved Discovery**: Filter by workflow role
- **Relationship Awareness**: See how agents work together
- **DSL Export**: Share agent definitions easily

### For Developers
- **Type Safety**: Full TypeScript support for new fields
- **Modular Components**: Reusable governance and DSL components
- **Extensible**: Easy to add new authority levels or roles
- **Maintainable**: Clear separation of concerns

### For Governance
- **Audit Trail**: Clear authority levels and escalation paths
- **Compliance**: Human-in-the-loop requirements documented
- **Risk Management**: Boundaries and thresholds defined
- **Transparency**: DSL provides human-readable governance rules

## Future Enhancements

Potential additions (not implemented):
- Visual workflow designer with drag-and-drop
- Governance policy templates
- Automated compliance checking
- Version control for agent definitions
- Relationship graph visualization
- Advanced DSL editor with syntax highlighting

## Backward Compatibility

All changes are **fully backward compatible**:
- Existing agents work without new fields
- New fields are optional
- UI gracefully handles missing data
- No breaking changes to API

## Testing

To test the enhancements:

1. **Start the application**:
   ```bash
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

2. **Test Agent Catalog**:
   - Filter by workflow role
   - Verify role tags appear on cards

3. **Test Agent Builder**:
   - Create new agent with governance profile
   - Preview DSL in real-time
   - Save and verify data persists

4. **Test Simulator**:
   - Select agent
   - Verify I/O display
   - Run simulation

## Summary

This enhancement transforms the Agent Catalog into a comprehensive governance-aware design environment while preserving all existing functionality. The system now provides:

✅ Governance profiles with authority levels and boundaries  
✅ Workflow role categorization and filtering  
✅ Automatic DSL generation in multiple formats  
✅ Relationship mapping between agents  
✅ Enhanced testing with I/O visibility  
✅ Improved user experience throughout  

All changes are additive, modular, and maintain backward compatibility.

---

**Made with Bob** 🤖