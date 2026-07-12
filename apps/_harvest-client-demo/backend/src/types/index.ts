// Core data types for the Agent Workflow Builder

export interface Vertical {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  agentCount: number;
  workflowCount: number; // Note: Represents Agentic Orchestrations count
  features: string[];
  complianceRequirements?: string[];
}

export interface Agent {
  id: string;
  verticalId: string;
  name: string;
  description: string;
  archetype: AgentArchetype;
  authorityLevel: AuthorityLevel;
  workflowRole?: string;
  /** How the agent interacts. 'conversational' agents conduct a step-by-step
   * interview (one question at a time); 'transactional' (default) process a
   * request in a single shot; 'hybrid' agents ingest a manifest of data +
   * attachments in one pass, then run a targeted clarification conversation
   * for any gaps. Undefined is treated as 'transactional'. */
  interactionStyle?: 'conversational' | 'transactional' | 'hybrid';
  /** Which deployment contexts this agent supports. 'standalone' = the agent owns
   * the full interaction directly (e.g. a web/voice channel); 'orchestrated' = the
   * agent is invoked by a parent orchestrator with a structured task envelope.
   * Undefined is treated as ['standalone']. */
  operatingModes?: OperatingMode[];
  /** Present when this agent is itself an orchestrator that coordinates sub-agents. */
  orchestration?: { coordinates?: string[] };
  governanceProfile?: {
    authorityLevel: string;
    escalationPath: string;
    autonomyDescription: string;
    boundaries: string[];
    humanInTheLoop: string[];
    confidenceThresholds: {
      minimum: number;
      reviewRequired: number;
    };
  };
  inputs: AgentInput[];
  outputs: AgentOutput[];
  governanceControls: GovernanceControl[];
  systemPrompt?: string;
  capabilities: string[];
  limitations: string[];
  escalationCriteria?: string[];
  version: string;
  createdAt: string;
  updatedAt: string;
  // Generated specification and prompt
  generatedSpec?: string;
  foundryPrompt?: string;
  specReviewerSummary?: string;
  specGeneratedAt?: string;
  // Azure AI Foundry deployment
  deploymentId?: string;
  deploymentEndpoint?: string;
  deployedAt?: string;
  // Revocation
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
}

export type OperatingMode = 'standalone' | 'orchestrated';

export type AgentArchetype =
  | 'Analyst'
  | 'Coordinator'
  | 'Specialist'
  | 'Validator'
  | 'Communicator'
  | 'Auditor'
  | 'Optimizer';

export type AuthorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface AgentInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  validation?: string;
  example?: any;
}

export interface AgentOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  example?: any;
}

export interface GovernanceControl {
  type: GovernanceControlType;
  description: string;
  enabled: boolean;
  parameters?: Record<string, any>;
}

export type GovernanceControlType =
  | 'human_review'
  | 'confidence_threshold'
  | 'data_validation'
  | 'compliance_check'
  | 'escalation_rule'
  | 'audit_logging'
  | 'rate_limiting'
  | 'access_control';

