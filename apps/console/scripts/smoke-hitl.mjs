// P1 smoke: proves the HITL loop live. Forces the gate at agent.coverage-verify,
// waits for the gate step on the SignalR tail, resolves it via POST /runs/{id}/resolve-hitl,
// and asserts the run completes with the resolution recorded in the immutable trace.
// Usage: node scripts/smoke-hitl.mjs [subjectId]

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const signalR = require("@microsoft/signalr");

const BASE =
  process.env.TRACES_API?.replace(/\/+$/, "") ??
  "https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io/api";
const SUBJECT = process.argv[2] ?? "CLM-2026-10003";

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
};

// Live tail
const negotiateRes = await fetch(`${BASE}/negotiate?subject=${encodeURIComponent(SUBJECT)}`, { method: "POST" });
if (!negotiateRes.ok) fail(`negotiate: HTTP ${negotiateRes.status}`);
const info = await negotiateRes.json();

let gateEvent = null;
let gateResolvedEvent = null;
const connection = new signalR.HubConnectionBuilder()
  .withUrl(info.url, { accessTokenFactory: () => info.accessToken })
  .configureLogging(signalR.LogLevel.Warning)
  .build();
connection.on("step", (evt) => {
  console.log(`  live: ${evt.label} [${evt.agentId}] ${evt.status}${evt.hitlGateId ? ` GATE=${evt.hitlGateId}` : ""}`);
  if (evt.hitlGateId && evt.status === "needs-human-review") gateEvent = evt;
  if (evt.hitlGateId && evt.status === "completed") gateResolvedEvent = evt;
});
await connection.start();
console.log("live tail: connected");

// Start run with the forced gate
const startRes = await fetch(`${BASE}/runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ subjectId: SUBJECT, packageId: "fnol-handler", forceHitlAtAgentId: "agent.coverage-verify" }),
});
if (!startRes.ok) fail(`POST /runs: HTTP ${startRes.status}`);
const run = await startRes.json();
console.log(`run started: ${run.runId} (forceHitlAtAgentId=agent.coverage-verify)`);

// Wait for the gate to fire (via live tail), then resolve it
const gateDeadline = Date.now() + 120_000;
while (!gateEvent) {
  if (Date.now() > gateDeadline) fail("gate did not fire in 120s");
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(`gate open: ${gateEvent.hitlGateId} at ${gateEvent.agentId} conf=${gateEvent.confidence}`);

// Fetch in-flight trace: hitlOptions must be present while the gate is open
const inflight = await getJson(`${BASE}/traces/${encodeURIComponent(SUBJECT)}?traceId=${encodeURIComponent(gateEvent.traceId)}`);
console.log(`in-flight trace hitlOptions: ${inflight.hitlOptions.map((o) => o.optionId).join(", ") || "(none)"}`);
if (inflight.hitlOptions.length === 0) fail("no hitlOptions on in-flight trace while gate open");

await new Promise((r) => setTimeout(r, 2000));
const resolveRes = await fetch(`${BASE}/runs/${encodeURIComponent(run.runId)}/resolve-hitl`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ optionId: "approve-as-is", overrideOutput: "Smoke: operator approved coverage step." }),
});
if (!resolveRes.ok) fail(`resolve-hitl: HTTP ${resolveRes.status}`);
console.log(`resolve-hitl accepted: ${JSON.stringify(await resolveRes.json())}`);

// Poll to terminal
let status;
const deadline = Date.now() + 180_000;
for (;;) {
  if (Date.now() > deadline) fail("run did not complete in 180s after resolve");
  status = await getJson(`${BASE}/runs/${encodeURIComponent(run.runId)}/status`);
  if (["Completed", "Failed", "Terminated", "Canceled"].includes(status.status)) break;
  await new Promise((r) => setTimeout(r, 3000));
}
await connection.stop();
if (status.status !== "Completed") fail(`run ended ${status.status}`);
console.log(`run completed: traceId=${status.result?.traceId} hitlOpen=${status.result?.hitlGatesOpen}`);

// Final trace: the gated step must be resolved
const trace = await getJson(
  `${BASE}/traces/${encodeURIComponent(SUBJECT)}?traceId=${encodeURIComponent(status.result.traceId)}`,
);
const gated = trace.steps.find((s) => s.hitlGateId);
if (!gated) fail("no gated step recorded in final trace");
console.log(`final gated step: ${gated.label} status=${gated.status} output="${gated.output.slice(0, 120)}"`);
if (gated.status === "needs-human-review") fail("gated step still needs-human-review after resolve");
if (status.result.hitlGatesOpen !== 0) fail(`hitlGatesOpen=${status.result.hitlGatesOpen} after resolve`);
console.log(`\nPASS: HITL loop proven live (gate fired${gateResolvedEvent ? ", resolution pushed on live tail" : ""}, run completed, trace records resolution)`);
