// Deploy the REAL Fabric IQ Ontology item (type "Ontology") on adp-v1 from the migrated 23-entity
// source, with DataBindings rebound to the adp lakehouse. env: FAB_TOKEN (api.fabric).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WS = process.env.WORKSPACE_ID || "12b39202-bbf7-4985-8eb1-541b3cde0071";
const LH = process.env.LAKEHOUSE_ID || "7ad533bb-706e-4528-b9d4-f6cd86cbf5dd";
const SRC = "C:/Users/AnandBhushan/Desktop/MS DT/agentic-decision-platform/usecases/meridian-pnc-auto-claims/ontology/fabric/claims_ontology";
const FAB = process.env.FAB_TOKEN;
const FH = { Authorization: `Bearer ${FAB}`, "Content-Type": "application/json" };

// walk the source folder -> parts, rebinding DataBindings to the adp lakehouse
const parts = [];
function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rel = relative(SRC, p).replace(/\\/g, "/");
    let content = readFileSync(p, "utf8");
    if (rel.includes("/DataBindings/")) {
      const o = JSON.parse(content);
      if (o.dataBindingConfiguration?.sourceTableProperties) {
        o.dataBindingConfiguration.sourceTableProperties.workspaceId = WS;
        o.dataBindingConfiguration.sourceTableProperties.itemId = LH;
      }
      content = JSON.stringify(o, null, 2);
    }
    parts.push({ path: rel, payload: Buffer.from(content, "utf8").toString("base64"), payloadType: "InlineBase64" });
  }
}
walk(SRC);
const ents = parts.filter((p) => /EntityTypes\/.*\/definition\.json$/.test(p.path)).length;
const dbs = parts.filter((p) => p.path.includes("/DataBindings/")).length;
console.log(`parts=${parts.length} entities=${ents} dataBindings(rebound)=${dbs}`);

const body = { displayName: "claims_ontology", type: "Ontology", description: "ADP Fabric IQ claims ontology: 23 entities + relationships + data bindings to the adp lakehouse.", definition: { parts } };
const r = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${WS}/items`, { method: "POST", headers: FH, body: JSON.stringify(body) });
console.log("create status:", r.status);
if (r.status === 202) {
  const op = r.headers.get("location"); const sleep = (ms) => new Promise((x) => setTimeout(x, ms));
  for (let i = 0; i < 60; i++) { await sleep(4000); const s = await fetch(op, { headers: FH }); const j = await s.json().catch(() => ({})); if (j.status === "Succeeded") { console.log("CREATED Ontology item claims_ontology"); break; } if (j.status === "Failed") { console.log("FAILED:", JSON.stringify(j.error || j)); break; } }
} else if (r.status === 201) { console.log("CREATED (201)"); }
else { console.log(await r.text()); }