// Agentic Orchestration (formerly Workflow)
// Represents a coordinated sequence of AI agents working together
export interface Workflow {
  id: string;
  verticalId: string;
  name: string;
  description: string;
  agents: WorkflowAgent[];
  connections: WorkflowConnection[];
  mermaidDSL: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowAgent {
  id: string;
  agentId: string;
  position: { x: number; y: number };
  config?: Record<string, any>;
}

export interface WorkflowConnection {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  condition?: string;
  label?: string;
}

export interface AIGenerateAgentRequest {
  description: string;
  verticalId: string;
  archetype?: AgentArchetype;
  requirements?: string[];
}

export interface AIGenerateAgentResponse {
  agent: Partial<Agent>;
  confidence: number;
  suggestions: string[];
}

export interface AIGeneratePromptRequest {
  agentId: string;
  input: Record<string, any>;
  context?: Record<string, any>;
}

export interface AIGeneratePromptResponse {
  prompt: string;
  systemPrompt: string;
  tokens: number;
}

export interface AISimulateRequest {
  agentId: string;
  input: Record<string, any>;
  context?: Record<string, any>;
}

export interface AISimulateResponse {
  output: Record<string, any>;
  confidence: number;
  governanceChecks: GovernanceCheckResult[];
  executionTime: number;
  tokensUsed: number;
  escalated: boolean;
  escalationReason?: string;
}

export interface AIClaimAssistRequest {
  command: string;
  claimContext: string;
}

export interface AIClaimAssistResponse {
  message: string;
  confidence: number;
  suggestedActions: string[];
}

export interface GovernanceCheckResult {
  controlType: GovernanceControlType;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface AIRecruitAgentRequest {
  agentId: string;
  workflowId: string;
  workflowAgentId?: string;
  context?: Record<string, any>;
}

export interface AIRecruitAgentResponse {
  success: boolean;
  deploymentId?: string;
  status: string;
  message?: string;
  provider: string;
  raw?: unknown;
}

export interface AIReleaseAgentRequest {
  agentId: string;
  workflowId: string;
  workflowAgentId?: string;
  deploymentId?: string;
  context?: Record<string, any>;
}

export interface AIReleaseAgentResponse {
  success: boolean;
  status: string;
  message?: string;
  provider: string;
  raw?: unknown;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}
// ============================================================================
// Claims Module Types
// ============================================================================

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
export type ClaimStage = 'intake' | 'investigation' | 'evaluation' | 'settlement' | 'closed';
/** Decision difficulty of a claim, seeded coherently from its scenario (never random). */
export type ClaimComplexity = 'low' | 'medium' | 'high';
// Incident types
export type IncidentType = 'Auto' | 'Property' | 'Medical';

// Evidence provenance labels
export type EvidenceProvenance =
  | 'Claimant Provided'
  | 'Third Party'
  | 'Public Record'
  | 'Agent Inferred';

// Narrative element status
export type NarrativeStatus = 'Confirmed' | 'Disputed' | 'Inferred' | 'Pending';

// Coverage applicability
export type CoverageStatus = 'covered' | 'excluded' | 'ambiguous';

// Intake channel tracking
export type IntakeChannel = 'Web Portal' | 'Mobile App' | 'Phone' | 'Email' | 'Agent Assisted';

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
  /** Full text body of a written document (report, statement, estimate). Shown in the UI when no image is available. */
  content?: string;
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
  /** Concise, sequenced next steps surfaced in the governed-action box. */
  recommendedSteps?: string[];
  financialImpact?: {
    estimatedAmount?: number;
    currency?: string;
    breakdown?: Array<{
      category: string;
      amount: number;
      description: string;
      /** negative = deduction (e.g. deductible) */
      isDeduction?: boolean;
      /** sub-total / section divider row */
      isSubtotal?: boolean;
    }>;
    repairQuotes?: Array<{
      id: string;
      vendor: string;
      vendorType: 'body_shop' | 'mechanic' | 'oem_dealer' | 'tow_service';
      amount: number;
      currency: string;
      receivedDate: string;
      status: 'pending_review' | 'accepted' | 'rejected' | 'superceded';
      notes?: string;
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

// Adjuster profile
export interface AdjusterProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  team: string;
  seniority: 'Junior' | 'Senior' | 'Principal' | 'Lead';
  yearsExperience: number;
  specialisations: string[];
  authorityLimit: number;
  currentWorkload: number;
  maxCapacity: number;
  status: 'available' | 'at-capacity' | 'away';
  bio: string;
  stats: {
    avgResolutionDays: number;
    customerSatisfaction: number;
    successRate: number;
    totalClaimsClosed: number;
  };
  clientHistory?: Array<{ claimantName: string; claimId: string; outcome: string }>;
}

// Client service tier — drives how much of the claim journey is handled by AI
// versus a human adjuster (hand-off behaviour). Surfaced to users under the
// branded prestige scheme: standard→Core, priority→Premier,
// white_glove→Masterpiece, signature→Masterpiece Signature.
export type ClientServiceTier = 'standard' | 'priority' | 'white_glove' | 'signature';

// Firm or agent appointed to manage a claim on behalf of a high-net-worth
// policyholder (top-tier clients rarely handle claims themselves).
export interface AppointedRepresentative {
  firmName: string;
  contactName?: string;
  relationship?: string;
}

// How a claim is handled following intake hand-off.
export type ClaimHandlingMode = 'ai' | 'ai_oversight' | 'human';

export interface CustomerPersona {
  id: string;
  displayName: string;
  firstName: string;
  lastName?: string;
  entityType: 'individual' | 'business';
  selectable: boolean;
  locale: 'en-US';
  timeZone: string;
  email?: string;
  phone?: string;
  preferredContactChannel: 'Email' | 'SMS' | 'Phone';
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  customerSince?: string;
  occupation?: string;
  household?: string;
  defaultPolicyRef?: string;
  policyRefs: string[];
  currentClaimIds: string[];
  priorClaimIds: string[];
  supportSummary: {
    policyCount: number;
    activeClaimCount: number;
    totalAnnualPremium: number;
    claimFreeYears: number;
  };
  notes: string[];
  riskSignals: string[];
  profileNote: string;
  /** Service tier controlling AI-vs-human hand-off. Defaults to 'standard'. */
  serviceTier: ClientServiceTier;
  /** Firm/agent appointed to manage claims for this client (top tiers). */
  appointedRepresentative?: AppointedRepresentative;
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
  /** AI-generated confidence score (0-100) produced by the Foundry LLM at seed/FNOL time.
   *  Authoritative numeric score shown throughout the Decision Queue and Decision Mode.
   *  Falls back to formula-computed value if absent (e.g. legacy records). */
  aiConfidenceScore?: number;
  /** One-sentence rationale for the AI confidence score. */
  aiConfidenceRationale?: string;
  /** Scenario-derived decision difficulty (low/medium/high). Drives complexity, SLA and effort displays. */
  complexity: ClaimComplexity;
  lastAgentAction: string;
  timeInQueue: string;
  priority: Priority;
  owner?: string;
  workingOn?: string;
  claimantPersonaId?: string;
  assignedAdjusterId?: string;
  assignedAdjusterName?: string;
  assignmentReason?: string;
  assignmentConfidence?: number;
  assignmentSignals?: string[];
  /** Adjuster's delegated authority limit in USD, enriched at read time for governance. */
  adjusterAuthorityLimit?: number;
  /** Service tier of the claimant at intake (copied from their persona). */
  clientServiceTier?: ClientServiceTier;
  /** Firm/agent appointed to manage this claim (top tiers), enriched at read time. */
  appointedRepresentative?: AppointedRepresentative;
  /** Whether this claim is handled by AI, AI with oversight, or a human adjuster. */
  handlingMode?: ClaimHandlingMode;
  /**
   * Whether this claim is eligible for straight-through (agent auto-finalised)
   * settlement. Conservatively confined to glass-only / total-loss-obvious
   * losses — everything else requires a human decision even when within
   * delegated authority (FR-4 / C-07: no autonomous adverse determinations).
   */
  straightThroughEligible?: boolean;

  // Analysis and evidence
  narrativeSynthesis: NarrativeElement[];
  anomalySignals: AnomalySignal[];
  evidenceItems: EvidenceItem[];
  recommendedAction: RecommendedAction;
  relatedClaims?: RelatedClaimMatch[];

  // Audit
  auditTrail: AuditEntry[];

  /** Most recent governed-settlement decision verdict (authority + threshold checks). */
  governanceDecision?: GovernanceDecisionRecord;

  /** Adjuster / AI notes on this claim. */
  claimNotes?: ClaimNote[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ClaimNote {
  id: string;
  text: string;
  author: string;
  authorRole: string;
  category: 'general' | 'investigation' | 'coverage' | 'legal' | 'communication';
  createdAt: string;
}
export interface FNOLSubmission {
  claimantName: string;
  claimantPersonaId?: string;
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
  policyRef?: string;
}

// Decision outcome
export interface DecisionOutcome {
  claimId: string;
  decision: 'approved' | 'rejected' | 'escalated' | 'more_info_needed';
  rationale: string;
  userId: string;
  timestamp: string;
  nextAction?: string;
  /** Settlement value the decision is being made against (drives authority checks). */
  settlementAmount?: number;
  /** Captured when a decision requires senior sign-off (HITL approval gate). */
  approverId?: string;
  approverName?: string;
  approverRole?: string;
}

// ── Governed settlement ────────────────────────────────────────────────────
/** Outcome of the backend governance evaluation for a settlement decision. */
export type GovernanceVerdictStatus =
  | 'within_authority'
  | 'requires_senior_approval'
  | 'blocked';

/** A single governance check that contributed to the verdict. */
export interface GovernanceCriterion {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

/**
 * Canonical governed-action taxonomy. Maps the internal decision verbs onto the
 * four canonical categories used across the governance specs and audit surface.
 */
export type DecisionCategory =
  | 'approve'
  | 'route-to-adjuster'
  | 'request-info'
  | 'recommend-deny-for-human-review';

/** Structured, auditable record of how a decision was governed. Persisted on the
 *  claim so the Decision Mode audit trail and downstream telemetry are legible. */
export interface GovernanceDecisionRecord {
  status: GovernanceVerdictStatus;
  requiresApproval: boolean;
  blocked: boolean;
  decision: DecisionOutcome['decision'];
  /** Canonical category this decision maps to (governed-action taxonomy). */
  canonicalCategory?: DecisionCategory;
  /** Whether the claim qualified for straight-through (agent auto-finalise) scope. */
  straightThroughEligible?: boolean;
  reasons: string[];
  criteria: GovernanceCriterion[];
  authorityLimit: number;
  settlementAmount: number;
  currency: string;
  confidenceLevel: ConfidenceLevel;
  approver?: { id?: string; name?: string; role?: string };
  evaluatedAt: string;
  /** Tamper-evident hash chain: SHA-256 over the canonical record + previous hash. */
  recordHash?: string;
  /** Hash of the prior governance record on this claim (chain link), if any. */
  previousHash?: string | null;
  /** Records-retention class applied to this decision for compliance. */
  retentionClass?: string;
}


// Made with Bob