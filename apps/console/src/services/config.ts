// Single source of truth for resolving the ADP traces API base URL.
// Order of precedence (per ADR-0006):
//   1. URL ?api=<absolute-url> override (demo-time redirection).
//   2. VITE_TRACES_API env var baked at build time.
//   3. /api proxy (when the console sits behind an SWA-linked backend).

const DEFAULT_API_BASE = "/api";

export function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("api");
    if (q) return q.replace(/\/+$/, "");
  }
  const env = (import.meta.env.VITE_TRACES_API as string | undefined)?.trim();
  if (env) return env.replace(/\/+$/, "");
  return DEFAULT_API_BASE;
}
