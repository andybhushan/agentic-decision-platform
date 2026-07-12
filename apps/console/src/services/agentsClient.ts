// GET /api/agents: the governance registry (packages joined with journal-observed behavior).
// Shape mirrors GetAgents.cs.

import { resolveApiBase } from "./config";

export interface SloView {
  metric: string;
  target: string;
  window: string;
}

export interface AgentStats {
  steps: number;
  avgConfidence: number;
  gatesFired: number;
}

export interface AgentGovernance {
  agentId: string;
  kind: string;
  capability: string;
  model: string;
  skillCount: number;
  ontologyBindings?: string[] | null;
  lowThreshold?: number | null;
  highThreshold?: number | null;
  stats?: AgentStats | null;
}

export interface WorkerStats {
  runs: number;
  steps: number;
  avgConfidence: number;
  gatesFired: number;
  operatorActions: number;
  lastActivityAt?: string | null;
}

export interface WorkerGovernance {
  packageId: string;
  version: string;
  industry: string;
  useCase: string;
  stage?: string | null;
  stageOrder?: number | null;
  workerId: string;
  workerName: string;
  entraAgentId?: string | null;
  capabilities: string[];
  slos: SloView[];
  agents: AgentGovernance[];
  stats?: WorkerStats | null;
}

export interface AgentsResponse {
  runtime: string;
  windowHours: number;
  workers: WorkerGovernance[];
}

export const RUNTIME_LABELS: Record<string, string> = {
  "agent-framework": "Microsoft Agent Framework",
  agentframework: "Microsoft Agent Framework",
  foundry: "Azure AI Foundry Agent Service",
  legacy: "Azure OpenAI (direct chat completions)",
  auto: "auto-selected",
};

export async function fetchAgents(window?: string): Promise<AgentsResponse> {
  const base = resolveApiBase();
  const url = window ? `${base}/agents?window=${encodeURIComponent(window)}` : `${base}/agents`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`fetchAgents: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as AgentsResponse;
}
