// Build the ADP Claims Ontology as a Fabric semantic model (Direct Lake over the adp lakehouse).
// 23-entity domain graph + business rules as DAX measures + glossary + PII object-level security.
// Creates/refreshes item "claims_ontology". env: FAB_TOKEN (api.fabric), STG_TOKEN (storage)
const WS = process.env.WORKSPACE_ID || "12b39202-bbf7-4985-8eb1-541b3cde0071";
const LH = process.env.LAKEHOUSE_ID || "7ad533bb-706e-4528-b9d4-f6cd86cbf5dd";
const SQL_SERVER = process.env.SQL_SERVER || "vlbqw5fplx3efe42wliapjqney-akjlgexxxocutdvrkqntzxqaoe.datawarehouse.fabric.microsoft.com";
const DB = process.env.LAKEHOUSE_NAME || "adp";
const ITEM = "claims_ontology";
const FAB = process.env.FAB_TOKEN, STG = process.env.STG_TOKEN;

const TABLES = ["party_person","adjuster","loss_location","policy","policy_term","coverage","vehicle","claimant","loss_event","loss_event_vehicle","loss_event_party","claim","exposure","vehicle_damage","damage_part","total_loss_evaluation","fraud_indicator","payment","evidence","consent","transcript","visual_evidence","document"];
const dt = t => ({ string:"string", timestamp:"dateTime", date:"dateTime", double:"double", float:"double", integer:"int64", long:"int64", boolean:"boolean" }[String(t).toLowerCase()] || "string");

const REL = [
  ["exposure","claim_number","claim","claim_number",true],
  ["exposure","coverage_id","coverage","coverage_id",true],
  ["exposure","claimant_id","claimant","claimant_id",true],
  ["claim","loss_event_id","loss_event","loss_event_id",true],
  ["claim","assigned_adjuster_id","adjuster","adjuster_id",true],
  ["loss_event","location_id","loss_location","location_id",true],
  ["coverage","term_id","policy_term","term_id",true],
  ["policy_term","policy_number","policy","policy_number",true],
  ["claimant","person_id","party_person","person_id",true],
  ["vehicle_damage","vin","vehicle","vin",true],
  ["damage_part","damage_id","vehicle_damage","damage_id",true],
  ["total_loss_evaluation","vin","vehicle","vin",true],
  ["fraud_indicator","claim_number","claim","claim_number",true],
  ["payment","exposure_id","exposure","exposure_id",true],
  ["claim","term_id","policy_term","term_id",false],
  ["vehicle","owner_person_id","party_person","person_id",false],
  ["policy","named_insured_person_id","party_person","person_id",false],
  ["vehicle_damage","claim_number","claim","claim_number",false],
  ["total_loss_evaluation","claim_number","claim","claim_number",false],
  ["payment","payee_person_id","party_person","person_id",false],
  ["payment","approved_by_adjuster_id","adjuster","adjuster_id",false],
  ["loss_event_vehicle","loss_event_id","loss_event","loss_event_id",false],
  ["loss_event_vehicle","vin","vehicle","vin",false],
  ["loss_event_party","loss_event_id","loss_event","loss_event_id",false],
  ["loss_event_party","person_id","party_person","person_id",false],
  // multimodal evidence layer
  ["evidence","claim_number","claim","claim_number",true],
  ["consent","evidence_id","evidence","evidence_id",true],
  ["transcript","loss_event_id","loss_event","loss_event_id",true],
  ["visual_evidence","evidence_id","evidence","evidence_id",true],
  ["visual_evidence","damage_id","vehicle_damage","damage_id",false],
  ["document","claim_number","claim","claim_number",false],
];

