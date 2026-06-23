# adp-v1

Anand-track local proving ground for Project ADP. Built to test the platform thesis in code, parallel to the IBM-Project-Adp team.

**Local-only.** Not pushed to `github.com/IBM-Project-Adp`. Per memory rules: see `feedback_adp_no_github_pushes` and `feedback_adp_folder_canonical`.

## Read this first

- [SPEC.md](SPEC.md) — one-page thesis, scope, pinned stack, success criteria, honest stub list.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — three views: platform, Meridian use case, integration.
- [docs/adr/](docs/adr/) — architecture decision records (one per substantive choice).

## Layout

```
adp-v1/
├── SPEC.md
├── README.md
├── platform/                              # use-case agnostic — the engine
│   ├── README.md
│   ├── schemas/ea-package.v0.schema.json  # the contract
│   ├── console/                           # generic trace renderer (Vite + Fluent UI v9)
│   └── (D3+) src/, infra/                 # Aspire host, compiler, orchestrator, agents, Bicep
├── usecases/
│   └── meridian-pnc-auto-claims/             # use-case specific — never imported from platform/
│       ├── README.md
│       ├── packages/fnol-handler.json     # the EA package
│       ├── data/                          # synthetic claim corpus + generator
│       └── (D3+) skills/, ontology/
├── scripts/
│   └── check-boundary.mjs                 # CI rule: platform/ must not import usecases/
└── docs/
    ├── ARCHITECTURE.md
    └── adr/
        ├── 0001-platform-usecase-boundary.md
        ├── 0002-ea-package-format.md            (agent package format)
        ├── 0003-compile-pipeline-shape.md
        ├── 0004-state-decision-bus-trace-stores.md
        ├── 0005-bicep-vs-terraform.md
        ├── 0006-console-framework-and-state-contract.md
        ├── 0007-agent-runtime-stack.md
        ├── 0008-identity-governance-security.md
        ├── 0009-context-layer.md
        └── 0010-compute-and-edge-hosting.md
```

## Source materials (this folder's reading list)

- `../Adp_Platform_DesignSpec.pdf` — Satish's IBM IQ spec (DSL, Digital Worker, Context Fabric, EA-layer mapping).
- `../KickoffNotes_2026-05-13.md` — Miha's operating direction (ICA replacement, MS-native, Aspire, no vibe-coding).
- `../repos/architecture/` — Chad's 7-layer reference architecture, ADRs 001–005, P&C Auto ontology v2.4.0.
- `../repos/mvp-demo/` — Richard's high-fidelity claims wireframe (React + Carbon).
- `../../Data Transformation/ICA_2.0_Deep_Analysis.md` — ICA 2.0 4-pillar shape we mirror MS-native.
- `../adp-portal/api/data/PROJECT-ADP.md` — portal master doc (workstreams, 31-spec catalogue).
- `../../DEPLOYMENT_REFERENCE.md` — Anand's deployment patterns (SWA, Databricks, Fabric, gpt-4o reuse).

## Running the console (D1–D2 demo)

```powershell
cd "C:\Users\AnandBhushan\Desktop\MS DT\Project ADP\adp-v1\platform\console"
npm install
npm run dev    # http://localhost:5174
```

The console renders a generic Trace. Demo data is at `platform/console/src/demo-trace.json` (use-case-shaped but the component knows nothing about insurance — see [platform/README.md](platform/README.md) invariants).

## Boundary check

```powershell
cd "C:\Users\AnandBhushan\Desktop\MS DT\Project ADP\adp-v1"
node scripts/check-boundary.mjs
```

Run before any commit that touches `platform/`. CI will run it on PRs once the GitHub workflow lands (D5+).

## Stack (pinned by ADR-001 through ADR-006)

- Runtime: .NET 10 + Microsoft Aspire
- Agents: Microsoft Agent Framework + Foundry Agent Service
- Orchestration: Azure Durable Functions
- Context: FabricIQ + FoundryIQ + Cosmos DB + Event Grid
- Data: Fabric Bronze/Silver/Gold
- LLM: Azure OpenAI gpt-4o (reuse `dt-navigator-openai`)
- IaC: Bicep
- Console: Vite + React + Fluent UI v9

See ADRs for the *why* of each.

## Next steps (per SPEC.md cadence)

- **D3–D5:** .NET Aspire scaffolding, Claim Intake + Coverage Verify agents on Foundry, first Durable Function orchestration.
- **Prerequisite:** `winget install Microsoft.DotNet.SDK.10` + `dotnet workload install aspire` + `az bicep install`.
