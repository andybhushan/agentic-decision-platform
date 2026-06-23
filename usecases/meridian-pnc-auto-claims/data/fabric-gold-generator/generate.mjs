// ADP Claims — synthetic gold data product generator (issue #68).
// Deterministic (seeded). Emits one CSV per gold table per the v0 schema.
// No real PII. Anchor "405 claim" CA-2026-0000123 always fires total-loss at 0.71.
//
// Parameterized (all optional; deterministic for a given --seed):
//   --count <n>            number of claims (default 100); supporting tables scale with it
//   --total-loss-pct <f>   fraction of non-anchor claims that cross the 0.70 gate (default 0.16)
//   --fraud-pct <f>        fraction of non-anchor claims flagged for fraud (default 0.10)
//   --seed <int>           PRNG seed (default 1835365732) — same seed => byte-identical output
//   --out <dir>            output directory (default ./data)
//
// Run: node generate.mjs --count 250 --total-loss-pct 0.2 --fraud-pct 0.12 --seed 42

import { writeFileSync, mkdirSync } from "node:fs";

// ---- args ----
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def; };
const COUNT = Math.max(1, parseInt(arg("count", "100"), 10));
const TL_PCT = Math.min(1, Math.max(0, parseFloat(arg("total-loss-pct", "0.16"))));
const FRAUD_PCT = Math.min(1, Math.max(0, parseFloat(arg("fraud-pct", "0.10"))));
const SEED = parseInt(arg("seed", "1835365732"), 10) | 0; // 0x6d6f6e64
const OUT = arg("out", "./data");

