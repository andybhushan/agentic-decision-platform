// Configure the ADP claims_data_agent (data sources + instructions) via updateDefinition.
// Mirrors the working IMAGINE claims_data_agent definition, repointed to the adp workspace items.
import { readFileSync } from "node:fs";

const WS = "12b39202-bbf7-4985-8eb1-541b3cde0071";
const DA = "33eb2030-bcf7-45f8-b0f0-62fe9c1d62a5";          // adp claims_data_agent
const LAKEHOUSE = "7ad533bb-706e-4528-b9d4-f6cd86cbf5dd";   // adp lakehouse
const SEMANTIC = "7153d34c-be3d-42f2-b7c9-237c0736c12d";    // claims_semantic
const GRAPH = "d77214e6-bd0a-4a5a-bfe9-dac2b2e6a7bc";       // claims_ontology_graph
const FAB = process.env.FAB_TOKEN;
const FH = { Authorization: `Bearer ${FAB}`, "Content-Type": "application/json" };

// reuse the governed instructions from the IMAGINE template (already generic / de-branded)
let aiInstructions = "You are the governed claims data agent over the auto-claims gold data product, the claims_semantic semantic model, and the claims ontology graph. Apply these policies directly so consuming agents get policy-correct, relationship-aware data.\n\nGate rules (versioned business policy):\n- Total loss: total_loss_probability >= 0.70 is a probable total loss (gate G3 -> licensed-adjuster approval). Use the semantic-model total-loss measures for rates.\n- Fraud: fraud_score >= 0.30 raises a soft gate (G1 -> adjuster review).\n- Coverage: an adverse coverage determination is a hard gate (G2 -> adjuster + supervisor).\n\nPII: never return party_person.date_of_birth or driver_license_number (object-level security).\nRouting: use the lakehouse for raw row lookups/filters/counts; the semantic model for rule-aware aggregates + glossary; the graph for relationship/traversal questions (Claim -> Exposure -> Coverage -> Policy; Claim -> LossEvent -> Vehicle).";
try { const j = JSON.parse(readFileSync("c:/Users/AnandBhushan/Desktop/MS DT/agentic-decision-platform/build/im-da-def.json", "utf8")); const sc = (j.definition.parts || []).find(p => p.path === "Files/Config/draft/stage_config.json"); if (sc) aiInstructions = JSON.parse(Buffer.from(sc.payload, "base64").toString()).aiInstructions; } catch {}

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o, null, 2)).toString("base64");
const ds = (type, name, artifactId, instr) => ({
  $schema: `https://developer.microsoft.com/json-schemas/fabric/item/dataAgent/definition/dataSource/1.0.0/schema.json`,
  artifactId, workspaceId: WS, dataSourceInstructions: instr, displayName: name, type, userDescription: null, metadata: {}, elements: [],
});
const stage = { $schema: "https://developer.microsoft.com/json-schemas/fabric/item/dataAgent/definition/stageConfiguration/1.0.0/schema.json", aiInstructions };
const lake = ds("lakehouse_tables", "adp", LAKEHOUSE, "Raw claim records + attributes (claim, exposure, coverage, policy, vehicle, loss_event, total_loss_evaluation, fraud_indicator, payment, evidence, consent, ...). Direct lookups, filters, counts, simple aggregates.");
const sem = ds("semantic_model", "claims_semantic", SEMANTIC, "Business meaning + versioned gate-rule measures (G3 Total Loss Gate, Fraud Signal, Total Loss Rate, Clean Claim Rate) + glossary. Rule-aware aggregates + definitions.");
const grph = ds("graph", "claims_ontology_graph", GRAPH, "Relationship/traversal: Claim -> Exposure -> Coverage -> PolicyTerm -> Policy; Claim -> LossEvent -> Vehicle. 'Which policy/coverage applies' + lineage answers.");

const mk = (stageDir) => ([
  { path: `Files/Config/${stageDir}/stage_config.json`, payload: b64(stage), payloadType: "InlineBase64" },
  { path: `Files/Config/${stageDir}/lakehouse-tables-adp/datasource.json`, payload: b64(lake), payloadType: "InlineBase64" },
  { path: `Files/Config/${stageDir}/semantic-model-claims_semantic/datasource.json`, payload: b64(sem), payloadType: "InlineBase64" },
  { path: `Files/Config/${stageDir}/graph-claims_ontology_graph/datasource.json`, payload: b64(grph), payloadType: "InlineBase64" },
]);

const parts = [
  { path: "Files/Config/data_agent.json", payload: b64({ $schema: "https://developer.microsoft.com/json-schemas/fabric/item/dataAgent/definition/dataAgent/2.1.0/schema.json" }), payloadType: "InlineBase64" },
  ...mk("draft"),
  { path: "Files/Config/publish_info.json", payload: b64({ $schema: "https://developer.microsoft.com/json-schemas/fabric/item/dataAgent/definition/publishInfo/1.0.0/schema.json", description: "ADP Claims Data Agent — ask claims questions in natural language." }), payloadType: "InlineBase64" },
  ...mk("published"),
  { path: ".platform", payload: b64({ $schema: "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json", metadata: { type: "DataAgent", displayName: "claims_data_agent" }, config: { version: "2.0", logicalId: "00000000-0000-0000-0000-000000000000" } }), payloadType: "InlineBase64" },
];

const r = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${WS}/items/${DA}/updateDefinition?updateMetadata=true`, { method: "POST", headers: FH, body: JSON.stringify({ definition: { parts } }) });
console.log("updateDefinition status:", r.status, " parts:", parts.length);
if (r.status === 202) {
  const op = r.headers.get("location"); const sleep = (ms) => new Promise(x => setTimeout(x, ms));
  for (let i = 0; i < 40; i++) { await sleep(4000); const s = await fetch(op, { headers: FH }); const j = await s.json().catch(() => ({})); if (j.status === "Succeeded") { console.log("CONFIGURED claims_data_agent"); break; } if (j.status === "Failed") { console.log("FAILED:", JSON.stringify(j.error || j)); break; } }
} else { console.log(await r.text()); }
