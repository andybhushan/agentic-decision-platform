// GET /api/decisions: the decision-queue read-side. Every subject the bundled packages can
// decide on, joined with the latest trace state per subject. Shape mirrors GetDecisions.cs.

import { resolveApiBase } from "./config";

export interface PackageSummary {
  packageId: string;
  version: string;
  industry: string;
  useCase: string;
  workerName: string;
  agentCount: number;
  subjectCount: number;
  // Lifecycle declaration (optional): the use case names the stage this worker decides.
  stage?: string | null;
  stageOrder?: number | null;
}

export interface TraceSummary {
  traceId: string;
  packageId?: string | null;
  startedAt?: string | null;
  lastActivityAt?: string | null;
  stepCount: number;
  minConfidence: number;
  avgConfidence: number;
  openGates: number;
  groundedSteps: number;
  status: "needs-review" | "failed" | "completed";
}

export interface DecisionItem {
  subjectId: string;
  packageId: string;
  packageIds: string[];
  industry?: string | null;
  useCase?: string | null;
  latestTrace?: TraceSummary | null;
  // Every worker that has ever decided this subject (lifecycle progress).
  packagesRun: string[];
  // Present when the subject entered through runtime intake rather than the corpus.
  receivedAt?: string | null;
  channel?: string | null;
}

// The use case's declared lifecycle: its stage-bearing packages in order.
export function lifecycleStages(packages: PackageSummary[], useCase?: string | null): PackageSummary[] {
  return packages
    .filter((p) => p.useCase === useCase && p.stage && p.stageOrder != null)
    .sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0));
}

export interface DecisionsResponse {
  packages: PackageSummary[];
  decisions: DecisionItem[];
}

export async function fetchDecisions(window?: string): Promise<DecisionsResponse> {
  const base = resolveApiBase();
  const url = window ? `${base}/decisions?window=${encodeURIComponent(window)}` : `${base}/decisions`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`fetchDecisions: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as DecisionsResponse;
}

// The sensible default worker for a decision: the one that produced its latest trace,
// else the worker most recently used anywhere on the same use case (the journal teaches
// the console; nothing is hardcoded), else the first capable package.
export function defaultPackageId(decision: DecisionItem, all: DecisionItem[]): string {
  if (decision.latestTrace?.packageId && decision.packageIds.includes(decision.latestTrace.packageId)) {
    return decision.latestTrace.packageId;
  }
  const sameUseCase = all
    .filter((d) => d.useCase === decision.useCase && d.latestTrace?.packageId)
    .sort((a, b) => (b.latestTrace?.lastActivityAt ?? "").localeCompare(a.latestTrace?.lastActivityAt ?? ""));
  for (const d of sameUseCase) {
    const pid = d.latestTrace?.packageId;
    if (pid && decision.packageIds.includes(pid)) return pid;
  }
  return decision.packageIds[0] ?? decision.packageId;
}