// business glossary
const TDESC = {
  claim:"Claim (aggregate root): a reported loss under a policy. Canonical id claim_number.",
  loss_event:"The real-world incident giving rise to the claim.",
  loss_location:"Geocoded location of the loss event.",
  policy:"Insurance policy contract identity.",
  policy_term:"Time-bounded policy instance; determines coverage at date of loss.",
  coverage:"Coverage line on a policy term (COLL/COMP/RENT...). Deductible and limits modeled here.",
  party_person:"Identity hub for persons (insured, claimant, payee). Contains Confidential-PII.",
  claimant:"A party making a claim demand (FirstParty in the alpha wedge).",
  adjuster:"Licensed claims adjuster; authority level + specialty.",
  vehicle:"Insured vehicle; actual cash value (acv) drives the total-loss decision.",
  vehicle_damage:"Assessed damage on a vehicle for a claim.",
  damage_part:"Individual damaged part with labor + part cost.",
  total_loss_evaluation:"Total-loss assessment. Drives the G3 hard gate (rule R-TL-001 v1.0.0).",
  exposure:"Coverage-applied financial dimension of a claim, per claimant per coverage.",
  fraud_indicator:"A single fraud red flag; accumulates into claim.fraud_score (G1 signal).",
  payment:"Indemnity/expense payment on an exposure.",
  loss_event_vehicle:"Link: loss event to involved vehicles.",
  loss_event_party:"Link: loss event to involved parties (with role).",
  evidence:"Multimodal evidence reference for a claim (photo/video/document/dashcam/transcript). PII-minimized: uri + metadata only.",
  consent:"Audit-grade consent record on evidence (dashcam/blackbox). First-class legal artifact (NAIC / fair-claims).",
  transcript:"Normalized voice/FNOL transcript for a loss event (speaker turns, language, capture channel).",
  visual_evidence:"Structured visual-evidence extraction depicting vehicle damage (modality + confidence).",
  document:"Document artifact corroborating a claim (e.g., police report)."
};
const CDESC = {
  "claim.fraud_score":"0.00-1.00 fraud score; >= 0.30 raises the G1 fraud signal.",
  "total_loss_evaluation.total_loss_probability":"0.00-1.00; >= 0.70 trips the G3 hard gate (R-TL-001 v1.0.0).",
  "total_loss_evaluation.total_loss_ratio":"repair_cost_estimate / actual_cash_value.",
  "vehicle.acv":"Actual cash value at date of loss; denominator of the total-loss ratio.",
  "coverage.deductible":"Out-of-pocket before coverage pays (e.g., 500 for COLL).",
  "party_person.date_of_birth":"Confidential-PII (governed by R-PTY-001).",
  "party_person.driver_license_number":"Confidential-PII (governed by R-PTY-001)."
};

// business rules as DAX measures (Fabric-native rule encoding)
const MEAS = {
  total_loss_evaluation: [
    { name:"Total Loss Count", expression:"CALCULATE(COUNTROWS('total_loss_evaluation'), 'total_loss_evaluation'[total_loss_probability] >= 0.70)", description:"Claims crossing the G3 total-loss threshold (rule R-TL-001)." },
    { name:"Total Loss Rate %", expression:"DIVIDE([Total Loss Count], COUNTROWS('total_loss_evaluation'))", formatString:"0.0%" },
    { name:"G3 Total Loss Gate", expression:"VAR p = SELECTEDVALUE('total_loss_evaluation'[total_loss_probability]) RETURN IF(p >= 0.70, \"TRIP - licensed-adjuster required\", \"clear\")", description:"Encodes gate rule R-TL-001 v1.0.0: totalLossProbability >= 0.70 (hard, licensed-adjuster)." }
  ],
  claim: [
    { name:"Clean Claim Rate %", expression:"DIVIDE(CALCULATE(COUNTROWS('claim'), 'claim'[fraud_score] < 0.30), COUNTROWS('claim'))", formatString:"0.0%" },
    { name:"Fraud Signal", expression:"VAR f = SELECTEDVALUE('claim'[fraud_score]) RETURN IF(f >= 0.30, \"flagged\", \"clean\")", description:"G1 fraud signal (R-TRG-001)." }
  ]
};

async function schema(t) {
  const r = await fetch(`https://onelake.dfs.fabric.microsoft.com/${WS}/${LH}/Tables/${t}/_delta_log/00000000000000000000.json`, { headers: { Authorization: `Bearer ${STG}` } });
  const text = await r.text();
  for (const l of text.trim().split("\n")) { try { const o = JSON.parse(l); if (o.metaData) return JSON.parse(o.metaData.schemaString).fields; } catch {} }
  throw new Error("no schema for " + t);
}

