// Theme-aware indent-tree depicting tenant -> subscription -> resource group -> resources
// for the adp-v1 deployment, plus the parallel Fabric chain in the same tenant.
//
// Two variants exported:
//  - <ResourceHierarchyFull />        : full tree with every resource
//  - <ResourceHierarchyCompact />     : condensed chain (used by Project / What & How)

import { makeStyles, tokens } from "@fluentui/react-components";

type RowKind =
  | "container"      // tenant / subscription / rg / workspace box header
  | "category"       // logical category band (Compute & Hosting, AI, etc.)
  | "resource"       // a leaf resource
  | "blank";         // spacer

interface TreeRow {
  kind: RowKind;
  indent: number;             // tree depth (0..5)
  prefix?: string;            // tree characters (├ │ └ etc.) — pre-computed for monospace alignment
  name?: string;              // primary label
  meta?: string;              // secondary label (region, SKU, purpose)
  accent?: "rg" | "compute" | "ai" | "data" | "state" | "identity" | "obs" | "fabric" | "cross";
}

const useStyles = makeStyles({
  wrap: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "10px",
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
    fontSize: "12.5px",
    padding: "20px 22px",
    lineHeight: 1.7,
    overflowX: "auto",
    color: tokens.colorNeutralForeground1,
  },
  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "16px",
    paddingBottom: "12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    fontFamily: tokens.fontFamilyBase,
    fontSize: "11px",
  },
  legendChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "2px 10px",
    borderRadius: "12px",
    fontWeight: 600,
    fontSize: "10px",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  legendSwatch: {
    width: "10px",
    height: "10px",
    borderRadius: "3px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "auto auto 1fr",
    columnGap: "10px",
    alignItems: "baseline",
    whiteSpace: "nowrap",
  },
  prefix: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: "pre",
  },
  name: {
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    fontSize: "11.5px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  // Container header rows (tenant, subscription, rg, workspace)
  container: {
    fontWeight: 700,
    color: tokens.colorBrandForeground1,
    letterSpacing: "0.5px",
    paddingTop: "8px",
    paddingBottom: "2px",
  },
  // Category band
  category: {
    paddingTop: "10px",
    paddingBottom: "2px",
    fontWeight: 700,
    fontSize: "11.5px",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  catCompute: { color: "#0078D4" },
  catAi: { color: "#9D6CD6" },
  catData: { color: "#22A06B" },
  catState: { color: "#1E8E8C" },
  catIdentity: { color: "#D4A64A" },
  catObs: { color: "#5C2D91" },
  catFabric: { color: "#22A06B" },
  catCross: { color: "#D83B01" },
  catRg: { color: tokens.colorBrandForeground1 },
  blank: { height: "8px" },
});

function categoryClass(s: ReturnType<typeof useStyles>, accent?: TreeRow["accent"]): string {
  switch (accent) {
    case "compute": return s.catCompute;
    case "ai": return s.catAi;
    case "data": return s.catData;
    case "state": return s.catState;
    case "identity": return s.catIdentity;
    case "obs": return s.catObs;
    case "fabric": return s.catFabric;
    case "cross": return s.catCross;
    case "rg":
    default: return s.catRg;
  }
}

function renderRow(s: ReturnType<typeof useStyles>, row: TreeRow, idx: number) {
  if (row.kind === "blank") return <div key={idx} className={s.blank} />;
  const accentCls = categoryClass(s, row.accent);
  const containerCls = row.kind === "container" ? `${s.container} ${accentCls}` : "";
  const categoryCls = row.kind === "category" ? `${s.category} ${accentCls}` : "";
  return (
    <div key={idx} className={`${s.row} ${containerCls} ${categoryCls}`}>
      <span className={s.prefix}>{row.prefix ?? ""}</span>
      <span className={row.kind === "resource" ? s.name : undefined}>{row.name}</span>
      {row.meta && <span className={s.meta}>{row.meta}</span>}
    </div>
  );
}

