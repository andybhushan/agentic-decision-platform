# Sample Data Specification

This document defines sample data structures for the three verticals: Claims, Healthcare, and Customer Service.

---

## Verticals Configuration

### Claims Vertical

```json
{
  "id": "claims",
  "name": "Claims",
  "description": "Insurance claims processing workflows",
  "icon": "🏥",
  "defaultAgents": [
    "claims-intake-agent",
    "claims-evidence-agent",
    "claims-fraud-agent",
    "claims-policy-agent",
    "claims-settlement-agent",
    "claims-supervisor-agent",
    "claims-compliance-agent"
  ],
  "industryContext": {
    "keyTerms": ["FNOL", "Adjuster", "Subrogation", "Deductible", "Coverage Limit"],
    "commonProcesses": ["First Notice of Loss", "Claims Investigation", "Settlement"],
    "regulatoryNotes": ["State insurance regulations", "Audit trail required"]
  }
}
```

### Healthcare Vertical

```json
{
  "id": "healthcare",
  "name": "Healthcare",
  "description": "Healthcare and medical service workflows",
  "icon": "⚕️",
  "defaultAgents": [
    "healthcare-intake-agent",
    "healthcare-records-agent",
    "healthcare-authorization-agent",
    "healthcare-billing-agent",
    "healthcare-quality-agent",
    "healthcare-coordinator-agent",
    "healthcare-compliance-agent"
  ],
  "industryContext": {
    "keyTerms": ["ICD-10", "CPT Codes", "Prior Authorization", "HIPAA", "PHI"],
    "commonProcesses": ["Patient Registration", "Insurance Verification", "Medical Coding"],
    "regulatoryNotes": ["HIPAA compliance required", "PHI protection mandatory"]
  }
}
```

### Customer Service Vertical

```json
{
  "id": "customer-service",
  "name": "Customer Service",
  "description": "Customer support and service workflows",
  "icon": "💬",
  "defaultAgents": [
    "cs-inquiry-agent",
    "cs-sentiment-agent",
    "cs-knowledge-agent",
    "cs-escalation-agent",
    "cs-resolution-agent",
    "cs-feedback-agent",
    "cs-quality-agent"
  ],
  "industryContext": {
    "keyTerms": ["SLA", "CSAT", "NPS", "Ticket", "First Contact Resolution"],
    "commonProcesses": ["Ticket Triage", "Issue Resolution", "Quality Assurance"],
    "regulatoryNotes": ["Data privacy compliance", "Response time SLAs"]
  }
}
```

---

## Agent Archetype Templates

### Intake Agent Template

```json
{
  "archetype": "Intake",
  "purpose": "Gathers information and asks follow-up questions",
  "authorityLevel": "supervised",
  "commonInputs": ["userInfo", "requestDetails", "context"],
  "commonOutputs": ["intakePackage", "completeness"],
  "commonConstraints": ["Must collect minimum required fields", "Cannot proceed without validation"],
  "governanceControls": [
    {"type": "audit", "description": "Log all interactions"},
    {"type": "validation", "description": "Validate required fields"}
  ]
}
```

### Evidence Agent Template

```json
{
  "archetype": "Evidence",
  "purpose": "Reviews documents and content, summarizes relevance",
  "authorityLevel": "autonomous",
  "commonInputs": ["documents", "photos", "context"],
  "commonOutputs": ["summary", "confidenceScore", "missingItems"],
  "commonConstraints": ["Must review all submitted items", "Cannot approve with low confidence"],
  "governanceControls": [
    {"type": "audit", "description": "Log all reviews"},
    {"type": "validation", "description": "Verify authenticity"}
  ]
}
```

### Fraud/Risk Agent Template

```json
{
  "archetype": "Fraud",
  "purpose": "Identifies unusual patterns, returns risk assessment",
  "authorityLevel": "supervised",
  "commonInputs": ["data", "history", "benchmarks"],
  "commonOutputs": ["riskLevel", "riskScore", "flags", "recommendation"],
  "commonConstraints": ["Cannot deny autonomously", "Must provide reasoning"],
  "governanceControls": [
    {"type": "audit", "description": "Log all assessments"},
    {"type": "approval", "description": "High-risk requires review"}
  ]
}
```

### Policy Agent Template

```json
{
  "archetype": "Policy",
  "purpose": "Looks up policy/rules, confirms coverage or applicability",
  "authorityLevel": "autonomous",
  "commonInputs": ["policyId", "requestType", "amount"],
  "commonOutputs": ["status", "details", "limits"],
  "commonConstraints": ["Cannot override policy terms", "Must flag ambiguities"],
  "governanceControls": [
    {"type": "audit", "description": "Log all lookups"},
    {"type": "validation", "description": "Verify policy active"}
  ]
}
```

### Settlement/Resolution Agent Template

```json
{
  "archetype": "Settlement",
  "purpose": "Suggests resolution, identifies approval needs",
  "authorityLevel": "supervised",
  "commonInputs": ["data", "coverage", "riskAssessment"],
  "commonOutputs": ["recommendation", "confidence", "approvalRequired"],
  "commonConstraints": ["Cannot exceed limits", "Must account for constraints"],
  "governanceControls": [
    {"type": "approval", "description": "High-value requires approval"},
    {"type": "audit", "description": "Log all calculations"}
  ]
}
```

### Supervisor Agent Template

```json
{
  "archetype": "Supervisor",
  "purpose": "Oversees other agents, handles escalations",
  "authorityLevel": "supervised",
  "commonInputs": ["escalationType", "context", "recommendations"],
  "commonOutputs": ["decision", "reasoning", "nextSteps"],
  "commonConstraints": ["Must review all recommendations", "Cannot override policy"],
  "governanceControls": [
    {"type": "audit", "description": "Log all decisions"},
    {"type": "approval", "description": "Complex cases need human"}
  ]
}
```

