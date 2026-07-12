import type { EvidenceItem, PolicyContext } from './index';

// Digital Steward types for claims navigation assistant

/** A compact summary of a single claim visible on the adjuster's current page */
export interface PageClaimSummary {
  id: string;
  claimantName: string;
  incidentType: string;
  stage: string;
  priority: string;
  confidenceLevel: string;
  blockerReason?: string;
  timeInQueue?: string;
  estimatedExposure?: number;
  workingOn?: string;
  /** Completed agent actions drawn from the claim's audit trail (auditable source for "Completed work"). */
  completedActions?: CompletedAgentAction[];
}

/** A single agent-performed, completed step taken from a claim's audit trail. */
export interface CompletedAgentAction {
  agent: string;
  action: string;
  outcome: string;
}

/** A claim as it appears in the ranked "Recommended Next Claims" list, with the
 *  exact signals and rationale used to place it — lets the Steward explain why
 *  one claim outranks another deterministically. */
export interface RankedClaimSummary {
  rank: number;
  id: string;
  claimantName: string;
  incidentType: string;
  priority: string;
  confidenceLevel: string;
  timeInQueue?: string;
  estimatedExposure?: number;
  pendingDecisionType?: string;
  /** Human-readable placement rationale, e.g. "HIGH priority · Anomaly Review · queued 1 day 6 hours". */
  rationale: string;
}

/** A claim as it appears in the ranked "Recommended Next Claims" list, with the
 *  exact signals and rationale used to place it — lets the Steward explain why
 *  one claim outranks another deterministically. */
export interface RankedClaimSummary {
  rank: number;
  id: string;
  claimantName: string;
  incidentType: string;
  priority: string;
  confidenceLevel: string;
  timeInQueue?: string;
  estimatedExposure?: number;
  pendingDecisionType?: string;
  /** Human-readable placement rationale, e.g. "HIGH priority · Anomaly Review · queued 1 day 6 hours". */
  rationale: string;
}

export interface StewardFocusedClaimRecord {
  id: string;
  claimantName: string;
  incidentType: string;
  incidentDate: string;
  incidentLocation: string;
  incidentDescription: string;
  injuryIndicated: boolean;
  policeReportRef?: string;
  immediateNeeds: string[];
  policyRef: string;
  policyContext: PolicyContext;
  claimStage: string;
  pendingDecisionType: string;
  blockerReason: string;
  confidenceLevel: string;
  lastAgentAction: string;
  timeInQueue: string;
  priority: string;
  workingOn?: string;
  evidenceItems: EvidenceItem[];
  recommendedAction?: {
    actionType: string;
    description: string;
    rationale: string;
    estimatedAmount?: number;
  };
}

/** Full page context sent with every chat request */
export interface StewardPageContext {
  pageName: string;
  priorityClaim?: PageClaimSummary;
  priorityReason?: string;
  focusedClaimId?: string; // claim the adjuster has soft-selected — "this claim"
  focusedClaimRecord?: StewardFocusedClaimRecord;
  focusedEntry?: { label: string; detail?: string }; // a specific on-screen entry the adjuster soft-selected — "this"
  activeAdjuster?: {
    id: string;
    name: string;
    team: string;
    seniority: string;
    yearsExperience: number;
    specialisations: string[];
    currentWorkload: number;
    maxCapacity: number;
    /** Delegated settlement/exposure authority limit for this adjuster (used to decide whether Claims Supervisor sign-off is needed). */
    authorityLimit?: number;
  };
  allClaims: PageClaimSummary[];
  /** The ranked "Recommended Next Claims" list with placement rationale, mirroring the on-screen cards. */
  recommendedRanking?: RankedClaimSummary[];
}

export interface StewardChatRequest {
  message: string;
  conversationId?: string;
  context?: StewardContext;
  pageContext?: StewardPageContext;
}

export interface StewardContext {
  tenantId: string;
  userId: string;
  role: string;
  claimId?: string;
  lineOfBusiness?: string;
  region?: string;
}

export interface StewardChatResponse {
  conversationId: string;
  message: string;
  sources: RetrievedSource[];
  confidence: number;
  warnings?: string[];
  action?: {
    type: 'escalate_siu' | 'redirect_fraud' | 'block_settlement';
    claimId: string;
    status: 'executed' | 'failed';
    summary: string;
    executedAt: string;
  };
}

export interface RetrievedSource {
  claimId: string;
  section: string;
  snippet: string;
  documentType: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: RetrievedSource[];
}

export interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface BriefingTag {
  label: string;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue';
}

export interface BriefingTopPriority {
  name: string;
  claimId: string;
  rank: number;
  tags: BriefingTag[];
  exposure: number;
  blocker?: string;
  requiredAction?: string;
  /** Why this claim outranks the rest of the queue (comparative rationale). */
  whyThisFirst?: string;
  /** What the pipeline has already completed on this claim (policy verified, fraud screen passed, etc.). */
  alreadyDone?: string[];
  /** Ordered, concrete next steps to move THIS claim forward (richer than the single requiredAction line). */
  recommendedSteps?: string[];
}

