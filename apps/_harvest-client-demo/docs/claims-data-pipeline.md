# Claims Demo Data — Production-Quality Seeding Pipeline

> **Goal:** one clean, repeatable way to (re)build the demo claim portfolio with
> production-quality, internally-consistent data and genuine agent telemetry.
> Only **Richard Hogan**'s customer + policy data is preserved across a reseed —
> he is the live FNOL demo subject.

---

## Why this exists

The original demo data was polluted by an older "suite run" force-completion
path that closed every claim while leaving the intake fields stale. The result
was nonsensical, uniform rows — e.g. a claim simultaneously `closed` / `100%
resolved` / `0 minutes in queue` / `$0 estimate` **and** "new claim requires
coverage verification".

The pipeline replaces that with a curated dataset where every field is
**consistent by construction**: stage ↔ pending decision ↔ blocker ↔ confidence ↔
queue age ↔ financial estimate ↔ resolution progress always agree.

---

## What it produces

**8 curated Auto claims**, each tied to a real seeded persona + policy (US,
USD), spread across the full lifecycle:

| Claim | Claimant (tier) | Stage | Decision | Priority | Estimate |
|-------|-----------------|-------|----------|----------|----------|
| AUTO-101 | Maya Thompson (standard) | closed | Settlement Approval | low | $4,820 |
| AUTO-102 | Carlos Ramirez (priority) | settlement | Settlement Approval | normal | $11,350 |
| AUTO-103 | Danielle Brooks (priority) | investigation | Anomaly Review | high | $18,400 |
| AUTO-104 | Renee Walker (standard) | evaluation | Coverage Verification | normal | $6,200 |
| AUTO-105 | Ethan Park (standard) | intake | Coverage Verification | normal | $9,750 |
| AUTO-106 | Carlos Ramirez (priority) | closed | Coverage Verification | low | $1,150 |
| AUTO-107 | Danielle Brooks (priority) | evaluation | Fraud Investigation | urgent | $0 (reserve held) |
| AUTO-108 | Maya Thompson (standard) | investigation | Policy Interpretation | high | $13,900 |

For **each** claim the pipeline emits an agent-interaction journey
(`agent_claims_intake` → `agent_claims_policy_verification` → optional
`agent_claims_fraud` → `digital-steward` → `agent_claims_settlement`), so the
Workforce / observability views show genuine telemetry (tokens, cost, duration,
confidence, escalations). Telemetry uses the **real deployed agents via Foundry**
when available, otherwise a realistic mock — controlled by a flag.

---

## How to run it

### One-off reseed (CLI)

```bash
cd backend
npm run seed:claims            # fast — mock agent telemetry (no Foundry calls)
npm run seed:claims -- --real  # drive deployed agents via Foundry where available
```

This wipes all demo claims + telemetry + non-Richard personas/policies, restores
the 6 US personas, rebuilds the 8 claims, and emits telemetry. It prints a
summary table of what changed.

### One-off reseed (admin API)

```bash
curl -X POST "http://localhost:3000/api/v1/claims/reseed"               # mock telemetry
curl -X POST "http://localhost:3000/api/v1/claims/reseed?useRealAgents=true"
```

### Automatic on startup (idempotent)

`backend/src/server.ts` calls `ensureClaimDemoData()` on boot. If the curated
claims are already present it does nothing; if the `claims` container is empty it
seeds them (with telemetry). It never wipes — use the reseed entry points for a
full reset.

---

## Where it lives

| File | Responsibility |
|------|----------------|
| `backend/src/services/claimsDemoSeeder.ts` | The pipeline: roster, curated specs, consistent `Claim` builder, telemetry, `reseedClaimDemoData()` + `ensureClaimDemoData()` |
| `backend/src/scripts/seedClaims.ts` | CLI entry point (`npm run seed:claims`) |
| `backend/src/routes/claimsRoutes.ts` | `POST /api/v1/claims/reseed` admin route |
| `backend/src/services/customerPersonaService.ts` | The 6 production US personas + policies (re-seeded by the pipeline) |
| `backend/src/services/adjusterDataService.ts` | Adjuster roster; legacy UK demo claims now gated behind `syncAdjusterDemoData({ seedDemoClaims: true })` and **off by default** |

### Adding or changing a claim

Edit the `CLAIM_SPECS` array in `claimsDemoSeeder.ts`. A spec is intentionally
compact — you set the scenario facts (stage, decision, fault, injury, estimate,
confidence, priority, queue age, etc.) and the builder derives every dependent
field (blocker, last action, narrative, evidence, anomalies, recommended action,
financial breakdown, audit trail, policy context) so the row can never become
internally contradictory. Tie each claim to a persona in `ROSTER` so its
`policyRef` resolves to a real policy.

---

## CI/CD — deploying updates

The demo data lives in **Azure Cosmos DB**, not in the container image, so a code
deploy does not by itself change the data. Process for shipping an update:

1. **Branch + edit** `CLAIM_SPECS` (or the builder) in
   `richardichogan/fix-revoke-button-and-timeout` (or a fresh feature branch).
2. **Typecheck:** `cd backend && npx tsc --noEmit` (and `cd frontend && npx tsc
   --noEmit` if you touched the frontend).
3. **Validate locally:** `npm run seed:claims`, then
   `GET http://localhost:3000/api/v1/claims` and confirm the rows are varied and
   consistent.
4. **Commit + PR + merge** to `master` (commits carry the `Co-authored-by:
   Copilot` trailer).
5. **Deploy the backend** (see `docs/deployment.md`). On boot,
   `ensureClaimDemoData()` seeds the curated set **only if the container is
   empty** — it will not overwrite existing data.
6. **Apply the new data to the running environment** when you want it live: hit
   the admin route against the deployed API:
   `POST https://<api-host>/api/v1/claims/reseed`. This is the explicit,
   auditable step that rebuilds the portfolio in the target environment.

> **Safety:** the reseed is destructive (it deletes existing demo claims +
> telemetry, preserving only Richard Hogan). Run it deliberately, never as an
> automatic post-deploy step.
