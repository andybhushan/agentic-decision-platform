import { useState } from "react";
import { Card, Badge, tokens, Button } from "@fluentui/react-components";
import { useDocsStyles, PageHero, Section, Callout } from "../common";

interface Adr {
  id: string;
  title: string;
  status: string;
  statusColor: "success" | "warning" | "brand" | "danger";
  date: string;
  context: string;
  decision: string;
  rationale: string;
  consequences: string;
  tradeoffs?: string;
}

const ADRS: Adr[] = [
  {
    id: "ADR-0001",
    title: "Platform vs use case boundary",
    status: "Accepted · v0.6 amended",
    statusColor: "success",
    date: "2026-05-25 (v0.6 amend 2026-05-27)",
    context: "Without a discipline, use-case vocabulary (claim, policy, fraud) leaks into platform code. The platform then ossifies around one industry and the next industry costs months.",
    decision: "Two top-level folders. platform/ owns everything industry-agnostic; usecases/<industry>/ owns packages + knowledge + data + tool kits. A CI rule (scripts/check-boundary.mjs) blocks any import from platform into usecases.",
    rationale: "Folder structure is the cheapest enforcement; CI keeps it honest. The v0.6 amendment carves a narrow exception so TracesApi.csproj + PackageCompiler.csproj may reference use-case tool-kit projects (tool implementations are explicitly the use-case's contribution to the runtime).",
    consequences: "Banking stress test proves it works (zero platform changes). Folder convention is the entire contract — no platform code knows about industry names.",
    tradeoffs: "Slight extra friction when a use case wants a genuinely new IContextSource type (rare in practice).",
  },
  {
    id: "ADR-0002",
    title: "Agent package format",
    status: "Accepted (v1)",
    statusColor: "success",
    date: "2026-05-25",
    context: "How does a use case describe its agents, skills, tools, context bindings, HITL gates and invariants in a way the runtime understands?",
    decision: "Typed C# record types in PackageModel emit (via build) a JSON Schema 2020-12 artefact at platform/schemas/agent-package.v1.schema.json. Use cases author JSON; the compile pipeline validates against the schema; the runtime loads it.",
    rationale: "Schema-as-contract. JSON is portable to ops surfaces; C# types are friendlier for runtime code; JSON Schema is industry-standard.",
    consequences: "One source of truth (PackageModel records) for both the runtime and the schema. Use cases author JSON without needing the .NET SDK.",
  },
  {
    id: "ADR-0003",
    title: "Compile pipeline shape",
    status: "Accepted",
    statusColor: "success",
    date: "2026-05-25",
    context: "Should compile be a single black-box step or staged?",
    decision: "4 stages: schema · semantic · plan · sign. Each stage fails fast with a structured error. Output is a deterministic zip.",
    rationale: "Staged pipelines are debuggable: when a package fails, the failing stage is immediately obvious. Determinism matters because the bundle ships into Resources/ for the Function.",
    consequences: "adpc compile takes ~400ms for a typical package. Plenty of room for new stages later.",
  },
  {
    id: "ADR-0004",
    title: "State + bus + trace stores",
    status: "Accepted (revised)",
    statusColor: "success",
    date: "2026-05-25",
    context: "Where does run state live? Where do decision events flow? Where can traces be queried after the fact?",
    decision: "Cosmos DB serverless for run state (container adp.dw-state, partition /subjectId). Event Hubs Standard with Kafka API for the decision-event bus (topic adp-v1-decisions). RTI + medallion deferred — Cosmos query covers v1's read patterns.",
    rationale: "Cosmos is the lowest-friction durable store on Azure. Event Hubs Kafka API gives a cloud-portable consumer surface for v1.5 services that want to subscribe.",
    consequences: "DwStateWriter writes Cosmos directly from CompositeDecisionSink. DecisionPublisher pushes to Event Hubs. Both are wired into the same sink composition.",
  },
  {
    id: "ADR-0005",
    title: "Bicep vs Terraform",
    status: "Accepted",
    statusColor: "success",
    date: "2026-05-25",
    context: "Two IaC options for Azure-only workloads.",
    decision: "Bicep for resource provisioning. Terraform reserved for D9-ring automation (Foundry projects, Defender for AI policy assignment, cross-tenant work).",
    rationale: "Bicep is first-class Microsoft, integrates with az deployment group, and is the documented happy path for newer services (Foundry, AI Search). Terraform's HashiCorp provider lags Microsoft on these.",
    consequences: "13 Bicep modules. Fabric workspace + Lakehouse provisioned via REST (no Bicep provider yet) — documented exception.",
  },
  {
    id: "ADR-0006",
    title: "Console framework + state",
    status: "Accepted",
    statusColor: "success",
    date: "2026-05-25",
    context: "What's the operator surface built with? How does state flow?",
    decision: "Vite + React 19 + Fluent UI v9. REST for command (POST /api/runs · POST /resolve-hitl) and read (GET /api/traces · GET /api/aggregate/outcomes); SignalR for live tail.",
    rationale: "Fluent UI v9 is Microsoft's current design system. SignalR-on-Functions is the lowest-friction live-push primitive on Azure. Vite gives sub-second hot reload.",
    consequences: "platform/console/ is a self-contained Vite app. Two views, hash-routed (operator + docs).",
  },
  {
    id: "ADR-0007",
    title: "Agent runtime stack",
    status: "Accepted (v1 partial)",
    statusColor: "warning",
    date: "2026-05-25",
    context: "What runs the agents — chat completions, Foundry Agent Service, Foundry Local, or a mix?",
    decision: "Mix. The IAgentAdapter contract abstracts the adapter; concrete implementations cover Foundry Agent Service (Persistent Agents SDK), legacy Azure OpenAI chat-completions, and a stub. Tool surface is MCP (Model Context Protocol).",
    rationale: "Foundry Agent Service gives per-agent Entra Identity, persistent agent + thread state, and a managed function-tool loop. Legacy AOAI is the fallback while Foundry RBAC is pending. Stub enables unit tests with no LLM dependency.",
    consequences: "ADR-0013 documents the Foundry-specific implementation. Foundry adapter is code-ready; activation is pending RBAC.",
    tradeoffs: "Three adapters to keep working. Acceptable while Foundry GA stabilises.",
  },
  {
    id: "ADR-0008",
    title: "Identity, governance, security",
    status: "Accepted (v1 partial)",
    statusColor: "warning",
    date: "2026-05-25",
    context: "How are agents identified individually? How do compliance services see what agents did?",
    decision: "Entra Agent ID per agent (issued by Foundry Agent Service on agent provisioning). Defender for AI for runtime detection. Purview for policy + DLP. Sentinel for the agent-event SOC pipeline.",
    rationale: "Microsoft-native identity-first model. Per-agent identity lets policy be agent-specific, not just workload-specific.",
    consequences: "TraceStep + DecisionEvent carry an entraAgentId field (currently null until Foundry activates). v1.5 wires Defender for AI + Sentinel.",
    tradeoffs: "Defender for AI + Sentinel are not yet wired — pending Foundry RBAC activation and v1.5 work.",
  },
  {
    id: "ADR-0009",
    title: "Context layer",
    status: "Accepted",
    statusColor: "success",
    date: "2026-05-26",
    context: "Agents reason; the context layer is what they reason WITH. ICA's Context Studio exists for this reason; this is where modern Microsoft has built a platform-grade answer.",
    decision: "L5 federation. ContextRouter receives (intent, dimensions, subjectKey) and fans in parallel to Fabric IQ + Foundry IQ + Work IQ + AI Search. Returns a merged Context object tagged GROUNDED vs DERIVED.",
    rationale: "Decouples agents from sources. Each source is optimised for its access pattern; the federation interleaves at the citation level so the LLM sees evidence from all three.",
    consequences: "ContextLayer is the largest platform project (~2,500 LoC). All three sources are real and citing in production.",
  },
  {
    id: "ADR-0010",
    title: "Compute + edge hosting",
    status: "Accepted",
    statusColor: "success",
    date: "2026-05-26",
    context: "Where do workloads run — Functions, Container Apps, AKS, or Foundry Local?",
    decision: "Functions for the API + Durable orchestrator. Container Apps env provisioned for v1.5 long-lived workers (decision-ingest, MCP back-ends). SWA for the SPA. Foundry Local door-open for edge-resident agents in a later phase.",
    rationale: "Functions for HTTP-triggered + Durable; Container Apps for stateful or long-lived; SWA for static SPAs. AKS rejected as overkill at this scope.",
    consequences: "cae-adp-v1 is provisioned but idle. v1.5 promotes the decision-ingest CLI consumer to a Container App.",
  },
  {
    id: "ADR-0011",
    title: "Semantic layer SQL → Fabric",
    status: "v0 + v1 both implemented",
    statusColor: "success",
    date: "2026-05-26 (v1 added 2026-05-27)",
    context: "Where do business entities live — Azure SQL or Fabric Lakehouse?",
    decision: "Both implemented; SEMANTIC_BACKEND env var selects. v0: Azure SQL (sql-adp-v1 · adp-semantic). v1: Fabric Lakehouse (workspace adp-v1 · Lakehouse adp). One env-var flip.",
    rationale: "SQL was the quickest path to a working semantic layer in v0; Fabric is the Microsoft-native end state. Both implementations share IContextSource so the agent code never sees the difference.",
    consequences: "Current default is fabric. SQL kept warm during soak. Decommission Azure SQL when Fabric is stable for &gt;1 week.",
  },
  {
    id: "ADR-0012",
    title: "Work IQ synthetic → Graph",
    status: "v0 done",
    statusColor: "success",
    date: "2026-05-26",
    context: "Collaboration signals — Teams threads, Outlook, SharePoint — without admin-consent burden on the IBM tenant.",
    decision: "Synthetic-deterministic v0 (WorkIqSource) so demos reproduce. Real Microsoft Graph migration documented; activation in ADR-0015 (delegated scopes only).",
    rationale: "Avoids admin consent on the IBM-Alliance tenant for v0; keeps the door open for real Graph reads on the deployer's own collaboration data with delegated scopes.",
    consequences: "Cloud Function defaults to synthetic. Local CLI can opt-in to Graph with WORKIQ_BACKEND=graph.",
  },
  {
    id: "ADR-0013",
    title: "Foundry Agent Service",
    status: "Code done · RBAC pending",
    statusColor: "warning",
    date: "2026-05-28",
    context: "Earlier FoundryAdapter was actually Azure OpenAI chat-completions — honest naming required either a rename or a real implementation.",
    decision: "Real implementation. FoundryAdapter rewritten on Azure.AI.Agents.Persistent (Persistent Agents SDK). Ensure-create-by-name pattern, threads + runs + RequiresAction tool dispatch. Provisioning ties each agent to a persistent Foundry agent with an Entra Agent ID.",
    rationale: "Per-agent Entra Identity, persistent agent + thread state, function-tool loop handled by Foundry. Sets up the Defender for AI / Sentinel / Purview wiring for v1.5.",
    consequences: "Activation requires two az role assignment create commands (Azure AI User role on the AIServices account). Function stays on the legacy adapter until these are granted.",
    tradeoffs: "Activation has an out-of-band dependency on Owner privileges. Code path is verified locally; live Function uses LegacyOpenAIAdapter today.",
  },
  {
    id: "ADR-0014",
    title: "Fabric IQ aggregation primitives",
    status: "Accepted (v1)",
    statusColor: "success",
    date: "2026-05-28",
    context: "Saying 'Fabric IQ' while only doing row-level SELECTs is misleading. Real Fabric IQ value comes from aggregations.",
    decision: "Add 4 GROUP BY aggregation primitives over the existing Lakehouse tables: severity-distribution-by-state, hour-of-day-concentration, state-loss-ratio, incident-type-mix-by-state. Plus the row-level primitives. Total 8 primitives.",
    rationale: "These are exactly the aggregations a Power BI semantic model would expose as named measures. Doing them in SQL today gives the same agent context without requiring full PBI Direct Lake setup.",
    consequences: "Fraud-pattern-scan + damage-categorize agents now cite Fabric aggregates alongside row-level facts. Full PBI semantic model with DAX measures is the v1.5 enhancement.",
    tradeoffs: "Aggregations aren't cached as DAX measures would be. At v1 query volume this is invisible; at scale, a v1.5 PBI model becomes worthwhile.",
  },
  {
    id: "ADR-0015",
    title: "Microsoft Graph Work IQ (delegated)",
    status: "Code done · tenant seed pending",
    statusColor: "warning",
    date: "2026-05-28",
    context: "ADR-0012 said 'Work IQ via Graph in v1' but kept it synthetic in v0. v1 needs the real Graph reader, with the tenant-compliance constraint that admin-consent app-only scopes are off-limits.",
    decision: "MicrosoftGraphWorkIqSource implements IContextSource using raw HTTP against Graph (/me/messages, /me/drive/root/search, /me/calendarView). Delegated scopes only (Mail.Read, Files.Read.All, Calendars.Read). WORKIQ_BACKEND env var selects synthetic vs graph.",
    rationale: "Delegated scopes mean the deployer signs in interactively and the source reads the deployer's own collaboration data. Zero admin-consent risk on the IBM tenant.",
    consequences: "Local CLI activates by setting WORKIQ_BACKEND=graph. Cloud Function MI stays on synthetic (admin consent would be required). Meaningful demos require the deployer to seed their own Outlook/OneDrive/Calendar with claim-id references.",
  },
  {
    id: "ADR-0016",
    title: "Schema-aware semantic primitive",
    status: "Accepted (v1, Track 5)",
    statusColor: "success",
    date: "2026-05-28",
    context: "Meridian primitives like policyholder-history and similar-claims were hard-coded to dim_policyholder + fact_claims. Banking has a different shape (dim_borrower + fact_loan_applications). To prove agnosticism without forking the L5 source, the primitive needs to be schema-aware.",
    decision: "New named primitive entity-history. Driven by digitalWorker.schemaBinding in the package: primary entity table + primary key, secondary entity table + primary key + foreign key, similarity filters. FabricLakehouseSource templates the SQL off the schema binding.",
    rationale: "One source, two industries. The package describes its shape; the source emits the right SQL. No Meridian code is touched when banking activates.",
    consequences: "Banking's evaluate-eligibility intent cites BORROWER_HISTORY/BOR-013 from Fabric. The boundary holds.",
  },
];

