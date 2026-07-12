// Lifecycle smoke: drives one subject through every remaining declared stage of its use case,
// in order, on the LIVE backend, then asserts /api/journey shows the full process.
// Usage: node scripts/smoke-lifecycle.mjs [subjectId]

const BASE =
  process.env.TRACES_API?.replace(/\/+$/, "") ??
  "https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io/api";
const SUBJECT = process.argv[2] ?? "CLM-2026-10001";

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
};

const queue = await getJson(`${BASE}/decisions`);
const decision = queue.decisions.find((d) => d.subjectId === SUBJECT);
if (!decision) fail(`subject ${SUBJECT} not in queue`);
const stages = queue.packages
  .filter((p) => p.useCase === decision.useCase && p.stage && p.stageOrder != null)
  .sort((a, b) => a.stageOrder - b.stageOrder);
console.log(`lifecycle for ${decision.useCase}: ${stages.map((s) => `${s.stageOrder}.${s.stage}`).join(" -> ")}`);
if (stages.length === 0) fail("use case declares no stages");

for (const stage of stages) {
  if (decision.packagesRun.includes(stage.packageId)) {
    console.log(`stage "${stage.stage}" (${stage.packageId}): already decided, skipping`);
    continue;
  }
  console.log(`stage "${stage.stage}" (${stage.packageId}): running...`);
  const startRes = await fetch(`${BASE}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ subjectId: SUBJECT, packageId: stage.packageId }),
  });
  if (!startRes.ok) fail(`POST /runs (${stage.packageId}): HTTP ${startRes.status}`);
  const run = await startRes.json();

  let status;
  const deadline = Date.now() + 240_000;
  for (;;) {
    if (Date.now() > deadline) fail(`${stage.packageId} did not reach terminal state in 240s`);
    status = await getJson(`${BASE}/runs/${encodeURIComponent(run.runId)}/status`);
    if (["Completed", "Failed", "Terminated", "Canceled"].includes(status.status)) break;

    // A gate may fire organically mid-stage; resolve it like the operator would.
    const trace = await fetch(`${BASE}/traces/${encodeURIComponent(SUBJECT)}`).then((r) => (r.ok ? r.json() : null));
    const gated = trace?.steps?.find((s) => s.status === "needs-human-review" && s.hitlGateId);
    if (gated && trace.hitlOptions?.length) {
      console.log(`  gate ${gated.hitlGateId} fired at ${gated.agentId} (conf ${gated.confidence}); approving`);
      await fetch(`${BASE}/runs/${encodeURIComponent(run.runId)}/resolve-hitl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: trace.hitlOptions[0].optionId, overrideOutput: `Smoke: operator approved ${gated.label}.` }),
      });
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  if (status.status !== "Completed") fail(`${stage.packageId} run ended ${status.status}`);
  console.log(`  completed: trace ${status.result?.traceId}, ${status.result?.stepCount} steps`);
}

const journey = await getJson(`${BASE}/journey/${encodeURIComponent(SUBJECT)}`);
console.log(`\njourney for ${SUBJECT}: ${journey.traces.length} traces`);
for (const t of journey.traces) {
  const stage = stages.find((s) => s.packageId === t.packageId);
  console.log(
    `  ${stage ? `${stage.stageOrder}. ${stage.stage}` : t.packageId}: ${t.status}, ${t.groundedSteps}/${t.stepCount} grounded, avgConf ${t.avgConfidence}${t.operatorActions ? `, ${t.operatorActions} operator action(s)` : ""}`,
  );
}
const decidedStages = new Set(journey.traces.map((t) => t.packageId));
const missing = stages.filter((s) => !decidedStages.has(s.packageId));
if (missing.length > 0) fail(`journey missing stages: ${missing.map((s) => s.stage).join(", ")}`);
console.log(`\nPASS: full lifecycle decided end to end (${stages.length} stages) and journaled on one subject`);
