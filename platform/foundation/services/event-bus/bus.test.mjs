// Tests for the event bus (#113 AC: producers emit, durable delivery, replayable, transport swappable).
import assert from "node:assert";
import { getBus, InMemoryEventBus, ServiceBusEventBus } from "./bus.mjs";

let pass = 0, fail = 0;
async function test(n, fn) { try { await fn(); pass++; console.log(`PASS ${n}`); } catch (e) { fail++; console.log(`FAIL ${n}\n   ${e.message}`); } }

const ev = (over = {}) => ({
  tier: "domain", eventType: "ClaimOpened", topic: "claims.lifecycle", schemaVersion: "1",
  timestamp: "2026-06-18T10:00:00Z", producedBy: "intake-agent",
  actor: { type: "agent", id: "intake-agent" },
  correlation: { claimId: "CA-2026-0001000", correlationId: "demo-run-001" },
  payload: {}, ...over,
});

await test("publish assigns eventId + monotonic sequenceNumber", async () => {
  const bus = new InMemoryEventBus();
  const a = await bus.publish(ev());
  const b = await bus.publish(ev({ eventType: "TriageCompleted", topic: "claims.triage" }));
  assert.ok(a.eventId && a.sequenceNumber === 1);
  assert.strictEqual(b.sequenceNumber, 2);
});

await test("subscribers receive events by topic prefix", async () => {
  const bus = new InMemoryEventBus();
  const got = [];
  bus.subscribe("claims.", (e) => got.push(e.eventType));
  bus.subscribe("decision.", (e) => got.push("DEC:" + e.eventType));
  await bus.publish(ev());
  await bus.publish(ev({ tier: "decision", eventType: "decision.raised", topic: "decision.queue", correlation: { claimId: "CA-2026-0001000", decisionId: "d1", correlationId: "r1" } }));
  assert.deepStrictEqual(got, ["ClaimOpened", "DEC:decision.raised"]);
});

await test("replay returns the per-claim stream in order", async () => {
  const bus = new InMemoryEventBus();
  await bus.publish(ev({ correlation: { claimId: "CA-2026-0001000", correlationId: "r" } }));
  await bus.publish(ev({ correlation: { claimId: "CA-2026-0002000", correlationId: "r" } }));
  await bus.publish(ev({ eventType: "ClaimResolved", correlation: { claimId: "CA-2026-0001000", correlationId: "r" } }));
  const stream = bus.replay({ claimId: "CA-2026-0001000" });
  assert.strictEqual(stream.length, 2);
  assert.deepStrictEqual(stream.map((e) => e.sequenceNumber), [1, 3]);
});

await test("invalid event is rejected (validate-before-append)", async () => {
  const bus = new InMemoryEventBus();
  await assert.rejects(() => bus.publish(ev({ correlation: { claimId: "BAD", correlationId: "r" } })), /claimId invalid/);
  await assert.rejects(() => bus.publish(ev({ eventType: "NotAThing" })), /not in enum/);
});

await test("durable: replay survives a new bus instance via persistPath", async () => {
  const path = new URL("./out/durable.jsonl", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const fs = await import("node:fs");
  try { fs.rmSync(path, { force: true }); } catch {}
  const bus1 = new InMemoryEventBus({ persistPath: path });
  await bus1.publish(ev());
  await bus1.publish(ev({ eventType: "ClaimResolved" }));
  const bus2 = new InMemoryEventBus({ persistPath: path });           // fresh instance, same log
  assert.strictEqual(bus2.replay({ claimId: "CA-2026-0001000" }).length, 2);
});

await test("transport is swappable (servicebus stub throws not-implemented)", async () => {
  const sb = getBus({ kind: "servicebus" });
  assert.ok(sb instanceof ServiceBusEventBus);
  await assert.rejects(() => sb.publish(ev()), /Not implemented/);
});

console.log(`\n${pass}/${pass + fail} tests passed`);
process.exit(fail ? 1 : 0);
