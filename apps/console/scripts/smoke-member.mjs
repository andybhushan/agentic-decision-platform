// Member-portal smoke: proves the full front-door loop live, exactly as the portal does it.
// records (member universe) -> build a member-prefilled FNOL -> POST /api/intake ->
// new subject queued as "new" -> fnol-handler runs it -> journey exists.
// Usage: node scripts/smoke-member.mjs

const BASE =
  process.env.TRACES_API?.replace(/\/+$/, "") ??
  "https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io/api";

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
};

// 1. The member universe
const data = await getJson(`${BASE}/records?industry=insurance`);
console.log(`records: ${data.records.length} (${data.useCase}, idField=${data.subjectIdField}), intake so far: ${Object.keys(data.intake).length}`);
const seed = data.records.find((r) => r.policyholder?.policyholderId && r.policy && r.vehicle);
if (!seed) fail("no usable member record");
const member = seed.policyholder;
console.log(`member: ${member.firstName} ${member.lastName} (${member.policyholderId}), policy ${seed.policy.policyNumber}`);

// 2. Member-prefilled FNOL (matches memberData.buildClaimRecord)
const record = {
  fnolReceivedAt: new Date().toISOString(),
  incidentDate: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
  channel: "web",
  policyholder: member,
  policy: seed.policy,
  vehicle: seed.vehicle,
  incident: {
    incidentType: "rear-end-collision",
    location: { city: member.address?.city, state: member.address?.state, intersection: "Elm & 3rd" },
    narrative:
      "I was stopped at a red light on Elm when the car behind me failed to brake and hit my rear bumper. Trunk does not close properly now. The other driver accepted fault at the scene and we exchanged details.",
    injuries: false,
    thirdPartyInvolved: true,
    policeReportFiled: true,
    photos: 4,
  },
  flags: { potentialFraudIndicators: false, expectedLowConfidenceTriage: false, ambiguousCoverage: false },
};

const intakeRes = await fetch(`${BASE}/intake`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ industry: "insurance", channel: "web", record }),
});
if (intakeRes.status !== 201) fail(`POST /intake: HTTP ${intakeRes.status} ${await intakeRes.text()}`);
const intake = await intakeRes.json();
console.log(`intake accepted: ${intake.subjectId} (${intake.useCase}, channel ${intake.channel})`);
if (!/^CLM-\d{4}-\d+$/.test(intake.subjectId)) fail(`unexpected subject id pattern: ${intake.subjectId}`);

// 3. Queued as new
const queue = await getJson(`${BASE}/decisions`);
const item = queue.decisions.find((d) => d.subjectId === intake.subjectId);
if (!item) fail("intake subject not in decision queue");
if (item.latestTrace) fail("fresh intake should have no trace yet");
if (!item.receivedAt) fail("queue item missing receivedAt");
const position = queue.decisions.findIndex((d) => d.subjectId === intake.subjectId);
console.log(`queued: position ${position}, useCase=${item.useCase}, channel=${item.channel}, capable=[${item.packageIds.join(", ")}]`);

// 4. Runnable end to end
const startRes = await fetch(`${BASE}/runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ subjectId: intake.subjectId, packageId: "fnol-handler" }),
});
if (!startRes.ok) fail(`POST /runs: HTTP ${startRes.status}`);
const run = await startRes.json();
let status;
const deadline = Date.now() + 240_000;
for (;;) {
  if (Date.now() > deadline) fail("run did not reach terminal state in 240s");
  status = await getJson(`${BASE}/runs/${encodeURIComponent(run.runId)}/status`);
  if (["Completed", "Failed", "Terminated", "Canceled"].includes(status.status)) break;
  // resolve any organic gate like an operator would
  const trace = await fetch(`${BASE}/traces/${encodeURIComponent(intake.subjectId)}`).then((r) => (r.ok ? r.json() : null));
  const gated = trace?.steps?.find((s) => s.status === "needs-human-review" && s.hitlGateId);
  if (gated && trace.hitlOptions?.length) {
    console.log(`  gate ${gated.hitlGateId} fired (conf ${gated.confidence}); approving`);
    await fetch(`${BASE}/runs/${encodeURIComponent(run.runId)}/resolve-hitl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: trace.hitlOptions[0].optionId, overrideOutput: `Smoke: approved ${gated.label}.` }),
    });
  }
  await new Promise((r) => setTimeout(r, 4000));
}
if (status.status !== "Completed") fail(`run ended ${status.status}`);
console.log(`run completed: trace ${status.result?.traceId}, ${status.result?.stepCount} steps`);

// 5. Journey + member view data
const journey = await getJson(`${BASE}/journey/${encodeURIComponent(intake.subjectId)}`);
console.log(`journey: ${journey.traces.length} trace(s), first stage status=${journey.traces[0]?.status}, grounded=${journey.traces[0]?.groundedSteps}/${journey.traces[0]?.stepCount}`);
const records2 = await getJson(`${BASE}/records?industry=insurance`);
if (!records2.records.some((r) => r[records2.subjectIdField] === intake.subjectId)) fail("new claim not in member records");
console.log(`member view: claim ${intake.subjectId} now appears in ${member.firstName}'s records`);

console.log(`\nPASS: member front door proven live (identified member -> prefilled FNOL -> queued -> agents decided -> tracked)`);
