// Start + poll a Durable orchestration run for a subject.
// Pairs with traceClient.ts: once a run completes, the console refetches the trace via fetchTrace.
// Contract verified against TracesApi RunFnol.cs: body is { subjectId, packageId, forceHitlAtAgentId? }.

import { resolveApiBase } from "./config";

export interface RunStarted {
  runId: string;
  subjectId: string;
  packageId: string;
  statusUrl: string;
  traceUrl: string;
}

export type RunStatusKind =
  | "Pending"
  | "Running"
  | "Completed"
  | "Failed"
  | "Terminated"
  | "Canceled"
  | "Suspended"
  | "Unknown";

export interface RunResult {
  traceId: string;
  subjectId: string;
  stepCount: number;
  hitlGatesOpen: number;
  completedAt: string;
}

export interface RunStatus {
  runId: string;
  status: RunStatusKind;
  createdAt?: string;
  lastUpdatedAt?: string;
  result?: RunResult;
  traceUrl?: string;
}

export async function startRun(
  subjectId: string,
  packageId: string = "fnol-handler",
  forceHitlAtAgentId?: string,
): Promise<RunStarted> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ subjectId, packageId, forceHitlAtAgentId }),
  });
  if (!res.ok) throw new Error(`startRun: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as RunStarted;
}

export async function getRunStatus(runId: string): Promise<RunStatus> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/runs/${encodeURIComponent(runId)}/status`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`getRunStatus: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as RunStatus;
}

export async function resolveHitl(runId: string, optionId: string, overrideOutput?: string): Promise<void> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/runs/${encodeURIComponent(runId)}/resolve-hitl`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ optionId, overrideOutput }),
  });
  if (!res.ok) throw new Error(`resolveHitl: HTTP ${res.status} ${res.statusText}`);
}

export async function pollUntilTerminal(
  runId: string,
  onUpdate: (s: RunStatus) => void,
  options: { intervalMs?: number; timeoutMs?: number; shouldStop?: () => boolean } = {},
): Promise<RunStatus> {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 600_000;
  const deadline = Date.now() + timeoutMs;
  let last: RunStatus | null = null;

  while (Date.now() < deadline) {
    if (options.shouldStop?.()) break;
    const s = await getRunStatus(runId);
    onUpdate(s);
    last = s;
    if (s.status === "Completed" || s.status === "Failed" || s.status === "Terminated" || s.status === "Canceled") {
      return s;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last ?? { runId, status: "Unknown" };
}