export function AdrsPage() {
  const s = useDocsStyles();
  const [filter, setFilter] = useState<"all" | "accepted" | "partial">("all");

  const filtered = ADRS.filter((a) => {
    if (filter === "all") return true;
    if (filter === "accepted") return a.statusColor === "success";
    if (filter === "partial") return a.statusColor === "warning";
    return true;
  });

  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Decisions"
        title="16 Architecture Decision Records"
        lead="Every substantive architectural decision documented with context, options considered, decision, rationale, consequences, and trade-offs. Source-of-record markdown lives in docs/adr/."
        badges={[
          { label: "16 total", color: "brand" },
          { label: `${ADRS.filter((a) => a.statusColor === "success").length} fully accepted`, color: "success" },
          { label: `${ADRS.filter((a) => a.statusColor === "warning").length} partial / pending`, color: "warning" },
        ]}
      />

      <Section title="Filter">
        <div style={{ display: "flex", gap: "8px" }}>
          <Button appearance={filter === "all" ? "primary" : "secondary"} size="small" onClick={() => setFilter("all")}>All ({ADRS.length})</Button>
          <Button appearance={filter === "accepted" ? "primary" : "secondary"} size="small" onClick={() => setFilter("accepted")}>Fully accepted ({ADRS.filter((a) => a.statusColor === "success").length})</Button>
          <Button appearance={filter === "partial" ? "primary" : "secondary"} size="small" onClick={() => setFilter("partial")}>Partial / pending ({ADRS.filter((a) => a.statusColor === "warning").length})</Button>
        </div>
      </Section>

      <Section title="Decisions">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filtered.map((adr) => (
            <Card key={adr.id} style={{ overflow: "hidden", padding: 0, borderLeft: `4px solid ${adr.statusColor === "success" ? tokens.colorPaletteGreenBorderActive : tokens.colorPaletteYellowBorderActive}` }}>
              <div style={{
                padding: "12px 20px",
                backgroundColor: tokens.colorNeutralBackground2,
                borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}>
                <span style={{ fontFamily: "Consolas, monospace", fontSize: "12px", color: tokens.colorBrandForeground1, fontWeight: 700 }}>{adr.id}</span>
                <span style={{ fontSize: "15px", fontWeight: 600, color: tokens.colorNeutralForeground1, flex: 1 }}>{adr.title}</span>
                <Badge size="small" appearance="outline" color={adr.statusColor}>{adr.status}</Badge>
                <span style={{ fontSize: "11px", color: tokens.colorNeutralForeground3 }}>{adr.date}</span>
              </div>
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { label: "Context", body: adr.context },
                  { label: "Decision", body: adr.decision, strong: true },
                  { label: "Rationale", body: adr.rationale },
                  { label: "Consequences", body: adr.consequences },
                  ...(adr.tradeoffs ? [{ label: "Trade-offs accepted", body: adr.tradeoffs }] : []),
                ].map((sec) => (
                  <div key={sec.label}>
                    <div style={{ fontSize: "10px", color: tokens.colorNeutralForeground3, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "4px" }}>{sec.label}</div>
                    <div style={{ fontSize: "13px", color: sec.strong ? tokens.colorNeutralForeground1 : tokens.colorNeutralForeground2, lineHeight: 1.55, fontWeight: sec.strong ? 500 : 400 }}>{sec.body}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Callout>
        The markdown source-of-record for each ADR is at <code>docs/adr/&lt;id&gt;-&lt;slug&gt;.md</code> in the repo.
        ADR-0011, 0013, 0014, 0015, 0016 were authored or amended during the 2026-05-28 v1.0 build.
      </Callout>
    </div>
  );
}
