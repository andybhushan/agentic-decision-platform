// P1 smoke: the Decision Queue flow end to end. Reads /api/decisions, picks a never-run
// subject, runs it with the journal-taught default package, and asserts the queue then
// shows the decision. Mirrors what DecisionQueuePage + DecisionModePage do.
// Usage: node scripts/smoke-queue.mjs [subjectId]

const BASE =
  process.env.TRACES_API?.replace(/\/+$/, "") ??
  "https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io/api";

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
};

// Same logic as src/services/decisionsClient.ts defaultPackageId.
function defaultPackageId(decision, all) {
  if (decision.latestTrace?.packageId && decision.packageIds.includes(decision.latestTrace.packageId)) {
    return decision.latestTrace.packageId;
  }
  const sameUseCase = all
    .filter((d) => d.useCase === decision.useCase && d.latestTrace?.packageId)
    .sort((a, b) => (b.latestTrace?.lastActivityAt ?? "").localeCompare(a.latestTrace?.lastActivityAt ?? ""));
  for (const d of sameUseCase) {
    const pid = d.latestTrace?.packageId;
    if (pid && decision.packageIds.includes(pid)) return pid;
  }
  return decision.packageIds[0] ?? decision.packageId;
}

const queue = await getJson(`${BASE}/decisions`);
console.log(`queue: ${queue.packages.length} packages, ${queue.decisions.length} decisions`);
if (queue.packages.length < 2) fail("expected multiple packages");

const wanted = process.argv[2];
const target = wanted
  ? queue.decisions.find((d) => d.subjectId === wanted)
  : queue.decisions.find((d) => !d.latestTrace && d.subjectId.startsWith("CLM"));
if (!target) fail("no target decision found");
const packageId = defaultPackageId(target, queue.decisions);
console.log(`target: ${target.subjectId} (${target.useCase}) capable=[${target.packageIds.join(", ")}] default=${packageId}`);
if (!target.packageIds.includes(packageId)) {
  fail(`default package ${packageId} is not in the capable set [${target.packageIds.join(", ")}]`);
}
// The journal-taught default follows the most recently used worker on the use case,
// so it drifts as different stages run; membership in the capable set is the invariant.

const startRes = await fetch(`${BASE}/runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ subjectId: target.subjectId, packageId }),
});
if (!startRes.ok) fail(`POST /runs: HTTP ${startRes.status}`);
const run = await startRes.json();
console.log(`run started: ${run.runId}`);

let status;
const deadline = Date.now() + 180_000;
for (;;) {
  if (Date.now() > deadline) fail("run did not complete in 180s");
  status = await getJson(`${BASE}/runs/${encodeURIComponent(run.runId)}/status`);
  if (["Completed", "Failed", "Terminated", "Canceled"].includes(status.status)) break;
  await new Promise((r) => setTimeout(r, 3000));
}
if (status.status !== "Completed") fail(`run ended ${status.status}`);
console.log(`run completed: traceId=${status.result?.traceId}`);

const after = await getJson(`${BASE}/decisions`);
const updated = after.decisions.find((d) => d.subjectId === target.subjectId);
if (!updated?.latestTrace) fail("queue does not show the new trace");
if (updated.latestTrace.traceId !== status.result.traceId) fail("queue latestTrace is not the run we just made");
console.log(
  `queue updated: ${updated.subjectId} status=${updated.latestTrace.status} minConf=${updated.latestTrace.minConfidence} grounded=${updated.latestTrace.groundedSteps}/${updated.latestTrace.stepCount}`,
);
const position = after.decisions.findIndex((d) => d.subjectId === target.subjectId);
console.log(`queue position: ${position} (0 = top after needs-review items)`);

console.log(`\nPASS: queue flow proven live (read queue, journal-taught default worker, run, queue reflects the decision)`);
