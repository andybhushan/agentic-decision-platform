import type { Trace } from "./types";
import demoTraceRaw from "./demo-trace.json";

// Trace fetch contract per ADR-0006. Order of precedence:
//   1. URL ?api=<absolute-url> overrides the default.
//   2. VITE_TRACES_API env var baked at build time.
//   3. /api proxy (works when console is behind the same SWA-linked Function).
//   4. Bundled demo-trace.json (last-resort dev fallback).
//
// The console never assumes the API is reachable; offline mode is always supported.

const DEFAULT_SUBJECT = "CLM-2026-10001";

export interface TraceFetchResult {
  trace: Trace;
  source: "live" | "demo";
  endpoint?: string;
  error?: string;
}

function readQuery(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function resolveApiBase(): string {
  const queryOverride = readQuery("api");
  if (queryOverride) return queryOverride.replace(/\/+$/, "");
  const envOverride = (import.meta.env.VITE_TRACES_API as string | undefined)?.trim();
  if (envOverride) return envOverride.replace(/\/+$/, "");
  return "/api";
}

export async function fetchTrace(subject?: string, traceId?: string): Promise<TraceFetchResult> {
  const demoTrace = demoTraceRaw as unknown as Trace;
  const subj = subject ?? readQuery("subject") ?? DEFAULT_SUBJECT;
  const traceFilter = traceId ?? readQuery("traceId") ?? null;
  const apiBase = resolveApiBase();
  const url = traceFilter
    ? `${apiBase}/traces/${encodeURIComponent(subj)}?traceId=${encodeURIComponent(traceFilter)}`
    : `${apiBase}/traces/${encodeURIComponent(subj)}`;

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
