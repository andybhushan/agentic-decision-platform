import { tokens } from "@fluentui/react-components";
import { useDocsStyles, PageHero, Section, Diagram, Callout, InfoCard, StatCard, Narrative } from "../common";
import { DeploymentTopologyDiagram } from "../diagrams";
import { ResourceHierarchyFull } from "../ResourceHierarchy";

// ============= Azure Resources =============
const RESOURCES = [
  { group: "Compute", name: "func-adp-v1-fnol", kind: "Azure Functions · Flex Consumption · .NET 10 isolated", purpose: "Workload host. 10 functions: RunFnol, GetTrace, ResolveHitl, GetAggregateOutcomes, Negotiate, Health + Durable orchestrator + 3 activities + ingest worker." },
  { group: "Compute", name: "plan-adp-v1-fnol", kind: "Functions plan (FC1)", purpose: "Hosting plan for func-adp-v1-fnol. Per-execution billing." },
  { group: "Compute", name: "swa-adp-v1-console", kind: "Static Web App · Free", purpose: "Operator console + docs portal SPA. Deployed via @azure/static-web-apps-cli." },
  { group: "Compute", name: "cae-adp-v1", kind: "Container Apps env", purpose: "Provisioned and idle. v1.5: promotes decision-ingest CLI consumer to a Container App." },
  { group: "AI", name: "ai-adp-v1", kind: "AIServices (kind=AIServices, S0)", purpose: "Foundry account scope." },
  { group: "AI", name: "ai-adp-v1/projects/adp-v1", kind: "Foundry project", purpose: "Agent runtime scope. Per-agent Entra Identity issued from here." },
  { group: "AI", name: "ai-adp-v1/projects/adp-v1/connections/dt-navigator-aoai", kind: "Foundry connection", purpose: "Reuses existing dt-navigator-openai (zero new model cost)." },
  { group: "AI", name: "dt-navigator-openai", kind: "Azure OpenAI (rg-microsoft-navigator)", purpose: "gpt-4o + text-embedding-3-large. Shared across MS DT tenant; ADP consumes via Foundry connection." },
  { group: "Data", name: "adp-v1", kind: "Fabric workspace (capacity offeringsfabric001)", purpose: "Bound to existing capacity to avoid new RG-level capacity cost." },
  { group: "Data", name: "adp", kind: "Fabric Lakehouse", purpose: "5 Delta tables in OneLake: dim_policyholder · dim_vehicle · fact_claims (Meridian); dim_borrower · fact_loan_applications (banking)." },
  { group: "Data", name: "srch-adp-v1", kind: "Azure AI Search · Basic · eastus", purpose: "Foundry IQ index adp-knowledge. 21 docs · 3072-d embeddings · industry-filtered." },
  { group: "Data", name: "sql-adp-v1", kind: "Azure SQL Basic", purpose: "Fallback semantic layer (SEMANTIC_BACKEND=sql). Kept warm during soak." },
  { group: "State", name: "cdb-adp-v1", kind: "Cosmos DB (Serverless)", purpose: "Container adp.dw-state · partition /subjectId. Decision Journal." },
  { group: "State", name: "evh-adp-v1", kind: "Event Hubs Standard (1 TU, Kafka API)", purpose: "Decision Journal topic adp-v1-decisions." },
  { group: "State", name: "signalr-adp-v1", kind: "SignalR Service · Free_F1 · Serverless", purpose: "Hub fnoltrace for operator live tail. Keyed by subjectId." },
  { group: "State", name: "egt-adp-v1-fanout", kind: "Event Grid topic", purpose: "Provisioned, idle. v1.5 dispatch surface." },
  { group: "Storage", name: "stadpv1", kind: "Storage account", purpose: "Function deployment blobs + AzureWebJobsStorage." },
  { group: "Security", name: "kv-adp-v1", kind: "Key Vault", purpose: "Reserved, idle in v1. v1.5 holds Graph delegated-token cache + Foundry per-agent secrets." },
  { group: "Identity", name: "6 user-assigned managed identities", kind: "id-adp-v1-{orchestrator, decision-ingest, context-router, mcp-claim-store, mcp-policy-store, console-api}", purpose: "Per-workload identities. Granularity matches future Defender for AI policy boundaries." },
  { group: "Observability", name: "log-adp-v1", kind: "Log Analytics workspace", purpose: "Backing store for App Insights." },
  { group: "Observability", name: "appi-adp-v1", kind: "Application Insights", purpose: "Distributed traces, exceptions, request timing." },
];

