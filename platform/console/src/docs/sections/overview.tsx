import { Card, Title2, tokens } from "@fluentui/react-components";
import { useDocsStyles, PageHero, Section, Diagram, Callout, StatCard, InfoCard, Narrative, ComponentsGrid, Caption1 } from "../common";
import { SystemOverviewDiagram } from "../diagrams";
import { OutcomesPanel } from "../../OutcomesPanel";

// ============= 1. Welcome / Home =============
export function HomePage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Docs · v1.0 · technical reference"
        title="Project ADP · documentation"
        lead="The technical reference for what's built, where it lives, and how it runs. For the project narrative — strategy, vision, methodology, roadmap — see the Project tab in the top nav."
        badges={[
          { label: "v1.0 live · 2026-05-29", color: "success" },
          { label: "5 packages deployed", color: "brand" },
          { label: "16 ADRs", color: "brand" },
          { label: "2 industries proven", color: "brand" },
          { label: "24 knowledge docs", color: "brand" },
        ]}
      />

      <Section title="What this docs portal covers" lead="Everything from mission and vision down to the exact Azure resource names and Bicep modules. Use the left nav to jump between Overview, Platform, Use Cases, Deployment, Decisions and Reference.">
        <div className={s.statGrid}>
          <StatCard n="3" label="docs sections" />
          <StatCard n="20+" label="documentation pages" />
          <StatCard n="10" label="SVG architecture diagrams" />
          <StatCard n="16" label="ADRs documented" />
          <StatCard n="4" label="Digital Workers in production" />
          <StatCard n="2" label="industries proven" />
        </div>
      </Section>

      <Section title="The architecture poster" lead="Generated through the Project · Studio with the v1.0 architecture-poster preset. Captures the as-deployed stack — ten platform layers, L5 federation, five Digital Workers, IBM + Microsoft co-brand.">
        <div style={{ borderRadius: "10px", overflow: "hidden", border: `1px solid ${tokens.colorNeutralStroke2}`, backgroundColor: "#0b1220" }}>
          <img
            src="/images/adp/pi-poster.png"
            alt="Project ADP v1.0 architecture poster — ten layers, L5 federation, five Digital Workers"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
        <Caption1 style={{ marginTop: "8px", color: tokens.colorNeutralForeground3, fontStyle: "italic" }}>
          Generated via OpenAI gpt-image-1 through the Studio page. Source prompt available in the Project · Studio preset library. Regenerate at any time by visiting Project · Studio.
        </Caption1>
      </Section>

      <Section title="Highest-level system view">
        <Narrative>
          At its broadest, ADP is two pipelines glued together. <b>Build-time</b> takes a declarative agent package authored in JSON, runs it through the four-stage compile pipeline, and emits a signed bundle. <b>Run-time</b> loads that bundle into an Azure Functions worker, executes the agents under a Durable orchestrator, federates context across three IQ sources for every step, evaluates HITL gates, and writes every decision to a journal in Cosmos while pushing live updates to the operator console over SignalR.
        </Narrative>
        <Diagram caption="Build-time on top produces a signed package zip. The bundle copies into Resources/ and is loaded by the run-time. Run-time at the bottom hosts the FnolOrchestrator, calls L5 federation + the LLM on every step, sinks decisions to Cosmos + Event Hubs, and pushes live events to the operator over SignalR.">
          <SystemOverviewDiagram />
        </Diagram>
      </Section>

      <Section title="Three primary user paths" lead="The portal is read as a deep technical reference. Most readers fall into one of three modes.">
        <div className={s.threeCol}>
          <InfoCard label="1. Architect" title="Read me top-to-bottom">
            Start with <b>Mission · Vision · Goals</b>, then walk the <b>Ten Platform Layers</b>, <b>Application Architecture</b> and the <b>L5 Federation</b>. End on <b>ADRs</b>.
          </InfoCard>
          <InfoCard label="2. Operator" title="Show me the demo">
            Read <b>Meridian · Overview</b>, then <b>Meridian · 4 Digital Workers</b>, then jump to the live operator console via the top-right nav.
          </InfoCard>
          <InfoCard label="3. Engineer" title="Reproduce the deploy">
            Skim <b>Application Architecture</b>, then read <b>Deployment Topology</b>, <b>Bicep & IaC</b>, and the <b>Provisioning Runbook</b>.
          </InfoCard>
        </div>
      </Section>

      <Callout>
        <b>Live console + docs:</b> https://witty-sea-0d12a380f.7.azurestaticapps.net<br />
        <b>API:</b> https://func-adp-v1-fnol.azurewebsites.net/api<br />
        <b>Repo:</b> <code>Project ADP/adp-v1/</code>
      </Callout>
    </div>
  );
}

