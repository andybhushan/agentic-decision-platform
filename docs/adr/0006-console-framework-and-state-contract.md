# ADR-0006 — Console framework and state contract

- **Status:** Accepted (v0)
- **Date:** 2026-05-26
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

The operator console is the only L2 experience surface in v0 (Teams cards and M365 pages are deferred). Two sub-decisions here:

1. **Framework** — what does the console run on?
2. **State contract** — what does the console read, and from where?

The console must remain use-case-agnostic per [ADR-0001](0001-platform-usecase-boundary.md). Whatever trace the orchestrator emits, the console renders.

## Options considered — framework

### Option A — Vite + React + Fluent UI v9

- Pros: matches `adp-portal/` v2 pattern (per [[project_adp_portal_v2_2026_05_23]]); Microsoft Azure-blue brand already locked; Fluent v9 is Microsoft's official design system; React 19 + Vite is the fastest dev loop for SPA work; bundle size acceptable (404 KB → 120 KB gzipped, measured).
- Cons: SPA pattern means no SSR / SEO — irrelevant for an internal operator console; Fluent v9 has rougher edges than Fluent v8 in some peripheral controls.

### Option B — Next.js + Fluent UI v9

- Pros: SSR; better long-term shape for multi-tenant deployments.
- Cons: SSR adds cold-start latency for what is fundamentally an SPA; Next.js + Fluent v9 has known SSR hydration warnings; platform Azure hosting picks become more constrained.

### Option C — Razor Pages / Blazor + Fluent UI Blazor

- Pros: stays inside the .NET ecosystem with Aspire; one runtime; .NET 10's improved Blazor story.
- Cons: Blazor's bundle weight is higher than React+Vite; Microsoft's own Foundry and Agent 365 tooling is shipping React UIs, so reference patterns favour React; ecosystem of trace-visualization libraries is React-tilted.

### Option D — Carbon Design System (IBM)

- Pros: IBM's design language; matches the `mvp-demo` repo Richard built.
- Cons: clashes with Miha's "Microsoft-first" tooling stance; brand-incoherent with the rest of ADP portal v2.

## Options considered — state contract

### Option α — REST endpoint per trace

`GET /api/traces/:id` returns the full Trace JSON. Console polls or refreshes on focus.

- Pros: simplest; cacheable; replayable; testable with curl.
- Cons: not live — must poll for updates.

### Option β — SignalR / WebSocket stream

Console subscribes to a SignalR hub backed by Event Grid; new decision events push to the UI in real time.

- Pros: live; matches the operator console's actual job (watching decisions land).
- Cons: more infra (SignalR Service or self-hosted hub); WebSocket auth requires care; harder to test deterministically.

### Option γ — Hybrid: REST for initial load + SignalR for live tail

- Pros: best of both; standard pattern; matches how Azure Portal blades work.
- Cons: two protocols to maintain.

### Option δ — Polling REST

Console fetches the same endpoint every N seconds.

- Pros: trivially simple; no extra infra.
- Cons: latency = polling interval; wasted requests when nothing is happening; not the right tool for a live decision stream.

## Decision

**Framework: Option A** — Vite + React 19 + Fluent UI v9. Already built and verified ([platform/console/](../../platform/console/)).

**State contract: Option γ** — REST for initial load, SignalR for live tail. Phased:

- **v0 (now):** Static `demo-trace.json` import. No backend. Lets the console UX be iterated independently of orchestrator availability.
- **D7–D8:** REST endpoint `GET /api/traces/:id` backed by Cosmos read. Console fetches on mount; refresh button does the same. No live tail yet.
- **D9 (stretch):** SignalR hub subscribed to Event Grid `egt-adp-v1-decisions`. Console replaces the refresh button with live subscription.

The console's type contract is [`platform/console/src/types.ts`](../../platform/console/src/types.ts). Whatever transports a `Trace` (file, REST, SignalR) maps to this type. The component never sees the transport.

## Consequences

- Console is React + Fluent v9. Locked.
- The `Trace` type in `types.ts` is the cross-cutting contract — anything that emits one (orchestrator → Cosmos → REST, Event Grid → SignalR) must serialise to this shape.
- v0 demo fixture is the only non-real source; clearly marked, scheduled for removal on D8.
- SignalR Service deferred to D9 stretch; v0 RG provision in Bicep skips it.
- The boundary rule (ADR-0001) means SignalR client code in the console reads `Trace` generically — no insurance vocabulary in the subscriber either.

## Trade-offs accepted

- No SSR. Acceptable for an internal operator console gated behind Entra.
- Polling-free live tail requires SignalR in v0.9+; for v0 we accept "refresh button" UX.
- One JSON file (`demo-trace.json`) inside `platform/` is use-case-shaped. Acceptable because (1) it is data not code, (2) the file is explicitly marked, (3) it goes away on D8.

## Validation

- Console build: ~120 KB gzipped, sub-6-second cold build. Verified.
- Refresh of the demo trace (changing the JSON file and reloading) renders correctly without code changes — the component is data-driven.
- After D8, replacing the JSON import with a `fetch('/api/traces/:id')` does not require touching the rendering logic.
