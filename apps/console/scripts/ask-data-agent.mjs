// Dev utility: ask the Fabric Data Agent a question exactly the way FabricDataAgentSource does.
// Usage: AZTOKEN=$(az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv) node scripts/ask-data-agent.mjs "question"

const BASE =
  "https://api.fabric.microsoft.com/v1/workspaces/12b39202-bbf7-4985-8eb1-541b3cde0071/aiskills/33eb2030-bcf7-45f8-b0f0-62fe9c1d62a5/aiassistant/openai";
const AV = "api-version=2024-05-01-preview";
const TOK = process.env.AZTOKEN;
const QUESTION = process.argv[2] ?? "How many rows does fact_claims contain?";
if (!TOK) { console.error("set AZTOKEN"); process.exit(1); }

const call = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}${AV}`, {
    method,
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

const assistant = await call("POST", "/assistants", { model: "gpt-4o" });
const thread = await call("POST", "/threads", {});
await call("POST", `/threads/${thread.id}/messages`, { role: "user", content: QUESTION });
const run = await call("POST", `/threads/${thread.id}/runs`, { assistant_id: assistant.id });
let status = run.status;
const deadline = Date.now() + 120_000;
while (!["completed", "failed", "cancelled", "expired"].includes(status)) {
  if (Date.now() > deadline) { console.error("timeout"); process.exit(1); }
  await new Promise((r) => setTimeout(r, 3000));
  status = (await call("GET", `/threads/${thread.id}/runs/${run.id}`)).status;
}
console.log("status:", status);
const msgs = await call("GET", `/threads/${thread.id}/messages`);
const a = (msgs.data ?? []).find((m) => m.role === "assistant");
console.log("ANSWER:", a ? a.content.map((c) => c.text?.value ?? "").join(" ") : "none");
