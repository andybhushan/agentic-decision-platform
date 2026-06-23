# Synthetic-data generator (issue #68)

A standalone, **deterministic** generator for synthetic personal-auto claims that produces the
**18 gold tables** of the agentic-claims-alpha data product and loads them into Fabric **gold**
(gold-first). No real PII. Anyone can clone, configure, and run it.

> **Scope:** reference / capability proof on the sandbox. This is the **gold-first** loader (CSV ->
> OneLake -> Delta). The *through-the-foundation* path (Service Bus -> event-store -> Cosmos ->
> `foundation_to_gold` + RefreshGraph) is driven by the **operator console** (`ca-operator-console`)
> and the foundation->gold pipeline; see RUNBOOK.md step 6.

## What it generates
All 18 gold tables (`claim`, `policy`, `policy_term`, `coverage`, `vehicle`, `exposure`,
`loss_event`, `vehicle_damage`, `damage_part`, `total_loss_evaluation`, `fraud_indicator`,
`payment`, `adjuster`, `claimant`, `party_person`, `loss_location`, `loss_event_vehicle`,
`loss_event_party`). The **anchor claim `CA-2026-0000123`** (Maya Alvarez, adjuster Derek Chen) is
always present and pinned to **total-loss probability 0.71** so gate **G3** fires.

## Prerequisites
- **Node.js >= 18** (uses built-in `fetch`; no npm dependencies).
- For loading only: **Azure CLI** (`az login`) with access to `sub-ibmc-projAdp-dev`, OR set
  `FAB_TOKEN` + `STG_TOKEN` yourself.

## Quick start
```bash
node generate.mjs                 # writes ./data/*.csv (defaults: 100 claims)
az login                          # once, for the loader
node load.mjs                     # uploads to OneLake + loads each gold Delta table
```
Or `npm run all` (generate + load).

## Parameters (generate.mjs — all optional, deterministic per --seed)
| Flag | Default | Meaning |
|---|---|---|
| `--count <n>` | `100` | number of claims; supporting tables scale with it |
| `--total-loss-pct <f>` | `0.16` | fraction of non-anchor claims that cross the 0.70 gate |
| `--fraud-pct <f>` | `0.10` | fraction of non-anchor claims flagged for fraud (score > 0.30) |
| `--seed <int>` | `1835365732` | PRNG seed — same seed => byte-identical output |
| `--out <dir>` | `./data` | output directory |

```bash
node generate.mjs --count 250 --total-loss-pct 0.20 --fraud-pct 0.12 --seed 42
```

## Configuration (load.mjs — env, defaults target auto-claims-dev)
| Env | Default | Meaning |
|---|---|---|
| `WORKSPACE_ID` | `26e07f51-…` | Fabric workspace id |
| `LAKEHOUSE_ID` | `4bee2408-…` | gold lakehouse id |
| `SUBSCRIPTION` | `e3dfdb01-…` | Azure sub for `az` token acquisition |
| `DATA_DIR` | `./data` | CSV directory |
| `FAB_TOKEN` / `STG_TOKEN` | (auto via `az`) | bring your own tokens to skip `az` |

## Optional post-load
- `node build_semantic.mjs` — (re)build the Direct Lake semantic model bindings.
- `node build_ontology.mjs` — (re)build the Fabric IQ ontology bindings.
- RefreshGraph so new claims surface in the ontology graph (RUNBOOK.md step 5).

See **RUNBOOK.md** for the full step-by-step.
