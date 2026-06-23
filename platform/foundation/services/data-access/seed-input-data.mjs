// Deterministic synthetic claims generator (no LLM, no network).
// Faker-style internal pools + a seeded PRNG → same seed yields identical output.
// Produces >=25 {policy, claim} records across all 4 sub-types and a spread of
// decision-relevant attributes, all valid against the Item 1 input schemas.
// Side outputs: out/claims.jsonl, out/labels.jsonl (expected outcomes = eval fixtures), out/summary.json
//
// Usage:  node generate.mjs [--seed 42] [--count 30]
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = resolve(here, "../../../docs/design/data-semantic-layer/contracts/input/schemas");
const outDir = join(here, "data");

// ---- args ----
const argv = process.argv.slice(2);
const getArg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEED = Number(getArg("--seed", 42));
const COUNT = Number(getArg("--count", 30));

// ---- seeded PRNG (mulberry32) — deterministic ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p) => rnd() < p;
const pad = (n, w) => String(n).padStart(w, "0");

// ---- Faker-style pools (non-PII synthetic; swap for a real Faker lib later) ----
const first = ["Maya", "Derek", "Priya", "Sofia", "Liam", "Noah", "Ava", "Ethan", "Mia", "Lucas", "Isla", "Mateo", "Zoe", "Aria", "Kai"];
const last = ["Alvarez", "Okafor", "Nair", "Romano", "Chen", "Patel", "Nguyen", "Garcia", "Khan", "Silva", "Brooks", "Reyes", "Holt", "Vance", "Ito"];
const cities = [
  { city: "San Jose", zip: "95126", lat: 37.3251, lon: -121.8967 },
  { city: "San Francisco", zip: "94158", lat: 37.7706, lon: -122.3893 },
  { city: "Oakland", zip: "94612", lat: 37.8044, lon: -122.2712 },
  { city: "Sacramento", zip: "95814", lat: 38.5688, lon: -121.4905 },
  { city: "Fresno", zip: "93721", lat: 36.7378, lon: -119.7871 },
  { city: "Long Beach", zip: "90802", lat: 33.7701, lon: -118.1937 },
];
const makes = [["Honda", ["Accord", "Civic", "CR-V"]], ["Toyota", ["Camry", "Corolla", "Prius"]], ["Tesla", ["Model 3", "Model Y"]], ["Ford", ["F-150", "Escape"]], ["Chevrolet", ["Malibu", "Equinox"]]];
const streets = ["Laurel Ave", "Mission Bay Blvd", "Telegraph Ave", "Crescent Dr", "Van Ness Ave", "Shaw Ave"];
const VINCHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; // excludes I, O, Q
const vin = () => Array.from({ length: 17 }, () => VINCHARS[Math.floor(rnd() * VINCHARS.length)]).join("");
const subtypes = ["FirstPartyCollision", "TheftRecovery", "HitAndRun", "MultiVehicle"];

function isoDate(y, m, d) { return `${y}-${pad(m, 2)}-${pad(d, 2)}`; }
function isoDateTime(mo, d, h) { return `2026-${pad(mo, 2)}-${pad(d, 2)}T${pad(h, 2)}:${pad(int(0, 59), 2)}:00Z`; }

function makePolicy(idx) {
  const [mk, models] = pick(makes);
  const c = pick(cities);
  const base = [{ code: "COLL", limitPerOccurrence: pick([45000, 50000, 60000]), deductible: pick([500, 750, 1000]) }];
  if (chance(0.8)) base.push({ code: "COMP", limitPerOccurrence: 40000, deductible: 500 });
  if (chance(0.6)) base.push({ code: "RENT", limitPerOccurrence: 900, rentalDailyLimit: 50, rentalMaxDays: 30 });
  if (chance(0.5)) base.push({ code: "TOW", limitPerOccurrence: 200 });
  if (chance(0.4)) base.push({ code: "MEDPAY", limitPerOccurrence: pick([5000, 10000]) });
  return {
    policyNumber: `CA-AUTO-${pick([2024, 2025])}-${pad(1000 + idx, 4)}`,
    lineOfBusiness: "PersonalAuto",
    status: chance(0.95) ? "active" : "lapsed",
    effectiveDate: isoDate(2024, int(1, 12), int(1, 28)),
    expirationDate: isoDate(2026, int(1, 12), int(1, 28)),
    ratingState: "CA",
    namedInsured: { name: `${pick(first)} ${pick(last)}`, partyRef: `party_${idx}`, address: { line1: `${int(1, 999)} ${pick(streets)}`, city: c.city, state: "CA", postalCode: c.zip } },
    coverages: base,
    exclusions: [],
    endorsements: [],
    vehicles: [{ vin: vin(), year: int(2018, 2025), make: mk, model: pick(models), garagingState: "CA" }],
  };
}

