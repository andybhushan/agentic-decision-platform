# ADR-0012 — Work IQ: synthetic v0, Microsoft Graph v1

- **Status:** Accepted (v0 implemented)
- **Date:** 2026-05-27
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

ADR-0009 specced three Context Layer sources: Fabric IQ (entity ontology), Foundry IQ (procedural knowledge), Work IQ (collaboration signals). After D11 the first two are real (Fabric Lakehouse + Azure AI Search). Work IQ was the last `StubWorkIqSource` — returning empty for every query, so the L5 federation was lopsided.

The intended v1 Work IQ is **Microsoft Graph**: Teams messages mentioning a claim, Outlook threads with adjuster + supervisor, SharePoint files attached to the claim, calendar / presence signals for adjuster availability. All of that requires:

- An Azure AD app registration with `Chat.Read`, `Files.Read.All`, `Mail.Read`, `Calendars.Read` delegated permissions (or app-only equivalents).
- **Admin consent** on the target tenant — which the demo Meridian tenant doesn't actually have. Meridian is a notional persona, not a real customer with a Microsoft 365 tenant we can read.
- A way to map a claim subject ID to the Graph entities (mention search by keyword, file metadata convention, channel naming).

That's an integration story, not a v0 platform story.

## Options considered

### Option A — Real Microsoft Graph against the deployer's own tenant

- Pros: actually-real Graph data.
- Cons: the deployer's tenant has no claim-related collaboration; results are noise. Auth wiring is also non-trivial — delegated tokens need user interaction, app-only needs admin consent.

### Option B — Stay with `StubWorkIqSource` (empty)

- Pros: zero work.
- Cons: L5 federation visibly broken; trace citations never include `[WorkIQ]`; ADR-0009's three-source claim is half-fiction.

### Option C — Synthetic-but-deterministic Work IQ source (chosen)

- Pros: completes the L5 trio in code shape; agents reason over three sources today; same `IContextSource` contract a v1 Graph implementation will satisfy; deterministic (claim → SHA256 → same fragment every run, demos reproduce); no external dependencies, no admin consent, no app registration.
- Cons: the data is *plausible*, not *real*. Operators looking at a trace see "Teams thread 'triage-support'..." citations that didn't actually come from Teams. Acceptable provided we're honest about the source identity (the fragments contain plausible-but-synthetic supervisor names and ADJ-NNNN identifiers; nothing claims to be from a real tenant).

### Option D — Read from a hand-crafted JSON corpus

- Pros: easier to audit; deterministic.
- Cons: 1000 claims means 5000 fragments (5 intents × 1K claims) to author; maintenance burden; not meaningfully better than programmatic generation for demo purposes.

## Decision

**Option C** — synthetic, deterministic Work IQ source. Per-claim seed comes from `SHA256(subjectId)[0..4]`; the seed picks supervisor names, message counts, photo counts, adjuster availability, shop relationship history from canned template pools. Same claim returns identical fragments across runs.

The fragment shape, dimensions, and SourceId match what a future `MicrosoftGraphWorkIqSource` will return — that's the migration contract.

## Intent → fragment mapping

| Intent | Fragment | DocId pattern |
|---|---|---|
| `triage_decision` | Teams thread `triage-support` — supervisor consultation, optional SIU concern (~25% of claims) | `TEAMS_THREAD/{claim}/triage-support` |
| `assign_adjuster` | Candidate adjuster availability — Teams presence + calendar status + declines this week | `CALENDAR_SIGNAL/ADJ-{n}/availability` |
| `assess_damage` | SharePoint photo-share thread — photo count, acknowledgement, network coordination | `SHAREPOINT_THREAD/{claim}/damage-photos` |
| `estimate_repair` | Shop liaison collaboration history — prior jobs, cycle time, complaint count (PAC-SHOP-001 hard-exclusion fires at >3 complaints) | `SHAREPOINT_FILE/shop-history/{claim}` |
| `route_shop` | Shop network availability signal — earliest in-network appointment, supervisor preference note | `TEAMS_THREAD/{claim}/shop-routing` |
| `verify_coverage` | (none — no Work IQ signal at coverage-verification time) | — |

Fragments declare `[Collaboration, Temporal]` dimensions. `Origin: GROUNDED` because they're deterministic and reproducible from the claim ID.

## Migration plan (v1 — Microsoft Graph)

1. Register an Azure AD app with `Chat.Read.All`, `Mail.Read`, `Files.Read.All`, `Calendars.Read.All` application permissions; grant admin consent on the target tenant.
2. Implement `MicrosoftGraphWorkIqSource : IContextSource` using the Microsoft Graph SDK (`Microsoft.Graph` NuGet) with token acquisition via `DefaultAzureCredential` against scope `https://graph.microsoft.com/.default`.
3. Map intents to Graph queries:
   - `triage_decision` → `/teams/{id}/channels/triage-support/messages` filtered by claim mention.
   - `assign_adjuster` → `/users/{adjusterUpn}/presence` + `/users/{adjusterUpn}/calendarView`.
   - `assess_damage` → `/sites/{siteId}/drive/root:/Claims/{claim}/Photos:/children`.
   - `estimate_repair` / `route_shop` → search across the shop-liaison SharePoint site + Teams `shop-routing` channel.
4. Swap `WorkIqSource` for `MicrosoftGraphWorkIqSource` in `TracesApi/Program.cs` DI and `PackageCompiler/Program.cs`. One-line change per call site.

Same pattern as ADR-0011's SQL → Fabric migration: the `IContextSource` interface is the API; the storage / API backend behind it is a v0 → v1 implementation detail.

## Validation (D-Work-IQ, 2026-05-27)

- ✅ Local smoke (`dotnet run` direct construction): all 5 dispatchable intents return non-empty fragments; `verify_coverage` correctly returns empty; same claim ID returns identical fragments across runs.
- ✅ Cloud end-to-end: trace `trc-19e69966fcd` on `CLM-2026-10010` cites `TEAMS_THREAD/CLM-2026-10010/shop-routing` at the repair-estimation step alongside `POLICYHOLDER_HISTORY/PH-389197` (Fabric) and `PAC-SHOP-001` (Foundry). All three L5 sources contributed to one decision.
- ✅ Boundary: `WorkIqSource` lives in `platform/src/ContextLayer/`, has no `usecases/` references. CI boundary check passes.

## Trade-offs accepted

- **Data is plausible, not real.** Supervisor names and adjuster IDs in fragments are template-derived from a hash, not pulled from anyone's actual tenant. The `SourceId="WorkIQ"` is honest — the API contract says "this is Work IQ" — but operators reading a demo trace should know the fragments are synthetic. Mitigated by ADR-0012 (this file) being part of the runbook.
- **No Graph throttling / pagination / token-refresh code in v0.** That belongs in v1 — `MicrosoftGraphWorkIqSource` will need it, this synthetic source doesn't.
- **No user-level personalization.** Real Work IQ would filter messages by "what this *operator* can see"; the synthetic source returns the same fragments regardless of caller identity. Fine for v0 demo; v1 will inherit the calling user's Graph permissions naturally.
