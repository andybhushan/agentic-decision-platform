# ADR-0002 — Agent package format

- **Status:** Accepted (v1)
- **Date:** 2026-05-26 (revised)
- **Deciders:** Anand Bhushan
- **Supersedes:** prior draft of this ADR that was anchored to "stub until Process Studio access lands"
- **Superseded by:** —

## Context

The platform compiles and executes **agent packages** — declarative definitions of a Digital Worker, its agents, skills, tools, orchestration policy, invariants, HITL gates, SLOs, and context bindings. The package format is the most critical contract in the platform: it is what every authoring tool, every CI step, every runtime executor, every audit query depends on.

Two things to optimise:

1. **Author experience.** A platform Microsoft can be proud of means an authoring path that feels first-class — IntelliSense, refactoring, type checking, composition. JSON-by-hand is none of those things.
2. **Runtime contract.** A platform IBM can be proud of means the artifact is portable, signable, immutable, machine-validatable, language-neutral. JSON Schema is exactly that.

The mistake of treating these as one decision is what led to the previous draft's "JSON Schema only" choice. The correct shape is **both**, layered.

## Options considered

### Option A — JSON Schema only (the v0 draft)

- Pros: machine-validatable; ubiquitous tooling; one artifact.
- Cons: hand-writing JSON is painful; no IntelliSense for cross-references between agents and skills; refactoring (renaming an agent ID) requires manual find-replace across the file.

### Option B — YAML only

- Pros: human-readable.
- Cons: silent type coercion (Norway problem); poor Git diff quality on nested structures; CEL-style rule expressions are stringly-typed regardless; same authoring fragility as JSON.

### Option C — Custom DSL with its own parser

- Pros: aligns with the strategic-policy-as-code idea; full domain expressiveness.
- Cons: building and maintaining a parser is multi-week work; we are not yet at the scale where a custom syntax pays for itself; reinvents what typed-config frameworks already solved.

### Option D — Typed C# DSL → JSON artifact (the modern pattern)

- Pros: code IS the spec — IntelliSense, refactor, type check, compose; standard Microsoft pattern (Aspire's distributed-app model, Bicep's typed Azure resources); compiles to a portable JSON artifact that satisfies all runtime/audit/portability needs; the JSON Schema becomes the artifact contract, not the authoring contract.
- Cons: requires a typed model library in `platform/src/PackageModel/` (~200 lines of C# records); a non-developer SME cannot author packages directly.

### Option E — Typed TypeScript DSL → JSON (AWS CDK pattern)

- Pros: same as D but in TS; aligns with the console stack.
- Cons: runtime is .NET; two language ecosystems for one concern; less idiomatic for an Aspire-hosted platform.

## Decision

**Option D — Typed C# DSL + JSON Schema-validated artifact.** Two layers:

1. **Authoring layer** — `platform/src/PackageModel/` exports C# records (`AgentPackage`, `DigitalWorker`, `AgentSpec`, `SkillRef`, `ToolRef`, `Orchestration`, etc.). A package author writes:

   ```csharp
   var pkg = new AgentPackage("fnol-handler", "0.1.0")
       .WithDigitalWorker(dw => dw
           .Named("FNOL Handler")
           .Capabilities("claim-intake", "coverage-verification", "initial-triage", "assignment-routing")
           .WithSlo("intake_latency_p90_minutes", 15, Window.P30D)
           .WithOrchestration(o => o.Hybrid().AddBoundedZone(...)));
   pkg.SerializeTo("fnol-handler.json");
   ```

2. **Artifact layer** — `platform/schemas/agent-package.v1.schema.json` is the immutable runtime contract. The CLI validates any JSON against it before execution. Hand-authored or LLM-generated JSON is equally valid as long as it passes the schema.

Both layers always exist. C# is the primary authoring path; JSON Schema is the wire format and the audit contract.

## Consequences

- `platform/src/PackageModel/` ships as a .NET 10 class library on D3, depended on by `platform/src/PackageCompiler/`.
- `platform/schemas/agent-package.v1.schema.json` is the source of truth for the artifact shape. The C# model serialises to it; CI validates any incoming JSON against it.
- Use cases can choose: write a C# program that emits JSON, or hand-author JSON. Both produce identical runtime artifacts.
- When (if) a visual authoring tool lands in v1+ (Foundry Studio integration, M365 Copilot conversational authoring), it emits JSON against the same schema. No platform code changes.
- The schema is **versioned** (`v1`, then `v2`, …). Breaking changes get a new file; converters live in `platform/src/PackageModel/Migrations/`.

## Trade-offs accepted

- Two ways to author. Acceptable — they share the same runtime contract.
- Non-developer SMEs cannot author packages directly until the v1+ authoring UI ships. Acceptable for v0 — packages are written by Anand + Claude / Copilot pairing.
- C# library is a real dependency. Acceptable — it is small (~200 lines), shipped as a NuGet inside the repo, and worth its weight for everyone authoring packages thereafter.

## Validation

- `platform/schemas/agent-package.v1.schema.json` validates against JSON Schema Draft 2020-12 meta-schema.
- `usecases/meridian-pnc-auto-claims/packages/fnol-handler.json` validates against the schema.
- D3+: the C# `AgentPackage` fluent builder produces JSON that round-trips through validation cleanly.
- D5+: CI rejects any PR that introduces a package file failing the schema check.