/** Queue-level synthesis the per-claim recommendation cards do not surface. */
export interface BriefingQueueIntelligence {
  totalExposure: number;
  openDecisions: number;
  highPriorityCount: number;
  fraudFlags: number;
  oldestWaiting?: string;
  /** One-line narrative tying the numbers together. */
  note?: string;
}

export interface BriefingActNowItem {
  name: string;
  claimId: string;
  timeInQueue: string;
  urgency: 'urgent' | 'high' | 'medium';
  reason: string;
}

export interface BriefingKeepAnEyeOnItem {
  identifier: string;
  note: string;
}

export interface BriefingData {
  topPriority: BriefingTopPriority;
  actNow: BriefingActNowItem[];
  keepAnEyeOn: BriefingKeepAnEyeOnItem[];
  queueIntelligence?: BriefingQueueIntelligence;
}

export interface ClaimChunk {
  id: string;
  claimId: string;
  policyId: string;
  tenantId: string;
  section: ClaimSection;
  content: string;
  embedding?: number[];
  metadata: ClaimChunkMetadata;
  chunkVersion: string;
  embeddingModel?: string;
  createdAt: string;
}

export type ClaimSection =
  | 'summary'
  | 'policy_details'
  | 'investigation_notes'
  | 'settlement_info'
  | 'evidence'
  | 'correspondence'
  | 'timeline'
  | 'parties';

export interface ClaimChunkMetadata {
  claimType: string;
  status: string;
  dateOfLoss: string;
  jurisdiction?: string;
  parties?: string[];
  coverageTypes?: string[];
  claimAmount?: number;
  priority?: string;
}

export interface IndexingJobRequest {
  tenantId: string;
  sourceType: 'json' | 'cosmos';
  sourcePath?: string;
  forceReindex?: boolean;
}

export interface IndexingJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface VectorSearchRequest {
  query: string;
  tenantId: string;
  filters?: {
    claimId?: string;
    userId?: string;
    lineOfBusiness?: string;
    region?: string;
    status?: string;
    claimType?: string;
  };
  topK?: number;
  minSimilarity?: number;
}

export interface VectorSearchResult {
  chunk: ClaimChunk;
  similarity: number;
}

export interface EmbeddingRequest {
  text: string;
}

export interface ChatCompletionRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  content: string;
  tokensUsed: number;
}

// ── SOPs (Standard Operating Procedures) as agent controls ──────────────────

export type SopCategory =
  | 'escalation'
  | 'authority'
  | 'siu'
  | 'coverage'
  | 'medical'
  | 'intake'
  | 'evidence'
  | 'staffing'
  | 'queue'
  | 'governance'
  | 'anomaly'
  | 'audit'
  | 'steward'
  | 'agent-governance'
  | 'communication'
  | 'general';

/** Front-matter metadata parsed from an SOP markdown document. */
export interface SopFrontMatter {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  owner: string;
  category: SopCategory;
  appliesTo?: string;
  summary?: string;
}

/** A fully-loaded SOP document: metadata + body + integrity checksum. */
export interface SopDocument extends SopFrontMatter {
  /** Raw markdown body (front-matter stripped). */
  body: string;
  /** SHA-256 of the raw file contents — used for change detection. */
  checksum: string;
  /** Source file name (for diagnostics). */
  fileName: string;
}

/** A retrievable chunk of an SOP (one section of the document). */
export interface SopChunk {
  /** Stable id: `${sopId}::${sectionSlug}`. */
  id: string;
  sopId: string;
  title: string;
  version: string;
  category: SopCategory;
  /** Section heading this chunk was taken from. */
  section: string;
  content: string;
}

/** A single SOP retrieval hit. */
export interface SopSearchResult {
  chunk: SopChunk;
  similarity: number;
}

/** Persisted manifest entry tracking the last-indexed state of an SOP. */
export interface SopManifestEntry {
  id: string;
  sopId: string;
  version: string;
  checksum: string;
  chunkCount: number;
  lastIndexedAt: string;
}

/** Result of a single SOP's sync (change detection + re-index). */
export interface SopSyncItem {
  sopId: string;
  title: string;
  version: string;
  status: 'unchanged' | 'added' | 'changed' | 'removed';
  previousChecksum?: string;
  currentChecksum?: string;
  chunksIndexed?: number;
}

/** Aggregate report returned by an SOP sync run. */
export interface SopChangeReport {
  ranAt: string;
  totalSops: number;
  changed: number;
  added: number;
  removed: number;
  unchanged: number;
  items: SopSyncItem[];
}
