# usecases/meridian-pnc-auto-claims/

Meridian P&C Auto Claims processing — the v0 proof point use case for the ADP platform.

This folder contains **only** the artifacts that vary per use case. The platform code under `../../platform/` consumes them via the EA package contract.

## Contents

```
meridian-pnc-auto-claims/
├── packages/
│   └── fnol-handler.json             FNOL Handler EA package (conforms to ../../platform/schemas/ea-package.v0.schema.json)
├── data/
│   ├── generate-claims.mjs           Seeded, deterministic synthetic claim generator
│   ├── claims-25.json                Readable seed corpus
│   └── claims-1k.json                Full v0 target corpus
├── skills/                           SKILL.md files referenced by the package (D3+)
└── (future) ontology/                P&C ontology subset used by FabricIQ adapter
```

## Scope (per [`../../SPEC.md`](../../SPEC.md))

**v0 covers:** FNOL Handler Digital Worker only — 4 agents (Claim Intake, Coverage Verify, Initial Triage, Assignment Routing), one happy path, one HITL gate on low-confidence triage.

**Out of v0:** Damage Assessment, Fraud Investigation, Settlement, Closure, customer contact centre, audit/monitoring, medical claims, legal escalations, real Duck Creek/Guidewire integration, multi-claim concurrency.

## Relationship to the platform

The platform doesn't know this folder exists. Anyone could add a sibling folder `usecases/<other-use-case>/` and the platform would run their packages just as faithfully. That is the test of whether the platform is actually a platform.

## Regenerating the synthetic corpus

```powershell
cd "C:\Users\AnandBhushan\Desktop\MS DT\Project ADP\adp-v1\usecases\meridian-pnc-auto-claims\data"
node generate-claims.mjs --count=25 --out=claims-25.json
node generate-claims.mjs --count=1000 --out=claims-1k.json
```

Seeded — same seed produces the same corpus across machines.
