// GET /api/aggregate/outcomes: the platform KPI aggregate over a rolling window.
// Shape verified against the live ca-tracesapi response on 2026-07-10.

import { resolveApiBase } from "./config";

export interface AggregateOutcomes {
  windowHours: number;
  claimsHandled: number;
  tracesRecorded: number;
  stepsTotal: number;
  stepsCompleted: number;
  stepsNeedingHumanReview: number;
  groundedStepRate: number;
  avgConfidence: number;
  avgStepDurationMs: number;
  runsByPackage: Record<string, number>;
}

export async function fetchOutcomes(window?: string, packages?: string[]): Promise<AggregateOutcomes> {
  const base = resolveApiBase();
  const q = new URLSearchParams();
  if (window) q.set("window", window);
  if (packages?.length) q.set("packages", packages.join(","));
  const qs = q.toString();
  const res = await fetch(`${base}/aggregate/outcomes${qs ? `?${qs}` : ""}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`fetchOutcomes: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as AggregateOutcomes;
}

// GET /api/aggregate/timeline: gap-filled bucketed telemetry for the dashboard charts.
// Shape mirrors GetAggregateTimeline.cs.

export interface TimelineBucket {
  start: string;
  traces: number;
  steps: number;
  groundedSteps: number;
  needsReview: number;
  avgConfidence: number;
  tracesByPackage: Record<string, number>;
}

export interface TimelineResponse {
  windowHours: number;
  bucketHours: number;
  buckets: TimelineBucket[];
}

// GET /api/aggregate/cycletime: per-worker decision latency percentiles. Mirrors GetCycleTime.cs.

export interface CycleTimeEntry {
  packageId: string;
  runs: number;
  p50Ms: number;
  p90Ms: number;
  avgMs: number;
  maxMs: number;
}

export interface CycleTimeResponse {
  windowHours: number;
  packages: CycleTimeEntry[];
}

export async function fetchCycleTime(window: string, packages?: string[]): Promise<CycleTimeResponse> {
  const base = resolveApiBase();
  const q = new URLSearchParams({ window });
  if (packages?.length) q.set("packages", packages.join(","));
  const res = await fetch(`${base}/aggregate/cycletime?${q}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`fetchCycleTime: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as CycleTimeResponse;
}

export async function fetchTimeline(window: string, bucket?: string, packages?: string[]): Promise<TimelineResponse> {
  const base = resolveApiBase();
  const q = new URLSearchParams({ window });
  if (bucket) q.set("bucket", bucket);
  if (packages?.length) q.set("packages", packages.join(","));
  const res = await fetch(`${base}/aggregate/timeline?${q}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`fetchTimeline: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as TimelineResponse;
}
