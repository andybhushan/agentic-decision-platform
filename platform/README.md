# platform/

The ADP platform. **Use-case agnostic.** Compiles and executes any EA package that conforms to [`schemas/ea-package.v0.schema.json`](schemas/ea-package.v0.schema.json).

## Invariants

1. **Nothing in `platform/` may import from `usecases/`.** Enforced by [`scripts/check-boundary.mjs`](../scripts/check-boundary.mjs).
2. **No domain vocabulary in code.** Variable names, type names, function names must not say `claim`, `insurance`, `FNOL`, `Meridian`, etc. The trace renders whatever labels the EA package supplies.
3. **Demo fixtures are allowed under `platform/console/src/demo-trace.json`** to keep dev velocity. Marked clearly; goes away on D8 when the console fetches from `/api/traces/:id`.

## Contents (current)

```
platform/
├── schemas/
│   └── ea-package.v0.schema.json     v0 stubbed EA package format (the contract)
└── console/                          Operator Console — renders any package trace
    └── src/
        ├── types.ts                  Generic Trace types
        ├── App.tsx                   Generic trace renderer
        ├── demo-trace.json           Demo fixture (use-case-shaped, marked)
        ├── main.tsx
        ├── styles.css
        └── vite-env.d.ts
```

## Contents (planned, D3+)

```
platform/
├── src/
│   ├── AppHost/                      Microsoft Aspire app host
│   ├── PackageCompiler/              EA package → Foundry/Durable artifacts
│   ├── Orchestration/                Durable Functions (inter-DW)
│   ├── Agents/                       Foundry agent adapter (4 generic kinds)
│   ├── ContextFabric/                FabricIQ + FoundryIQ + WorkIQ adapters
│   └── DecisionIngest/               Event Grid → Bronze
└── infra/                            Bicep modules (generic — no use-case naming)
```

## What goes under `usecases/` instead

Anything that names a domain, an industry, a customer, a specific data shape, or a real-world workflow. See [`usecases/meridian-pnc-auto-claims/README.md`](../usecases/meridian-pnc-auto-claims/README.md).
