import type { Trace } from "./types";
import { resolveApiBase } from "./config";
import demoTraceRaw from "./demo-trace.json";

// Trace fetch contract per ADR-0006. The console never assumes the API is reachable;
// the bundled demo trace is the last-resort offline fallback and the result says which one you got.

export interface TraceFetchResult {
  trace: Trace;
  source: "live" | "demo";
  endpoint?: string;
  error?: string;
}

export async function fetchTrace(subject: string, traceId?: string): Promise<TraceFetchResult> {
  const demoTrace = demoTraceRaw as unknown as Trace;
  const apiBase = resolveApiBase();
  const url = traceId
    ? `${apiBase}/traces/${encodeURIComponent(subject)}?traceId=${encodeURIComponent(traceId)}`
    : `${apiBase}/traces/${encodeURIComponent(subject)}`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return {
        trace: demoTrace,
        source: "demo",
        endpoint: url,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }
    const live = (await res.json()) as Trace;
    return { trace: live, source: "live", endpoint: url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { trace: demoTrace, source: "demo", endpoint: url, error: msg };
  }
}
