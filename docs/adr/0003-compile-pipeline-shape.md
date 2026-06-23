# ADR-0003 — Compile pipeline shape

- **Status:** Accepted (v0)
- **Date:** 2026-05-26
- **Deciders:** Anand Bhushan
- **Supersedes:** —
- **Superseded by:** —

## Context

PDF §4 specifies a four-stage compile pipeline that turns DSL source into a signed, registered runtime artifact:

1. **Parser** — syntax, references, schema compatibility.
2. **Semantic Validator** — ontology, guardrails, calibration, regulatory, invariants.
3. **Execution Plan Generator** — SK task graphs, Durable Functions, Event Grid, APIM.
4. **Deployment Artifact** — signed, versioned, registered in Agent 365.

The platform needs to actually run these four stages. The shape of that execution — in-process, separate microservice, CLI tool, Functions, etc. — is the decision here.

## Options considered

### Option A — In-process module within the host (4 stages as method calls)

- Pros: trivial to debug; one process; fast feedback loop; no extra Azure resources for v0; matches Aspire's "one solution" model.
- Cons: cannot be operated independently (cannot recompile without restarting the host); harder to add a CI step "validate this package on PR" without standing up the host.

### Option B — Standalone CLI tool (`adpc compile package.json -o artifact.zip`)

- Pros: invocable from CI, from a developer laptop, from a build step. Decouples "compile" from "run." Pattern matches `tsc`, `bicep build`, `terraform plan`. Compile errors caught at PR-time, not runtime.
- Cons: separate distribution + versioning concern. Slightly more code (CLI parsing) than option A.

### Option C — HTTP service / Azure Function

- Pros: callable from the IEA side (when Process Studio authors a package, it can POST to compile-as-a-service); central single source of truth.
- Cons: premature for v0. Adds an Azure resource (Function or App Service), authentication boundary, networking. No caller for this service yet exists in v0.

### Option D — Hybrid: CLI for build-time + in-process for hot-reload during dev

- Pros: best of A and B.
- Cons: two implementations of the same logic; drift risk.

## Decision

**Option B — Standalone CLI tool**, implemented as a .NET console application under `platform/src/PackageCompiler/`, invocable as `adpc compile <package> -o <artifact>`.

The four stages are method calls inside the CLI. The CLI is the only consumer of those methods in v0. When (if) we need a compile-as-a-service in v1+, we wrap the same methods in a Function — no rewrite.

Rationale: separating compile from run is the single most important property for catching errors early. A package that fails to compile in CI never reaches the Foundry registry. This is the same discipline ICA + Bicep + TypeScript apply, and it costs almost nothing to set up now.

## Consequences

- `platform/src/PackageCompiler/` is a .NET 10 console project.
- Output is a `.zip` artifact with three sub-artifacts (Layer A: Durable Functions code; Layer B: Foundry agent definitions; Layer C: Agent Framework scaffolds) plus a signed manifest.
- `adpc compile` runs as a step in the GitHub Actions PR workflow on D5.
- Stage 4 ("register in Agent 365") is stubbed in v0 — emits the signed artifact to local disk only; Agent 365 registry integration deferred.
- `dotnet run --project platform/src/PackageCompiler -- compile usecases/meridian-pnc-auto-claims/packages/fnol-handler.json -o artifact.zip` becomes the smoke test.

## Trade-offs accepted

- Slightly more code at v0 than in-process. Worth it — separates concerns from day 1.
- Stage 4 (Agent 365 registry) is stubbed. Named gap; deferred to v1.
- No hot-reload during dev. Mitigation: `adpc compile` is fast (validation + plan generation = sub-second on v0 schema size).

## Validation

- CLI invocable from terminal: `adpc compile <pkg> -o <out>` produces a `.zip`.
- CLI exits non-zero on schema violation, with a clear error.
- CI step blocks PRs that introduce a non-compiling package.
- Hot path: package change → CI failure visible in PR within ~30 seconds.
