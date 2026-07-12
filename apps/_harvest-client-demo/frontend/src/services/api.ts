import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type {
  Vertical,
  Agent,
  Workflow,
  APIResponse,
  AIGenerateAgentRequest,
  AIGenerateAgentResponse,
  AIGeneratePromptRequest,
  AIGeneratePromptResponse,
  AISimulateRequest,
  AISimulateResponse,
  GitHubExecutiveReport,
  GitHubReportingFilters,
  Claim,
  AdjusterProfile,
  CustomerPersona,
  FNOLSubmission,
  DecisionOutcome,
  EvidenceItem,
  EvidenceReview,
  AppointedRepresentative,
} from '../types';
import type { Workforce } from '../data/claimsWorkforce.seed';
import type { ModelNode, Subflow, SubflowEdge } from '../data/claimsModel';

export interface GovernanceSummary {
  windowDays: number;
  totalInteractions: number;
  policyChecks: number;
  policyViolations: number;
  violationRate: number | null;
  governanceOverrides: number;
  overrideRate: number | null;
  escalations: number;
  escalationRate: number | null;
  errorCount: number;
  errorRate: number | null;
  toolCalls: number;
  toolFailures: number;
  toolFailureRate: number | null;
  avgDurationMs: number | null;
  avgInputTokens: number | null;
  avgOutputTokens: number | null;
  avgEstimatedCostUsd: number | null;
  topViolations: Array<{
    agentId: string;
    violations: number;
    checks: number;
    violationRate: number | null;
    interactions: number;
  }>;
  externalSignals: {
    entra: { enabled: boolean; status: string; source: string };
    a365: { enabled: boolean; status: string; source: string };
    github: { enabled: boolean; status: string; source: string };
  };
}

export interface GovernanceRiskMatrixResponse {
  windowDays: number;
  agents: Array<{
    agentId: string;
    interactions: number;
    policyChecks: number;
    policyViolations: number;
    violationRate: number;
    overrideRate: number;
    escalationRate: number;
    errorRate: number;
    toolFailureRate: number;
    riskScore: number;
    latestTs: string;
    totalTokenCostUsd: number | null;
    avgInputTokens: number | null;
    avgOutputTokens: number | null;
  }>;
}

export interface GovernanceAuditLogResponse {
  windowDays: number;
  totalEvents: number;
  events: Array<{
    id: string;
    ts: string;
    agentId: string;
    sessionId: string;
    claimId: string | null;
    eventType: 'policy_violation' | 'governance_override' | 'runtime_error' | 'human_escalation' | 'tool_failure';
    severity: 'critical' | 'high' | 'medium';
    message: string;
    actorId: string | null;
  }>;
}

export interface GovernanceDemoState {
  enabled: boolean;
  seed: string | null;
  generatedAt: string | null;
  windowDays: number | null;
  interactionCount: number;
  consistency: {
    passed: boolean;
    checks: {
      costArithmetic: { passed: boolean; expected: number; actual: number };
      violationRate: { passed: boolean; expected: number; actual: number };
      lastSeenIntegrity: { passed: boolean; mismatches: Array<{ agentId: string; expected: string; actual: string }> };
    };
    issues: string[];
  } | null;
}

