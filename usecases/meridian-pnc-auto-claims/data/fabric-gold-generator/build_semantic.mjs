// Build a Direct Lake semantic model over gold_claims with ontology relationships.
// Reads authoritative Delta schemas from OneLake, emits TMSL (model.bim), creates the item.
// env: FAB_TOKEN, STG_TOKEN
const WS = "26e07f51-7085-4ccb-aeb2-89231b462f92";
const LH = "4bee2408-b5c5-4b75-9263-2f28f618c3b9";
const SQL_SERVER = "vlbqw5fplx3efe42wliapjqney-kf76ajufodfuzlvsrerrwrrpsi.datawarehouse.fabric.microsoft.com";
const DB = "gold_claims";
const FAB = process.env.FAB_TOKEN, STG = process.env.STG_TOKEN;

const TABLES = ["party_person","adjuster","loss_location","policy","policy_term","coverage","vehicle","claimant","loss_event","loss_event_vehicle","loss_event_party","claim","exposure","vehicle_damage","damage_part","total_loss_evaluation","fraud_indicator","payment"];

// delta type -> TMSL dataType
const dt = t => ({ string:"string", timestamp:"dateTime", date:"dateTime", double:"double", float:"double", integer:"int64", long:"int64", boolean:"boolean" }[String(t).toLowerCase()] || "string");

// curated relationships: [fromTable, fromCol, toTable, toCol, isActive]
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
  // secondary paths kept INACTIVE to avoid ambiguity (still visible in the graph)
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
];

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
  tables.push({
    name: t,
    columns: fields.map(f => ({ name: f.name, dataType: dt(f.type), sourceColumn: f.name, summarizeBy: "none" })),
    partitions: [{ name: t, mode: "directLake", source: { type: "entity", entityName: t, schemaName: "dbo", expressionSource: "DatabaseQuery" } }]
  });
}

const relationships = REL.map(([ft, fc, tt, tc, act]) => ({
  name: guid(), fromTable: ft, fromColumn: fc, toTable: tt, toColumn: tc,
  crossFilteringBehavior: "oneDirection", ...(act ? {} : { isActive: false })
}));

const bim = {
  name: "gold_claims_semantic", compatibilityLevel: 1604,
  model: {
    culture: "en-US", defaultPowerBIDataSourceVersion: "powerBI_V3", discourageImplicitMeasures: true,
    expressions: [{ name: "DatabaseQuery", kind: "m",
      expression: `let\n    database = Sql.Database("${SQL_SERVER}", "${DB}")\nin\n    database` }],
    tables, relationships
  }
};

const b64 = s => Buffer.from(s, "utf8").toString("base64");
const body = {
  displayName: "gold_claims_semantic", type: "SemanticModel",
  description: "IMAGINE claims semantic model (Direct Lake over gold_claims) with ontology relationships. Ontology-equivalent layer pending Fabric IQ enablement.",
  definition: { parts: [
    { path: "definition.pbism", payload: b64(JSON.stringify({ version: "4.0", settings: {} })), payloadType: "InlineBase64" },
    { path: "model.bim", payload: b64(JSON.stringify(bim)), payloadType: "InlineBase64" }
  ] }
};

console.log(`tables=${tables.length} relationships=${relationships.length} (active=${REL.filter(r=>r[4]).length})`);
const r = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${WS}/items`, {
  method: "POST", headers: { Authorization: `Bearer ${FAB}`, "Content-Type": "application/json" }, body: JSON.stringify(body)
});
console.log("create status:", r.status);
if (r.status === 202) {
  const op = r.headers.get("location"); const sleep = ms => new Promise(x => setTimeout(x, ms));
  for (let i = 0; i < 30; i++) { await sleep(3000); const s = await fetch(op, { headers: { Authorization: `Bearer ${FAB}` } }); const j = await s.json().catch(() => ({})); if (j.status === "Succeeded") { console.log("created:", JSON.stringify(j)); break; } if (j.status === "Failed") { console.log("FAILED:", JSON.stringify(j.error || j)); break; } }
} else { console.log(await r.text()); }
