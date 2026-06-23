// Tests for feedback capture (#114 AC: override/agreement captured with structure; capture-only).
import assert from "node:assert";
import { InMemoryEventBus } from "../event-bus/bus.mjs";
import { captureFeedback, exportFeedback } from "./feedback.mjs";

let pass = 0, fail = 0;
async function test(n, fn) { try { await fn(); pass++; console.log(`PASS ${n}`); } catch (e) { fail++; console.log(`FAIL ${n}\n   ${e.message}`); } }

await test("captures feedback as a labeled event on the bus", async () => {
  const bus = new InMemoryEventBus();
  const e = await captureFeedback(bus, { claimId: "CA-2026-0001000", decisionId: "d1", label: "agreed", actor: { id: "adj-7" } });
  assert.strictEqual(e.eventType, "feedback.captured");
  assert.strictEqual(e.topic, "platform.feedback");
  assert.strictEqual(e.payload.label, "agreed");
});

await test("rejects bad label / missing decisionId", async () => {
  const bus = new InMemoryEventBus();
  await assert.rejects(() => captureFeedback(bus, { claimId: "CA-2026-0001000", decisionId: "d1", label: "nope", actor: { id: "a" } }), /label must be/);
  await assert.rejects(() => captureFeedback(bus, { claimId: "CA-2026-0001000", label: "agreed", actor: { id: "a" } }), /decisionId required/);
});

await test("export produces an eval-ready dataset with override rate", async () => {
  const bus = new InMemoryEventBus();
  await captureFeedback(bus, { claimId: "CA-2026-0001000", decisionId: "d1", label: "agreed", actor: { id: "a" } });
  await captureFeedback(bus, { claimId: "CA-2026-0002000", decisionId: "d2", label: "overrode", reason: "ACV too low", actor: { id: "a" } });
  await captureFeedback(bus, { claimId: "CA-2026-0003000", decisionId: "d3", label: "corrected", correctedValue: "repair", actor: { id: "a" } });
  const { summary, items } = exportFeedback(bus);
  assert.strictEqual(summary.total, 3);
  assert.deepStrictEqual(summary.byLabel, { agreed: 1, overrode: 1, corrected: 1 });
  assert.strictEqual(summary.overrideRate, 0.667);
  assert.ok(items.every((i) => i.claimId && i.decisionId && i.label));
});

console.log(`\n${pass}/${pass + fail} tests passed`);
process.exit(fail ? 1 : 0);