// ---- seeded PRNG (mulberry32) ----
let _s = SEED;
function rnd() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = a => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const rf = (lo, hi, d = 2) => +(lo + rnd() * (hi - lo)).toFixed(d);
const pad = (n, w) => String(n).padStart(w, "0");
let _u = 0; const uuid = () => { _u++; const h = (n) => pad((Math.floor(rnd() * 0xffff) ^ _u * (n + 1)).toString(16), 4).slice(-4); return `${h(1)}${h(2)}-${h(3)}-4${h(4).slice(1)}-${h(5)}-${h(6)}${h(7)}${h(8)}`; };
const iso = d => d.toISOString().slice(0, 19) + "Z";
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// ---- CSV writer ----
function csv(name, rows) {
  if (!rows.length) { writeFileSync(`${OUT}/${name}.csv`, ""); return; }
  const cols = Object.keys(rows[0]);
  const esc = v => v === null || v === undefined ? "" : (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const out = [cols.join(",")].concat(rows.map(r => cols.map(c => esc(r[c])).join(","))).join("\n");
  writeFileSync(`${OUT}/${name}.csv`, out);
  console.log(name.padEnd(24), rows.length);
}

// ---- reference data ----
const FIRST = ["Maya","James","Aisha","Robert","Elena","David","Priya","Marcus","Sophia","Liam","Nina","Carlos","Grace","Omar","Lucia","Ethan","Zoe","Hugo","Maria","Noah"];
const LAST = ["Alvarez","Chen","Patel","Johnson","Garcia","Smith","Nguyen","Brown","Kim","Davis","Lopez","Martin","Khan","Rossi","Silva","Wong","Reyes","Hassan","Cohen","Park"];
const CITIES = [["Los Angeles","90012"],["San Diego","92101"],["San Jose","95113"],["Sacramento","95814"],["Fresno","93721"],["Oakland","94607"],["Long Beach","90802"],["Anaheim","92805"]];
const MAKES = [["Honda",["Civic","Accord","CR-V"]],["Toyota",["Corolla","Camry","RAV4"]],["Ford",["Focus","Fusion","Escape"]],["Chevrolet",["Malibu","Equinox","Cruze"]],["Nissan",["Altima","Sentra","Rogue"]]];
const BODY = ["Sedan","SUV","Truck","Coupe","Hatchback","Van"];
const LOSS_CAUSE = ["RearEndCollision","RearEndCollision","RearEndCollision","SideImpact","ParkedVehicleHit","SingleVehicleRollover","Hail","Theft","GlassOnly","AnimalStrike"];
const IMPACT = ["Front","Rear","LeftSide","RightSide","Rollover","Multiple"];
const CHANNEL = ["MobileApp","Web","Telematics","Phone","Chatbot","Agent"];
const PART_NAMES = ["Rear Bumper","Trunk Lid","Left Quarter Panel","Right Quarter Panel","Tail Light Assy","Rear Sensor","Front Bumper","Hood","Left Door","Windshield"];

// supporting-table volumes scale with claim count (ratios preserved from the v0 fixed set)
const N = {
  person: Math.max(20, Math.round(COUNT * 2)),
  adjuster: 10,
  location: Math.max(12, Math.round(COUNT * 1.2)),
  policy: Math.max(12, Math.round(COUNT * 1.2)),
  term: Math.max(15, Math.round(COUNT * 1.5)),
  vehicle: Math.max(15, Math.round(COUNT * 1.5)),
  claimant: Math.max(13, Math.round(COUNT * 1.3)),
  claim: COUNT,
};
const base = new Date("2025-06-01T00:00:00Z");

mkdirSync(OUT, { recursive: true });

// ---- party_person ----
const persons = [];
for (let i = 0; i < N.person; i++) {
  const id = uuid();
  persons.push({ person_id: id, first_name: pick(FIRST), last_name: pick(LAST),
    date_of_birth: iso(addDays(new Date("1960-01-01Z"), ri(0, 16000))),
    driver_license_number: "D" + ri(1000000, 9999999), driver_license_state: "CA",
    contact_email: `user${i}@example.com`, contact_phone: `+1310${ri(2000000, 9999999)}`,
    mailing_address: `${ri(100, 9999)} Main St` });
}

// ---- adjuster (Derek Chen anchored at idx 6) ----
const SPEC = ["Material","Casualty","TotalLoss","SIU","Litigation"];
const adjusters = [];
for (let i = 0; i < N.adjuster; i++) {
  adjusters.push({ adjuster_id: "ADJ-" + pad(i + 1, 4),
    display_name: i === 6 ? "Derek Chen" : `${pick(FIRST)} ${pick(LAST)}`,
    queue_id: "Q-" + pad(ri(1, 5), 2), authority_level: ri(1, 5),
    licensed_states: "CA", specialty: i === 6 ? "Material" : pick(SPEC) });
}
const derek = adjusters[6];

// ---- loss_location ----
const locations = [];
for (let i = 0; i < N.location; i++) {
  const c = pick(CITIES);
  locations.push({ location_id: uuid(), latitude: rf(32.5, 38.7, 4), longitude: rf(-122.5, -117.1, 4),
    address_line: `${ri(100, 9999)} ${pick(LAST)} Ave`, city: c[0], state: "CA", postal_code: c[1] });
}

// ---- policy + term + coverage ----
const policies = [], terms = [], coverages = [];
for (let i = 0; i < N.policy; i++) {
  const owner = pick(persons);
  const pn = `CA-AUTO-2025-${pad(1000 + i, 4)}`;
  policies.push({ policy_number: pn, producer_code: "P" + ri(100, 999), issued_state: "CA",
    named_insured_person_id: owner.person_id, effective_first_term: iso(base) });
}
for (let i = 0; i < N.term; i++) {
  const p = pick(policies);
  const ef = addDays(base, ri(0, 120));
  const tid = uuid();
  terms.push({ term_id: tid, policy_number: p.policy_number, effective_from: iso(ef),
    effective_to: iso(addDays(ef, 365)), premium_total: rf(900, 2400), rating_tier: pick(["Std","Pref","NonStd"]), status: "InForce" });
  coverages.push({ coverage_id: uuid(), term_id: tid, coverage_code: "COLL", limit_per_occurrence: pick([25000,30000,50000]), limit_per_person: "", deductible: pick([500,1000]), rental_daily_limit: "", rental_max_days: "" });
  coverages.push({ coverage_id: uuid(), term_id: tid, coverage_code: "COMP", limit_per_occurrence: pick([25000,30000]), limit_per_person: "", deductible: pick([250,500]), rental_daily_limit: "", rental_max_days: "" });
  coverages.push({ coverage_id: uuid(), term_id: tid, coverage_code: "RENT", limit_per_occurrence: 1200, limit_per_person: "", deductible: "", rental_daily_limit: 40, rental_max_days: 30 });
  if (rnd() < 0.5) coverages.push({ coverage_id: uuid(), term_id: tid, coverage_code: "TOW", limit_per_occurrence: 150, limit_per_person: "", deductible: "", rental_daily_limit: "", rental_max_days: "" });
}

// ---- vehicle ----
const vehicles = [];
for (let i = 0; i < N.vehicle; i++) {
  const mk = pick(MAKES);
  vehicles.push({ vin: "1HG" + pad(ri(0, 99999999999999), 14).slice(0, 14), owner_person_id: pick(persons).person_id,
    year: ri(2014, 2024), make: mk[0], model: pick(mk[1]), trim: pick(["LX","EX","SE","LE","Sport",""]),
    body_style: pick(BODY), current_odometer: ri(5000, 140000), acv: rf(6000, 32000) });
}

// ---- claimant ----
const claimants = [];
for (let i = 0; i < N.claimant; i++) {
  claimants.push({ claimant_id: uuid(), person_id: pick(persons).person_id,
    claimant_type: rnd() < 0.85 ? "FirstParty" : "ThirdParty", demand_amount: rnd() < 0.3 ? rf(1000, 15000) : "" });
}

// ---- loss_event + claim + children ----
const lossEvents = [], leVeh = [], leParty = [], claims = [], exposures = [],
  damages = [], parts = [], tle = [], fraud = [], payments = [];

function buildClaim(i, anchor) {
  const term = anchor ? terms[0] : pick(terms);
  const ef = new Date(term.effective_from); const et = new Date(term.effective_to);
  const occ = anchor ? new Date("2026-06-02T15:30:00Z") : new Date(ef.getTime() + rnd() * (et.getTime() - ef.getTime()));
  const loc = anchor ? { location_id: uuid(), latitude: 33.9416, longitude: -118.4085, address_line: "I-405 N near LAX", city: "Los Angeles", state: "CA", postal_code: "90045" } : pick(locations);
  if (anchor) locations.push(loc);
  const veh = anchor ? { vin: "1HGCV405ANCHOR1", owner_person_id: persons[0].person_id, year: 2021, make: "Honda", model: "Civic", trim: "EX", body_style: "Sedan", current_odometer: 41000, acv: 9250.00 } : pick(vehicles);
  if (anchor) vehicles.push(veh);
  const cm = anchor ? { claimant_id: uuid(), person_id: persons[0].person_id, claimant_type: "FirstParty", demand_amount: "" } : pick(claimants);
  if (anchor) { persons[0].first_name = "Maya"; persons[0].last_name = "Alvarez"; claimants.push(cm); }

  const leId = uuid();
  lossEvents.push({ loss_event_id: leId, location_id: loc.location_id, occurred_at: iso(occ),
    loss_cause: anchor ? "RearEndCollision" : pick(LOSS_CAUSE), is_first_party: true,
    point_of_impact: anchor ? "Rear" : pick(IMPACT), description: anchor ? "Rear-ended on I-405" : "" });
  leVeh.push({ loss_event_id: leId, vin: veh.vin });
  leParty.push({ loss_event_id: leId, person_id: cm.person_id, role: "Claimant" });

  const cn = anchor ? "CA-2026-0000123" : `CA-2026-${pad(1000000 + i, 7)}`;
  const reported = addDays(occ, ri(0, 3));
  const dmgId = uuid();
  const nParts = anchor ? 6 : ri(2, 7);
  // --total-loss-pct of non-anchor claims are severe so the total-loss gate is exercised across the set
  const severe = !anchor && rnd() < TL_PCT;
  const myParts = [];
  let repair = 0;
  for (let p = 0; p < nParts; p++) {
    const cost = anchor ? [1850, 1420, 980, 760, 540, 1181.55][p] : rf(150, 1900);
    repair += cost;
    myParts.push({ part_id: uuid(), damage_id: dmgId, part_name: anchor ? ["Rear Bumper","Trunk Lid","Left Quarter Panel","Right Quarter Panel","Tail Light Assy","Rear Sensor"][p] : pick(PART_NAMES),
      damage_severity: pick(["Minor","Moderate","Severe"]), labor_hours: rf(0.5, 8), part_cost: cost });
  }
  const acv = veh.acv;
  if (severe) {
    const factor = (acv * rf(0.75, 1.05)) / repair;
    for (const pt of myParts) pt.part_cost = +(pt.part_cost * factor).toFixed(2);
    repair = +myParts.reduce((s, pt) => s + pt.part_cost, 0).toFixed(2);
  } else {
    repair = anchor ? 6731.55 : +repair.toFixed(2);
  }
  for (const pt of myParts) parts.push(pt);
  const ratio = +(repair / acv).toFixed(3);
  let prob = anchor ? 0.71
    : severe ? Math.min(0.99, +(ratio * 0.95 + rf(0, 0.05)).toFixed(2))
    : Math.max(0, Math.min(0.99, +(ratio * 0.95 + rf(-0.05, 0.05)).toFixed(2)));
  const isTL = prob >= 0.70;
  damages.push({ damage_id: dmgId, vin: veh.vin, claim_number: cn, estimate_amount: repair, is_driveable: !isTL, is_total_loss: isTL, repair_facility_id: "RF-" + ri(100, 999) });
  tle.push({ evaluation_id: uuid(), vin: veh.vin, claim_number: cn, repair_cost_estimate: repair, actual_cash_value: acv, total_loss_ratio: ratio, total_loss_probability: prob, recommendation: isTL ? "total-loss-probable" : "repair" });

  const fs = anchor ? 0.04 : (rnd() < FRAUD_PCT ? rf(0.35, 0.9) : rf(0.0, 0.25));
  if (!anchor && fs > 0.3) fraud.push({ indicator_id: uuid(), claim_number: cn, indicator_type: pick(["LateReporting","PriorLossHistory","InconsistentStatement","StagedAccidentPattern"]), weight: rf(0.2, 0.5) });

  claims.push({ claim_number: cn, loss_event_id: leId, term_id: term.term_id, reported_at: iso(reported),
    date_of_loss: iso(occ), reporting_channel: anchor ? "MobileApp" : pick(CHANNEL),
    status: anchor ? "PendingCoverageDecision" : pick(["Open","UnderInvestigation","PendingCoverageDecision","PendingPayment","Closed"]),
    line_of_business: "PersonalAuto", severity_tier: isTL ? "High" : pick(["Low","Medium"]),
    total_incurred: repair, fraud_score: fs, assigned_adjuster_id: anchor ? derek.adjuster_id : pick(adjusters).adjuster_id });

  const collCov = coverages.find(c => c.term_id === term.term_id && c.coverage_code === "COLL");
  const ded = collCov ? +collCov.deductible || 0 : 500;
  const paid = (anchor || pick([true, false])) ? +(Math.max(0, repair - ded)).toFixed(2) : 0;
  exposures.push({ exposure_id: uuid(), claim_number: cn, claimant_id: cm.claimant_id, coverage_id: collCov ? collCov.coverage_id : "", coverage_code: "COLL", exposure_type: "Collision",
    status: paid > 0 ? "PendingPayment" : "Open", reserve_amount: +(repair).toFixed(2), paid_to_date: paid, opened_at: iso(reported) });
  if (rnd() < 0.6) {
    const rentCov = coverages.find(c => c.term_id === term.term_id && c.coverage_code === "RENT");
    exposures.push({ exposure_id: uuid(), claim_number: cn, claimant_id: cm.claimant_id, coverage_id: rentCov ? rentCov.coverage_id : "", coverage_code: "RENT", exposure_type: "Rental",
      status: "Open", reserve_amount: 1200, paid_to_date: 0, opened_at: iso(reported) });
  }
  if (paid > 0) payments.push({ payment_id: uuid(), exposure_id: exposures[exposures.length - (rnd() < 0.6 ? 2 : 1)].exposure_id, payee_person_id: cm.person_id,
    approved_by_adjuster_id: derek.adjuster_id, amount: paid, payment_method: pick(["ACH","Check","DigitalWallet"]), payment_type: "Indemnity", issued_at: iso(addDays(reported, 2)), cleared_at: iso(addDays(reported, 4)) });
}

buildClaim(0, true); // anchor first
for (let i = 1; i < N.claim; i++) buildClaim(i, false);

// ---- multimodal evidence layer (issues #9 D1 / #11 X1): evidence, consent, transcript, visual_evidence, document ----
// Keyed to the claims/loss_events/damages above so the new ontology entities + relationships resolve.
const evidence = [], consents = [], transcripts = [], visualEvidence = [], documents = [];
for (const c of claims) {
  const dmg = damages.find(d => d.claim_number === c.claim_number);
  const photoId = uuid();
  evidence.push({ evidence_id: photoId, claim_number: c.claim_number, evidence_type: "photo", uri: `onelake://claims/${c.claim_number}/photo.jpg`, source: "claimant-upload", captured_at: c.reported_at, pii_redaction_applied: true });
  if (dmg) visualEvidence.push({ visual_evidence_id: uuid(), evidence_id: photoId, damage_id: dmg.damage_id, modality: "image", confidence: rf(0.70, 0.99) });
  if (rnd() < 0.35) { // dashcam/blackbox needs audit-grade consent
    const clipId = uuid(); const etype = pick(["dashcam-clip", "blackbox-telemetry"]);
    evidence.push({ evidence_id: clipId, claim_number: c.claim_number, evidence_type: etype, uri: `onelake://claims/${c.claim_number}/clip`, source: "telematics", captured_at: c.date_of_loss, pii_redaction_applied: true });
    consents.push({ consent_id: uuid(), evidence_id: clipId, consent_type: etype === "dashcam-clip" ? "dashcam_access" : "blackbox_diagnostics", decision: pick(["granted", "granted", "denied"]), capture_channel: "mobile_pwa", capture_actor: "policyholder", captured_at: c.reported_at });
  }
  if (["Phone", "Agent", "Chatbot"].includes(c.reporting_channel))
    transcripts.push({ transcript_id: uuid(), loss_event_id: c.loss_event_id, language: "en-US", captured_via: c.reporting_channel === "Agent" ? "Agent" : "Phone", captured_at: c.reported_at });
  if (rnd() < 0.4) documents.push({ document_id: uuid(), claim_number: c.claim_number, doc_type: "police-report" });
}

// ---- write all ----
console.log(`\nparams: count=${N.claim} total-loss-pct=${TL_PCT} fraud-pct=${FRAUD_PCT} seed=${SEED} out=${OUT}\n`);
console.log("table".padEnd(24), "rows");
csv("party_person", persons);
csv("adjuster", adjusters);
csv("loss_location", locations);
csv("policy", policies);
csv("policy_term", terms);
csv("coverage", coverages);
csv("vehicle", vehicles);
csv("claimant", claimants);
csv("loss_event", lossEvents);
csv("loss_event_vehicle", leVeh);
csv("loss_event_party", leParty);
csv("claim", claims);
csv("exposure", exposures);
csv("vehicle_damage", damages);
csv("damage_part", parts);
csv("total_loss_evaluation", tle);
csv("fraud_indicator", fraud);
csv("payment", payments);
csv("evidence", evidence);
csv("consent", consents);
csv("transcript", transcripts);
csv("visual_evidence", visualEvidence);
csv("document", documents);

const a = tle.find(t => t.claim_number === "CA-2026-0000123");
const tlCount = tle.filter(t => t.total_loss_probability >= 0.70).length;
const fraudCount = claims.filter(c => c.fraud_score > 0.3).length;
console.log("\nAnchor CA-2026-0000123:", JSON.stringify(a));
console.log(`Total-loss (>=0.70): ${tlCount} of ${tle.length} (${(100 * tlCount / tle.length).toFixed(1)}%)`);
console.log(`Fraud-flagged (>0.30): ${fraudCount} of ${claims.length} (${(100 * fraudCount / claims.length).toFixed(1)}%)`);
