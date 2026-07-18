# ADP — UC4 Live Demo Runbook

**Agentic Decision Platform · Meridian Mutual auto-claims · LIVE on Azure (DT sub `Project-IBMMSOFFERINGSPOC`, rg-adp-v1, eastus2).**
Lead with `usecases/meridian-pnc-auto-claims/CUSTOMER-BRIEF.md`.

## Live URLs
| Surface | URL |
|---|---|
| **Console (platform view)** | https://lemon-water-065e3e40f.7.azurestaticapps.net/?key=meridian-adp-2026 (shared-link gate; key is cosmetic demo hygiene, synthetic data only) |
| **Member portal (claims use-case view)** | same host, path `/member` (Meridian Mutual branding; simulated member sign-in) |
| **Borrower portal (lending use-case view)** | same host, path `/bank` (Northwind Bank branding; simulated customer sign-in; entirely separate identities BOR-*/LOAN-* and single-stage Origination Decision lifecycle) |
| **API (TEST)** | https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io |
| **Fabric workspace** | `adp-v1` (lakehouse `adp`: dim_policyholder / dim_vehicle / fact_claims 1000 claims + dim_borrower / fact_loan_applications) |

**Console surfaces (v2, deployed 2026-07-12):** Platform (use-case switcher + how it works) · Decision Queue (37+ decisions, lifecycle progress, new-intake tags) · Decision Mode (stage rail Intake->Damage->Fraud->Settlement, live SignalR trace, HITL gates, governed Action Preview, journey) · Outcomes (Carbon Charts KPI dashboard) · Lab (raw runs) · guided 7-beat narrator (play button) · dark/light themes · Member portal: sign in as a policyholder, see policy/vehicles/claims, report a claim (prefilled FNOL wizard, mobile-friendly), track each stage in claimant language.

## What's live (the stack)
Console (SWA) → **API on Azure Container Apps** `ca-tracesapi` (Durable Functions container) → **real GPT-4o** (`aif-adp-v1`) → grounding via **AI Search RAG** (`adp-knowledge`, 19 docs) **+ Fabric semantic layer** (`SEMANTIC_BACKEND=fabric`) → immutable trace + HITL + dashboard.

## Demo script (7 beats; the console's narrator mode walks these)
1. **Brief** — open the customer brief; set up Meridian Mutual + the leakage/compliance pain.
2. **See the platform** — open the **console URL** → Platform page; walk the use cases (claims LIVE + banking LIVE = use-case-agnostic platform).
   - **Optional cold open:** start in the **Member portal** (`/member`): sign in as a policyholder, file a claim from a phone-sized window, then switch to the operator console and watch it arrive in the queue tagged "new · web".
3. **Run a claim** (the hero) — open it in Decision Mode; the lifecycle rail shows Intake → Damage → Fraud → Settlement; run a stage and watch 4 agents stream live.
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
- AI Services `aif-adp-v1` (gpt-4o + text-embedding-3-large) · AI Search `srch-adp-v1` · Cosmos `cdb-adp-v1` · Event Hubs `evh-adp-v1` · ACR `acradpv1` · Container App `ca-tracesapi` (env `cae-adp-v1`) · SWA `swa-adp-v1-console` · SignalR `sigr-adp-v1` (Free_F1, Serverless; added 2026-07-10 for the live tail, wired to `ca-tracesapi` via secret `azure-signalr-connection` as env `AZURE_SIGNALR_CONNECTION`) · Fabric ws `adp-v1` on `offeringsfabric001`.
- **Note:** `func-adp-v1-fnol` (Bicep Functions app) is unused — replaced by `ca-tracesapi` on Container Apps because the sub lacks `roleAssignments/write` for MI-storage Functions. See memory `project_uc4_agentic_decision_platform`.

## Not in MVP (state honestly)
Estimatics / payments / subrogation are simulated; full settlement/recovery lifecycle beyond the current stages is roadmap. The platform is carrier-agnostic and reskinnable. (Note: multimodal evidence intake — damage photos + document upload with GPT-4o vision — has since shipped and is live; see `SPEC.md` for current status.)