export interface GovernanceIdentitySignals {
  status: 'not_configured' | 'consent_required' | 'connected';
  message: string;
  tenantId: string | null;
  orgName: string | null;
  permissionsGranted: boolean;
  consentUrl: string | null;
  signals: {
    userCount: number | null;
    riskyUserCount: number | null;
    recentSignInFailures: number | null;
    conditionalAccessPolicies: number | null;
    lastRefreshed: string;
  } | null;
  a365Signals: {
    secureScore: number | null;
    secureScoreMax: number | null;
    activeUsers: number | null;
    activeAlerts: number | null;
    dlpPolicies: number | null;
    complianceScore: number | null;
    teamsMessages7d: number | null;
    lastRefreshed: string;
  } | null;
}

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Suppress 401s — expected when session not yet established
        if (error.response?.status !== 401) {
          console.error('API Error:', error);
        }
        throw error;
      }
    );
  }

  // Verticals
  async getVerticals(): Promise<Vertical[]> {
    const response = await this.client.get<APIResponse<Vertical[]>>('/verticals');
    return response.data.data || [];
  }

  async getVertical(id: string): Promise<Vertical> {
    const response = await this.client.get<APIResponse<Vertical>>(`/verticals/${id}`);
    if (!response.data.data) {
      throw new Error('Vertical not found');
    }
    return response.data.data;
  }

  async clearClaimSuitesDemoData(): Promise<ClaimSuiteClearResult> {
    const response = await this.client.post<APIResponse<ClaimSuiteClearResult>>('/claim-suites/clear');
    if (!response.data.data) {
      throw new Error('Failed to clear claim suite demo data');
    }
    return response.data.data;
  }

  async reimportClaimSuitesDemoData(options?: {
    count?: number;
    seed?: string;
    name?: string;
    generatedBy?: string;
    agentIds?: string[];
  }): Promise<{
    cleared: ClaimSuiteClearResult;
    suite: { id: string; name: string; totalCases: number };
    run: {
      id: string;
      agentIds: string[];
      executionPlan: { deployedAgentIds: string[]; mockedAgentIds: string[] };
      summary: { processedCases: number; closedCases: number };
    };
  }> {
    const response = await this.client.post<APIResponse<{
      cleared: ClaimSuiteClearResult;
      suite: { id: string; name: string; totalCases: number };
      run: {
        id: string;
        agentIds: string[];
        executionPlan: { deployedAgentIds: string[]; mockedAgentIds: string[] };
        summary: { processedCases: number; closedCases: number };
      };
    }>>('/claim-suites/reimport', options ?? {}, { timeout: 600000 });
    if (!response.data.data) {
      throw new Error('Failed to re-import claim suite data');
    }
    return response.data.data;
  }

  // Agents
  async getAgents(filters?: {
    verticalId?: string;
    archetype?: string;
    authorityLevel?: string;
    search?: string;
  }): Promise<Agent[]> {
    const response = await this.client.get<APIResponse<Agent[]>>('/agents', {
      params: filters,
    });
    return response.data.data || [];
  }

  async getAgent(id: string): Promise<Agent> {
    const response = await this.client.get<APIResponse<Agent>>(`/agents/${id}`);
    if (!response.data.data) {
      throw new Error('Agent not found');
    }
    return response.data.data;
  }

  async createAgent(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
    const response = await this.client.post<APIResponse<Agent>>('/agents', agent);
    if (!response.data.data) {
      throw new Error('Failed to create agent');
    }
    return response.data.data;
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    const response = await this.client.put<APIResponse<Agent>>(`/agents/${id}`, updates);
    if (!response.data.data) {
      throw new Error('Failed to update agent');
    }
    return response.data.data;
  }

  async deleteAgent(id: string): Promise<void> {
    await this.client.delete(`/agents/${id}`);
  }

  async revokeAgent(id: string, reason?: string): Promise<{
    agentId: string;
    agentName: string;
    revokedAt: string;
    revokedBy: string;
    revokeReason?: string;
    wasDeployed: boolean;
  }> {
    const response = await this.client.post<APIResponse<{
      agentId: string;
      agentName: string;
      revokedAt: string;
      revokedBy: string;
      revokeReason?: string;
      wasDeployed: boolean;
    }>>(`/agents/${id}/revoke`, { reason });
    if (!response.data.data) {
      throw new Error('Failed to revoke agent');
    }
    return response.data.data;
  }

  async deployAgentToFoundry(id: string): Promise<{
    deploymentId: string;
    endpoint: string;
    status: string;
  }> {
    const response = await this.client.post<APIResponse<{
      deploymentId: string;
      endpoint: string;
      status: string;
    }>>(`/agents/${id}/deploy-to-foundry`);
    if (!response.data.data) {
      throw new Error('Failed to deploy agent to Azure AI Foundry');
    }
    return response.data.data;
  }

  async generateAgentSpec(id: string): Promise<{
    specification: string;
    foundryPrompt: string;
    reviewerSummary: string;
    agentId: string;
    agentName: string;
  }> {
    const response = await this.client.post<APIResponse<{
      specification: string;
      foundryPrompt: string;
      reviewerSummary: string;
      agentId: string;
      agentName: string;
    }>>(`/agents/${id}/generate-spec`, undefined, { timeout: 300000 });
    if (!response.data.data) {
      throw new Error('Failed to generate agent specification');
    }
    return response.data.data;
  }

  async chatWithAgent(
    id: string,
    query: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
    deploymentId?: string,
    options: { context?: 'standalone' | 'orchestrated'; taskEnvelope?: unknown } = {},
  ): Promise<{
    response: string;
    confidence?: number;
    escalateToHuman?: boolean;
    message: string;
  }> {
    const response = await this.client.post<APIResponse<{
      response: string;
      confidence?: number;
      escalateToHuman?: boolean;
      message: string;
    }>>(`/agents/${id}/chat`, {
      query,
      history,
      deploymentId,
      context: options.context,
      taskEnvelope: options.taskEnvelope,
    });
    if (!response.data.data) {
      throw new Error('Failed to get agent response');
    }
    return response.data.data;
  }

  async getAgentInteractionsSummary(id: string): Promise<{
    agentId: string;
    total: number;
    avgConfidence: number | null;
    avgRoutingConfidence: number | null;
    avgDurationMs: number | null;
    escalationRate: number | null;
    escalated: number;
    errorCount: number;
    errorRate: number | null;
    avgInputTokens: number | null;
    avgOutputTokens: number | null;
    avgEstimatedCostUsd: number | null;
    policyChecks: number;
    policyViolations: number;
    policyViolationRate: number | null;
    governanceOverrides: number;
    overrideRate: number | null;
    toolCalls: number;
    toolFailures: number;
    toolFailureRate: number | null;
    byType: Record<string, number>;
    byPhase: Record<string, number>;
    latestHandoff: {
      targetName: string | null;
      reason: string | null;
      confidence: number | null;
    } | null;
    recent: {
      id: string;
      ts: string;
      interactionType: string;
      phase: string | null;
      confidence: number | null;
      escalated: boolean;
      claimId: string | null;
      claimantName: string | null;
      handoffTarget: string | null;
      handoffReason: string | null;
      durationMs: number | null;
      summary: string | null;
      clientIssueFlags: string[];
      decisionPoints: string[];
    }[];
  }> {
    const response = await this.client.get(`/agents/${id}/interactions/summary`);
    return response.data.data;
  }

  async getGovernanceSummary(windowDays = 7): Promise<GovernanceSummary> {
    const response = await this.client.get<APIResponse<GovernanceSummary>>('/governance/summary', {
      params: { windowDays },
    });
    if (!response.data.data) {
      throw new Error('Failed to load governance summary');
    }
    return response.data.data;
  }

  async getGovernanceRiskMatrix(windowDays = 7): Promise<GovernanceRiskMatrixResponse> {
    const response = await this.client.get<APIResponse<GovernanceRiskMatrixResponse>>('/governance/agents/risk-matrix', {
      params: { windowDays },
    });
    if (!response.data.data) {
      throw new Error('Failed to load governance risk matrix');
    }
    return response.data.data;
  }

  async getGovernanceAuditLog(windowDays = 7, pageSize = 100): Promise<GovernanceAuditLogResponse> {
    const response = await this.client.get<APIResponse<GovernanceAuditLogResponse>>('/governance/audit-log', {
      params: { windowDays, pageSize },
    });
    if (!response.data.data) {
      throw new Error('Failed to load governance audit log');
    }
    return response.data.data;
  }

  async loadGovernanceDemoData(options?: {
    seed?: string;
    windowDays?: number;
    interactionsPerAgent?: number;
  }): Promise<GovernanceDemoState> {
    const response = await this.client.post<APIResponse<GovernanceDemoState>>('/governance/demo/load', options ?? {});
    if (!response.data.data) {
      throw new Error('Failed to load governance demo data');
    }
    return response.data.data;
  }

  async resetGovernanceDemoData(): Promise<{ enabled: boolean }> {
    const response = await this.client.post<APIResponse<{ enabled: boolean }>>('/governance/demo/reset');
    if (!response.data.data) {
      throw new Error('Failed to reset governance demo data');
    }
    return response.data.data;
  }

  async getGovernanceDemoStatus(): Promise<GovernanceDemoState> {
    const response = await this.client.get<APIResponse<GovernanceDemoState>>('/governance/demo/status');
    if (!response.data.data) {
      throw new Error('Failed to load governance demo status');
    }
    return response.data.data;
  }

  async getGovernanceIdentitySignals(): Promise<GovernanceIdentitySignals> {
    const response = await this.client.get<APIResponse<GovernanceIdentitySignals>>('/governance/identity-signals');
    if (!response.data.data) {
      throw new Error('Failed to load identity signals');
    }
    return response.data.data;
  }

  async proposeAgentConfigure(
    id: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<{
    response: string;
    proposedChanges: {
      field: string;
      currentValue: unknown;
      newValue: unknown;
      reason: string;
    }[] | null;
  }> {
    const response = await this.client.post(`/agents/${id}/configure`, { message, history });
    return response.data.data;
  }

  // Voice layer (sits on top of the web intake agent)
  async transcribeVoice(
    audioBase64: string,
    mimeType: string,
    language?: string,
  ): Promise<{ text: string; provider: string }> {
    const response = await this.client.post<APIResponse<{ text: string; provider: string }>>(
      '/voice/transcribe',
      { audioBase64, mimeType, language },
    );
    if (!response.data.data) {
      throw new Error('Failed to transcribe audio');
    }
    return response.data.data;
  }

  async synthesizeVoice(
    text: string,
    voice?: string,
  ): Promise<{ audioBase64: string; mimeType: string; provider: string }> {
    const response = await this.client.post<
      APIResponse<{ audioBase64: string; mimeType: string; provider: string }>
    >('/voice/synthesize', { text, voice });
    if (!response.data.data) {
      throw new Error('Failed to synthesize speech');
    }
    return response.data.data;
  }
  async getWorkflows(filters?: {
    verticalId?: string;
    search?: string;
  }): Promise<Workflow[]> {
    const response = await this.client.get<APIResponse<Workflow[]>>('/workflows', {
      params: filters,
    });
    return response.data.data || [];
  }

  async getWorkflow(id: string): Promise<Workflow> {
    const response = await this.client.get<APIResponse<Workflow>>(`/workflows/${id}`);
    if (!response.data.data) {
      throw new Error('Workflow not found');
    }
    return response.data.data;
  }

  async getWorkforces(): Promise<Workforce[]> {
    const response = await this.client.get<APIResponse<Workforce[]>>('/workforces');
    return response.data.data || [];
  }

  async getClaimsModel(): Promise<{ nodes: ModelNode[]; subflows: Subflow[]; topEdges: SubflowEdge[] }> {
    const response = await this.client.get<
      APIResponse<{ nodes: ModelNode[]; subflows: Subflow[]; topEdges: SubflowEdge[] }>
    >('/process-models/claims');
    if (!response.data.data) {
      throw new Error('Claims model not found');
    }
    return response.data.data;
  }

  async getWorkforce(id: string): Promise<Workforce> {
    const response = await this.client.get<APIResponse<Workforce>>(`/workforces/${id}`);
    if (!response.data.data) {
      throw new Error('Workforce not found');
    }
    return response.data.data;
  }

  async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow> {
    const response = await this.client.post<APIResponse<Workflow>>('/workflows', workflow);
    if (!response.data.data) {
      throw new Error('Failed to create workflow');
    }
    return response.data.data;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow> {
    const response = await this.client.put<APIResponse<Workflow>>(`/workflows/${id}`, updates);
    if (!response.data.data) {
      throw new Error('Failed to update workflow');
    }
    return response.data.data;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.client.delete(`/workflows/${id}`);
  }

  // AI Services
  async generateAgent(request: AIGenerateAgentRequest): Promise<AIGenerateAgentResponse> {
    const response = await this.client.post<APIResponse<AIGenerateAgentResponse>>(
      '/ai/generate-agent',
      request
    );
    if (!response.data.data) {
      throw new Error('Failed to generate agent');
    }
    return response.data.data;
  }

  async customizeAgent(agentId: string, customization: string): Promise<AIGenerateAgentResponse> {
    const response = await this.client.post<APIResponse<AIGenerateAgentResponse>>(
      '/ai/customize-agent',
      { agentId, customization }
    );
    if (!response.data.data) {
      throw new Error('Failed to customize agent');
    }
    return response.data.data;
  }

  async generatePrompt(request: AIGeneratePromptRequest): Promise<AIGeneratePromptResponse> {
    const response = await this.client.post<APIResponse<AIGeneratePromptResponse>>(
      '/ai/generate-prompt',
      request
    );
    if (!response.data.data) {
      throw new Error('Failed to generate prompt');
    }
    return response.data.data;
  }

  async simulate(request: AISimulateRequest): Promise<AISimulateResponse> {
    const response = await this.client.post<APIResponse<AISimulateResponse>>(
      '/ai/simulate',
      request
    );
    if (!response.data.data) {
      throw new Error('Failed to simulate agent');
    }
    return response.data.data;
  }

  async claimAssist(command: string, claimContext: string): Promise<{
    message: string;
    confidence: number;
    suggestedActions: string[];
  }> {
    const response = await this.client.post<APIResponse<{
      message: string;
      confidence: number;
      suggestedActions: string[];
    }>>('/ai/claim-assist', { command, claimContext });
    if (!response.data.data) {
      throw new Error('Failed to get AI response');
    }
    return response.data.data;
  }

  async testConnection(): Promise<{ success: boolean; provider: string }> {
    const response = await this.client.get<APIResponse<{ success: boolean; provider: string }>>(
      '/ai/test-connection'
    );
    if (!response.data.data) {
      throw new Error('Failed to test connection');
    }
    return response.data.data;
  }

  // Reporting
  async getExecutiveReport(filters?: GitHubReportingFilters): Promise<GitHubExecutiveReport> {
    const response = await this.client.get<APIResponse<GitHubExecutiveReport>>('/reporting/executive', {
      params: filters,
    });

    if (!response.data.data) {
      throw new Error('Failed to load executive report');
    }

    return response.data.data;
  }

  // Claims API methods
  async getClaims(filters?: {
    stage?: string;
    priority?: string;
    decisionType?: string;
    confidenceLevel?: string;
    adjusterId?: string;
    claimantPersonaId?: string;
  }): Promise<Claim[]> {
    const response = await this.client.get<APIResponse<Claim[]>>('/claims', {
      params: filters,
    });
    return response.data.data || [];
  }

  async getMasterClaims(filters?: {
    stage?: string;
    adjusterId?: string;
    claimantPersonaId?: string;
    clientTier?: string;
    handlingMode?: string;
    search?: string;
    seededOnly?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: MasterClaimRecord[]; meta: MasterClaimsResponseMeta }> {
    const response = await this.client.get<APIResponse<MasterClaimRecord[]>>('/claims/master', {
      params: filters,
    });
    return {
      data: response.data.data || [],
      meta: {
        count: response.data.meta?.count || 0,
        total: Number((response.data.meta as { total?: number } | undefined)?.total ?? 0),
        page: Number((response.data.meta as { page?: number } | undefined)?.page ?? 1),
        pageSize: Number((response.data.meta as { pageSize?: number } | undefined)?.pageSize ?? filters?.pageSize ?? 50),
        timestamp: response.data.meta?.timestamp,
      },
    };
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

  async deleteClaim(id: string): Promise<void> {
    await this.client.delete(`/claims/${id}`);
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

  async batchApproveClaims(
    claimIds: string[],
    userId: string,
    rationale?: string,
  ): Promise<{
    results: Array<{ claimId: string; outcome: 'approved' | 'blocked' | 'not_found'; reason?: string }>;
    approvedCount: number;
    blockedCount: number;
    notFoundCount: number;
  }> {
    const response = await this.client.post<
      APIResponse<{
        results: Array<{ claimId: string; outcome: 'approved' | 'blocked' | 'not_found'; reason?: string }>;
        approvedCount: number;
        blockedCount: number;
        notFoundCount: number;
      }>
    >('/claims/batch-decision', { claimIds, userId, rationale });
    if (!response.data.data) {
      throw new Error('Failed to batch approve claims');
    }
    return response.data.data;
  }

  async getClaimEvidence(id: string): Promise<EvidenceItem[]> {
    const response = await this.client.get<APIResponse<EvidenceItem[]>>(
      `/claims/${id}/evidence`
    );
    return response.data.data || [];
  }

  async getClaimEvidenceReview(claimId: string, evidenceId: string): Promise<EvidenceReview> {
    const response = await this.client.get<APIResponse<EvidenceReview>>(
      `/claims/${claimId}/evidence/${evidenceId}/review`
    );
    if (!response.data.data) {
      throw new Error('Failed to load evidence review');
    }
    return response.data.data;
  }

  async getAdjusters(): Promise<AdjusterProfile[]> {
    const response = await this.client.get<APIResponse<AdjusterProfile[]>>('/staff/adjusters');
    return response.data.data || [];
  }

  async getAdjuster(id: string): Promise<AdjusterProfile> {
    const response = await this.client.get<APIResponse<AdjusterProfile>>(`/staff/adjusters/${id}`);
    if (!response.data.data) {
      throw new Error('Adjuster not found');
    }
    return response.data.data;
  }

  async getCustomerPersonas(selectableOnly = false): Promise<CustomerPersona[]> {
    const response = await this.client.get<APIResponse<CustomerPersona[]>>('/customers/personas', {
      params: { selectableOnly },
    });
    return response.data.data || [];
  }

  async getCustomerPersona(id: string): Promise<CustomerPersona> {
    const response = await this.client.get<APIResponse<CustomerPersona>>(`/customers/personas/${id}`);
    if (!response.data.data) {
      throw new Error('Customer persona not found');
    }
    return response.data.data;
  }

  async getPolicies(filters?: { holder?: string; personaId?: string }): Promise<Array<{
    policyRef: string;
    personaId?: string;
    policyType?: string;
    coverageType: string;
    coverageActive: boolean;
    renewalDate: string;
    annualPremium?: number;
    excessAmount: number;
    noClaims: number;
    address?: string;
    vehicles?: Array<{ make: string; model: string; registration: string; year: number; colour?: string }>;
    buildingsValue?: number;
    contentsValue?: number;
    maxTripDuration?: number;
  }>> {
    const response = await this.client.get('/policies', { params: filters });
    return response.data.data || [];
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; uptime: number }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Auth
  async login(password: string): Promise<{ userId: string; userName: string }> {
    const response = await this.client.post<APIResponse<{ userId: string; userName: string }>>(
      'auth/login',
      { password }
    );
    if (!response.data.data) {
      throw new Error('Login failed');
    }
    return response.data.data;
  }

  async getMe(): Promise<{ userId: string; userName: string } | null> {
    try {
      const response = await this.client.get<APIResponse<{ userId: string; userName: string }>>(
        'auth/me'
      );
      return response.data.data || null;
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    await this.client.post('auth/logout', {});
  }

  // Deployment audit
  async getDeploymentAudit(opts?: {
    limitDays?: number;
    limit?: number;
  }): Promise<{
    deployments: Array<{
      id: string;
      agentId: string;
      deployedBy: string;
      deployedByName: string;
      deployedAt: string;
      version: string;
      entraProfile?: {
        id: string;
        displayName: string;
        mail: string;
        department?: string;
        jobTitle?: string;
      };
      a365Signals?: {
        hasAnomalies: boolean;
        details: string[];
      };
    }>;
    totalCount: number;
  }> {
    const response = await this.client.get('/governance/deployments', { params: opts });
    if (!response.data.data) {
      return { deployments: [], totalCount: 0 };
    }
    return response.data.data;
  }
}

export interface MasterClaimRecord {
  claimId: string;
  claimStage: string;
  priority: string;
  pendingDecisionType: string;
  claimantName: string;
  claimantPersonaId: string | null;
  clientTier: string | null;
  appointedRepresentative: AppointedRepresentative | null;
  handlingMode: string | null;
  assignedAdjusterId: string | null;
  assignedAdjusterName: string | null;
  owner: string | null;
  policyRef: string;
  policyType: string | null;
  coverageType: string | null;
  coverageActive: boolean | null;
  holderName: string;
  holderEmail: string | null;
  holderPhone: string | null;
  seeded: boolean;
  governanceFlags: string[];
  updatedAt: string;
  createdAt: string;
}

export interface MasterClaimsResponseMeta {
  count: number;
  total: number;
  page: number;
  pageSize: number;
  timestamp?: string;
}

export interface ClaimSuiteClearResult {
  suitesDeleted: number;
  casesDeleted: number;
  runsDeleted: number;
  evaluationsDeleted: number;
  claimsDeleted: number;
  policiesDeleted: number;
  policiesPreserved: number;
  personasDeleted: number;
  fnolSessionsDeleted: number;
  telemetryDeleted: number;
}

export const api = new APIClient();

// Made with Bob