// ============= 2. Mission · Vision · Goals =============
export function MissionPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Overview"
        title="Mission · Vision · Goals"
        lead="What ADP exists to do, the long-arc bet, and the specific v1.0 deliverables that prove it."
      />

      <Section title="Mission" lead="One sentence; the platform either holds this or it doesn't.">
        <Card className={s.card} style={{ borderLeft: `4px solid ${tokens.colorBrandStroke1}` }}>
          <Title2 style={{ fontSize: "20px", fontWeight: 700 }}>Run claim operations agentically, end-to-end.</Title2>
          <p className={s.cardBody}>
            From FNOL through Damage Assessment, Fraud Investigation, and Settlement — every decision made by a named
            agent, every output grounded in cited sources, every consequential moment gated by a human-in-the-loop.
            Auditable, replayable, accountable.
          </p>
        </Card>
        <Narrative>
          The mission is deliberately specific. Not "AI helps in the claim process" — that bar has been cleared by ten different point tools for ten years. The platform-grade bar is that the <i>reasoning across steps</i>, not just the OCR or the rate-lookup, is now done by named agents whose decisions are recorded as decisions (not reconstructed from email later). <b>Agentic</b> means a Digital Worker owns a phase of the lifecycle and the agents inside it cooperate on the same claim. <b>Grounded</b> means every output cites the source fragments that produced it. <b>HITL</b> means the orchestration pauses on consequential moments and waits for a human — not at the end as a rubber stamp, but inline as a first-class state. <b>Auditable</b> means the Decision Journal is the audit surface, not a retrospective reconstruction.
        </Narrative>
      </Section>

      <Section title="Vision" lead="Where Client Zero ends and the platform's long arc begins.">
        <Card className={s.card} style={{ borderLeft: `4px solid ${tokens.colorPalettePurpleBorderActive}` }}>
          <Title2 style={{ fontSize: "20px", fontWeight: 700 }}>The platform under any frontier firm's vertical operations.</Title2>
          <p className={s.cardBody}>
            Meridian P&C Auto is Client Zero. The boundary between platform and use case is mechanical — banking proved
            it with a 2-agent stress test (zero platform changes). Healthcare, public sector, supply chain are sibling
            folders under <code>usecases/</code>. The platform is Microsoft-native, customer-facing, single-industry-deep
            — distinguished by depth, not breadth.
          </p>
        </Card>
        <Narrative>
          The bet is that the value of an agentic platform comes from <b>depth in one vertical</b> not breadth across many. Going wide gives demos; going deep gives production. Meridian P&amp;C Auto is the first industry the platform is depth-tuned for — 19 PAC-* knowledge docs, 3 Fabric Delta tables, 4 MCP tools, 4 Digital Workers across the lifecycle, state-aware regulatory reasoning across CA / NY / TX / FL / MA / IL with NAIC default. The boundary between platform and use case is enforced at the import level (<code>scripts/check-boundary.mjs</code> in CI) so that depth in one industry doesn't fork the platform — and so that a second industry costs new <code>usecases/</code> folder work, not platform refactoring. Banking is the proof point: two agents, two knowledge docs, two tools, zero platform changes.
        </Narrative>
      </Section>

      <Section title="v1.0 Goals — all four delivered">
        <div className={s.twoCol}>
          <InfoCard label="Goal 1" title="Honest IQ federation on real Microsoft services">
            Three independent context sources — <b>Foundry IQ</b> (Azure AI Search), <b>Fabric IQ</b> (Lakehouse + 4
            aggregation primitives + 1 schema-aware primitive), <b>Work IQ</b> (synthetic-deterministic default + real
            Microsoft Graph code path) — all running and all citing in production traces.
          </InfoCard>
          <InfoCard label="Goal 2" title="Full Meridian lifecycle">
            Four Digital Workers covering <b>FNOL → Damage → Fraud → Settlement</b>. Three HITL gate types
            (confidence-based, field-value, mandatory-band). 19 PAC-* knowledge docs governing reasoning. One bounded-reasoning
            zone for the fraud-pattern-scan agent.
          </InfoCard>
          <InfoCard label="Goal 3" title="Demonstrable agnosticism">
            Banking stress test in its own folder with zero Meridian intent names, table names, or tool IDs in <code>platform/src/</code>.
            Boundary enforced at the CI level by <code>scripts/check-boundary.mjs</code>.
          </InfoCard>
          <InfoCard label="Goal 4" title="Stakeholder-grade demo surface">
            Operator console with 8 buttons across 4 DWs and live SignalR tail; this docs portal SPA with 20+ pages,
            architecture diagrams as inline SVG, and 16 documented ADRs.
          </InfoCard>
        </div>
      </Section>

      <Section title="Honesty floor" lead="What v1.0 is NOT, deliberately.">
        <Callout variant="warn">
          The platform doesn't pretend to be more done than it is. Foundry Agent Service code is ready but RBAC is pending;
          Microsoft Graph Work IQ needs tenant seeding; the full Power BI semantic model with named DAX measures is a
          v1.5 enhancement. Each gap is documented in an ADR and tracked in <b>Reference → Honest Gaps · v1.5</b>.
        </Callout>
      </Section>
    </div>
  );
}

