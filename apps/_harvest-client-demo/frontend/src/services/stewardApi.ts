import axios from 'axios';
import type { EvidenceItem, PolicyContext } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

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
  rationale: string;
}

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

export interface StewardPageContext {
  pageName: string;
  priorityClaim?: PageClaimSummary;
  priorityReason?: string;
  focusedClaimId?: string;
  focusedClaimRecord?: StewardFocusedClaimRecord;
  focusedEntry?: { label: string; detail?: string };
  activeAdjuster?: {
    id: string;
    name: string;
    team: string;
    seniority: string;
    yearsExperience: number;
    specialisations: string[];
    currentWorkload: number;
    maxCapacity: number;
    authorityLimit?: number;
  };
  allClaims: PageClaimSummary[];
  recommendedRanking?: RankedClaimSummary[];
}

export interface StewardChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    tenantId: string;
    userId: string;
    role: string;
    claimId?: string;
    lineOfBusiness?: string;
    region?: string;
  };
  pageContext?: StewardPageContext;
}

export interface RetrievedSource {
  claimId: string;
  section: string;
  snippet: string;
  documentType: string;
  similarity: number;
  metadata: Record<string, any>;
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

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: RetrievedSource[];
  briefingData?: BriefingData;
  decisionBriefing?: DecisionBriefingData;
  action?: {
    type: 'escalate_siu' | 'redirect_fraud' | 'block_settlement';
    claimId: string;
    status: 'executed' | 'failed';
    summary: string;
    executedAt: string;
  };
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
  whyThisFirst?: string;
  alreadyDone?: string[];
  recommendedSteps?: string[];
}

export interface BriefingQueueIntelligence {
  totalExposure: number;
  openDecisions: number;
  highPriorityCount: number;
  fraudFlags: number;
  oldestWaiting?: string;
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

// Single-claim briefing used in Decision Mode. Mirrors the queue briefing's visual
// language (same card chrome) but the content is the focused-claim decision context
// rather than the portfolio-level queue read.
export interface DecisionBriefingData {
  claimId: string;
  name: string;
  incidentType: string;
  stage: string;
  tags: BriefingTag[];
  exposure: number;
  recommendation?: string;
  whyRecommended?: string;
  blocker?: string;
  governanceTitle?: string;
  governanceNote?: string;
  governanceTone?: 'positive' | 'caution' | 'critical';
  completedWork: string[];
  recommendedSteps: string[];
}

export const stewardApi = {
  async getBriefing(pageContext: StewardPageContext): Promise<BriefingData> {
    const response = await axios.post(`${API_BASE}/steward/briefing`, { pageContext });
    return response.data.data;
  },

  async chat(request: StewardChatRequest): Promise<StewardChatResponse> {
    const response = await axios.post(`${API_BASE}/steward/chat`, request);
    return response.data.data;
  },

  async listConversations(tenantId = 'default-tenant', userId = 'default-user'): Promise<Conversation[]> {
    const response = await axios.get(`${API_BASE}/steward/conversations`, {
      params: { tenantId, userId },
    });
    return response.data.data;
  },

  async getConversation(id: string, tenantId = 'default-tenant'): Promise<Conversation> {
    const response = await axios.get(`${API_BASE}/steward/conversations/${id}`, {
      params: { tenantId },
    });
    return response.data.data;
  },

  async deleteConversation(id: string, tenantId = 'default-tenant'): Promise<void> {
    await axios.delete(`${API_BASE}/steward/conversations/${id}`, {
      params: { tenantId },
    });
  },

  async triggerIndexing(tenantId = 'default-tenant'): Promise<any> {
    const response = await axios.post(`${API_BASE}/steward/admin/index`, {
      tenantId,
      sourceType: 'json',
    });
    return response.data.data;
  },
};