function makeClaim(idx, policy, lossType) {
  const c = pick(cities);
  const insuredVin = policy.vehicles[0].vin;
  const injury = lossType === "MultiVehicle" ? chance(0.6) : chance(0.15);
  const drivable = !chance(lossType === "FirstPartyCollision" ? 0.55 : 0.3);
  const channel = pick(["Phone", "MobileApp", "Web", "Agent", "Telematics", "IoTCrashDetection"]);
  const narrChannel = ["Telematics", "IoTCrashDetection"].includes(channel) ? "MobileApp" : channel; // keep within narrative enum
  const vehicles = [{ vin: insuredVin, role: "insured-vehicle", drivable, reportedDamageAreas: pick([["front"], ["rear", "bumper"], ["front", "front-left", "engine-bay"], ["side"]]) }];
  if (lossType === "HitAndRun") vehicles.push({ role: "third-party-vehicle", drivable: true, reportedDamageAreas: [] });
  if (lossType === "MultiVehicle") { vehicles.push({ role: "third-party-vehicle", drivable: false, reportedDamageAreas: ["rear"] }); if (chance(0.5)) vehicles.push({ role: "third-party-vehicle", drivable: true, reportedDamageAreas: ["side"] }); }
  const hasPolice = lossType !== "FirstPartyCollision" ? chance(0.8) : chance(0.2);
  const claim = {
    claimId: `CA-2026-${pad(1000 + idx, 7)}`,
    policyNumber: policy.policyNumber,
    lossType,
    lossDate: isoDateTime(int(4, 6), int(1, 28), int(0, 23)),
    reportDate: isoDateTime(int(4, 6), int(1, 28), int(0, 23)),
    reportingChannel: channel,
    lossLocation: { line1: `${pick(streets)} & ${int(1, 30)}th St`, city: c.city, state: "CA", postalCode: c.zip, geocode: { latitude: c.lat, longitude: c.lon } },
    claimant: { partyRef: policy.namedInsured.partyRef, name: policy.namedInsured.name, role: "named-insured", contactPhone: `+1-${int(200, 999)}-555-${pad(int(0, 9999), 4)}` },
    involvedVehicles: vehicles,
    injuryReported: injury,
    narrative: {
      text: NARR[lossType], language: "en-US", capturedVia: narrChannel, capturedAt: isoDateTime(6, int(1, 28), int(0, 23)), piiRedactionApplied: true,
      extractedSignals: { injuryMentioned: injury, vehicleDrivable: drivable, otherPartiesMentioned: vehicles.length - 1, policeReportMentioned: hasPolice },
    },
    evidence: [{ evidenceId: `asset_photo_${idx}`, type: "photo", uri: `onelake://claims/CA-2026-${pad(1000 + idx, 7)}/photo.jpg`, mimeType: "image/jpeg", capturedAt: isoDateTime(6, int(1, 28), int(0, 23)), source: "claimant-upload", label: "damage", consent: { required: false, decision: "not-applicable", consentType: "none" }, piiRedactionApplied: true }],
  };
  if (hasPolice) claim.policeReportNumber = `${pick(["SFPD", "OPD", "CHP", "SJPD"])}-2026-${pad(int(1, 999999), 6)}`;
  // consented dashcam/blackbox on a fraction → exercises the consent path
  if (chance(0.35)) claim.evidence.push({ evidenceId: `asset_dashcam_${idx}`, type: pick(["dashcam-clip", "blackbox-telemetry"]), uri: `onelake://claims/CA-2026-${pad(1000 + idx, 7)}/clip.mp4`, mimeType: "video/mp4", capturedAt: isoDateTime(6, int(1, 28), int(0, 23)), source: "telematics", label: "impact", consent: { required: true, decision: pick(["granted", "granted", "denied"]), consentType: "dashcam_access", capturedAt: isoDateTime(6, int(1, 28), int(0, 23)), captureChannel: "mobile_pwa", captureActor: "policyholder", provider: "DriveSync" }, piiRedactionApplied: true });
  return claim;
}
const NARR = {
  FirstPartyCollision: "I lost control and hit a barrier. The front end is badly damaged.",
  TheftRecovery: "My vehicle was stolen and later recovered with damage.",
  HitAndRun: "Another vehicle hit mine and drove off before I got the plate.",
  MultiVehicle: "Traffic stopped suddenly and several vehicles collided in a chain.",
};

// label = expected downstream outcome (eval fixture; not part of the strict claim schema)
function label(claim, policy) {
  const tlp = claim.lossType === "FirstPartyCollision" && !claim.involvedVehicles[0].drivable ? +(0.6 + rnd() * 0.35).toFixed(2) : +(rnd() * 0.5).toFixed(2);
  const hasColl = policy.coverages.some((c) => c.code === "COLL");
  return {
    claimId: claim.claimId,
    expectedTriage: claim.injuryReported || claim.lossType === "MultiVehicle" ? "HITL" : "STP",
    expectedFraud: claim.lossType === "TheftRecovery" && rnd() < 0.25 ? "flagged" : "clean",
    expectedCoverage: policy.status !== "active" ? "adverse" : hasColl ? "covered" : "partial",
    totalLossProbability: tlp,
    expectedGate: tlp >= 0.7 ? "G3" : claim.injuryReported ? "G2" : "none",
  };
}

