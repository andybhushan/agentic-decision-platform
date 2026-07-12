// GET /api/journey/{subjectId}: every trace ever journaled for a subject, in time order.
// With the packages' declared stages this renders the end-to-end process. Shape mirrors GetJourney.cs.

import { resolveApiBase } from "./config";

export interface JourneyTrace {
  traceId: string;
  packageId?: string | null;
  startedAt?: string | null;
  lastActivityAt?: string | null;
  stepCount: number;
  openGates: number;
  groundedSteps: number;
  minConfidence: number;
  avgConfidence: number;
  operatorActions: number;
  status: "needs-review" | "failed" | "completed";
}

export interface JourneyResponse {
  subjectId: string;
  traces: JourneyTrace[];
}

// 404 (no runs yet) resolves to an empty journey rather than throwing.
export async function fetchJourney(subjectId: string): Promise<JourneyResponse> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/journey/${encodeURIComponent(subjectId)}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return { subjectId, traces: [] };
  if (!res.ok) throw new Error(`fetchJourney: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as JourneyResponse;
}