### Compliance Agent Template

```json
{
  "archetype": "Compliance",
  "purpose": "After-the-fact checks, ensures process compliance",
  "authorityLevel": "autonomous",
  "commonInputs": ["processRecord", "finalDecision"],
  "commonOutputs": ["complianceStatus", "issues", "recommendations"],
  "commonConstraints": ["Cannot modify decisions", "Must flag all violations"],
  "governanceControls": [
    {"type": "audit", "description": "Log all checks"},
    {"type": "validation", "description": "Verify required steps"}
  ]
}
```

---

## Sample Workflow: Claims Standard Processing

```json
{
  "id": "claims-standard-workflow",
  "name": "Standard Claims Processing",
  "description": "End-to-end claims workflow with fraud detection",
  "vertical": "claims",
  "mermaidDSL": "flowchart LR\n    Start([Claim Submitted]) --> Intake[Intake Agent]\n    Intake --> Evidence[Evidence Agent]\n    Evidence --> Fraud[Fraud Agent]\n    Fraud -->|Low Risk| Policy[Policy Agent]\n    Fraud -->|Medium/High Risk| Supervisor[Supervisor Agent]\n    Supervisor --> Policy\n    Policy -->|Covered| Settlement[Settlement Agent]\n    Policy -->|Unclear| HumanReview[Human Adjuster]\n    HumanReview --> Settlement\n    Settlement -->|Under Authority| Approve[Auto-Approve]\n    Settlement -->|Over Authority| ManagerApproval[Manager Approval]\n    ManagerApproval --> Approve\n    Approve --> Compliance[Compliance Agent]\n    Compliance --> Close([Claim Closed])"
}
```

---

## Sample Workflow: Healthcare Prior Authorization

```json
{
  "id": "healthcare-prior-auth",
  "name": "Prior Authorization Workflow",
  "description": "Medical service prior authorization process",
  "vertical": "healthcare",
  "mermaidDSL": "flowchart LR\n    Start([Service Requested]) --> Intake[Patient Intake]\n    Intake --> Records[Medical Records Agent]\n    Records --> Auth[Authorization Agent]\n    Auth -->|Approved| Notify[Notify Provider]\n    Auth -->|Denied| Appeal[Appeal Process]\n    Auth -->|Complex| MedicalDirector[Medical Director Review]\n    MedicalDirector --> Notify\n    Notify --> Compliance[Compliance Check]\n    Compliance --> Close([Authorization Complete])"
}
```

---

## Sample Workflow: Customer Service Ticket Resolution

```json
{
  "id": "cs-ticket-resolution",
  "name": "Ticket Resolution Workflow",
  "description": "Customer service ticket handling and resolution",
  "vertical": "customer-service",
  "mermaidDSL": "flowchart LR\n    Start([Customer Contact]) --> Inquiry[Inquiry Agent]\n    Inquiry --> Sentiment[Sentiment Analysis]\n    Sentiment -->|Negative| Escalation[Escalation Agent]\n    Sentiment -->|Neutral/Positive| Knowledge[Knowledge Base Agent]\n    Knowledge -->|Solution Found| Resolution[Resolution Agent]\n    Knowledge -->|No Solution| Escalation\n    Escalation --> Resolution\n    Resolution --> Feedback[Feedback Agent]\n    Feedback --> Quality[Quality Check]\n    Quality --> Close([Ticket Closed])"
}
```

---

## Governance Control Types

### Audit Controls
- Log all decisions with timestamps
- Record input/output pairs
- Track execution time
- Maintain audit trail

### Approval Controls
- Supervisor approval for high-risk
- Manager approval for high-value
- Human review for complex cases
- Medical director for clinical decisions

### Constraint Controls
- Maximum processing time limits
- Confidence threshold requirements
- Authority level boundaries
- Policy compliance checks

### Validation Controls
- Required field verification
- Data format validation
- Business rule compliance
- Regulatory requirement checks

---

## AI Provider Mock Responses

### Mock Agent Generation Response

```json
{
  "agent": {
    "name": "Generated Agent Name",
    "archetype": "Appropriate Archetype",
    "purpose": "Clear purpose statement",
    "inputs": [...],
    "outputs": [...],
    "authorityLevel": "supervised",
    "governanceControls": [...]
  },
  "confidence": 0.85,
  "suggestions": [
    "Consider adding fallback logic",
    "May need integration with external system"
  ]
}
```

### Mock Simulation Response

```json
{
  "output": {
    "decision": "Recommended action",
    "confidence": 0.92,
    "reasoning": "Detailed explanation of decision",
    "nextSteps": ["Step 1", "Step 2"]
  },
  "executionTime": 1250,
  "governanceChecks": [
    {"type": "audit", "status": "passed"},
    {"type": "validation", "status": "passed"}
  ],
  "escalations": []
}
```

---

## File Structure for Implementation

```
data/
├── verticals/
│   ├── claims.json
│   ├── healthcare.json
│   └── customer-service.json
├── agents/
│   ├── claims/
│   │   ├── intake-agent.json
│   │   ├── evidence-agent.json
│   │   ├── fraud-agent.json
│   │   ├── policy-agent.json
│   │   ├── settlement-agent.json
│   │   ├── supervisor-agent.json
│   │   └── compliance-agent.json
│   ├── healthcare/
│   │   └── [7 agent files]
│   └── customer-service/
│       └── [7 agent files]
└── workflows/
    ├── claims-standard-workflow.json
    ├── healthcare-prior-auth.json
    └── cs-ticket-resolution.json
```

---

*Note: Full detailed agent definitions with complete prompts and internal logic are available in the implementation phase. This specification provides the essential structure and templates.*

*Last Updated: 2026-05-13*