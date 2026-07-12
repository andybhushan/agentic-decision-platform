// Core data types for the Agent Workflow Builder Frontend

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
  workflowRole?: WorkflowRole;
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
  governanceProfile?: GovernanceProfile;
  inputs: AgentInput[];
  outputs: AgentOutput[];
  governanceControls: GovernanceControl[];
  systemPrompt?: string;
  capabilities: string[];
  limitations: string[];
  escalationCriteria?: string[];
  relatedAgents?: RelatedAgents;
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
}

export type OperatingMode = 'standalone' | 'orchestrated';

export type WorkflowRole =
  | 'Intake'
  | 'Evidence'
  | 'Fraud'
  | 'Policy'
  | 'Settlement'
  | 'Supervision'
  | 'Compliance'
  | 'Generic';

export interface GovernanceProfile {
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

export interface RelatedAgents {
  dependsOn?: string[];
  supports?: string[];
  oftenUsedWith?: string[];
}

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

export interface GovernanceCheckResult {
  controlType: GovernanceControlType;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface GitHubReportingFilters {
  owner?: string;
  projectNumber?: number;
  repository?: string;
  milestone?: string;
  reportingWindowDays?: number;
}

export type ExecutiveHealthStatus = 'on-track' | 'at-risk' | 'critical';

export interface GitHubProjectContext {
  owner: string;
  title: string;
  number: number;
  url: string;
  shortDescription?: string;
  public: boolean;
  closed: boolean;
  repositories: string[];
  reportGeneratedAt: string;
  reportingWindowDays: number;
}

export interface ExecutiveMetric {
  label: string;
  value: string;
  helperText?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'positive' | 'warning' | 'critical' | 'neutral';
}

export interface ExecutiveBlocker {
  id: string;
  title: string;
  url: string;
  repository: string;
  owner?: string;
  ageInDays: number;
  severity: 'low' | 'medium' | 'high';
  summary: string;
}

export interface ExecutiveRisk {
  id: string;
  title: string;
  url: string;
  repository: string;
  severity: 'medium' | 'high';
  summary: string;
}

export interface ExecutiveMilestoneStatus {
  id: string;
  title: string;
  description?: string;
  dueOn?: string;
  openIssues: number;
  closedIssues: number;
  completionPercentage: number;
  status: ExecutiveHealthStatus;
}

export interface ExecutiveDeliverySignal {
  label: string;
  value: number;
  helperText?: string;
}

export interface ExecutiveNotableItem {
  id: string;
  title: string;
  url: string;
  repository: string;
  state: string;
  type: 'issue' | 'pull_request';
  updatedAt: string;
  summary: string;
}

export interface GitHubExecutiveReport {
  context: GitHubProjectContext;
  health: {
    status: ExecutiveHealthStatus;
    headline: string;
    summary: string;
  };
  metrics: ExecutiveMetric[];
  blockers: ExecutiveBlocker[];
  risks: ExecutiveRisk[];
  milestones: ExecutiveMilestoneStatus[];
  deliverySignals: ExecutiveDeliverySignal[];
  notableItems: ExecutiveNotableItem[];
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
    timestamp?: string;
    requestId?: string;
    count?: number;
    filters?: Record<string, any>;
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

export interface EvidenceDamageHighlight {
  id: string;
  label: string;
  zone:
    | 'front-left'
    | 'front-center'
    | 'front-right'
    | 'left-side'
    | 'right-side'
    | 'rear-left'
    | 'rear-center'
    | 'rear-right'
    | 'windshield'
    | 'hood'
    | 'trunk'
    | 'roof';
  point: { x: number; y: number };
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
  rationale: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface EvidenceRepairEstimateLine {
  label: string;
  reason: string;
  minAmount: number;
  maxAmount: number;
}

export interface EvidenceReview {
  reviewKind: 'damage_photo' | 'document_image';
  imageUrl?: string;
  filename: string;
  source: string;
  selectedEvidenceReview: {
    summary: string;
    findings: string[];
    analysisSource: 'vision' | 'heuristic';
    fallbackUsed: boolean;
  };
  discrepancies: string[];
  damageHighlights: EvidenceDamageHighlight[];
  evidenceValidity: {
    overall: 'strong' | 'mixed' | 'weak';
    summary: string;
    corroboratingSignals: string[];
    concerns: string[];
  };
  repairEstimate: {
    currency: 'USD';
    totalMin: number;
    totalMax: number;
    lineItems: EvidenceRepairEstimateLine[];
    assumptions: string[];
  };
  claimWideAssessment: {
    summary: string;
    evidenceConsidered: number;
    supportingEvidence: string[];
    missingEvidence: string[];
    recommendations: string[];
  };
}

// ─── Evidence Intelligence ("Trace the truth") ─────────────────────────────────
// A deterministic, metadata-derived intelligence view over a single evidence
// artifact. Mirrors how claimSimulation derives stage results: computed from the
// claim's own data, no AI call, no randomness — repeatable and explainable.

// How much weight the artifact can carry in a decision, derived primarily from
// its verification status and secondarily from provenance.
export type EvidenceTrustLevel = 'corroborated' | 'usable' | 'source-limited' | 'disputed';

// The chain of custody for an evidence artifact.
export interface EvidenceLineage {
  origin: string;          // who/what produced it, e.g. "Pacific Auto Body"
  collectedBy: string;     // which Digital Worker captured it, e.g. "Damage DW"
  collectedAt: string;     // ISO timestamp (maps from dateReceived)
  systemOfRecord: string;  // where it is stored, e.g. "Claim-document store"
  trustPosture: string;    // plain-language note on usability + limitations
}

// A single row in a structured artifact (e.g. a repair-estimate line).
export interface EvidenceArtifactLineItem {
  description: string;
  basis: string;
  amount?: number;
  currency?: string;
}

// The renderable "document" for an artifact, when structured fields exist.
export interface EvidenceArtifact {
  vendor?: string;
  headline?: string;
  amount?: number;
  currency?: string;
  fields: Array<{ label: string; value: string }>;
  lineItems?: EvidenceArtifactLineItem[];
  lineItemsLabel?: string; // honest label for the line-items source
}

// The full derived intelligence packet for one evidence item.
export interface EvidenceIntelligence {
  evidenceId: string;
  title: string;
  summary: string;
  trustLevel: EvidenceTrustLevel;
  category: string;        // short kind label, e.g. "Document", "Photo set"
  whatThisSays: string[];
  whyThisMatters: string;
  whatThisDoesNotProve: string[];
  lineage: EvidenceLineage;
  artifact?: EvidenceArtifact;
}

// ─── Decision Intelligence (Beat 4 "Examine the evidence / Steer the plan") ────
// Deterministic, metadata-derived decision support for Decision Mode. Computed
// from the claim's own data — no AI call, no randomness — mirroring claimSimulation.

export type DecisionTone = 'positive' | 'caution' | 'critical' | 'neutral';

// A single headline metric shown in the decision metrics row.
export interface DecisionMetric {
  id: string;
  label: string;
  value: string;        // formatted display value, e.g. "70%", "±14%", "3 days"
  detail: string;       // honest, traceable sub-label
  tone: DecisionTone;
  progress?: number;    // 0–100 when a bar makes sense
}

// Whether the recommended action can be signed off within delegated authority,
// or must be escalated for senior approval.
export interface GovernanceAssessment {
  requiresApproval: boolean;
  title: string;
  summary: string;
  reasons: string[];
  tone: DecisionTone;
  /**
   * Whether the claim is eligible for straight-through (agent auto-finalise).
   * When false on a within-authority claim, the human adjuster must sign off
   * (no autonomous finalisation outside the conservative STP scope).
   */
  straightThroughEligible?: boolean;
  /**
   * True when this claim is blocked on a specialist referral (SIU fraud
   * investigation, Legal policy interpretation) rather than a delegated
   * authority ceiling. Per SOP-001's two-axis escalation model, specialist
   * referrals are a direct route that bypasses supervisor/senior sign-off
   * entirely — "redirect to a senior" is not a valid unblock for these,
   * regardless of the requesting adjuster's own seniority.
   */
  specialistReferralRequired?: boolean;
}

// One decomposed component of the overall AI confidence, with the evidence /
// signal it was derived from (governance legibility — FR-2 / C-02).
export interface DecisionConfidenceComponent {
  id: string;
  label: string;
  score: number;            // 0–100
  tone: DecisionTone;
  basis: string;            // what this score was derived from
  evidenceRefs?: string[];  // ids/types of supporting evidence
}

// A bounded "thing to consider" surfaced from real claim signals.
export interface DecisionInsight {
  id: string;
  severity: 'info' | 'caution' | 'critical';
  title: string;
  detail: string;
}

// An evidence item ranked by how decision-relevant it is, with a deep link
// into the Evidence Intelligence view.
export interface RankedEvidence {
  item: EvidenceItem;
  relevance: string;    // why this matters to the pending decision
  tone: DecisionTone;
  deepLinkParam: string; // the ?ev= value for the evidence route
}

// The full derived decision-intelligence packet for one claim.
export interface DecisionIntelligence {
  metrics: DecisionMetric[];
  governance: GovernanceAssessment;
  insights: DecisionInsight[];
  relevantEvidence: RankedEvidence[];
  /** Per-component breakdown of the headline AI confidence (FR-2 / C-02). */
  confidenceBreakdown: DecisionConfidenceComponent[];
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
  recommendedSteps?: string[];
  financialImpact?: {
    estimatedAmount?: number;
    currency?: string;
    breakdown?: Array<{
      category: string;
      amount: number;
      description: string;
      isDeduction?: boolean;
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
// versus a human adjuster (hand-off behaviour). Surfaced under the branded
// prestige scheme: standard→Core, priority→Premier, white_glove→Masterpiece,
// signature→Masterpiece Signature.
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
   *  Authoritative numeric score shown in Decision Queue and Decision Mode. */
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
  /** Eligible for straight-through (agent auto-finalise) settlement — glass-only /
   *  total-loss-obvious scope. Everything else needs a human sign-off. */
  straightThroughEligible?: boolean;
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

// FNOL form submission
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
export type GovernanceVerdictStatus =
  | 'within_authority'
  | 'requires_senior_approval'
  | 'blocked';

export interface GovernanceCriterion {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

/** Canonical governed-action taxonomy used across the audit surface. */
export type DecisionCategory =
  | 'approve'
  | 'route-to-adjuster'
  | 'request-info'
  | 'recommend-deny-for-human-review';

export interface GovernanceDecisionRecord {
  status: GovernanceVerdictStatus;
  requiresApproval: boolean;
  blocked: boolean;
  decision: DecisionOutcome['decision'];
  canonicalCategory?: DecisionCategory;
  straightThroughEligible?: boolean;
  reasons: string[];
  criteria: GovernanceCriterion[];
  authorityLimit: number;
  settlementAmount: number;
  currency: string;
  confidenceLevel: ConfidenceLevel;
  approver?: { id?: string; name?: string; role?: string };
  evaluatedAt: string;
  recordHash?: string;
  previousHash?: string | null;
  retentionClass?: string;
}


// Made with Bob