function Legend() {
  const s = useStyles();
  const items: { label: string; color: string }[] = [
    { label: "Resource Group", color: tokens.colorBrandForeground1 },
    { label: "Compute", color: "#0078D4" },
    { label: "AI & Knowledge", color: "#9D6CD6" },
    { label: "Data Substrate", color: "#22A06B" },
    { label: "State & Events", color: "#1E8E8C" },
    { label: "Identity", color: "#D4A64A" },
    { label: "Observability", color: "#5C2D91" },
    { label: "Cross-RG reuse", color: "#D83B01" },
  ];
  return (
    <div className={s.legend}>
      {items.map((it) => (
        <span key={it.label} className={s.legendChip} style={{ color: it.color, backgroundColor: `${it.color}1A` }}>
          <span className={s.legendSwatch} style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Full tree
// ──────────────────────────────────────────────────────────────────────────────

const FULL_ROWS: TreeRow[] = [
  { kind: "container", indent: 0, prefix: "🏢 ", name: "TENANT", meta: "ibmalliance.onmicrosoft.com (Microsoft Entra ID)", accent: "rg" },
  { kind: "container", indent: 1, prefix: "│", name: "", meta: "" },
  { kind: "container", indent: 1, prefix: "├── 📦 ", name: "SUBSCRIPTION", meta: "Project-IBMMSOFFERINGSPOC", accent: "rg" },
  { kind: "container", indent: 2, prefix: "│   │", name: "", meta: "" },
  { kind: "container", indent: 2, prefix: "│   ├── 📁 ", name: "RESOURCE GROUP · rg-adp-v1", meta: "eastus2 · tag project=adp-v1", accent: "rg" },

  // ── COMPUTE & HOSTING ───────────────────────────────────────────────────
  { kind: "category", indent: 3, prefix: "│   │   │   ", name: "COMPUTE & HOSTING · 4", accent: "compute" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "func-adp-v1-fnol", meta: "Azure Functions · Flex Consumption · .NET 10 isolated · 11 functions hosted" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "plan-adp-v1-fnol", meta: "Functions plan · FC1 (Flex Consumption)" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "swa-adp-v1-console", meta: "Static Web App · Free · operator + docs + project portals + studio" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "cae-adp-v1", meta: "Container Apps environment · provisioned · idle (v1.5)" },

  // ── AI & KNOWLEDGE ──────────────────────────────────────────────────────
  { kind: "category", indent: 3, prefix: "│   │   │   ", name: "AI & KNOWLEDGE · 3", accent: "ai" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "ai-adp-v1", meta: "AIServices (Foundry account) · kind=AIServices · S0" },
  { kind: "resource", indent: 4, prefix: "│   │   │   └── ", name: "projects/adp-v1", meta: "Foundry project · connection to dt-navigator-aoai (cross-RG reuse)" },
  { kind: "resource", indent: 4, prefix: "│   │   └── ", name: "srch-adp-v1", meta: "Azure AI Search · Basic SKU · eastus (capacity-driven) · index adp-knowledge · 24 docs" },

  // ── DATA SUBSTRATE (Azure side) ─────────────────────────────────────────
  { kind: "category", indent: 3, prefix: "│   │   │   ", name: "DATA SUBSTRATE · 2 in RG (+ Fabric, see below)", accent: "data" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "sql-adp-v1", meta: "Azure SQL Basic · database adp-semantic · v0 fallback semantic layer" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "stadpv1", meta: "Storage account · LRS · function deployment + WebJobs" },

  // ── STATE & EVENTS ─────────────────────────────────────────────────────
  { kind: "category", indent: 3, prefix: "│   │   │   ", name: "STATE & EVENTS · 4", accent: "state" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "cdb-adp-v1", meta: "Cosmos DB · Serverless · container adp.dw-state · partition /subjectId · Decision Journal" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "evh-adp-v1", meta: "Event Hubs Standard · 1 TU · Kafka API · topic adp-v1-decisions" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "signalr-adp-v1", meta: "SignalR Service · Free_F1 · Serverless mode · hub fnoltrace (operator live tail)" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "egt-adp-v1-fanout", meta: "Event Grid topic · provisioned · idle (v1.5 dispatch)" },

  // ── IDENTITY & SECRETS ─────────────────────────────────────────────────
  { kind: "category", indent: 3, prefix: "│   │   │   ", name: "IDENTITY & SECRETS · 7", accent: "identity" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "id-adp-v1-orchestrator", meta: "User-assigned managed identity · workload: FnolOrchestrator + activities" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "id-adp-v1-decision-ingest", meta: "User-assigned MI · workload: decision-event consumer (v1.5)" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "id-adp-v1-context-router", meta: "User-assigned MI · workload: ContextRouter L5 federation" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "id-adp-v1-mcp-claim-store", meta: "User-assigned MI · workload: claim-store MCP tool (v1.5 real backend)" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "id-adp-v1-mcp-policy-store", meta: "User-assigned MI · workload: policy-store MCP tool (v1.5 real backend)" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "id-adp-v1-console-api", meta: "User-assigned MI · workload: console API surface" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "kv-adp-v1", meta: "Key Vault · Premium · reserved (idle in v1, holds Graph token cache + Foundry per-agent secrets in v1.5)" },

  // ── OBSERVABILITY ──────────────────────────────────────────────────────
  { kind: "category", indent: 3, prefix: "│   │   │   ", name: "OBSERVABILITY · 2", accent: "obs" },
  { kind: "resource", indent: 4, prefix: "│   │   ├── ", name: "log-adp-v1", meta: "Log Analytics workspace · backing store for App Insights" },
  { kind: "resource", indent: 4, prefix: "│   │   └── ", name: "appi-adp-v1", meta: "Application Insights · distributed traces · dependencies · request timing" },

  { kind: "blank", indent: 0 },

  // ── Cross-RG reuse ─────────────────────────────────────────────────────
  { kind: "container", indent: 2, prefix: "│   └── 🔗 ", name: "(cross-RG reuse) rg-microsoft-navigator", meta: "eastus2 · MS-DT navigator RG · same tenant", accent: "cross" },
  { kind: "resource", indent: 3, prefix: "│       └── ", name: "dt-navigator-openai", meta: "Azure OpenAI · gpt-4o + text-embedding-3-large · reused via Foundry connection · zero new model cost" },

  { kind: "blank", indent: 0 },

  // ── Microsoft Fabric (same tenant, separate surface) ────────────────────
  { kind: "container", indent: 1, prefix: "└── 🧵 ", name: "MICROSOFT FABRIC", meta: "same tenant · separate provisioning surface", accent: "fabric" },
  { kind: "container", indent: 2, prefix: "    └── ", name: "Capacity · offeringsfabric001", meta: "shared with MS-DT offering footprint · no new capacity provisioned", accent: "fabric" },
  { kind: "container", indent: 3, prefix: "        └── ", name: "Workspace · adp-v1", meta: "Microsoft Fabric workspace", accent: "fabric" },
  { kind: "container", indent: 4, prefix: "            └── ", name: "Lakehouse · adp", meta: "OneLake · 5 Delta tables", accent: "fabric" },
  { kind: "resource", indent: 5, prefix: "                ├── ", name: "dim_policyholder", meta: "Meridian · 1,000 rows · v1 entity dimension" },
  { kind: "resource", indent: 5, prefix: "                ├── ", name: "dim_vehicle", meta: "Meridian · 1,000 rows · v1 entity dimension" },
  { kind: "resource", indent: 5, prefix: "                ├── ", name: "fact_claims", meta: "Meridian · 1,000 rows · v1 fact table" },
  { kind: "resource", indent: 5, prefix: "                ├── ", name: "dim_borrower", meta: "Banking · 30 rows · second-industry stress test" },
  { kind: "resource", indent: 5, prefix: "                └── ", name: "fact_loan_applications", meta: "Banking · 40 rows · second-industry stress test" },
];

export function ResourceHierarchyFull() {
  const s = useStyles();
  return (
    <div className={s.wrap}>
      <Legend />
      {FULL_ROWS.map((r, i) => renderRow(s, r, i))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Compact chain (Project / What & How)
// ──────────────────────────────────────────────────────────────────────────────

const COMPACT_ROWS: TreeRow[] = [
  { kind: "container", indent: 0, prefix: "🏢 ", name: "TENANT", meta: "ibmalliance.onmicrosoft.com (Microsoft Entra ID)", accent: "rg" },
  { kind: "container", indent: 1, prefix: "│", name: "" },
  { kind: "container", indent: 1, prefix: "├── 📦 ", name: "SUBSCRIPTION", meta: "Project-IBMMSOFFERINGSPOC", accent: "rg" },
  { kind: "container", indent: 2, prefix: "│   │", name: "" },
  { kind: "container", indent: 2, prefix: "│   ├── 📁 ", name: "rg-adp-v1", meta: "eastus2 · ~18 resources · 6 logical categories · ~$3.50/day idle", accent: "rg" },
  { kind: "resource", indent: 3, prefix: "│   │       ", name: "Compute · AI · Data · State · Identity · Observability", meta: "see Docs → Deployment → Resource Group Structure for the full tree" },
  { kind: "container", indent: 2, prefix: "│   └── 🔗 ", name: "(cross-RG) rg-microsoft-navigator", meta: "same tenant · dt-navigator-openai reused for gpt-4o + embeddings", accent: "cross" },
  { kind: "container", indent: 1, prefix: "│", name: "" },
  { kind: "container", indent: 1, prefix: "└── 🧵 ", name: "MICROSOFT FABRIC", meta: "capacity offeringsfabric001 (shared) · workspace adp-v1 · Lakehouse adp · 5 Delta tables", accent: "fabric" },
];

export function ResourceHierarchyCompact() {
  const s = useStyles();
  return (
    <div className={s.wrap}>
      {COMPACT_ROWS.map((r, i) => renderRow(s, r, i))}
    </div>
  );
}
