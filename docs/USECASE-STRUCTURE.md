# ADP Use-Case Structure (the standard template)

ADP is a **use-case-agnostic platform** with use cases as self-contained packages. Two reference use cases ship today (`meridian-pnc-auto-claims`, `banking-loan-origination`); adding a third is a copy of this template.

## Standard layout (every use case follows this)

```
usecases/<use-case>/
  spec/                  PRD.md + RESEARCH-NOTES.md + adr/   (spec-driven: approve before build)
  ontology/              the use case's semantic layer
    fabric/              Fabric IQ ontology source (entity + relationship + data-binding defs)
    contracts-input/     input schemas (e.g. claim/policy/evidence) + samples + validator
  data/                  synthetic datasets + generators (incl. fabric-gold-generator/)
  knowledge/             grounding knowledge docs the agents retrieve (RAG)
  packages/              agent packages (the typed DSL -> JSON the platform compiles)
  skills/                use-case-specific skills (optional)
  tools/                 use-case tools (C#) the agents call
  README.md
```

## What is platform vs use case
| Concern | Lives in | Why |
|---|---|---|
| Event contracts, schemas, taxonomy | `platform/foundation/contracts/` | shared across all use cases |
| Data-access / event-bus / feedback services | `platform/foundation/services/` | generic, configured per use case |
| Package compiler, orchestration, decision journal, console | `platform/src` + `platform/console` | the runtime backbone |
| Ontology, input contracts, knowledge, data, packages, tools | `usecases/<uc>/` | domain-specific |

## Adding a new use case (the standard flow)
1. `cp -r usecases/_template usecases/<new>` (or copy an existing one) and clear domain content.
2. Write `spec/PRD.md` + ADRs; **get the PRD approved** (spec-driven gate).
3. Define `ontology/` (entities + bindings) and `ontology/contracts-input/` (input schemas).
4. Generate `data/` (synthetic, deterministic) and author `knowledge/`.
5. Author `packages/` (agents) + `tools/`; the platform compiles + runs them; decisions stream to the journal.
6. Validate against the use case's acceptance criteria; demo.

## Reference use cases
- **`meridian-pnc-auto-claims`** — the superset claims MVP (fictitious carrier Meridian Mutual). 23-entity Fabric ontology, full-lifecycle knowledge, 4 agent packages. See `usecases/meridian-pnc-auto-claims/spec/PRD.md`.
- **`banking-loan-origination`** — second domain proving use-case-agnosticism (loan handler, borrower data).

> ICA 2.0 alignment (ADR-U7): use-case packages map to ICA's **Advantage Marketplace** templates; agents/tools stay exposable as **MCP/A2A** so ICA can orchestrate them.
