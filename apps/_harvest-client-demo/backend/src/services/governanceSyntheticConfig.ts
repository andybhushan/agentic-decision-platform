import type { AgentRuntimeStatus, DataSensitivityTier, GovernanceSeverity } from './governanceSyntheticTypes';

export interface SyntheticAgentProfile {
  id: string;
  name: string;
  owner: string;
  purpose: string;
  sensitivityTier: DataSensitivityTier;
  status: AgentRuntimeStatus;
  modelId: string;
  profile: 'healthy' | 'cost_pressure' | 'compliance_pressure';
}

export interface SyntheticPolicy {
  id: string;
  name: string;
  severity: GovernanceSeverity;
  appliesTo: string[];
}

export interface SyntheticModelPrice {
  modelId: string;
  inputPer1kUsd: number;
  outputPer1kUsd: number;
}

export interface SyntheticBudget {
  agentId: string;
  reportingPeriodDays: number;
  maxSpendUsd: number;
}

export const GOVERNANCE_SYNTHETIC_AGENTS: SyntheticAgentProfile[] = [
  {
    id: 'digital-steward',
    name: 'Digital Steward',
    owner: 'Operations Excellence',
    purpose: 'Cross-queue prioritization and briefing',
    sensitivityTier: 'medium',
    status: 'active',
    modelId: 'gpt-5.4',
    profile: 'healthy',
  },
  {
    id: 'agent_claims_mobile_intake',
    name: 'Mobile FNOL Intake',
    owner: 'Claims Intake',
    purpose: 'Customer-first FNOL capture and routing',
    sensitivityTier: 'high',
    status: 'active',
    modelId: 'gpt-5.4',
    profile: 'compliance_pressure',
  },
  {
    id: 'fnol-session-service',
    name: 'FNOL Session Service',
    owner: 'Claims Platform',
    purpose: 'Session orchestration and evidence workflow',
    sensitivityTier: 'high',
    status: 'degraded',
    modelId: 'gpt-4o-mini',
    profile: 'cost_pressure',
  },
];

export const GOVERNANCE_SYNTHETIC_POLICIES: SyntheticPolicy[] = [
  {
    id: 'policy-pii-redaction',
    name: 'PII Redaction Required',
    severity: 'high',
    appliesTo: ['digital-steward', 'agent_claims_mobile_intake', 'fnol-session-service'],
  },
  {
    id: 'policy-high-value-hitl',
    name: 'High-value Claim Human Approval',
    severity: 'critical',
    appliesTo: ['agent_claims_mobile_intake', 'fnol-session-service'],
  },
  {
    id: 'policy-tool-timeout',
    name: 'Tool Timeout Guardrail',
    severity: 'medium',
    appliesTo: ['digital-steward', 'fnol-session-service'],
  },
  {
    id: 'policy-customer-vulnerability',
    name: 'Vulnerable Customer Escalation',
    severity: 'high',
    appliesTo: ['agent_claims_mobile_intake'],
  },
];

export const GOVERNANCE_SYNTHETIC_MODEL_PRICING: SyntheticModelPrice[] = [
  { modelId: 'gpt-5.4', inputPer1kUsd: 0.01, outputPer1kUsd: 0.03 },
  { modelId: 'gpt-4o-mini', inputPer1kUsd: 0.0015, outputPer1kUsd: 0.006 },
];

export const GOVERNANCE_SYNTHETIC_BUDGETS: SyntheticBudget[] = [
  { agentId: 'digital-steward', reportingPeriodDays: 30, maxSpendUsd: 60 },
  { agentId: 'agent_claims_mobile_intake', reportingPeriodDays: 30, maxSpendUsd: 80 },
  { agentId: 'fnol-session-service', reportingPeriodDays: 30, maxSpendUsd: 40 },
];

