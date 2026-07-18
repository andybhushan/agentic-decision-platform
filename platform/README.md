# platform/

The ADP platform engine. **Use-case agnostic.** Compiles and executes any signed agent package that conforms to [`schemas/agent-package.v1.schema.json`](schemas/agent-package.v1.schema.json).

## Invariants

1. **`platform/` may not import from `usecases/`.** Enforced by [`scripts/check-boundary.mjs`](../scripts/check-boundary.mjs). Run before any commit that touches `platform/`.
2. **No domain vocabulary in the engine itself.** The orchestration, adapters, context router, and tool runtime don't hardcode `claim`, `insurance`, `FNOL`, `Meridian`, etc. — a package supplies its own labels, agents, skills, and tools; the engine just executes what it declares.
3. The console (`apps/console/`) lives outside `platform/` — it's the shared experience layer for both the operator view and the two branded end-user portals (member/borrower), and reads live from the API, not from fixtures.

## Contents (current, live)

```
platform/
├── schemas/
│   └── agent-package.v1.schema.json   the package contract
└── src/
    ├── TracesApi/          .NET 10 isolated Azure Functions + Durable Functions — the whole backend API
    │   └── Functions/      one file per REST endpoint
    ├── Agents/              IAgentAdapter + PromptContract (the shared contract) and the 3 backend
    │                        implementations (AgentFrameworkAdapter, FoundryAdapter, LegacyOpenAIAdapter)
    │                        + AdapterRegistry / AgentAdapterFactory (the runtime switch)
    ├── ContextLayer/        ContextRouter (the IQ federation fan-out) + one IContextSource per source:
    │                        AzureSearchFoundryIQSource, FabricLakehouseSource, FabricDataAgentSource,
    │                        WorkIqSource / MicrosoftGraphWorkIqSource — plus EvidenceStore/EvidenceVision
    │                        (GPT-4o vision at intake)
    ├── Orchestration/        PlanExecutor, StepRunner, HitlGateEvaluator, Trace — the step-execution
    │                        loop and the confidence-gate logic
    ├── DecisionIngest/       journal read/write, runtime intake store
    ├── PackageModel/         AgentPackage + serializer
    ├── PackageCompiler/      `adpc` — validates, plans, and signs a package into a deployable artifact
    └── ToolRuntime/          IMcpTool contract + the tool registry (V0Tools)
```

The console that renders all of this — operator view, member portal (`/member`), borrower portal (`/bank`), docs (`/docs`) — is `apps/console/` at the repo root, not under `platform/`.

## What goes under `usecases/` instead

Anything that names a domain, an industry, a customer, a specific data shape, or a real-world workflow — the agent packages themselves, the synthetic data corpus and Fabric gold-layer generator, and the ontology. See [`usecases/meridian-pnc-auto-claims/`](../usecases/meridian-pnc-auto-claims/) and [`usecases/banking-loan-origination/`](../usecases/banking-loan-origination/).
