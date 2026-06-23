// Raw data access layer (T013 / issue #82).
// A swappable provider interface the triage/coverage agents read through. The agent depends on
// the INTERFACE, never on a concrete store. Synthetic-backed today; Foundry/Fabric/real systems later.
// Constitution: Art. IV (tools stateless, managed identity), Art. VIII (no speculative abstraction —
// one narrow interface), and "no business logic leaks into the agent" (#82 AC).
//
// The OpenAPI tools already in the tool-catalog map 1:1 onto this interface:
//   policy-lookup        -> getPolicy(policyNumber)
//   claim-get            -> getClaim(claimId)
//   prior-claims-lookup  -> listClaims({ policyNumber })
//   photo-store / claim photos -> getEvidence(claimId)
// i.e. this is the provider that sits BEHIND those tool endpoints.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {Object} ClaimDataProvider
 * @property {(policyNumber: string) => Promise<object|null>} getPolicy
 * @property {(claimId: string) => Promise<object|null>} getClaim
 * @property {(filter?: {policyNumber?: string, lossType?: string}) => Promise<object[]>} listClaims
 * @property {(claimId: string) => Promise<object[]>} getEvidence
 */

/**
 * Synthetic-backed provider. Reads the deterministic dataset produced by
 * src/data/synthetic/generate.mjs. Read-only; stateless between calls beyond the in-memory index.
 * @implements {ClaimDataProvider}
 */
export class SyntheticClaimDataProvider {
  /** @param {string} [dataPath] path to claims.jsonl */
  constructor(dataPath = resolve(here, "./data/claims.jsonl")) {
    this._byPolicy = new Map();
    this._byClaim = new Map();
    const lines = readFileSync(dataPath, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      const { policy, claim } = JSON.parse(line);
      this._byPolicy.set(policy.policyNumber, policy);
      this._byClaim.set(claim.claimId, claim);
    }
  }
  async getPolicy(policyNumber) { return this._byPolicy.get(policyNumber) ?? null; }
  async getClaim(claimId) { return this._byClaim.get(claimId) ?? null; }
  async listClaims(filter = {}) {
    let claims = [...this._byClaim.values()];
    if (filter.policyNumber) claims = claims.filter((c) => c.policyNumber === filter.policyNumber);
    if (filter.lossType) claims = claims.filter((c) => c.lossType === filter.lossType);
    return claims;
  }
  async getEvidence(claimId) { return this._byClaim.get(claimId)?.evidence ?? []; }
}

/**
 * Real-systems provider stub. Shows exactly where the swap happens — a Foundry tool call /
 * Fabric Data Agent / mock-* APIM endpoint goes here, behind the SAME interface, so the agent
 * code never changes. Auth via managed identity (Art. IV/X); no secrets.
 * @implements {ClaimDataProvider}
 */
export class FoundryClaimDataProvider {
  /** @param {{ baseUrl: string, fetchImpl?: typeof fetch }} cfg */
  constructor(cfg) { this._cfg = cfg; this._fetch = cfg.fetchImpl ?? fetch; }
  async getPolicy(policyNumber) {
    // e.g. GET {baseUrl}/dc/policies/{policyNumber} via the 'policy-lookup' tool (managed identity).
    throw new Error("FoundryClaimDataProvider.getPolicy: wire to mock-policy-admin-api / Fabric. Not implemented in staging.");
  }
  async getClaim(claimId) { throw new Error("FoundryClaimDataProvider.getClaim: wire to mock-claimcenter-api. Not implemented in staging."); }
  async listClaims() { throw new Error("FoundryClaimDataProvider.listClaims: wire to prior-claims-lookup. Not implemented in staging."); }
  async getEvidence(claimId) { throw new Error("FoundryClaimDataProvider.getEvidence: wire to claim photos/evidence store. Not implemented in staging."); }
}

/**
 * Factory — selects the provider by env, defaulting to synthetic. The agent calls getProvider(),
 * never `new SomethingProvider()`, so swapping the backend is a config change, not a code change.
 * @param {{ kind?: string, dataPath?: string, baseUrl?: string }} [opts]
 * @returns {ClaimDataProvider}
 */
export function getProvider(opts = {}) {
  const kind = opts.kind ?? process.env.CLAIM_DATA_PROVIDER ?? "synthetic";
  switch (kind) {
    case "synthetic": return new SyntheticClaimDataProvider(opts.dataPath);
    case "foundry": return new FoundryClaimDataProvider({ baseUrl: opts.baseUrl ?? process.env.CLAIM_DATA_BASE_URL });
    default: throw new Error(`Unknown CLAIM_DATA_PROVIDER: ${kind}`);
  }
}