// ============= 3. System Overview =============
export function SystemOverviewPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Overview"
        title="System Overview"
        lead="The platform accepts a declarative agent package, compiles it, executes it under Durable orchestration, and emits an auditable decision trace with HITL pause/resume — all on Microsoft Azure."
      />

      <Section title="Build-time / Run-time at a glance">
        <Diagram caption="Build-time emits a signed package zip. Run-time loads it into the platform runtime. The runtime emits a decision journal and live tail back to the operator surface.">
          <SystemOverviewDiagram />
        </Diagram>
      </Section>

      <Section title="The runtime in one paragraph">
        <Narrative>
          The runtime is an Azure Functions worker hosting one Durable orchestrator (<code>FnolOrchestrator</code>) and three activities (<code>PrepareRunActivity</code>, <code>RunStepActivity</code>, <code>ResolveHitlActivity</code>). The orchestrator loads the bundled package, then iterates agents. For each agent it calls <code>StepRunner.RunStepAsync</code>, which (1) fans a context request to the three L5 IQ sources in parallel, (2) calls the LLM adapter (Foundry Agent Service in ready code, Azure OpenAI chat-completions in live default), (3) dispatches any MCP tool calls through the industry-aware tool registry, (4) evaluates HITL gates, and (5) writes the step event to Cosmos + SignalR + Event Hubs via a composite decision sink. If a HITL gate trips, the orchestrator waits on a Durable external event; the operator clicks Approve / Escalate in the console, which raises the event and resumes the orchestration.
        </Narrative>
      </Section>

      <Section title="Components in the highest-level view" lead="What each box in the system-overview diagram actually is.">
        <ComponentsGrid items={[
          { icon: "dotnet", role: "Build-time", name: "Agent Package", body: <>Declarative JSON describing a Digital Worker — agents, skills, tools, context bindings, HITL gates, invariants, bounded reasoning zones. Validated against <code>agent-package.v1.schema.json</code> (JSON Schema 2020-12).</>, resource: "usecases/<x>/packages/*.json" },
          { icon: "dotnet", role: "Build-time", name: "Compile Pipeline", body: <>Four-stage <code>adpc compile</code> CLI: <b>schema validate</b> → <b>semantic validate</b> → <b>plan generate</b> → <b>sign + bundle</b>. Runs in ~400ms for a typical package.</>, resource: "platform/src/PackageCompiler" },
          { icon: "dotnet", role: "Build-time", name: "Signed Bundle", body: <>Reproducible zip — <code>manifest.json</code>, <code>provenance.json</code>, <code>plan.json</code>, plus the input <code>package.json</code>. Copies into <code>Resources/</code> for the Function to load at run-time.</>, resource: "build/<package>.zip" },
          { icon: "swa", role: "Run-time · UX", name: "Operator Console", body: <>Vite + React 19 + Fluent UI v9 SPA. Eight run buttons across 4 DWs × 2 modes (normal / forced-HITL); SignalR live tail; HITL Approve / Escalate; trace viewer.</>, resource: "swa-adp-v1-console" },
          { icon: "functions", role: "Run-time · entry", name: "RunFnol Function", body: <>HTTP trigger at <code>POST /api/runs</code>. Validates input, schedules a new Durable orchestration, returns <code>202</code> with run URLs.</>, resource: "func-adp-v1-fnol" },
          { icon: "durable", role: "Run-time · orchestration", name: "FnolOrchestrator", body: <>Durable orchestrator. Calls <code>PrepareRunActivity</code> once, then loops <code>RunStepActivity</code> per agent. Awaits <code>WaitForExternalEvent("HitlResolution")</code> when a gate trips.</>, resource: "TracesApi/Functions/FnolOrchestrator.cs" },
          { icon: "foundry", role: "Run-time · agent", name: "StepRunner", body: <>The single-step engine shared by both the CLI and cloud paths. Fetches L5 context, calls the LLM adapter, dispatches MCP tools, evaluates HITL gates, sinks the decision.</>, resource: "platform/src/Orchestration/StepRunner.cs" },
          { icon: "foundry", role: "Run-time · context", name: "L5 Federation", body: <>ContextRouter fans every request to <b>Foundry IQ</b> (AI Search) + <b>Fabric IQ</b> (Lakehouse) + <b>Work IQ</b> (synthetic / Graph) in parallel and merges fragments.</>, resource: "platform/src/ContextLayer" },
          { icon: "openai", role: "Run-time · reasoning", name: "Azure OpenAI gpt-4o", body: <>The reasoning engine. Reused <code>dt-navigator-openai</code> account (cross-RG) so no new model cost. Surfaced via the Foundry adapter or the legacy chat-completions adapter.</>, resource: "dt-navigator-openai (rg-microsoft-navigator)" },
          { icon: "cosmos", role: "Run-time · state", name: "Cosmos · dw-state", body: <>Decision Journal. Container <code>adp.dw-state</code>, partition <code>/subjectId</code>. Every step writes a <code>DecisionEvent</code>; the trace endpoint reads back by subject.</>, resource: "cdb-adp-v1" },
          { icon: "eventhubs", role: "Run-time · bus", name: "Event Hubs Kafka", body: <>Decision event bus. Topic <code>adp-v1-decisions</code>. Kafka API surface for v1.5 Container App consumers.</>, resource: "evh-adp-v1" },
          { icon: "signalr", role: "Run-time · live", name: "SignalR Service", body: <>Hub <code>fnoltrace</code>, free tier. Keyed by <code>subjectId</code>. Pushes step events to the operator console as they land — typical end-to-end latency under one second.</>, resource: "signalr-adp-v1" },
        ]} />
      </Section>

      <Section title="What's in the box (v1.0)" lead="One number per layer, summarising the stack.">
        <div className={s.statGrid}>
          <StatCard n="2" label="LLM adapters" />
          <StatCard n="3" label="IQ sources federated" />
          <StatCard n="5" label="Delta tables (Fabric)" />
          <StatCard n="6" label="MCP tools (4 Meridian + 2 banking)" />
          <StatCard n="8" label="Fabric IQ primitives" />
          <StatCard n="4" label="Durable orchestrators / activities" />
          <StatCard n="10" label="Azure Functions hosted" />
          <StatCard n="13" label="Bicep modules" />
          <StatCard n="14" label="agent steps per claim lifecycle" />
          <StatCard n="16" label="ADRs accepted" />
          <StatCard n="19+2" label="knowledge docs indexed" />
          <StatCard n="~20" label="Azure resources" />
        </div>
      </Section>
    </div>
  );
}

