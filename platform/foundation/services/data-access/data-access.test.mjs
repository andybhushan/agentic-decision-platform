// Integration test for the data-access layer (#82 AC: "integration test").
// Exercises the real provider against the real synthetic dataset (no mocks) — constitution Art. IX
// ("integration over unit"). Run AFTER generating data: node ../../data/synthetic/generate.mjs
import assert from "node:assert";
import { getProvider, SyntheticClaimDataProvider, FoundryClaimDataProvider } from "./provider.mjs";

let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name}\n   ${e.message}`); } }

const p = getProvider({ kind: "synthetic" });

await test("factory returns the synthetic provider by default", async () => {
  assert.ok(getProvider() instanceof SyntheticClaimDataProvider);
});

await test("getClaim returns a known claim with a valid claimId", async () => {
  const all = await p.listClaims();
  assert.ok(all.length >= 25, `expected >=25 claims, got ${all.length}`);
  const c = await p.getClaim(all[0].claimId);
  assert.ok(/^[A-Z]{2}-\d{4}-\d{7}$/.test(c.claimId), "claimId pattern");
});

await test("getPolicy resolves the claim's policy (referential integrity)", async () => {
  const [c] = await p.listClaims();
  const pol = await p.getPolicy(c.policyNumber);
  assert.ok(pol, "policy exists for claim");
  assert.strictEqual(pol.policyNumber, c.policyNumber);
});

await test("listClaims filters by lossType", async () => {
  const fpc = await p.listClaims({ lossType: "FirstPartyCollision" });
  assert.ok(fpc.length > 0, "has FPC claims");
  assert.ok(fpc.every((c) => c.lossType === "FirstPartyCollision"), "all FPC");
});

await test("listClaims filters by policyNumber (prior-claims-lookup)", async () => {
  const [c] = await p.listClaims();
  const byPol = await p.listClaims({ policyNumber: c.policyNumber });
  assert.ok(byPol.every((x) => x.policyNumber === c.policyNumber));
});

await test("getEvidence returns evidence refs with consent shape", async () => {
  const [c] = await p.listClaims();
  const ev = await p.getEvidence(c.claimId);
  assert.ok(Array.isArray(ev) && ev.length >= 1, "has evidence");
  assert.ok("consent" in ev[0], "evidence carries consent");
});

await test("unknown ids return null (no throw)", async () => {
  assert.strictEqual(await p.getClaim("ZZ-0000-0000000"), null);
  assert.strictEqual(await p.getPolicy("ZZ-AUTO-0000-0000"), null);
});

await test("foundry provider is a clean swap point (throws not-implemented)", async () => {
  const fp = new FoundryClaimDataProvider({ baseUrl: "https://example" });
  await assert.rejects(() => fp.getClaim("CA-2026-0001000"), /Not implemented/);
});

console.log(`\n${pass}/${pass + fail} tests passed`);
process.exit(fail ? 1 : 0);
