# Raw Data Access Layer (T013 / issue #82)

**Status:** Draft for team review · **Owner:** Data & Semantic (Anand + vibha436) · **Date:** 2026-06-18
**Target:** `adp-sandbox` · `src/services/data-access/` · **Depends on:** #80 (contract), #81 (synthetic data)

> A single, narrow **provider interface** the agents read policy/claim/evidence through. The agent depends on the interface, **never** on a concrete store, so the backend swaps (synthetic → Foundry/Fabric/real ClaimCenter) as a **config change, not a code change**. No business logic lives here (constitution Art. VIII; #82 AC "no business logic leaks into the agent").

## Interface

```
ClaimDataProvider
  getPolicy(policyNumber)            -> Policy | null
  getClaim(claimId)                  -> Claim | null
  listClaims({policyNumber, lossType}) -> Claim[]
  getEvidence(claimId)               -> EvidenceRef[]
```

`getProvider({ kind })` (or env `CLAIM_DATA_PROVIDER`) selects the implementation; defaults to `synthetic`.

| Provider | Backing | Use |
|---|---|---|
| `SyntheticClaimDataProvider` | `src/data/synthetic/out/claims.jsonl` (#81) | dev / test / demo |
| `FoundryClaimDataProvider` | mock-* APIM endpoints / Fabric Data Agent (managed identity) | the swap point for real systems (stub in staging) |

## Maps onto the existing tool-catalog (no new tools needed)

The provider sits **behind** the OpenAPI tools already in `tool-catalog.md`:

| Tool (catalog) | Provider method |
|---|---|
| `policy-lookup` `/dc/policies/{policyNumber}` | `getPolicy` |
| `claim-get` `/cc/claims/{claimId}` | `getClaim` |
| `prior-claims-lookup` `/cc/claims/history/{policyNumber}` | `listClaims({policyNumber})` |
| claim photos / evidence | `getEvidence` |

So this layer is the **swappable implementation** behind the Foundry tools — first the synthetic store, later the mocks (`/apim-mock`), later real systems. Article IV honored: tools stay stateless OpenAPI endpoints; this provider is the data source they call.

## Test

```
node ../../data/synthetic/generate.mjs   # produce the dataset first
node data-access.test.mjs                # 8/8 integration tests (real data, no mocks)
```

Verified: **8/8 passing** — referential integrity (every claim resolves its policy), filters, evidence+consent shape, null-on-unknown, and the Foundry swap point.

## Acceptance criteria (#82) — status
- [x] Provider interface + synthetic-backed implementation
- [x] Integration test (real synthetic data, not mocked unit tests)
- [x] No business logic leaks into the agent (pure read interface; decisions live in agents/orchestrator)
- [x] First attempt = Foundry-direct path identified (`FoundryClaimDataProvider` swap point)
- [ ] Wire `FoundryClaimDataProvider` to mock-* APIM / Fabric (next, with infra)
- [ ] Commit (Anand pushes)
