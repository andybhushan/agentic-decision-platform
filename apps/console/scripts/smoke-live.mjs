// Phase-0 E2E smoke: proves the console's service contracts against the LIVE ca-tracesapi.
// Exercises the same wire calls as src/services: health, SignalR live tail, POST /runs,
// status polling, GET /traces/{subject}?traceId, GET /aggregate/outcomes.
// Usage: node scripts/smoke-live.mjs [subjectId]

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const signalR = require("@microsoft/signalr");

const BASE =
  process.env.TRACES_API?.replace(/\/+$/, "") ??
  "https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io/api";
const SUBJECT = process.argv[2] ?? "CLM-2026-10005";

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
};

// 1. Health
const health = await getJson(`${BASE}/health`);
console.log(`health: ${health.service} ${health.status}`);
if (health.status !== "ok") fail("health not ok");

// 2. SignalR live tail: negotiate manually (the endpoint returns raw { url, accessToken }),
// then connect to the returned Azure SignalR url with the token.
const negotiateRes = await fetch(`${BASE}/negotiate?subject=${encodeURIComponent(SUBJECT)}`, {
  method: "POST",
  headers: { Accept: "application/json" },
});
if (!negotiateRes.ok) fail(`POST /negotiate: HTTP ${negotiateRes.status}`);
const info = await negotiateRes.json();
console.log(`negotiate: hub url ${info.url.split("?")[0]}`);

const liveSteps = [];
const connection = new signalR.HubConnectionBuilder()
  .withUrl(info.url, { accessTokenFactory: () => info.accessToken })
  .configureLogging(signalR.LogLevel.Warning)
  .build();
connection.on("step", (evt) => {
  liveSteps.push(evt);
  console.log(
    `  live step ${liveSteps.length}: ${evt.label} [${evt.agentId}] ${evt.origin} ${evt.status} conf=${evt.confidence}${evt.hitlGateId ? ` GATE=${evt.hitlGateId}` : ""}`,
  );
});
await connection.start();
console.log("live tail: connected");

// 3. Start run
const startRes = await fetch(`${BASE}/runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ subjectId: SUBJECT, packageId: "fnol-handler" }),
});
if (!startRes.ok) fail(`POST /runs: HTTP ${startRes.status}`);
const run = await startRes.json();
console.log(`run started: ${run.runId} subject=${run.subjectId} package=${run.packageId}`);

// 4. Poll to terminal
let status;
const deadline = Date.now() + 180_000;
for (;;) {
  if (Date.now() > deadline) fail("run did not reach terminal state in 180s");
  status = await getJson(`${BASE}/runs/${encodeURIComponent(run.runId)}/status`);
  console.log(`  status: ${status.status}`);
  if (["Completed", "Failed", "Terminated", "Canceled"].includes(status.status)) break;
  await new Promise((r) => setTimeout(r, 3000));
}
await connection.stop();
if (status.status !== "Completed") fail(`run ended ${status.status}`);
console.log(
  `run completed: traceId=${status.result?.traceId} steps=${status.result?.stepCount} hitlOpen=${status.result?.hitlGatesOpen}`,
);

// 5. Fetch immutable trace
const trace = await getJson(
  `${BASE}/traces/${encodeURIComponent(SUBJECT)}?traceId=${encodeURIComponent(status.result.traceId)}`,
);
const grounded = trace.steps.filter((s) => s.origin === "GROUNDED").length;
const cited = trace.steps.reduce((n, s) => n + (s.citedSources?.length ?? 0), 0);
console.log(
  `trace: ${trace.traceId} package=${trace.package.id}@${trace.package.version} steps=${trace.steps.length} grounded=${grounded}/${trace.steps.length} citations=${cited}`,
);
for (const s of trace.steps) {
  console.log(`  ${s.label} [${s.agentId}] ${s.origin} ${s.status} conf=${s.confidence} tools=${s.toolCalls?.length ?? 0} cites=${s.citedSources?.length ?? 0}`);
}

// 6. Outcomes aggregate
const outcomes = await getJson(`${BASE}/aggregate/outcomes`);
console.log(
  `outcomes(${outcomes.windowHours}h): handled=${outcomes.claimsHandled} groundedRate=${outcomes.groundedStepRate} avgConf=${outcomes.avgConfidence} needsReview=${outcomes.stepsNeedingHumanReview}`,
);

// Verdict
if (liveSteps.length === 0) fail("no SignalR live steps received");
if (trace.steps.length === 0) fail("trace has no steps");
console.log(`\nPASS: live E2E proven (${liveSteps.length} live steps streamed, ${trace.steps.length} trace steps, source=live)`);
