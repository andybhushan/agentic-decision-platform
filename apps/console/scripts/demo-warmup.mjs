// Demo warm-up: makes the live environment look alive right before a showing.
// Runs a handful of claims across lifecycle stages plus one banking application, and leaves
// ONE claim paused at an open HITL gate so the queue shows a real "needs review" row.
// Takes ~4-6 minutes. Usage: node scripts/demo-warmup.mjs
//
// Idempotent enough: subjects are re-run (a new trace per run); nothing is deleted.

const BASE =
  process.env.TRACES_API?.replace(/\/+$/, "") ??
  "https://ca-tracesapi.thankfulriver-6516e81f.eastus2.azurecontainerapps.io/api";

const getJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
};

async function runToTerminal(subjectId, packageId, { forceGate = false, leaveGateOpen = false, resolveGates = true } = {}) {
  const body = { subjectId, packageId };
  if (forceGate) body.forceHitlAtAgentId = "agent.coverage-verify";
  const startRes = await fetch(`${BASE}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!startRes.ok) throw new Error(`POST /runs ${subjectId}/${packageId}: HTTP ${startRes.status}`);
  const run = await startRes.json();
  process.stdout.write(`  ${subjectId} · ${packageId} `);

  const deadline = Date.now() + 300_000;
  for (;;) {
    if (Date.now() > deadline) { console.log("… timeout (left running)"); return; }
    const s = await getJson(`${BASE}/runs/${encodeURIComponent(run.runId)}/status`);
    if (["Completed", "Failed", "Terminated", "Canceled"].includes(s.status)) {
      console.log(`→ ${s.status}`);
      return;
    }
    const trace = await fetch(`${BASE}/traces/${encodeURIComponent(subjectId)}`).then((r) => (r.ok ? r.json() : null));
    const gated = trace?.steps?.find((x) => x.status === "needs-human-review" && x.hitlGateId);
    if (gated) {
      if (leaveGateOpen) {
        console.log(`→ GATE OPEN (${gated.hitlGateId}) — left for the demo`);
        return;
      }
      if (resolveGates && trace.hitlOptions?.length) {
        await fetch(`${BASE}/runs/${encodeURIComponent(run.runId)}/resolve-hitl`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId: trace.hitlOptions[0].optionId, overrideOutput: `Warm-up: operator approved ${gated.label}.` }),
        });
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

console.log(`Warm-up against ${BASE}\n`);
console.log("Claims activity:");
await runToTerminal("CLM-2026-10008", "fnol-handler");
await runToTerminal("CLM-2026-10009", "fnol-handler");
await runToTerminal("CLM-2026-10008", "damage-handler");
console.log("Banking activity:");
await runToTerminal("LOAN-2026-50002", "loan-handler");
console.log("Leaving one claim awaiting human review:");
await runToTerminal("CLM-2026-10010", "fnol-handler", { forceGate: true, leaveGateOpen: true });

const agg = await getJson(`${BASE}/aggregate/outcomes?window=24h`);
console.log(`\nDashboard (24h): ${agg.claimsHandled} subjects, ${agg.tracesRecorded} runs, grounded ${Math.round(agg.groundedStepRate * 100)}%, needs review ${agg.stepsNeedingHumanReview}`);
console.log("Warm-up complete. The queue now has fresh activity and one open gate.");
