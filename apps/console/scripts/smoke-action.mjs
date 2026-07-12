// P2 smoke: governed action + dashboard read-sides.
// Journals an operator action onto a completed trace via POST /api/actions, then asserts:
// the trace shows the human.operator row, queue/aggregate step metrics EXCLUDE it,
// and /api/aggregate/timeline has buckets covering today's runs.
// Usage: node scripts/smoke-action.mjs [subjectId]

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

// Baseline
const before = await getJson(`${BASE}/traces/${encodeURIComponent(SUBJECT)}`);
const agentStepsBefore = before.steps.filter((s) => !s.agentId.startsWith("human."));
console.log(`baseline trace ${before.traceId}: ${before.steps.length} rows (${agentStepsBefore.length} agent steps)`);
const queueBefore = await getJson(`${BASE}/decisions`);
const itemBefore = queueBefore.decisions.find((d) => d.subjectId === SUBJECT);
if (!itemBefore?.latestTrace) fail("subject has no latest trace in queue");

// Journal the governed action
const res = await fetch(`${BASE}/actions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({
    subjectId: SUBJECT,
    traceId: before.traceId,
    actionId: "approve-execute",
    label: "Approve and execute",
    rationale: "Smoke: recommendation consistent with policy coverage and routing rules.",
  }),
});
if (!res.ok) fail(`POST /actions: HTTP ${res.status} ${await res.text()}`);
const action = await res.json();
console.log(`action journaled: step=${action.stepId} at ${action.journaledAt}`);

// Trace must now show the operator row
const after = await getJson(`${BASE}/traces/${encodeURIComponent(SUBJECT)}?traceId=${encodeURIComponent(before.traceId)}`);
const opRow = after.steps.find((s) => s.agentId === "human.operator");
if (!opRow) fail("trace does not show the human.operator row");
console.log(`trace shows operator row: "${opRow.label}" status=${opRow.status} output="${opRow.output.slice(0, 90)}..."`);

// Queue metrics must EXCLUDE the operator row from step counts
const queueAfter = await getJson(`${BASE}/decisions`);
const itemAfter = queueAfter.decisions.find((d) => d.subjectId === SUBJECT);
if (itemAfter.latestTrace.stepCount !== agentStepsBefore.length)
  fail(`queue stepCount ${itemAfter.latestTrace.stepCount} != agent steps ${agentStepsBefore.length} (operator row leaked into metrics)`);
console.log(`queue metrics clean: stepCount=${itemAfter.latestTrace.stepCount}, grounded=${itemAfter.latestTrace.groundedSteps}, status=${itemAfter.latestTrace.status}`);

// Aggregate grounded rate must stay 1.0 (operator DERIVED row excluded)
const agg = await getJson(`${BASE}/aggregate/outcomes?window=24h`);
if (agg.groundedStepRate < 1) fail(`groundedStepRate dropped to ${agg.groundedStepRate}: operator row leaked into aggregate`);
console.log(`aggregate clean: groundedStepRate=${agg.groundedStepRate}, steps=${agg.stepsTotal}`);

// Timeline must show today's runs
const tl = await getJson(`${BASE}/aggregate/timeline?window=24h&bucket=1h`);
const active = tl.buckets.filter((b) => b.traces > 0);
if (active.length === 0) fail("timeline has no active buckets in 24h despite recent runs");
console.log(`timeline: ${tl.buckets.length} buckets, ${active.length} active, packages=${JSON.stringify(active.map((b) => b.tracesByPackage))}`);

console.log(`\nPASS: governed action journaled immutably, metrics exclude operator rows, timeline feeds the dashboard`);