let g = 1; const guid = () => `00000000-0000-0000-0000-${String(g++).padStart(12,"0")}`;

const tables = [];
for (const t of TABLES) {
  const fields = await schema(t);
  const tab = {
    name: t,
    ...(TDESC[t] ? { description: TDESC[t] } : {}),
    columns: fields.map(f => ({ name: f.name, dataType: dt(f.type), sourceColumn: f.name, summarizeBy: "none", ...(CDESC[`${t}.${f.name}`] ? { description: CDESC[`${t}.${f.name}`] } : {}) })),
    partitions: [{ name: t, mode: "directLake", source: { type: "entity", entityName: t, schemaName: "dbo", expressionSource: "DatabaseQuery" } }]
  };
  if (MEAS[t]) tab.measures = MEAS[t];
  tables.push(tab);
}

const relationships = REL.map(([ft, fc, tt, tc, act]) => ({
  name: guid(), fromTable: ft, fromColumn: fc, toTable: tt, toColumn: tc,
  crossFilteringBehavior: "oneDirection", ...(act ? {} : { isActive: false })
}));

const roles = [{
  name: "PII-Restricted", modelPermission: "read",
  tablePermissions: [{ name: "party_person", columnPermissions: [
    { name: "date_of_birth", metadataPermission: "none" },
    { name: "driver_license_number", metadataPermission: "none" }
  ] }]
}];

const bim = {
  name: ITEM, compatibilityLevel: 1604,
  model: {
    culture: "en-US", defaultPowerBIDataSourceVersion: "powerBI_V3", discourageImplicitMeasures: true,
    expressions: [{ name: "DatabaseQuery", kind: "m", expression: `let\n    database = Sql.Database("${SQL_SERVER}", "${DB}")\nin\n    database` }],
    tables, relationships, roles
  }
};

const b64 = s => Buffer.from(s, "utf8").toString("base64");
const FH = { Authorization: `Bearer ${FAB}` };

// clean rebuild: delete any existing claims_ontology
const list = await (await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${WS}/items`, { headers: FH })).json();
for (const it of (list.value || [])) {
  if (it.displayName === ITEM && it.type === "SemanticModel") {
    const d = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${WS}/items/${it.id}`, { method: "DELETE", headers: FH });
    console.log("deleted existing", it.id, d.status);
  }
}

const body = {
  displayName: ITEM, type: "SemanticModel",
  description: "ADP Claims Ontology: 23-entity Fabric semantic model (Direct Lake) - domain graph incl. multimodal evidence/consent, gate rules as DAX (G3 R-TL-001, G1 R-TRG-001), glossary, PII OLS (R-PTY-001).",
  definition: { parts: [
    { path: "definition.pbism", payload: b64(JSON.stringify({ version: "4.0", settings: {} })), payloadType: "InlineBase64" },
    { path: "model.bim", payload: b64(JSON.stringify(bim)), payloadType: "InlineBase64" }
  ] }
};

const measCount = Object.values(MEAS).reduce((s,a)=>s+a.length,0);
console.log(`tables=${tables.length} relationships=${relationships.length} (active=${REL.filter(r=>r[4]).length}) measures=${measCount} roles=${roles.length}`);
const r = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${WS}/items`, { method: "POST", headers: { ...FH, "Content-Type": "application/json" }, body: JSON.stringify(body) });
console.log("create status:", r.status);
if (r.status === 202) {
  const op = r.headers.get("location"); const sleep = ms => new Promise(x => setTimeout(x, ms));
  for (let i = 0; i < 40; i++) { await sleep(3000); const s = await fetch(op, { headers: FH }); const j = await s.json().catch(() => ({})); if (j.status === "Succeeded") { console.log("CREATED claims_ontology:", JSON.stringify(j)); break; } if (j.status === "Failed") { console.log("FAILED:", JSON.stringify(j.error || j)); break; } }
} else { console.log(await r.text()); }