export function DeployResourcesPage() {
  const s = useDocsStyles();
  const groups = Array.from(new Set(RESOURCES.map((r) => r.group)));
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Deployment"
        title="Azure Resources"
        lead="What is actually in Azure right now: ~20 resources in one resource group, eastus2 (with AI Search in eastus due to capacity). Tenant ibmalliance.onmicrosoft.com, subscription Project-IBMMSOFFERINGSPOC."
      />

      <Section title="Quick facts">
        <div className={s.statGrid}>
          <StatCard n="1" label="resource group" />
          <StatCard n="~20" label="Azure resources" />
          <StatCard n="2" label="regions (eastus2 + eastus)" />
          <StatCard n="6" label="user-assigned managed identities" />
          <StatCard n="~$3.50" label="per-day idle cost" />
          <StatCard n="~$0.05" label="per-run cost (mostly tokens)" />
        </div>
      </Section>

      {groups.map((g) => (
        <Section key={g} title={g}>
          <table className={s.table}>
            <thead><tr><th>Resource</th><th>Kind</th><th>Purpose</th></tr></thead>
            <tbody>
              {RESOURCES.filter((r) => r.group === g).map((r) => (
                <tr key={r.name}>
                  <td><code>{r.name}</code></td>
                  <td style={{ fontSize: "12px", color: tokens.colorNeutralForeground3 }}>{r.kind}</td>
                  <td>{r.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ))}

      <Section title="Why two regions">
        <Callout>
          eastus2 is the home region. Azure AI Search Basic was at capacity in eastus2 when the resource was
          provisioned, so <code>srch-adp-v1</code> lives in eastus. Cross-region latency is negligible at
          AI Search call volume (the vector query itself takes 80-120ms; the cross-region hop adds &lt;15ms).
        </Callout>
      </Section>
    </div>
  );
}

// ============= Resource Group Structure =============
export function DeployHierarchyPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Deployment"
        title="Resource Group Structure"
        lead="The organizational chain — tenant → subscription → resource group → resources — exactly as an architect would see it in the Azure Portal navigator. The full as-deployed hierarchy, including the cross-RG reuse of dt-navigator-openai and the parallel Microsoft Fabric chain in the same tenant."
      />

      <Section title="The full tree" lead="Every resource by name, with SKU + purpose + region. Six logical categories inside rg-adp-v1, plus the cross-RG OpenAI account, plus the Fabric Lakehouse chain.">
        <Narrative>
          All v1 resources are organized in <b>three containers</b>: one Azure resource group (<code>rg-adp-v1</code>) under the
          <code> Project-IBMMSOFFERINGSPOC</code> subscription in the IBM Alliance tenant, one cross-RG reuse pointer to the existing
          <code> dt-navigator-openai</code> Azure OpenAI account in <code>rg-microsoft-navigator</code>, and one Microsoft Fabric workspace
          (<code>adp-v1</code>) bound to the shared <code>offeringsfabric001</code> capacity. The tree below shows all three under
          one root.
        </Narrative>
        <ResourceHierarchyFull />
      </Section>

      <Section title="How to read this">
        <table className={s.table}>
          <thead><tr><th>Level</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>Tenant</td><td>Microsoft Entra ID directory. One per IBM Alliance ownership boundary.</td></tr>
            <tr><td>Subscription</td><td>Billing + RBAC boundary. <code>Project-IBMMSOFFERINGSPOC</code> is the MS-DT offerings PoC subscription.</td></tr>
            <tr><td>Resource Group</td><td>Lifecycle + lifecycle-tag boundary. <code>rg-adp-v1</code> tags with <code>project=adp-v1</code>; one <code>az group delete</code> tears down all of v1.</td></tr>
            <tr><td>Category</td><td>Editorial grouping (not an Azure construct). Same six categories that appear in the Topology diagram and the Resources page table.</td></tr>
            <tr><td>Resource</td><td>The Azure resource itself. Bicep-provisioned except the Fabric workspace + Lakehouse (REST-provisioned via <code>scripts/provision-fabric.ps1</code>).</td></tr>
            <tr><td>Cross-RG reuse</td><td>An out-of-RG dependency. <code>dt-navigator-openai</code> lives in <code>rg-microsoft-navigator</code> and is consumed via a Foundry connection — counted in v1's surface but not in v1's billing.</td></tr>
            <tr><td>Microsoft Fabric chain</td><td>Same tenant, separate provisioning surface (Fabric Portal + Fabric REST). Capacity ⊃ Workspace ⊃ Lakehouse ⊃ Delta tables.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="What this complements">
        <div className={s.threeCol}>
          <InfoCard label="Companion page 1" title="Azure Resources">
            Flat list by category — every resource with SKU + purpose. The "what" view.
          </InfoCard>
          <InfoCard label="Companion page 2" title="Deployment Topology">
            SVG topology — six grouped category boxes inside the RG container. The "spatial" view.
          </InfoCard>
          <InfoCard label="This page" title="Resource Group Structure">
            Indent-tree hierarchy — the organizational chain from tenant down. The "container" view.
          </InfoCard>
        </div>
      </Section>

      <Callout>
        Three views, one source of truth. If you only have time for one, the Topology page is the fastest to grasp.
        For an architect new to the build, read this page first to anchor the chain of containers, then the Topology
        for spatial relationships, then the Azure Resources page for SKU-level detail.
      </Callout>
    </div>
  );
}

// ============= Deployment Topology =============
export function DeployTopologyPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Deployment"
        title="Deployment Topology"
        lead="The same ~20 Azure resources grouped by responsibility. Compute & Hosting at top-left; Data Substrate at top-right; State & Events bottom-left; Identity & Security middle; Observability bottom-right."
      />

      <Section title="Topology diagram">
        <Diagram caption="Everything is inside rg-adp-v1 in eastus2 except srch-adp-v1 (eastus, capacity-driven). dt-navigator-openai is also outside the RG — it's the cross-RG reuse of the existing MS DT navigator AOAI account.">
          <DeploymentTopologyDiagram />
        </Diagram>
      </Section>

      <Section title="Network model">
        <p className={s.sectionLead}>
          Public endpoints throughout v1.0 — no private endpoints, no VNet integration. Justification: the only
          consumer of the Function app is the public SPA; the only consumer of Cosmos / AI Search / SignalR /
          Event Hubs is the Function app. All authentication is AAD-based and capability-scoped via managed
          identity. Private endpoints are a v1.5 hardening pass once Defender for AI lands.
        </p>
      </Section>

      <Section title="Cross-resource auth (who calls what)">
        <table className={s.table}>
          <thead><tr><th>Caller</th><th>Called</th><th>How</th></tr></thead>
          <tbody>
            <tr><td>func-adp-v1-fnol (system MI)</td><td>Cosmos cdb-adp-v1</td><td>Cosmos data-plane RBAC</td></tr>
            <tr><td>func-adp-v1-fnol (system MI)</td><td>Event Hubs evh-adp-v1</td><td>"Azure Event Hubs Data Sender" RBAC</td></tr>
            <tr><td>func-adp-v1-fnol (system MI)</td><td>SignalR signalr-adp-v1</td><td>"SignalR App Server" role</td></tr>
            <tr><td>func-adp-v1-fnol (system MI)</td><td>Fabric workspace adp-v1</td><td>Workspace Viewer (data-plane)</td></tr>
            <tr><td>func-adp-v1-fnol (key)</td><td>dt-navigator-openai</td><td>API key (v1.5: replace with key-less via Foundry)</td></tr>
            <tr><td>func-adp-v1-fnol (key)</td><td>srch-adp-v1</td><td>Admin key (v1.5: query key + identity)</td></tr>
            <tr><td>SWA</td><td>func-adp-v1-fnol</td><td>Anonymous (auth at app level — operator demo only)</td></tr>
            <tr><td>SWA</td><td>signalr-adp-v1</td><td>Negotiate endpoint issues short-lived JWT</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ============= Bicep & IaC =============
const BICEP_MODULES = [
  { file: "main.bicep", purpose: "Top-level composition. Calls all 12 modules in order; declares param bindings." },
  { file: "modules/ai-search.bicep", purpose: "srch-adp-v1 — Azure AI Search Basic in eastus (capacity-driven)." },
  { file: "modules/container-apps.bicep", purpose: "cae-adp-v1 — Container Apps environment (idle, v1.5)." },
  { file: "modules/cosmos.bicep", purpose: "cdb-adp-v1 — Serverless Cosmos DB + database adp + container dw-state (partition /subjectId)." },
  { file: "modules/eventgrid.bicep", purpose: "egt-adp-v1-fanout — Event Grid topic (idle)." },
  { file: "modules/eventhubs.bicep", purpose: "evh-adp-v1 + namespace + topic adp-v1-decisions (Kafka API enabled)." },
  { file: "modules/functions.bicep", purpose: "func-adp-v1-fnol + plan-adp-v1-fnol — Flex Consumption .NET 10 isolated worker. All app settings declared." },
  { file: "modules/identity.bicep", purpose: "6 user-assigned managed identities — one per logical workload." },
  { file: "modules/keyvault.bicep", purpose: "kv-adp-v1 — Key Vault Premium (idle)." },
  { file: "modules/log-analytics.bicep", purpose: "log-adp-v1 + appi-adp-v1." },
  { file: "modules/signalr.bicep", purpose: "signalr-adp-v1 — Free_F1 Serverless mode." },
  { file: "modules/sql.bicep", purpose: "sql-adp-v1 + adp-semantic database (Basic SKU, fallback)." },
  { file: "modules/storage.bicep", purpose: "stadpv1 — Storage account (LRS)." },
  { file: "modules/swa.bicep", purpose: "swa-adp-v1-console — Static Web App Free tier." },
];

export function DeployBicepPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Deployment"
        title="Bicep & Infrastructure-as-Code"
        lead="13 Bicep modules. 18 of 19 resources are Bicep-native; the 19th (Fabric workspace + Lakehouse) is provisioned via REST in scripts/provision-fabric.ps1 because Fabric doesn't have Bicep-native resource providers as of 2026-05-28."
      />

      <Section title="Module inventory">
        <table className={s.table}>
          <thead><tr><th>File</th><th>Purpose</th></tr></thead>
          <tbody>
            {BICEP_MODULES.map((m) => (
              <tr key={m.file}>
                <td><code>{m.file}</code></td>
                <td>{m.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="The Fabric exception · ADR-0011 amendment">
        <Callout variant="warn">
          Fabric workspace + Lakehouse provisioning has no Bicep resource provider. The build uses
          <code>scripts/provision-fabric.ps1</code> which calls Fabric REST (<code>POST /v1/workspaces</code>,
          <code>POST /v1/workspaces/{`{id}`}/lakehouses</code>). The script binds the workspace to capacity
          <code>offeringsfabric001</code> (existing, MS DT shared) so no new RG-level capacity is required.
        </Callout>
      </Section>

      <Section title="Deploy commands">
        <div className={s.codeBlock}>{`# 1. Base Bicep
az group create --name rg-adp-v1 --location eastus2 --tags project=adp-v1
az deployment group create -g rg-adp-v1 --name adp-v1-bootstrap \\
  --template-file platform/infra/main.bicep \\
  --parameters platform/infra/parameters/dev.bicepparam

# 2. Fabric (REST, scripted)
./scripts/provision-fabric.ps1                                # workspace + Lakehouse
./scripts/load-fabric-lakehouse.ps1                           # Meridian 3 tables
./scripts/load-fabric-banking.ps1                             # banking 2 tables

# 3. Foundry account + project + AOAI connection
az cognitiveservices account create --name ai-adp-v1 --kind AIServices --sku S0 \\
  -g rg-adp-v1 -l eastus2 --custom-domain ai-adp-v1 --yes
az cognitiveservices account identity assign --name ai-adp-v1 -g rg-adp-v1
# project + connection: REST or portal (see ADR-0013)

# 4. Index knowledge corpus
dotnet run --project platform/src/PackageCompiler -- index --knowledge usecases/meridian-pnc-auto-claims/knowledge
dotnet run --project platform/src/PackageCompiler -- index --knowledge usecases/banking-loan-origination/knowledge

# 5. Compile + bundle packages
foreach ($p in 'fnol-handler','damage-handler','fraud-handler','settlement-handler') {
  dotnet run --project platform/src/PackageCompiler -- compile \\
    --in "usecases/meridian-pnc-auto-claims/packages/$p.json" \\
    --out "build/$p.zip"
  Copy-Item "build/$p.zip" -Destination "platform/src/TracesApi/Resources/$p.zip" -Force
}

# 6. Publish + deploy function
dotnet publish platform/src/TracesApi -c Release -o build/tracesapi-publish
az functionapp deployment source config-zip -g rg-adp-v1 -n func-adp-v1-fnol --src build/tracesapi.zip

# 7. Build + deploy console
cd platform/console
$env:VITE_TRACES_API = "https://func-adp-v1-fnol.azurewebsites.net/api"
npm install; npm run build
$tok = az staticwebapp secrets list --name swa-adp-v1-console --resource-group rg-adp-v1 --query "properties.apiKey" -o tsv
npx --yes @azure/static-web-apps-cli@latest deploy ./dist --deployment-token $tok --env production`}</div>
      </Section>
    </div>
  );
}

// ============= Provisioning Runbook =============
export function DeployRunbookPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Deployment"
        title="Provisioning Runbook"
        lead="Clean-room reproduce in ~45 minutes if Foundry RBAC is pre-granted, ~60 minutes otherwise. The Function deployment is the longest single step (~6-8 minutes for first-time publish)."
      />

      <Section title="Step-by-step">
        <div className={s.codeBlock}>{`# 0. Prereqs
az login                                                 # signed-in as deployer with Contributor on the sub
az account set --subscription 5aaa5efd-2544-456c-964e-4d8627d6a0b8

# 1. Resource group + base Bicep
az group create --name rg-adp-v1 --location eastus2 --tags project=adp-v1
az deployment group create -g rg-adp-v1 --name adp-v1-bootstrap \\
  --template-file platform/infra/main.bicep \\
  --parameters platform/infra/parameters/dev.bicepparam

# 2. Fabric workspace + Lakehouse + Meridian tables
./scripts/provision-fabric.ps1
./scripts/load-fabric-lakehouse.ps1 -WorkspaceId <id-from-step-2> -LakehouseId <id-from-step-2>

# 3. Banking Fabric tables
./scripts/load-fabric-banking.ps1

# 4. Foundry account + project + AOAI connection
az cognitiveservices account create --name ai-adp-v1 --kind AIServices --sku S0 \\
  -g rg-adp-v1 -l eastus2 --custom-domain ai-adp-v1 --yes
az cognitiveservices account identity assign --name ai-adp-v1 -g rg-adp-v1
# Then create project + connection (REST or portal — see ADR-0013)

# 5. Knowledge index
$env:AZURE_OPENAI_ENDPOINT = "..."
$env:AZURE_OPENAI_API_KEY  = "..."
$env:AZURE_SEARCH_ENDPOINT = "https://srch-adp-v1.search.windows.net"
$env:AZURE_SEARCH_API_KEY  = (az search admin-key show -g rg-adp-v1 --service-name srch-adp-v1 --query primaryKey -o tsv)
dotnet run --project platform/src/PackageCompiler -- index --knowledge usecases/meridian-pnc-auto-claims/knowledge
dotnet run --project platform/src/PackageCompiler -- index --knowledge usecases/banking-loan-origination/knowledge

# 6. Compile packages
foreach ($p in 'fnol-handler','damage-handler','fraud-handler','settlement-handler') {
  dotnet run --project platform/src/PackageCompiler -- compile \\
    --in "usecases/meridian-pnc-auto-claims/packages/$p.json" \\
    --out "build/$p.zip"
}
dotnet run --project platform/src/PackageCompiler -- compile \\
  --in usecases/banking-loan-origination/packages/loan-handler.json \\
  --out build/loan-handler.zip

# 7. Bundle Meridian packages into Function publish + deploy
foreach ($n in 'fnol-handler','damage-handler','fraud-handler','settlement-handler') {
  Copy-Item "build/$n.zip" -Destination "platform/src/TracesApi/Resources/$n.zip" -Force
}
dotnet publish platform/src/TracesApi -c Release -o build/tracesapi-publish
# zip with forward-slash entries (see DEPLOY.md gotcha #2)
az functionapp deployment source config-zip -g rg-adp-v1 -n func-adp-v1-fnol --src build/tracesapi.zip

# 8. Build + deploy console
cd platform/console
$env:VITE_TRACES_API = "https://func-adp-v1-fnol.azurewebsites.net/api"
npm install; npm run build
$tok = az staticwebapp secrets list --name swa-adp-v1-console --resource-group rg-adp-v1 --query "properties.apiKey" -o tsv
npx --yes @azure/static-web-apps-cli@latest deploy ./dist --deployment-token $tok --env production

# 9. (Optional) Foundry Agent Service activation — needs Owner privileges
$accountId = (az cognitiveservices account show --name ai-adp-v1 -g rg-adp-v1 --query id -o tsv)
$userObjId = '6f063eee-397a-4e06-aed1-da4cda6d8792'
$funcMI    = 'a4318002-a996-4000-aea0-31aa4e70aabe'
az role assignment create --assignee-object-id $userObjId --assignee-principal-type User \\
  --role '53ca6127-db72-4b80-b1b0-d745d6d5456d' --scope $accountId
az role assignment create --assignee-object-id $funcMI --assignee-principal-type ServicePrincipal \\
  --role '53ca6127-db72-4b80-b1b0-d745d6d5456d' --scope $accountId
az functionapp config appsettings set -g rg-adp-v1 -n func-adp-v1-fnol \\
  --settings AGENT_BACKEND=foundry FOUNDRY_PROJECT_ENDPOINT='https://ai-adp-v1.services.ai.azure.com/api/projects/adp-v1'`}</div>
      </Section>

      <Section title="Known gotchas">
        <table className={s.table}>
          <thead><tr><th>Gotcha</th><th>Fix</th></tr></thead>
          <tbody>
            <tr><td>NU1100 NuGet resolution failed for Azure.AI.Agents.Persistent on net10.0</td><td><code>dotnet nuget add source 'https://api.nuget.org/v3/index.json'</code> at user level if no sources configured.</td></tr>
            <tr><td>PowerShell 5.1 reads .ps1 as ANSI; em dashes break the parser</td><td>Use ASCII-only literals in .ps1 files. Reference: <code>feedback_ps51_no_non_ascii_in_scripts.md</code> in memory.</td></tr>
            <tr><td>Function zip with backslash entries → Linux Functions host can't extract</td><td>Re-zip with forward-slash separators. <code>System.IO.Compression.ZipFile.CreateFromDirectory</code> handles this on PS 7+; PS 5.1 needs a manual loop.</td></tr>
            <tr><td>SWA deploys but the operator console doesn't see new API endpoints</td><td>Set <code>VITE_TRACES_API</code> before <code>npm run build</code> — it's compiled into the bundle.</td></tr>
            <tr><td>Foundry Agent Service: 403 on agent create</td><td>RBAC pending. Run the two <code>az role assignment create</code> commands in step 9 with an account that has <code>Microsoft.Authorization/roleAssignments/write</code>.</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ============= Cost & Operations =============
export function DeployCostPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Deployment"
        title="Cost & Operations"
        lead="Idle ~$3.50/day. Per-run ~$0.05 (mostly tokens). The two cost levers are LLM token consumption and Fabric capacity — both manageable."
      />

      <Section title="Idle cost · per-day">
        <table className={s.table}>
          <thead><tr><th>Resource</th><th>SKU</th><th>$/day est.</th></tr></thead>
          <tbody>
            <tr><td>Cosmos DB (Serverless)</td><td>0 RU baseline</td><td>$0.00 (only pay for RU on read/write)</td></tr>
            <tr><td>Functions Flex Consumption</td><td>FC1, idle</td><td>~$0.10 (always-ready slot)</td></tr>
            <tr><td>Storage</td><td>LRS, ~10 MB</td><td>~$0.01</td></tr>
            <tr><td>Event Hubs</td><td>Standard 1 TU</td><td>~$0.80</td></tr>
            <tr><td>SignalR Service</td><td>Free_F1</td><td>$0.00</td></tr>
            <tr><td>AI Search</td><td>Basic</td><td>~$2.50</td></tr>
            <tr><td>SQL Database (fallback)</td><td>Basic</td><td>~$0.17</td></tr>
            <tr><td>Key Vault</td><td>Premium, idle</td><td>~$0.03</td></tr>
            <tr><td>Container Apps env</td><td>idle, no replicas</td><td>~$0.00</td></tr>
            <tr><td>Foundry (AIServices)</td><td>S0, no model deployed in-project</td><td>~$0.00 (consumption follows AOAI)</td></tr>
            <tr><td>Static Web App</td><td>Free</td><td>$0.00</td></tr>
            <tr><td>Log Analytics + App Insights</td><td>pay-as-you-go</td><td>~$0.05 (light ingest)</td></tr>
            <tr><td>Fabric capacity offeringsfabric001</td><td>shared (not in this RG)</td><td>$0.00 to this project</td></tr>
            <tr><td><b>Total idle</b></td><td></td><td><b>~$3.50</b></td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Per-run cost (one claim through one DW · 4 agent steps)">
        <table className={s.table}>
          <thead><tr><th>Cost driver</th><th>Quantity</th><th>$ approx</th></tr></thead>
          <tbody>
            <tr><td>gpt-4o input tokens</td><td>~5K tokens × 4 steps</td><td>$0.020</td></tr>
            <tr><td>gpt-4o output tokens</td><td>~2K tokens × 4 steps</td><td>$0.020</td></tr>
            <tr><td>text-embedding-3-large query embed</td><td>~200 tokens × 4 steps</td><td>$0.00026</td></tr>
            <tr><td>AI Search query (vector)</td><td>4 queries</td><td>included in Basic SKU</td></tr>
            <tr><td>Fabric SQL endpoint queries</td><td>4-8 queries</td><td>$0.00 marginal</td></tr>
            <tr><td>Cosmos write (decision events)</td><td>4 events</td><td>~$0.0001</td></tr>
            <tr><td>SignalR push</td><td>4 messages</td><td>included in Free_F1 (under 20K msg/day)</td></tr>
            <tr><td><b>Total per run</b></td><td></td><td><b>~$0.04 to $0.06</b></td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Cost levers">
        <div className={s.twoCol}>
          <InfoCard label="Lever 1" title="Drop AI Search to free tier">
            Basic ($2.50/day) → Free (limit 50MB, 3 indexes). v1.0 corpus is 19+2 docs = well under 50MB. Saves $2.50/day at the cost of losing the SLA.
          </InfoCard>
          <InfoCard label="Lever 2" title="Decommission Azure SQL fallback">
            Once SEMANTIC_BACKEND=fabric has been stable for &gt;1 week, drop sql-adp-v1 entirely. Saves $0.17/day.
          </InfoCard>
          <InfoCard label="Lever 3" title="Switch to gpt-4o-mini for non-reasoning agents">
            claim-intake and shop-routing don't need gpt-4o. gpt-4o-mini cuts per-step cost ~10x. Per-run cost drops to ~$0.015.
          </InfoCard>
          <InfoCard label="Lever 4" title="Stop Event Hubs Standard">
            EH Standard 1 TU is $0.80/day idle. If the Container Apps consumer never lands in v1.5, drop EH entirely; Cosmos write + SignalR push is enough.
          </InfoCard>
        </div>
      </Section>

      <Section title="Operational basics">
        <table className={s.table}>
          <thead><tr><th>Concern</th><th>Today</th></tr></thead>
          <tbody>
            <tr><td>Logs</td><td>App Insights via Function instrumentation (request, dependency, trace, exception telemetry)</td></tr>
            <tr><td>Metrics</td><td>Function App Insights metrics + Cosmos consumed RU + AI Search QPS</td></tr>
            <tr><td>Alerts</td><td>None configured in v1.0 — out of scope. v1.5 alerts: HITL backlog &gt;5, grounded rate &lt;90%, avg confidence &lt;0.7.</td></tr>
            <tr><td>SLA target</td><td>None promised externally. Internal goal: 99% of demo runs complete &lt;90 seconds (no HITL).</td></tr>
            <tr><td>Backup</td><td>Cosmos serverless has continuous backup (built-in). Fabric Lakehouse Delta tables have time-travel.</td></tr>
            <tr><td>Cost monitoring</td><td>Azure Cost Management; tag <code>project=adp-v1</code> on the RG.</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}
