// Platform-level types. No domain vocabulary allowed.
// "Trace" is what the platform emits for any EA package execution — claims, fraud, loan origination, anything.
// Domain meaning lives in the EA package, not here.

export type Origin = "GROUNDED" | "DERIVED";
export type StepStatus = "completed" | "needs-human-review" | "running" | "failed";

export interface ToolCall {
  toolId: string;
  arguments: string;
  result: string;
  durationMs: number;
  success: boolean;
}

export interface CitedSource {
  sourceId: string;
  docId: string;
  title: string;
  score: number;
}

export interface TraceStep {
  stepId: string;
  agentId: string;
  label: string;
  confidence: number;
  status: StepStatus;
  origin: Origin;
  output: string;
  durationMs: number;
  hitlGateId?: string;
  toolCalls?: ToolCall[];
  citedSources?: CitedSource[];
  ontologyBindings?: string[];
  regulatoryBasis?: string[];
}

export interface HitlOption {
  optionId: string;
  label: string;
  appearance?: "primary" | "secondary";
  overrideOutput: string;
}

export interface PackageRef {
  id: string;
  version: string;
  schemaVersion: string;
  agentCount: number;
  skillCount: number;
  toolCount: number;
}

export interface SloDecl {
  metric: string;
  target: string;
  window: string;
}

export interface Trace {
  traceId: string;
  subject: string;
  package: PackageRef;
  steps: TraceStep[];
  hitlOptions: HitlOption[];
  slos: SloDecl[];
  startedAt: string;
}