// ---- minimal offline schema validator (subset; mirrors contracts/input/validate.mjs) ----
const cache = new Map();
const loadSchema = (f) => { const p = resolve(schemaDir, f); if (!cache.has(p)) cache.set(p, JSON.parse(readFileSync(p, "utf8"))); return cache.get(p); };
const dateRe = /^\d{4}-\d{2}-\d{2}$/, dtRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
function rref(ref, root) { if (ref.startsWith("#/")) return { s: ref.slice(2).split("/").reduce((o, k) => o[k], root), r: root }; const [f, frag] = ref.split("#"); const nr = loadSchema(f); return { s: frag ? frag.slice(1).split("/").filter(Boolean).reduce((o, k) => o[k], nr) : nr, r: nr }; }
function val(d, s, root, path, e) {
  if (s.$ref) { const x = rref(s.$ref, root); return val(d, x.s, x.r, path, e); }
  if (s.type === "object") { if (!d || typeof d !== "object" || Array.isArray(d)) return e.push(`${path}: object`); for (const r of s.required || []) if (!(r in d)) e.push(`${path}.${r}: required`); if (s.additionalProperties === false) for (const k of Object.keys(d)) if (!(s.properties && k in s.properties)) e.push(`${path}.${k}: extra`); for (const [k, sub] of Object.entries(s.properties || {})) if (k in d) val(d[k], sub, root, `${path}.${k}`, e); }
  else if (s.type === "array") { if (!Array.isArray(d)) return e.push(`${path}: array`); if (s.minItems != null && d.length < s.minItems) e.push(`${path}: minItems`); if (s.items) d.forEach((it, i) => val(it, s.items, root, `${path}[${i}]`, e)); }
  else if (s.type === "string") { if (typeof d !== "string") return e.push(`${path}: string`); if (s.pattern && !new RegExp(s.pattern).test(d)) e.push(`${path}: pattern (${d})`); if (s.format === "date" && !dateRe.test(d)) e.push(`${path}: date`); if (s.format === "date-time" && !dtRe.test(d)) e.push(`${path}: date-time`); }
  else if (s.type === "number" || s.type === "integer") { if (typeof d !== "number") return e.push(`${path}: ${s.type}`); if (s.minimum != null && d < s.minimum) e.push(`${path}: min`); if (s.maximum != null && d > s.maximum) e.push(`${path}: max`); }
  else if (s.type === "boolean") { if (typeof d !== "boolean") e.push(`${path}: boolean`); }
  if (s.enum && !s.enum.includes(d)) e.push(`${path}: enum (${d})`);
  if (s.const !== undefined && d !== s.const) e.push(`${path}: const`);
}

// ---- generate ----
mkdirSync(outDir, { recursive: true });
const policySchema = loadSchema("policy.schema.json"), claimSchema = loadSchema("claim.schema.json");
const claimsOut = [], labelsOut = [], summary = { seed: SEED, count: COUNT, bySubtype: {}, totalLossCount: 0, hitlCount: 0, adverseCount: 0, invalid: 0 };
for (let i = 0; i < COUNT; i++) {
  const lossType = subtypes[i % subtypes.length]; // even spread, then random extras
  const policy = makePolicy(i);
  const claim = makeClaim(i, policy, lossType);
  const lab = label(claim, policy);
  const e = [];
  val(policy, policySchema, policySchema, "policy", e);
  val(claim, claimSchema, claimSchema, "claim", e);
  if (e.length) { summary.invalid++; console.error(`INVALID ${claim.claimId}:`, e.slice(0, 3)); }
  summary.bySubtype[lossType] = (summary.bySubtype[lossType] || 0) + 1;
  if (lab.totalLossProbability >= 0.7) summary.totalLossCount++;
  if (lab.expectedTriage === "HITL") summary.hitlCount++;
  if (lab.expectedCoverage === "adverse") summary.adverseCount++;
  claimsOut.push(JSON.stringify({ policy, claim }));
  labelsOut.push(JSON.stringify(lab));
}
writeFileSync(join(outDir, "claims.jsonl"), claimsOut.join("\n") + "\n");
writeFileSync(join(outDir, "labels.jsonl"), labelsOut.join("\n") + "\n");
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`Generated ${COUNT} claims (seed ${SEED}). Invalid: ${summary.invalid}`);
console.log("Subtypes:", summary.bySubtype, "| total-loss:", summary.totalLossCount, "| HITL:", summary.hitlCount, "| adverse:", summary.adverseCount);
process.exit(summary.invalid ? 1 : 0);
