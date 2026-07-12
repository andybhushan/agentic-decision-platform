import type { InteractionDoc } from './cosmosService';

export type DataSensitivityTier = 'low' | 'medium' | 'high';
export type AgentRuntimeStatus = 'active' | 'degraded' | 'paused';
export type GovernanceEventType =
  | 'policy_violation'
  | 'governance_override'
  | 'runtime_error'
  | 'human_escalation'
  | 'tool_failure';
export type GovernanceSeverity = 'critical' | 'high' | 'medium';

export interface SyntheticInteractionRecord {
  id: string;
  agentId: string;
  sessionId: string;
  timestamp: string;
  durationMs: number;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  status: 'success' | 'error';
  toolCallsTotal: number;
  toolCallsFailed: number;
  escalated: boolean;
  riskContribution: number;
  traceReference: string;
  policyEvaluations: Array<{
    policyId: string;
    outcome: 'passed' | 'failed' | 'blocked' | 'violation';
    threshold: number;
    actual: number;
    actionTaken?: 'none' | 'override';
    severity: GovernanceSeverity;
  }>;
  errorCode?: string;
  events: SyntheticGovernanceEvent[];
}

export type SyntheticGovernanceEvent =
  | {
      id: string;
      interactionId: string;
      agentId: string;
      timestamp: string;
      type: 'policy_violation';
      severity: GovernanceSeverity;
      message: string;
      actorId: string | null;
      detail: {
        policyId: string;
        threshold: number;
        actual: number;
      };
    }
  | {
      id: string;
      interactionId: string;
      agentId: string;
      timestamp: string;
      type: 'governance_override';
      severity: GovernanceSeverity;
      message: string;
      actorId: string | null;
      detail: {
        policyId: string;
        reason: string;
      };
    }
  | {
      id: string;
      interactionId: string;
      agentId: string;
      timestamp: string;
      type: 'human_escalation';
      severity: GovernanceSeverity;
      message: string;
      actorId: string | null;
      detail: {
        queue: string;
      };
    }
  | {
      id: string;
      interactionId: string;
      agentId: string;
      timestamp: string;
      type: 'runtime_error';
      severity: GovernanceSeverity;
      message: string;
      actorId: string | null;
      detail: {
        errorCode: string;
      };
    }
  | {
      id: string;
      interactionId: string;
      agentId: string;
      timestamp: string;
      type: 'tool_failure';
      severity: GovernanceSeverity;
      message: string;
      actorId: string | null;
      detail: {
        failedCalls: number;
      };
    };

export interface GovernanceSyntheticDataset {
  seed: string;
  generatedAt: string;
  windowDays: number;
  interactions: InteractionDoc[];
}

export interface GovernanceConsistencyReport {
  passed: boolean;
  checks: {
    costArithmetic: { passed: boolean; expected: number; actual: number };
    violationRate: { passed: boolean; expected: number; actual: number };
    lastSeenIntegrity: { passed: boolean; mismatches: Array<{ agentId: string; expected: string; actual: string }> };
  };
  issues: string[];
}

