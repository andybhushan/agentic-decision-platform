// Borrower-portal smoke: proves the lending front door live, exactly as the portal does it.
// banking records -> borrower profile -> prefilled application -> POST /api/intake ->
// queued -> loan-handler decides (resolving any organic gate) -> journey + records updated.
// Usage: node scripts/smoke-borrower.mjs

const BASE =
  process.env.TRACES_API?.replace(/\/+$/, "") ??
  "https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io/api";

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };
const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
};

// 1. The borrower universe (entirely separate from insurance: BOR-*/LOAN-*)
const data = await getJson(`${BASE}/records?industry=banking`);
console.log(`banking records: ${data.records.length} (${data.useCase}, idField=${data.subjectIdField})`);
const seed = data.records.find((r) => r.borrowerId && r.ficoScore);
if (!seed) fail("no usable borrower record");
console.log(`borrower: ${seed.borrowerName} (${seed.borrowerId}), FICO ${seed.ficoScore} (${seed.ficoBand}), ${seed.employer}`);

// 2. Borrower-prefilled application (matches borrowerData.buildApplicationRecord)
const record = {
  borrowerId: seed.borrowerId,
  borrowerName: seed.borrowerName,
  state: seed.state,
  ageBand: seed.ageBand,
  employer: seed.employer,
  employerTenureYears: seed.employerTenureYears,
  applicationDate: new Date().toISOString().slice(0, 10),
  loanAmount: 18000,
  termMonths: 48,
  loanPurpose: "auto",
  collateralValue: 21500,
  ficoScore: seed.ficoScore,
  ficoBand: seed.ficoBand,
  grossMonthlyIncome: seed.grossMonthlyIncome,
  existingMonthlyDebt: seed.existingMonthlyDebt,
  languagePreference: seed.languagePreference ?? "en",
};

const intakeRes = await fetch(`${BASE}/intake`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ industry: "banking", channel: "web", record }),
});
if (intakeRes.status !== 201) fail(`POST /intake: HTTP ${intakeRes.status} ${await intakeRes.text()}`);
const intake = await intakeRes.json();
console.log(`intake accepted: ${intake.subjectId} (${intake.useCase})`);
if (!/^LOAN-\d{4}-\d+$/.test(intake.subjectId)) fail(`unexpected subject id pattern: ${intake.subjectId}`);

// 3. Queued with the banking lifecycle
const queue = await getJson(`${BASE}/decisions`);
const item = queue.decisions.find((d) => d.subjectId === intake.subjectId);
if (!item) fail("application not in decision queue");
if (item.useCase !== "consumer-loan-origination") fail(`wrong use case: ${item.useCase}`);
console.log(`queued: useCase=${item.useCase}, capable=[${item.packageIds.join(", ")}]`);

// 4. loan-handler decides it (resolve any organic gate like a loan officer would)
const startRes = await fetch(`${BASE}/runs`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ subjectId: intake.subjectId, packageId: "loan-handler" }),
});
if (!startRes.ok) fail(`POST /runs: HTTP ${startRes.status}`);
const run = await startRes.json();
let status;
const deadline = Date.now() + 300_000;
for (;;) {
  if (Date.now() > deadline) fail("run did not reach terminal state in 300s");
  status = await getJson(`${BASE}/runs/${encodeURIComponent(run.runId)}/status`);
  if (["Completed", "Failed", "Terminated", "Canceled"].includes(status.status)) break;
  const trace = await fetch(`${BASE}/traces/${encodeURIComponent(intake.subjectId)}`).then((r) => (r.ok ? r.json() : null));
  const gated = trace?.steps?.find((s) => s.status === "needs-human-review" && s.hitlGateId);
  if (gated && trace.hitlOptions?.length) {
    console.log(`  gate ${gated.hitlGateId} fired (conf ${gated.confidence}); loan officer approves`);
    await fetch(`${BASE}/runs/${encodeURIComponent(run.runId)}/resolve-hitl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: trace.hitlOptions[0].optionId, overrideOutput: `Smoke: loan officer approved ${gated.label}.` }),
    });
  }
  await new Promise((r) => setTimeout(r, 4000));
}
if (status.status !== "Completed") fail(`run ended ${status.status}`);
console.log(`run completed: trace ${status.result?.traceId}, ${status.result?.stepCount} steps`);

// 5. Journey + borrower view
const journey = await getJson(`${BASE}/journey/${encodeURIComponent(intake.subjectId)}`);
console.log(`journey: ${journey.traces.length} trace(s), status=${journey.traces[0]?.status}, grounded=${journey.traces[0]?.groundedSteps}/${journey.traces[0]?.stepCount}, avgConf=${journey.traces[0]?.avgConfidence}`);
const records2 = await getJson(`${BASE}/records?industry=banking`);
if (!records2.records.some((r) => r[records2.subjectIdField] === intake.subjectId)) fail("new application not in borrower records");
console.log(`borrower view: ${intake.subjectId} now appears in ${seed.borrowerName}'s applications`);

console.log(`\nPASS: lending front door proven live (borrower -> prefilled application -> queued -> decided -> tracked)`);
