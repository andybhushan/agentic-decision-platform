# ADP — UC4 Live Demo Runbook

**Agentic Decision Platform · Meridian Mutual auto-claims · LIVE on Azure (DT sub `Project-IBMMSOFFERINGSPOC`, rg-adp-v1, eastus2).**
Lead with `usecases/meridian-pnc-auto-claims/CUSTOMER-BRIEF.md`.

## Live URLs
| Surface | URL |
|---|---|
| **Console (SEE)** | https://lemon-water-065e3e40f.7.azurestaticapps.net |
| **API (TEST)** | https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io |
| **Fabric workspace** | `adp-v1` (lakehouse `adp`: dim_policyholder / dim_vehicle / fact_claims, 1000 claims) |

## What's live (the stack)
Console (SWA) → **API on Azure Container Apps** `ca-tracesapi` (Durable Functions container) → **real GPT-4o** (`aif-adp-v1`) → grounding via **AI Search RAG** (`adp-knowledge`, 19 docs) **+ Fabric semantic layer** (`SEMANTIC_BACKEND=fabric`) → immutable trace + HITL + dashboard.

## Demo script (7 beats)
1. **Brief** — open the customer brief; set up Meridian Mutual + the leakage/compliance pain.
2. **See the platform** — open the **console URL**; walk the architecture / use-cases (claims + banking = use-case-agnostic platform).
3. **Run a claim** (the hero) — start a run (browser, or `POST /api/runs`); watch 4 agents process FNOL→coverage→triage→routing in seconds.
4. **Grounding** — show each step **GROUNDED** with citations (PAC-* knowledge) — not hallucinated.
5. **HITL gate** — show a claim where coverage confidence drops below threshold → **gate fires automatically**, routes to a human with full rationale. *"The AI knew what it didn't know."*
6. **Dashboard** — `/api/aggregate/outcomes`: claims handled, grounded-step rate, avg confidence, steps needing review — the COO's KPI view.
7. **Governance close** — immutable decision journal + explainability + HITL = the NAIC-ready story that lets it ship.

## Direct API calls (for testing)
```bash
BASE=https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io
curl $BASE/api/health
curl -X POST $BASE/api/runs -H "Content-Type: application/json" -d '{"subjectId":"CLM-2026-10005","useCase":"meridian-pnc-auto-claims"}'
curl $BASE/api/runs/<runId>/status
curl $BASE/api/traces/CLM-2026-10005
curl $BASE/api/aggregate/outcomes
```

## Run it locally (no Azure)
```
dotnet build platform/src/AdpV1.slnx            # (.NET 10 SDK)
cd <repo root>
dotnet platform/src/PackageCompiler/bin/Debug/net10.0/adpc.dll compile --in usecases/meridian-pnc-auto-claims/packages/fnol-handler.json --out build/fnol.zip
dotnet ...adpc.dll execute --artifact build/fnol.zip --claim usecases/meridian-pnc-auto-claims/data/claims-25.json --subject CLM-2026-10000 --adapter stub --tools --demo-hitl-on agent.coverage-verify
```

## Resources (rg-adp-v1, DT sub)
- AI Services `aif-adp-v1` (gpt-4o + text-embedding-3-large) · AI Search `srch-adp-v1` · Cosmos `cdb-adp-v1` · Event Hubs `evh-adp-v1` · ACR `acradpv1` · Container App `ca-tracesapi` (env `cae-adp-v1`) · SWA `swa-adp-v1-console` · Fabric ws `adp-v1` on `offeringsfabric001`.
- **Note:** `func-adp-v1-fnol` (Bicep Functions app) is unused — replaced by `ca-tracesapi` on Container Apps because the sub lacks `roleAssignments/write` for MI-storage Functions. See memory `project_uc4_agentic_decision_platform`.

## Not in MVP (state honestly)
Estimatics / payments / subrogation are simulated; full settlement/recovery lifecycle + the multimodal evidence/consent layer (built in the IMAGINE WS2 track) are roadmap. The platform is carrier-agnostic and reskinnable.
