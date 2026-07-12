// GET /api/health: liveness of the ADP traces API.

import { resolveApiBase } from "./config";

export interface HealthStatus {
  status: string;
  service: string;
  timestamp: string;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/health`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`fetchHealth: HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as HealthStatus;
}