// ============= 4. Technology Stack =============
const STACK = [
  { layer: "Runtime", items: [".NET 10", "Azure Functions (Flex Consumption · isolated worker)", "Microsoft Durable Functions", "Azure.AI.Agents.Persistent (Foundry SDK)", "Azure.AI.OpenAI", "Microsoft.Data.SqlClient (Fabric SQL endpoint)"] },
  { layer: "Front-end", items: ["Vite", "React 19", "Fluent UI v9", "TypeScript 5", "SignalR client (live tail)"] },
  { layer: "Storage", items: ["Microsoft Fabric Lakehouse (Delta tables)", "Cosmos DB (Serverless)", "Azure SQL (Basic, fallback)", "Azure Storage (function deployment + WebJobs)"] },
  { layer: "AI & search", items: ["Azure OpenAI gpt-4o", "Azure OpenAI text-embedding-3-large", "Azure AI Search (vector + hybrid)", "Azure AI Foundry Agent Service"] },
  { layer: "Messaging", items: ["Event Hubs (Kafka API)", "Azure SignalR Service", "Event Grid topic (fan-out, idle)"] },
  { layer: "Identity & security", items: ["Entra ID + per-workload managed identities", "Key Vault (idle)", "Entra Agent ID (per agent · pending RBAC)"] },
  { layer: "Compute hosting", items: ["Azure Functions FC1 (Flex Consumption)", "Container Apps env (provisioned, idle)", "Static Web Apps (Free)"] },
  { layer: "Observability", items: ["Application Insights", "Log Analytics", "Decision Journal (Cosmos)", "Live tail (SignalR)"] },
  { layer: "IaC & tools", items: ["Bicep (13 modules)", "PowerShell + Azure CLI", "az functionapp deployment source config-zip", "npx @azure/static-web-apps-cli"] },
  { layer: "Boundary enforcement", items: ["scripts/check-boundary.mjs (Node script)", "Platform → use case import banned at CI", "Tool-kit project references allow-listed"] },
];
export function TechStackPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Overview"
        title="Technology Stack"
        lead="Microsoft-first, .NET 10 on the back end, React 19 + Fluent UI on the front end, Microsoft Fabric Lakehouse as the semantic store, Azure AI Foundry as the agent runtime."
      />

      <Section title="Stack by layer">
        <div className={s.twoCol}>
          {STACK.map((g) => (
            <Card key={g.layer} className={s.card}>
              <span className={s.cardLabel}>{g.layer}</span>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: tokens.colorNeutralForeground2, lineHeight: 1.55 }}>
                {g.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Versions pinned (Directory.Packages.props)">
        <div className={s.codeBlock}>{`Azure.AI.Agents.Persistent                      1.1.0
Azure.AI.OpenAI                                 2.1.0
Azure.Identity                                  1.13.1
Azure.Messaging.EventHubs                       5.11.5
Azure.Storage.Blobs                             12.23.0
Microsoft.Azure.Cosmos                          3.46.0
Microsoft.Azure.Functions.Worker                2.0.0
Microsoft.Azure.Functions.Worker.Extensions.*   (matrix)
Microsoft.Data.SqlClient                        5.2.2
Microsoft.DurableTask.Client                    1.4.0
Microsoft.Extensions.Azure                      1.10.0
SignalR Service (server: 1.x via Functions ext.)
React                                           19.0.0
Vite                                            6.0.x
@fluentui/react-components                      9.x
TypeScript                                      5.6.x`}</div>
      </Section>

      <Section title="Why these picks · short rationale">
        <table className={s.table}>
          <thead>
            <tr><th>Choice</th><th>Why</th></tr>
          </thead>
          <tbody>
            <tr><td><b>.NET 10 isolated worker</b></td><td>Latest LTS-track; same process model as Foundry Agent SDK; Durable Functions matures fastest in .NET stack.</td></tr>
            <tr><td><b>Durable Functions (not Logic Apps)</b></td><td>HITL = a 30-minute wait inside an orchestration. Durable's <code>WaitForExternalEvent</code> is the cleanest pause/resume primitive in Azure.</td></tr>
            <tr><td><b>Microsoft Fabric Lakehouse</b></td><td>Microsoft-native semantic layer. SQL analytics endpoint gives the same SqlClient interface as Azure SQL — one source can target either with an env var flip.</td></tr>
            <tr><td><b>Foundry Agent Service</b></td><td>Per-agent Entra Identity, persistent agent + thread state, function-tool loop handled by the service. Replaces our in-process chat-completions loop.</td></tr>
            <tr><td><b>Vite + React 19</b></td><td>Sub-second hot reload; Fluent UI 9 is Microsoft's current design system; SignalR client integrates without ceremony.</td></tr>
            <tr><td><b>Bicep, not Terraform</b></td><td>First-class Microsoft; deployment-group commands integrate with az CLI; ADR-0005 has the full comparison.</td></tr>
            <tr><td><b>Static Web Apps Free</b></td><td>Operator + docs portal both ship from one Free SWA. Zero per-MAU cost; deploy via SWA CLI.</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ============= 5. Live Status =============
export function LiveStatusPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Overview"
        title="Live Operational Status"
        lead="Aggregate read of the Decision Journal in Cosmos DB, refreshed every 30 seconds. The numbers below are real-time from the production deployment."
      />

      <Section title="Last 24 hours">
        <OutcomesPanel windowHours={24} />
      </Section>

      <Section title="What this proves" lead="The panel is wired through the same GET /api/aggregate/outcomes endpoint that the operator console uses; SignalR live tail uses the same Cosmos partition; the numbers can't drift from what's actually been processed.">
        <div className={s.threeCol}>
          <InfoCard label="Grounding" title="Citations on every step">
            <code>groundedStepRate</code> reports the fraction of step outputs that include at least one source citation. Target: 95%+.
          </InfoCard>
          <InfoCard label="Confidence" title="Average reasoning confidence">
            <code>avgConfidence</code> is the mean of <code>result.Confidence</code> across all completed steps. Low confidence trips a HITL gate.
          </InfoCard>
          <InfoCard label="HITL discipline" title="Paused steps awaiting resolution">
            <code>stepsNeedingHumanReview</code> = steps currently held by Durable's <code>WaitForExternalEvent</code>. Tracked per claim.
          </InfoCard>
        </div>
      </Section>

      <Section title="Reading the panel">
        <table className={s.table}>
          <thead>
            <tr><th>Metric</th><th>Definition</th><th>Source</th></tr>
          </thead>
          <tbody>
            <tr><td>Claims handled</td><td>distinct <code>subjectId</code>s with at least one step in window</td><td>Cosmos <code>dw-state</code></td></tr>
            <tr><td>Decision traces</td><td>distinct <code>traceId</code>s — typically claims-handled + retries</td><td>Cosmos <code>dw-state</code></td></tr>
            <tr><td>Agent steps</td><td>step events; usually 4 per package run</td><td>Cosmos <code>dw-state</code></td></tr>
            <tr><td>Grounded rate</td><td>steps where <code>citedSources.length &gt; 0</code></td><td>derived from decision sink output</td></tr>
            <tr><td>Avg confidence</td><td>arithmetic mean of <code>result.Confidence</code></td><td>per-step JSON sidecar</td></tr>
            <tr><td>HITL paused</td><td>steps with <code>status == "needs-human-review"</code></td><td>orchestrator state</td></tr>
            <tr><td>Avg step ms</td><td>activity end-to-end wall time</td><td>activity timing</td></tr>
            <tr><td>Runs by package</td><td>count of orchestrator instances per <code>packageId</code></td><td>orchestrator metadata</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}
