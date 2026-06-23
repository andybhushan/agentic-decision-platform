// Upload gold CSVs to OneLake Files/landing and load each into a Delta table (gold-first).
// Tokens: FAB_TOKEN (api.fabric.microsoft.com) + STG_TOKEN (storage.azure.com). If unset,
// auto-acquired via `az account get-access-token` for SUBSCRIPTION (requires `az login`).
//
// Config via env (defaults target the auto-claims-dev workspace):
//   WORKSPACE_ID   Fabric workspace id   (default 26e07f51-...)
//   LAKEHOUSE_ID   gold lakehouse id     (default 4bee2408-...)
//   SUBSCRIPTION   Azure sub for az token (default e3dfdb01-... = sub-ibmc-projAdp-dev)
//   DATA_DIR       CSV directory          (default ./data)
//
// Run: node load.mjs        (after `node generate.mjs` and `az login`)
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

const WS = process.env.WORKSPACE_ID || "26e07f51-7085-4ccb-aeb2-89231b462f92";
const LH = process.env.LAKEHOUSE_ID || "4bee2408-b5c5-4b75-9263-2f28f618c3b9";
const SUB = process.env.SUBSCRIPTION || "e3dfdb01-3d0d-45ad-b8d1-e145c32e2758";
const DATA_DIR = process.env.DATA_DIR || "./data";

function azToken(resource) {
  return execSync(`az account get-access-token --resource ${resource} --subscription ${SUB} --query accessToken -o tsv`, { encoding: "utf8" }).trim();
}
const FAB = process.env.FAB_TOKEN || azToken("https://api.fabric.microsoft.com");
const STG = process.env.STG_TOKEN || azToken("https://storage.azure.com");

const dfsBase = `https://onelake.dfs.fabric.microsoft.com/${WS}/${LH}/Files/landing`;
const apiBase = `https://api.fabric.microsoft.com/v1/workspaces/${WS}/lakehouses/${LH}`;
const files = readdirSync(DATA_DIR).filter(f => f.endsWith(".csv") && readFileSync(`${DATA_DIR}/${f}`).length > 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function upload(file) {
  const url = `${dfsBase}/${file}`;
  const body = readFileSync(`${DATA_DIR}/${file}`);
  let r = await fetch(`${url}?resource=file`, { method: "PUT", headers: { Authorization: `Bearer ${STG}`, "x-ms-version": "2023-11-03" } });
  if (!r.ok && r.status !== 201) throw new Error(`create ${file}: ${r.status} ${await r.text()}`);
  r = await fetch(`${url}?action=append&position=0`, { method: "PATCH", headers: { Authorization: `Bearer ${STG}`, "x-ms-version": "2023-11-03", "Content-Type": "application/octet-stream" }, body });
  if (!r.ok && r.status !== 202) throw new Error(`append ${file}: ${r.status} ${await r.text()}`);
  r = await fetch(`${url}?action=flush&position=${body.length}`, { method: "PATCH", headers: { Authorization: `Bearer ${STG}`, "x-ms-version": "2023-11-03" } });
  if (!r.ok) throw new Error(`flush ${file}: ${r.status} ${await r.text()}`);
}

async function loadTable(table, file) {
  const r = await fetch(`${apiBase}/tables/${table}/load`, {
    method: "POST", headers: { Authorization: `Bearer ${FAB}`, "Content-Type": "application/json" },
    body: JSON.stringify({ relativePath: `Files/landing/${file}`, pathType: "File", mode: "overwrite", recursive: false,
      formatOptions: { format: "Csv", header: true, delimiter: "," } })
  });
  if (r.status === 202) {
    const op = r.headers.get("location");
    for (let i = 0; i < 40; i++) {
      await sleep(3000);
      const s = await fetch(op, { headers: { Authorization: `Bearer ${FAB}` } });
      const j = await s.json().catch(() => ({}));
      if (j.status === "Succeeded") return "ok";
      if (j.status === "Failed") return "FAILED: " + JSON.stringify(j.error || j);
    }
    return "timeout";
  }
  if (r.ok) return "ok";
  return `HTTP ${r.status}: ${await r.text()}`;
}

console.log(`Workspace ${WS} · Lakehouse ${LH}\nUploading ${files.length} files from ${DATA_DIR}...`);
for (const f of files) { await upload(f); process.stdout.write("."); }
console.log("\nUploads done. Loading tables (sequential)...");
for (const f of files) {
  const table = f.replace(".csv", "");
  const res = await loadTable(table, f);
  console.log(table.padEnd(24), res);
}
console.log("Done. Next: refresh the Fabric IQ ontology graph (RefreshGraph) so new claims surface in the ontology — see RUNBOOK.md step 5.");
