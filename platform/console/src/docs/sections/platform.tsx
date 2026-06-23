import { tokens } from "@fluentui/react-components";
import { useDocsStyles, PageHero, Section, Diagram, Callout, InfoCard, Narrative, ComponentsGrid } from "../common";
import {
  TenLayersDiagram,
  ApplicationArchitectureDiagram,
  CompilePipelineDiagram,
  RuntimeSequenceDiagram,
  L5FederationDiagram,
  HitlStateMachineDiagram,
  BoundaryDiagram,
} from "../diagrams";

// ============= Platform · Ten Layers =============
export function PlatformLayersPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Platform"
        title="Ten Platform Layers"
        lead="A vertical stack with explicit responsibilities. Use cases plug in at L3 (agents), L5 (context primitives), and L7 (data). Everything else is invariant across industries."
      />

      <Section title="The stack" lead="Each layer has a sharply scoped responsibility and a Microsoft-native default service.">
        <Narrative>
          The ten layers are not abstract — each one maps to one or two concrete Azure services and to specific files in the repo. The discipline is that responsibilities don't bleed across layers: identity is L1, never embedded in agent code; orchestration is L4, never reimplemented in the experience layer; context is L5, never short-circuited by agents calling stores directly. Use cases plug in at exactly three layers — L3 (declare agents in JSON packages), L5 (declare which named primitives each intent binds to), L7 (contribute their own Delta tables + knowledge docs + claim corpus). Everything else stays invariant.
        </Narrative>
        <Diagram caption="Status legend: solid colour band on the left = built and serving · ⏸ next to a service name = specced in an ADR but deferred to v1.5+. L5 (purple band) and L7 (green band) are the two layers most relevant to use-case authors.">
          <TenLayersDiagram />
        </Diagram>
      </Section>

      <Section title="Components in the ten-layer stack" lead="What lives at each layer, with the canonical service or code path.">
        <ComponentsGrid items={[
          { icon: "entra", role: "L1 Identity & Governance", name: "Entra ID + Entra Agent ID", body: <>Per-workload identity via 6 user-assigned MIs; per-agent identity via Entra Agent ID (issued by Foundry Agent Service on agent provisioning). Defender for AI / Purview / Sentinel wiring documented, v1.5 follow-on.</> },
          { icon: "swa", role: "L2 Experience", name: "Operator Console + Docs Portal", body: <>SWA Free hosts both surfaces. Hash-routed: <code>#operator</code> for the live workflow, <code>#docs/&lt;route&gt;</code> for this portal. SignalR live tail + HITL Approve / Escalate.</> },
          { icon: "foundry", role: "L3 Agent Runtime", name: "FoundryAdapter + LegacyOpenAIAdapter", body: <>Two adapters implementing <code>IAgentAdapter</code>. Foundry code-ready (Persistent Agents SDK); Legacy active default. <code>AgentAdapterFactory</code> routes by <code>AGENT_BACKEND</code> env var.</> },
          { icon: "durable", role: "L4 Orchestration", name: "Durable Functions", body: <>One orchestrator (<code>FnolOrchestrator</code>) + three activities. HITL pause/resume via <code>WaitForExternalEvent("HitlResolution", 30min)</code>. Replay-based execution survives Function host restarts.</> },
          { icon: "foundry", role: "L5 Context (Trio)", name: "ContextRouter + 3 IContextSources", body: <>Generic router fans to <b>Foundry IQ</b> (AI Search) + <b>Fabric IQ</b> (Lakehouse) + <b>Work IQ</b> (synthetic / Graph) in parallel. Largest project: ~2,500 LoC.</> },
          { icon: "cosmos", role: "L6 State & Events", name: "Cosmos + Event Hubs + SignalR", body: <>Cosmos <code>dw-state</code> for persistent state (Decision Journal). Event Hubs Kafka for the decision-event bus. SignalR for live push to the operator. Event Grid topic provisioned (idle).</> },
          { icon: "fabric", role: "L7 Data Substrate", name: "Fabric Lakehouse + Azure OpenAI", body: <>Fabric workspace <code>adp-v1</code> with Lakehouse <code>adp</code> (5 Delta tables). Reused <code>dt-navigator-openai</code> for gpt-4o + text-embedding-3-large. Azure SQL fallback (<code>SEMANTIC_BACKEND=sql</code>).</> },
          { icon: "functions", role: "L8 Compute & Hosting", name: "Functions + Container Apps + SWA", body: <>Functions Flex Consumption hosts the workload. Container Apps env is provisioned for v1.5 long-lived workers. SWA Free hosts the SPA.</> },
          { icon: "bicep", role: "L9 IaC & Automation", name: "Bicep + PowerShell + az CLI", body: <>13 Bicep modules cover 18 of 19 resources. The 19th (Fabric workspace + Lakehouse) is provisioned by <code>scripts/provision-fabric.ps1</code> via Fabric REST.</> },
          { icon: "logs", role: "L10 Observability", name: "App Insights + Log Analytics", body: <>Distributed traces + exceptions + dependencies + request timing. Decision Journal in Cosmos is the agent-level audit surface; the trace endpoint and live tail expose it to the operator.</> },
        ]} />
      </Section>

      <Section title="Layer-by-layer responsibilities">
        <table className={s.table}>
          <thead>
            <tr><th>Layer</th><th>Responsibility</th><th>What's built</th></tr>
          </thead>
          <tbody>
            <tr><td><b>L1 · Identity & Governance</b></td><td>Per-workload identity, per-agent identity, run-time policy, audit propagation</td><td>Entra Agent ID stub bound to traces. Defender for AI · Purview · Sentinel ⏸</td></tr>
            <tr><td><b>L2 · Experience</b></td><td>Operator UX, live tail, HITL approval surface, docs portal</td><td>Operator Console + this Docs Portal (SWA Free), SignalR live tail, Approve / Escalate</td></tr>
            <tr><td><b>L3 · Agent Runtime</b></td><td>LLM adapter abstraction, function-calling loop, per-agent identity propagation</td><td><code>FoundryAdapter</code> (Persistent Agents SDK · code ready), <code>LegacyOpenAIAdapter</code> (active fallback), <code>StubAdapter</code>, <code>AgentAdapterFactory</code> env-routing</td></tr>
            <tr><td><b>L4 · Orchestration</b></td><td>Per-step execution, HITL pause/resume, retry, multi-agent cascade</td><td><code>FnolOrchestrator</code> + 3 activities. Durable's <code>WaitForExternalEvent</code> for HITL.</td></tr>
            <tr><td><b>L5 · Context (L5 Trio)</b></td><td>Federated knowledge / data / collaboration access via named primitives</td><td>Foundry IQ (AI Search) · Fabric IQ (Lakehouse + 8 primitives) · Work IQ (synthetic + Graph code)</td></tr>
            <tr><td><b>L6 · State & Events</b></td><td>Persistent state, event bus, live push to UI</td><td>Cosmos <code>dw-state</code> · Event Hubs Kafka · SignalR Service · Event Grid (idle)</td></tr>
            <tr><td><b>L7 · Data Substrate</b></td><td>Domain entities + procedural docs + AI model endpoint</td><td>Fabric Lakehouse <code>adp</code> (5 Delta tables) · Azure SQL fallback · reused <code>dt-navigator-openai</code></td></tr>
            <tr><td><b>L8 · Compute & Hosting</b></td><td>Run-time hosts for workloads</td><td>Azure Functions Flex Consumption (.NET 10 isolated) · Container Apps env (idle) · SWA Free</td></tr>
            <tr><td><b>L9 · IaC & Automation</b></td><td>Provision + reproduce in a clean tenant</td><td>13 Bicep modules · PowerShell scripts for Fabric workspace + Lakehouse + table loads</td></tr>
            <tr><td><b>L10 · Observability</b></td><td>What happened, when, why</td><td>App Insights · Log Analytics · Decision Journal in Cosmos · Trace endpoint · Live tail</td></tr>
          </tbody>
        </table>
      </Section>

      <Callout>
        Use cases plug in at <b>L3</b> (declare agents in JSON), <b>L5</b> (declare which primitive each intent binds to),
        and <b>L7</b> (contribute their own Delta tables + knowledge docs + claim corpus). All other layers are invariant.
      </Callout>
    </div>
  );
}

// ============= Platform · Application Architecture =============
const PROJECTS = [
  { name: "PackageModel", lines: "177", responsibility: "Schema record types — AgentPackage, DigitalWorker, AgentSpec, ContextBinding (list-valued SourceBindings), CorpusBinding, SchemaBinding + EntityBinding, HitlGate, Invariant, BoundedReasoningZone." },
  { name: "PackageCompiler (adpc CLI)", lines: "680", responsibility: "Compile · Execute · Index · Ingest · ShowState · SemanticLoad subcommands. 4-stage compile pipeline (schema · semantic · plan · sign). Emits signed package zip." },
  { name: "Agents", lines: "719", responsibility: "IAgentAdapter contract + 3 implementations: FoundryAdapter (Persistent Agents SDK), LegacyOpenAIAdapter (chat-completions, active fallback), StubAdapter. AgentAdapterFactory env-routing." },
  { name: "ContextLayer", lines: "2,493", responsibility: "L5 federation — largest project. IContextSource, ContextRouter, ContextRequest (Industry + SourceBindings list + SchemaContext), AzureSearchFoundryIQSource, FabricLakehouseSource, SqlSemanticLayerSource, WorkIqSource, MicrosoftGraphWorkIqSource." },
  { name: "Orchestration", lines: "519", responsibility: "Trace types · TraceStep · HitlOption · StepRunner (single-step engine) · PlanExecutor (loop) · HitlGateEvaluator (confidence + field-value triggers, step-scoped)." },
  { name: "ToolRuntime", lines: "103", responsibility: "MCP tool contracts only — IMcpTool, IToolRegistry, ToolRegistry, IndustryAwareToolRegistry. Implementations live under usecases/<x>/tools per ADR-0001 v0.6." },
  { name: "DecisionIngest", lines: "449", responsibility: "DecisionEvent · IDecisionSink · DecisionPublisher (EH Kafka API) · DwStateWriter (Cosmos) · CompositeDecisionSink · DwStateReader + OutcomesAggregate for live status." },
  { name: "TracesApi", lines: "829", responsibility: "Azure Functions worker. HTTP triggers: Health, GetTrace, RunFnol, ResolveHitl, GetAggregateOutcomes, Negotiate (SignalR). Durable orchestrators: FnolOrchestrator. Activities: PrepareRunActivity, RunStepActivity, ResolveHitlActivity." },
];

export function PlatformAppArchPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Platform"
        title="Application Architecture"
        lead="Eight .NET 10 projects make up the platform. The diagram below shows the build-time pipeline above the run-time control flow. Same code, two execution paths: adpc CLI for local dev, Durable Function for cloud."
      />

      <Section title="Build-time + Run-time" lead="Same picture, two concerns. Build-time on top, run-time on the bottom.">
        <Narrative>
          The platform is not a single monolith — it's two pipelines sharing a contract. Build-time accepts the declarative package, runs four validation + planning stages, and emits a signed bundle. Run-time loads the bundle into an Azure Functions worker, drives the Durable orchestrator, and forks out per-step into context federation, LLM invocation, tool dispatch, gate evaluation, and decision persistence. The same <code>StepRunner</code> code is invoked by both the local <code>adpc execute</code> CLI and the cloud <code>RunStepActivity</code>; only the host differs.
        </Narrative>
        <Diagram caption="Top half: build-time. Compile pipeline emits the signed package zip that goes into Resources/. Bottom half: run-time. RunFnol HTTP trigger schedules FnolOrchestrator, which iterates agents via RunStepActivity → StepRunner → branches into ContextRouter, IAgentAdapter, ToolRegistry, HitlGateEvaluator, CompositeDecisionSink. Persistence flows down to Cosmos, Event Hubs, SignalR, AI Search citations, and App Insights traces.">
          <ApplicationArchitectureDiagram />
        </Diagram>
      </Section>

      <Section title="Components of the application architecture" lead="What each box in the diagram is, what it owns, and where the code lives.">
        <ComponentsGrid items={[
          { icon: "dotnet", role: "Run-time engine", name: "StepRunner", body: <>Single-step engine: context fetch → adapter call → tool dispatch → HITL evaluation → decision sink. Called by both <code>adpc execute</code> and <code>RunStepActivity</code>.</>, resource: "Orchestration/StepRunner.cs" },
          { icon: "foundry", role: "L5", name: "ContextRouter", body: <>Generic router. Fans <code>ContextRequest</code> to all <code>IContextSource</code> implementations in parallel, merges fragments by docId, dedupes and scores, tags <b>GROUNDED</b> vs <b>DERIVED</b>.</>, resource: "ContextLayer/ContextRouter.cs" },
          { icon: "openai", role: "L3", name: "IAgentAdapter", body: <>LLM adapter contract. Three implementations: <code>FoundryAdapter</code> (Persistent Agents SDK), <code>LegacyOpenAIAdapter</code> (active cloud default), <code>StubAdapter</code> (tests).</>, resource: "Agents/" },
          { icon: "dotnet", role: "L3", name: "IndustryAwareToolRegistry", body: <>Composes per-industry tool kits at run-time off <code>Package.Industry</code>. Meridian gets <code>MeridianTools</code>, banking gets <code>BankingTools</code>, no tool-id collisions.</>, resource: "ToolRuntime/V0Tools.cs" },
          { icon: "durable", role: "L4", name: "HitlGateEvaluator", body: <>Evaluates the three gate types — confidence threshold, field-value boolean, field-value string. Step-scoped: only fires on the step the trigger names.</>, resource: "Orchestration/HitlGateEvaluator.cs" },
          { icon: "cosmos", role: "L6", name: "CompositeDecisionSink", body: <>Fans every <code>DecisionEvent</code> to Cosmos (<code>DwStateWriter</code>) + SignalR (<code>SignalRStepSink</code>) + Event Hubs (<code>DecisionPublisher</code>). Atomic per-step persistence.</>, resource: "DecisionIngest/CompositeDecisionSink.cs" },
          { icon: "durable", role: "L4 entry", name: "FnolOrchestrator", body: <>Durable orchestrator. Loads bundled package via <code>PrepareRunActivity</code>, loops <code>RunStepActivity</code> per agent, awaits HITL via <code>WaitForExternalEvent</code>.</>, resource: "TracesApi/Functions/FnolOrchestrator.cs" },
          { icon: "functions", role: "L4 HTTP", name: "RunFnol Function", body: <>HTTP trigger. Validates input, schedules orchestration, returns <code>202</code> with <code>runId</code> + status + resolve-hitl URLs.</>, resource: "TracesApi/Functions/RunFnol.cs" },
        ]} />
      </Section>

      <Section title="Platform projects (platform/src/)">
        <table className={s.table}>
          <thead>
            <tr><th>Project</th><th>LoC</th><th>Responsibility</th></tr>
          </thead>
          <tbody>
            {PROJECTS.map((p) => (
              <tr key={p.name}>
                <td><code>{p.name}</code></td>
                <td>{p.lines}</td>
                <td>{p.responsibility}</td>
              </tr>
            ))}
            <tr><td colSpan={2}><b>Total</b></td><td>~5,969 lines across 50 .cs files</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Cross-project contracts">
        <div className={s.twoCol}>
          <InfoCard label="L5 contract" title="IContextSource">
            One method: <code>Task&lt;IReadOnlyList&lt;ContextFragment&gt;&gt; QueryAsync(ContextRequest, CancellationToken)</code>.
            Implementations are free to call AI Search, Fabric SQL, Graph, or anything else. The router merges fragments.
          </InfoCard>
          <InfoCard label="L3 contract" title="IAgentAdapter">
            <code>Task&lt;AgentInvocationResult&gt; InvokeAsync(AgentSpec, AgentInvocationContext, CancellationToken)</code>.
            Foundry, legacy AOAI, and stub all implement this. Same StepRunner code drives all three.
          </InfoCard>
          <InfoCard label="MCP contract" title="IMcpTool">
            <code>string Id; Task&lt;ToolResult&gt; InvokeAsync(JsonElement args, ToolInvocationContext)</code>.
            Industry-specific tools live in <code>usecases/&lt;x&gt;/tools/</code> and are composed via <code>IndustryAwareToolRegistry</code> keyed by <code>Package.Industry</code>.
          </InfoCard>
          <InfoCard label="Sink contract" title="IDecisionSink">
            <code>Task PublishAsync(DecisionEvent)</code>. <code>CompositeDecisionSink</code> fans to Cosmos
            (<code>DwStateWriter</code>) + SignalR (<code>SignalRStepSink</code>) + Event Hubs (<code>DecisionPublisher</code>).
          </InfoCard>
        </div>
      </Section>

      <Section title="Console (platform/console/)">
        <p className={s.sectionLead}>
          Vite + React 19 + Fluent UI v9 single-page app. Two views, hash-routed:
          <code>#operator</code> for the live workflow surface, <code>#docs/&lt;route&gt;</code> for this docs portal.
        </p>
        <table className={s.table}>
          <thead><tr><th>File</th><th>What it does</th></tr></thead>
          <tbody>
            <tr><td><code>Shell.tsx</code></td><td>Top-nav router. Default route lands on docs/home.</td></tr>
            <tr><td><code>App.tsx</code></td><td>Operator console — 8 run buttons across 4 DWs × 2 modes (normal / forced-HITL); SignalR live tail; HITL Approve/Escalate; trace viewer.</td></tr>
            <tr><td><code>DocsPortal.tsx</code></td><td>This docs portal — sidebar nav + content router + 6 sections + 10 SVG diagrams.</td></tr>
            <tr><td><code>OutcomesPanel.tsx</code></td><td>Live aggregate read of the Decision Journal; auto-refresh every 30s.</td></tr>
            <tr><td><code>runClient.ts</code></td><td>POST /api/runs · pollUntilTerminal · resolveHitl.</td></tr>
            <tr><td><code>traceClient.ts</code></td><td>GET /api/traces/{`{subject}`} — final reconciliation read after orchestration completes.</td></tr>
            <tr><td><code>liveTail.ts</code></td><td>SignalR subscription keyed by subjectId — appends step events as they land.</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ============= Platform · Compile Pipeline =============
export function PlatformCompilePage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Platform"
        title="Compile Pipeline"
        lead="adpc is the platform's CLI. The compile subcommand runs 4 stages over a declarative package JSON and emits a signed bundle ready to load into the runtime."
      />

      <Section title="Four stages">
        <Diagram caption="Each stage fails fast with a structured error. The bundle is just a zip — manifest + provenance + plan + the original package JSON — so a future runtime can reconstruct everything without needing the compiler.">
          <CompilePipelineDiagram />
        </Diagram>
      </Section>

      <Section title="What each stage does">
        <table className={s.table}>
          <thead><tr><th>Stage</th><th>Checks</th><th>Why</th></tr></thead>
          <tbody>
            <tr>
              <td><b>1. Schema Validate</b></td>
              <td>Conformance to <code>agent-package.v1.schema.json</code> (JSON Schema 2020-12). Required fields, types, enums, regex patterns for ids.</td>
              <td>Catch typos and missing fields before semantic checks run.</td>
            </tr>
            <tr>
              <td><b>2. Semantic Validate</b></td>
              <td>Cross-references: every <code>skill.agentRef</code> matches an agent id; every <code>intent</code> referenced in a contextBinding exists; every <code>tool.id</code> declared is loadable; no contradictory HITL gate triggers.</td>
              <td>JSON schema can't express "every reference resolves" — semantic stage owns it.</td>
            </tr>
            <tr>
              <td><b>3. Plan Generate</b></td>
              <td>Stage ordering for agents (acyclic dependency graph), provenance map (which sources each step is allowed to cite), field-value gate index for fast O(1) lookup at run-time.</td>
              <td>Pre-compute everything the runtime needs so per-step decisions are constant-time table lookups.</td>
            </tr>
            <tr>
              <td><b>4. Sign & Bundle</b></td>
              <td>Zip with deterministic ordering. <code>manifest.json</code> = file index. <code>provenance.json</code> = source bindings + invariants. <code>plan.json</code> = stage order. <code>package.json</code> = the original input.</td>
              <td>Reproducible artefact; ready to copy into <code>TracesApi/Resources/</code> and ship.</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Try it locally">
        <div className={s.codeBlock}>{`dotnet run --project platform/src/PackageCompiler -- compile \\
  --in  usecases/meridian-pnc-auto-claims/packages/fnol-handler.json \\
  --out build/fnol-handler.zip

# Output:
#   stage 1 (schema)    ✓ 312 ms
#   stage 2 (semantic)  ✓ 41 ms
#   stage 3 (plan)      ✓ 18 ms
#   stage 4 (sign+bundle) ✓ 67 ms
#   wrote build/fnol-handler.zip (14.2 KB)`}</div>
      </Section>
    </div>
  );
}

// ============= Platform · Runtime & Orchestration =============
export function PlatformRuntimePage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Platform"
        title="Runtime & Orchestration"
        lead="One claim, one click, one Durable orchestration. The sequence diagram below traces every hop from the operator's click through L5 context fetch, LLM call, tool dispatch, decision persistence, and live tail back to the SPA."
      />

      <Section title="End-to-end sequence">
        <Diagram caption="Each step in the loop fans out: ContextRouter goes to all three L5 sources in parallel, then the result is handed to the LLM adapter, the result is sunk into Cosmos + SignalR + Event Hubs, and HITL gates are evaluated before continuing.">
          <RuntimeSequenceDiagram />
        </Diagram>
      </Section>

      <Section title="The three Durable activities">
        <div className={s.threeCol}>
          <InfoCard label="Activity 1" title="PrepareRunActivity">
            Loads the bundled package zip from <code>Resources/{`{packageId}`}.zip</code>, resolves the claim corpus,
            instantiates a <code>Trace</code> with the run's <code>traceId</code> + <code>subjectId</code>.
          </InfoCard>
          <InfoCard label="Activity 2" title="RunStepActivity">
            Wraps <code>StepRunner.RunStepAsync</code>. Called once per agent in the package. Does context fetch + LLM call + tool dispatch + HITL evaluation + decision sink.
          </InfoCard>
          <InfoCard label="Activity 3" title="ResolveHitlActivity">
            Applies the operator's resolution (Approve / Escalate / Override) to the paused step, then signals the orchestrator to resume.
          </InfoCard>
        </div>
      </Section>

      <Section title="Why Durable">
        <table className={s.table}>
          <thead><tr><th>Need</th><th>Durable mechanism</th></tr></thead>
          <tbody>
            <tr><td>Pause for up to 30 minutes pending operator</td><td><code>await context.WaitForExternalEvent("HitlResolution", timeout)</code></td></tr>
            <tr><td>Survive Function host restart mid-orchestration</td><td>Replay-based execution — state lives in Cosmos task hub</td></tr>
            <tr><td>Sequential agent cascade with timing isolation</td><td><code>await context.CallActivityAsync(...)</code> with explicit retry policy</td></tr>
            <tr><td>Per-step retry on transient AI Search / LLM failure</td><td><code>RetryOptions(firstRetry=2s, maxRetries=3, backoff=2.0)</code></td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Two execution paths · same code">
        <Callout>
          <code>StepRunner.RunStepAsync</code> is called by <b>two</b> entry points: the <code>adpc execute</code>
          CLI command (for local dev / replay / experimentation) and the cloud <code>RunStepActivity</code>
          (for the durable orchestrator). Same context layer, same decision sink interface, same HITL evaluation —
          only the host differs.
        </Callout>
      </Section>
    </div>
  );
}

// ============= Platform · L5 Federation =============
export function PlatformL5Page() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Platform"
        title="L5 Federation · the IQ Trio"
        lead="Each agent step calls a generic ContextRouter that fans the request to three independent context sources in parallel and merges the returned fragments. Packages declare per-intent sourceBindings as named primitives. Zero industry coupling lives in platform code."
      />

      <Section title="The fan-out" lead="One request from the agent. Three parallel calls. Three independent indices. One merged context with citations from all three sources interleaved.">
        <Narrative>
          Context federation is the single largest piece of the platform — about 2,500 lines of C# across <code>platform/src/ContextLayer/</code>, more than any other project. That is not by accident: an agentic platform is only as good as the context it can ground its reasoning in. The L5 trio is engineered so that adding a new use case never requires touching the platform code. Packages declare per-intent <code>sourceBindings</code> as <i>named primitives</i>; the platform resolves the named primitive into the right query against the right source. The three sources are independent (different access patterns, different indices, different identity models) but federated at the citation level — the LLM sees evidence from all three interleaved in one merged context.
        </Narrative>
        <Diagram caption="ContextRouter (centre) receives a ContextRequest from the agent step and fans the request to all three sources in parallel. Each source returns ContextFragments tagged with sourceId + docId. The router merges, dedupes by docId, scores by relevance, tags GROUNDED vs DERIVED, and returns one Context object to the agent.">
          <L5FederationDiagram />
        </Diagram>
      </Section>

      <Section title="Components of the L5 federation" lead="What each source actually is, how it's backed, and which primitives it exposes.">
        <ComponentsGrid items={[
          { icon: "search", role: "Source 1 · L5", name: "Foundry IQ", body: <>Procedural + regulatory knowledge as text. Backed by Azure AI Search vector index. 21 markdown docs (19 Meridian PAC-* + 2 banking BANK-*). One primitive: semantic search.</>, resource: "srch-adp-v1 · index adp-knowledge" },
          { icon: "fabric", role: "Source 2 · L5", name: "Fabric IQ", body: <>Business entities + aggregated signals. Lakehouse SQL endpoint with AAD auth. 8 named primitives over 5 Delta tables — including 4 GROUP BY aggregations per ADR-0014 and a schema-aware <code>entity-history</code> per ADR-0016.</>, resource: "workspace adp-v1 · Lakehouse adp" },
          { icon: "graph", role: "Source 3 · L5", name: "Work IQ", body: <>Collaboration signals — Teams chats, SharePoint files, Outlook mails, calendar availability. Default backend = synthetic-deterministic. Real backend = Microsoft Graph delegated scopes. Selected via <code>WORKIQ_BACKEND</code> env var.</>, resource: "ContextLayer/WorkIqSource + MicrosoftGraphWorkIqSource" },
          { icon: "dotnet", role: "Federation", name: "ContextRouter", body: <>The generic router. Fans the request to all three sources in parallel, merges <code>ContextFragment</code> objects by docId, dedupes, scores, tags <b>GROUNDED</b> (from authoritative source) or <b>DERIVED</b> (inferred), returns one merged <code>Context</code>.</>, resource: "ContextLayer/ContextRouter.cs" },
          { icon: "search", role: "Vector backbone", name: "Azure AI Search", body: <>3072-dimension embeddings via <code>text-embedding-3-large</code>. Industry-filtered queries (industry field on each doc + <code>industry eq</code> OData filter). Sub-200ms typical query latency.</>, resource: "srch-adp-v1 (eastus, Basic)" },
          { icon: "fabric", role: "Semantic store", name: "Fabric Lakehouse", body: <>OneLake-backed Delta tables. Microsoft.Data.SqlClient + AAD auth against the SQL analytics endpoint. Function MI has Viewer on the workspace. 5 tables (3 Meridian + 2 banking).</>, resource: "Lakehouse adp (capacity offeringsfabric001)" },
        ]} />
      </Section>

      <Section title="Foundry IQ · Azure AI Search" lead="Procedural and regulatory knowledge. Cited inline.">
        <table className={s.table}>
          <tbody>
            <tr><td>Resource</td><td><code>srch-adp-v1</code> (eastus), Basic SKU</td></tr>
            <tr><td>Index</td><td><code>adp-knowledge</code> · 21 markdown docs (19 Meridian PAC-* + 2 banking BANK-*) · 3072-d embeddings via <code>text-embedding-3-large</code></td></tr>
            <tr><td>Filter</td><td>Every doc has an <code>industry</code> field (derived from front-matter <code>domain</code>); the source adds <code>industry eq '{`{value}`}'</code> to every OData filter — eliminates cross-industry bleed (banking agents never see Meridian docs).</td></tr>
            <tr><td>Primitive</td><td><code>semantic search over knowledge docs</code> — one primitive; the package decides which intent calls it.</td></tr>
            <tr><td>Citation shape</td><td><code>[Foundry] PAC-DAMAGE-002 — Repair Cost Estimation Bands</code></td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Fabric IQ · Microsoft Fabric Lakehouse" lead="Business entities and aggregated signals. The largest contribution by primitive count.">
        <table className={s.table}>
          <tbody>
            <tr><td>Resource</td><td>Workspace <code>adp-v1</code> (capacity <code>offeringsfabric001</code>) · Lakehouse <code>adp</code></td></tr>
            <tr><td>Tables</td><td><code>dim_policyholder</code> · <code>dim_vehicle</code> · <code>fact_claims</code> (Meridian) · <code>dim_borrower</code> · <code>fact_loan_applications</code> (banking) — 5 Delta tables</td></tr>
            <tr><td>Access</td><td>Lakehouse SQL analytics endpoint via <code>Microsoft.Data.SqlClient</code> + AAD auth (Function MI has Viewer on the workspace)</td></tr>
            <tr><td>Row-level primitives</td><td><code>policyholder-history</code>, <code>similar-claims</code>, <code>vehicle-history</code>, <code>entity-history</code> (schema-aware)</td></tr>
            <tr><td>Aggregation primitives</td><td><code>severity-distribution-by-state</code>, <code>hour-of-day-concentration</code>, <code>state-loss-ratio</code>, <code>incident-type-mix-by-state</code></td></tr>
            <tr><td>Schema-aware activation</td><td><code>entity-history</code> is templated off the package's <code>digitalWorker.schemaBinding</code>. Banking flips between <code>dim_borrower</code> + <code>fact_loan_applications</code> automatically.</td></tr>
            <tr><td>Citation shape</td><td><code>[FabricIQ] POLICYHOLDER_HISTORY/PH-208920</code> · <code>[FabricIQ] SEVERITY_DIST/CA</code></td></tr>
          </tbody>
        </table>
        <Callout>
          Per <b>ADR-0014</b>, this is honest "Fabric IQ" at the Lakehouse default-semantic-model level. A full Power BI
          semantic model with named DAX measures (and the Copilot-for-PowerBI path that unlocks) is a v1.5 enhancement.
          The current SQL primitives are functionally equivalent for agent context.
        </Callout>
      </Section>

      <Section title="Work IQ · synthetic default · Microsoft Graph code-ready" lead="Collaboration signals — Teams chats, SharePoint files, Outlook mails, calendar availability.">
        <table className={s.table}>
          <tbody>
            <tr><td>Default backend</td><td><code>WorkIqSource</code> — deterministic synthetic fragments per claim (SHA-256 of <code>subjectId</code> seeds the generator so demos are reproducible)</td></tr>
            <tr><td>Real backend</td><td><code>MicrosoftGraphWorkIqSource</code> — raw HTTP against Graph (<code>/me/messages</code>, <code>/me/drive/root/search</code>, <code>/me/calendarView</code>). Per ADR-0015, delegated scopes only.</td></tr>
            <tr><td>Activation</td><td><code>WORKIQ_BACKEND=graph</code> env var + user-tenant seeding (Outlook emails / OneDrive files / Calendar entries containing claim IDs). Local CLI opts in; cloud stays synthetic.</td></tr>
            <tr><td>Primitives</td><td><code>triage-supervisor-thread</code>, <code>adjuster-availability</code>, <code>damage-photo-thread</code>, <code>shop-collab-history</code>, <code>siu-consult-channel</code>, <code>policyholder-contact-channel</code>, <code>payment-ops-signal</code></td></tr>
            <tr><td>Citation shape</td><td><code>[WorkIQ] TEAMS_THREAD/CLM-2026-10012/payment-ops</code></td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Why federation, not a single super-index">
        <p className={s.sectionLead}>
          A single index would conflate three very different access patterns: vector search over text (Foundry IQ),
          structured SQL queries over rows and aggregates (Fabric IQ), and graph-traversal-like queries over
          collaboration topology (Work IQ). Each backend is optimised for its access pattern; the federation
          interleaves results at the citation level so the LLM sees evidence from all three sources without any
          single index trying to be everything.
        </p>
      </Section>
    </div>
  );
}

// ============= Platform · HITL Gates =============
export function PlatformHitlPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Platform"
        title="HITL Gates"
        lead="Three gate types. Two evaluation forms. One Durable primitive. Eight gate definitions across the 4 Meridian packages."
      />

      <Section title="The state machine">
        <Diagram caption="A step runs, then is evaluated. If a gate trips, the orchestrator awaits a Durable external event; the operator clicks Approve/Escalate; the orchestrator resumes from where it paused. No state is lost on Function host restarts — Durable replays the orchestration deterministically.">
          <HitlStateMachineDiagram />
        </Diagram>
      </Section>

      <Section title="Three gate types">
        <div className={s.threeCol}>
          <InfoCard label="Type 1" title="Confidence-based">
            <code>step.&lt;X&gt;.confidence &lt; 0.6</code>. Compares <code>result.Confidence</code> against the
            agent's <code>confidenceCalibration.lowThreshold</code>. Built into <code>StepRunner.EvaluateStatus</code>.
          </InfoCard>
          <InfoCard label="Type 2" title="Field-value boolean">
            <code>step.damage_categorization.totalLossSuspect == true</code>. <code>HitlGateEvaluator</code> keyword-matches the kebab-case form of the field name in the step's output text. <b>Step-scoped</b> — only fires on the step the trigger names.
          </InfoCard>
          <InfoCard label="Type 3" title="Field-value string equality (mandatory band)">
            <code>step.fraud_score.fraudBand == 'siu-priority'</code>. Matches a literal value case-insensitively in step output. Used by the fraud package to guarantee a human review on every priority-band classification.
          </InfoCard>
        </div>
      </Section>

      <Section title="Live gates across the 4 Meridian DWs">
        <table className={s.table}>
          <thead><tr><th>Gate id</th><th>Trigger</th><th>DW</th><th>What this catches</th></tr></thead>
          <tbody>
            <tr><td><code>gate.low-confidence-triage</code></td><td>confidence</td><td>FNOL</td><td>Initial-triage uncertainty before downstream propagates</td></tr>
            <tr><td><code>gate.total-loss-suspect</code></td><td>field-value boolean</td><td>Damage</td><td>Categorization that lands in the total-loss band</td></tr>
            <tr><td><code>gate.low-confidence-damage</code></td><td>confidence</td><td>Damage</td><td>Categorization uncertainty</td></tr>
            <tr><td><code>gate.priority-fraud-review</code></td><td>field-value string</td><td>Fraud</td><td>Mandatory operator review on siu-priority band</td></tr>
            <tr><td><code>gate.low-confidence-fraud</code></td><td>confidence</td><td>Fraud</td><td>Fraud-score uncertainty</td></tr>
            <tr><td><code>gate.high-value-settlement</code></td><td>field-value boolean</td><td>Settlement</td><td>Settlement {`>$25K`} pre-mailing</td></tr>
            <tr><td><code>gate.full-denial-review</code></td><td>field-value boolean</td><td>Settlement</td><td>Every full denial gets a human pair of eyes</td></tr>
            <tr><td><code>gate.disclosure-template-revision</code></td><td>confidence</td><td>Settlement</td><td>Multi-template disclosure letter uncertainty</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Operator resolution">
        <div className={s.codeBlock}>{`POST /api/runs/{runId}/resolve-hitl

{
  "decision": "approved" | "escalated" | "override",
  "override": { "field": "totalLossSuspect", "value": false },  // optional
  "comment": "Verified — adjuster confirmed not a total loss.",
  "operatorId": "anand.bhushan@ibmalliance.onmicrosoft.com"
}

→ raises a Durable external event "HitlResolution"
→ FnolOrchestrator.WaitForExternalEvent returns
→ ResolveHitlActivity applies the override
→ CompositeDecisionSink writes the resolved step
→ live tail flips the step card from "needs-human-review" to "completed"
→ next agent proceeds`}</div>
      </Section>

      <Callout variant="warn">
        v0 limitation: the field-value evaluator is keyword-based, not a structured-JSON evaluator. Adequate for the
        trigger forms the current packages declare. v1.5 plan: agents emit a JSON sidecar (<code>&lt;json&gt;...&lt;/json&gt;</code> block) and the evaluator runs against parsed claim state with a proper expression engine. Same <code>HitlGate.Trigger</code> syntax; only the matching backend changes.
      </Callout>
    </div>
  );
}

// ============= Platform · Boundary & Agnostic Proof =============
export function PlatformBoundaryPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Platform"
        title="Boundary & Agnostic Proof"
        lead="The platform-vs-use case boundary is not an aspiration — it's enforced at CI. Banking proved the boundary holds with a 2-agent stress test and zero platform code changes."
      />

      <Section title="The boundary picture">
        <Diagram caption="Platform exposes contracts (IContextSource, IMcpTool, IAgentAdapter). Use cases declare packages + knowledge + data + tool kits. CI rule (check-boundary.mjs) blocks any import from platform into usecases. Two narrow exceptions in v0.6: TracesApi and PackageCompiler may reference use-case tool kit projects — explicitly because tool implementations are the use case's contribution to the runtime.">
          <BoundaryDiagram />
        </Diagram>
      </Section>

      <Section title="What changes when you add a new industry">
        <table className={s.table}>
          <thead><tr><th>What you do</th><th>Why it works</th></tr></thead>
          <tbody>
            <tr><td>Create <code>usecases/&lt;industry&gt;/</code> folder with the same shape as <code>meridian-pnc-auto-claims/</code></td><td>Folder convention is the entire contract; no platform code knows about industry names.</td></tr>
            <tr><td>Author one or more <code>packages/*.json</code></td><td>JSON Schema 2020-12 is the integration contract.</td></tr>
            <tr><td>Drop knowledge docs under <code>knowledge/</code></td><td><code>adpc index --knowledge</code> indexes them into <code>adp-knowledge</code> with the right industry filter.</td></tr>
            <tr><td>Optionally drop Delta tables for new entities</td><td><code>schemaBinding</code> in the package activates <code>entity-history</code> primitive against the new tables. No <code>FabricLakehouseSource</code> changes.</td></tr>
            <tr><td>Build a tool kit at <code>tools/&lt;industry&gt;Tools.csproj</code></td><td>Implements <code>IMcpTool</code> for each tool. Added to <code>TracesApi.csproj</code> via project reference; <code>IndustryAwareToolRegistry</code> composes by <code>Package.Industry</code>.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="What you do NOT do">
        <ul style={{ paddingLeft: "20px", lineHeight: 1.7, color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
          <li>Edit anything under <code>platform/src/</code> for a new industry.</li>
          <li>Add a new <code>IContextSource</code> implementation unless you genuinely need a new <i>type</i> of source (which is rare — most industries need different rows in the same source types).</li>
          <li>Hard-code industry strings outside of package files.</li>
          <li>Change the CI <code>check-boundary.mjs</code> rules.</li>
        </ul>
      </Section>

      <Section title="The banking proof" lead="Two agents. Zero platform changes. One sibling folder.">
        <Callout>
          <code>usecases/banking-loan-origination/packages/loan-handler.json</code> declares 2 agents (intake + eligibility),
          a <code>corpusBinding</code> (<code>borrowers-30.json</code>), and a <code>schemaBinding</code> targeting
          <code>dim_borrower</code> + <code>fact_loan_applications</code>. Citations in the eligibility step include
          <code>BORROWER_HISTORY/BOR-013</code> (Fabric) and <code>BANK-001</code> (Foundry) — banking-only,
          zero Meridian document bleed. Boundary CI script passes.
        </Callout>
      </Section>

      <Section title="The CI rule (scripts/check-boundary.mjs)">
        <div className={s.codeBlock}>{`Node script. Walks platform/src/ for:
  - .cs   files: any "using <namespace>" of usecases.*
  - .csproj: any <ProjectReference Include="..usecases\\...">
Blocks at CI level. Allowlist: TracesApi.csproj + PackageCompiler.csproj
may reference usecases/<x>/tools/<x>Tools.csproj only (per ADR-0001 v0.6).

Run locally:
  $ node scripts/check-boundary.mjs
  ✓ boundary clean (50 .cs files scanned, 10 .csproj files scanned)
  ✓ tool-kit allowlist hits: 2 (expected: 2)`}</div>
      </Section>
    </div>
  );
}

// ============= Platform · Ontology + Regulatory Binding =============
export function PlatformOntologyPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Platform · v1.1"
        title="Ontology + Regulatory Binding"
        lead="Every cited fragment, every Delta table, and every step decision now carries its canonical ontology entity ID and (where regulatory) its source paragraph IDs. v1's adoption of the v2.4 auto-claims ontology from the team's archived architecture repo, surfaced end-to-end."
      />

      <Section title="Why this exists" lead="The team's stranded v2.4 ontology + the alpha-PRD ask for per-paragraph regulatory mapping converged into a one-weekend patch.">
        <Narrative>
          The team's <code>adp-base</code> repo declares ADR-0006 (Fabric IQ for domain ontology) as a foundational decision, but the formal v2.4 auto-claims ontology that gives that ADR teeth lives stranded in the archived <code>architecture</code> repo (~400 lines + 30 per-entity files + 6 agent designs). v1's PAC-* knowledge corpus and 5 Delta tables didn't yet bind to that ontology vocabulary. Meanwhile the agentic-claims-alpha PRD's Renee persona (Legal &amp; Compliance) needs decisions tagged to specific NAIC AI Model Bulletin paragraphs and California Fair Claims Settlement Practices Regulations sections. Both gaps close with the same plumbing: front-matter on each knowledge doc, structured passthrough on each ContextFragment, aggregation in StepRunner, and chips in the operator console.
        </Narrative>
        <Callout>
          v1.1 is additive and wire-backward-compatible. Existing traces, decision events, and packages without the new fields render exactly as before. No ADRs invalidated; one new ADR-0017 covers the binding decision.
        </Callout>
      </Section>

      <Section title="The acl:* entities v1 touches" lead="Subset of the v2.4 ontology that v1's corpus + Delta tables actually exercise.">
        <table className={s.table}>
          <thead><tr><th><code>acl:*</code> entity</th><th>v1 surface</th><th>Where it appears</th></tr></thead>
          <tbody>
            <tr><td><code>acl:Claim</code></td><td><code>fact_claims</code> · subject id <code>CLM-2026-*</code></td><td><code>schemaBinding.primaryEntity.entitySemantics</code> on all 4 Meridian packages</td></tr>
            <tr><td><code>acl:Policy</code> + <code>acl:PolicyTerm</code></td><td>Embedded in claim corpus</td><td>PAC-COV-001, PAC-COV-002</td></tr>
            <tr><td><code>acl:Coverage</code></td><td><code>policy.coverages[]</code> on each claim</td><td>PAC-COV-001/002, PAC-REG-002, PAC-SET-001</td></tr>
            <tr><td><code>acl:LossEvent</code></td><td><code>incident</code> block on a claim</td><td>PAC-INTAKE-001, PAC-FRD-002</td></tr>
            <tr><td><code>acl:Vehicle</code></td><td><code>dim_vehicle</code> · vin</td><td><code>schemaBinding.secondaryEntity.entitySemantics</code> on all 4 Meridian packages</td></tr>
            <tr><td><code>acl:VehicleDamage</code> + <code>acl:DamagePart</code></td><td>DamageReport emitted by agent.damage-categorize</td><td>PAC-DAMAGE-001/002/003, PAC-SHOP-001</td></tr>
            <tr><td><code>acl:TotalLossEvaluation</code></td><td>total-loss-suspect gate output</td><td>PAC-TOTAL-LOSS-001</td></tr>
            <tr><td><code>acl:Adjuster</code></td><td>Adjuster roster MCP tool (mock)</td><td>PAC-ROUTE-001, PAC-REG-001</td></tr>
            <tr><td><code>acl:Claimant</code></td><td>First-party only in v1 (the policyholder)</td><td>PAC-INTAKE-001, PAC-SET-003</td></tr>
            <tr><td><code>acl:Payment</code></td><td>Settlement disbursement step output</td><td>PAC-SET-001/002/003, PAC-REG-001</td></tr>
            <tr><td><code>acl:FraudIndicator</code></td><td>fraud-pattern-scan step output</td><td>PAC-FRD-001/002/003</td></tr>
            <tr><td><code>acl:SIUReferral</code></td><td>SIU referral step output (HITL gate)</td><td>PAC-FRD-003, PAC-SIU-001</td></tr>
            <tr><td><code>acl:Endorsement</code></td><td>Rideshare endorsement on TNC claims</td><td>PAC-REG-002</td></tr>
            <tr><td><code>acl:Exposure</code></td><td>Collapsed into claim record in v1 (R-CLM-001 deferred to v1.5)</td><td>PAC-TRI-001, PAC-COV-002</td></tr>
          </tbody>
        </table>
        <Callout variant="info">
          Out of scope for v1: <code>acl:BodilyInjury</code>, <code>acl:Subrogation</code>, <code>acl:Salvage</code>, <code>acl:Recovery</code>, <code>acl:Litigation</code>. These are tracked for v1.5 schema expansion. The full v2.4 entity catalog (~30 entities) is preserved in <code>usecases/meridian-pnc-auto-claims/ontology/adp-v1-binding.md</code>.
        </Callout>
      </Section>

      <Section title="How the binding flows end-to-end" lead="Six edits compose into one pipeline: doc front-matter → ContextFragment → TraceStep → DecisionEvent → console.">
        <div className={s.codeBlock}>{`1. usecases/meridian-pnc-auto-claims/knowledge/PAC-*.md
   ---
   ontologyBindings: [acl:Claim, acl:Coverage]
   regulatoryBasis: ["NAIC AI Model Bulletin §4.2", "10 CCR §2695.7(b)(1)"]
   ---

2. platform/src/ContextLayer/LocalFoundryIQSource.cs (+ AzureSearchIndexer.cs / AzureSearchFoundryIQSource.cs)
   ParseDoc() extracts the two arrays from YAML.
   QueryAsync() forwards them on the ContextFragment.

3. platform/src/ContextLayer/Contracts.cs · ContextFragment
   New nullable fields: OntologyBindings + RegulatoryBasis.

4. platform/src/Orchestration/StepRunner.cs
   Aggregates the distinct union across all fragments cited on a step.
   Emits TraceStep.{ citedSources, ontologyBindings, regulatoryBasis }.
   Emits DecisionEvent.{ citedSources, ontologyBindings, regulatoryBasis }.

5. platform/src/PackageModel/AgentPackage.cs · EntityBinding
   New nullable field: EntitySemantics. Surfaces in schemaBinding.

6. platform/console/src/App.tsx
   Chip rows under each step: cited docs, ontology entities, regulatory paragraphs.`}</div>
      </Section>

      <Section title="Regulatory paragraphs surfaced by v1" lead="What 'regulatoryBasis' resolves to today.">
        <table className={s.table}>
          <thead><tr><th>Authority</th><th>Cited paragraphs</th><th>Triggered by</th></tr></thead>
          <tbody>
            <tr><td>NAIC AI Model Bulletin</td><td>§3.2 (algorithmic-decision support), §4.1 (pattern detection), §4.2 (model thresholds + adverse-action review)</td><td>Fraud Handler (PAC-FRD-001/002/003)</td></tr>
            <tr><td>NAIC Model UCSP Act</td><td>§§1-10 (full unfair-practices framework), §4 (fair investigation), §902 (denial standards + adjuster qualification)</td><td>FNOL + Settlement Handlers (PAC-REG-001, PAC-ROUTE-001, PAC-SET-001/002)</td></tr>
            <tr><td>10 CCR §2695 (California)</td><td>§2695.7(b)(1) (written-notice), §2695.7(g) (settlement-offer), §2695.8(b)(1) (total-loss appraisal)</td><td>Settlement + Damage Handlers (PAC-SET-001/002, PAC-TOTAL-LOSS-001)</td></tr>
            <tr><td>CA Insurance Code</td><td>§11580.24 (TNC coverage), §1872.4 (fraud reporting)</td><td>Coverage + SIU paths (PAC-REG-002, PAC-SIU-001)</td></tr>
            <tr><td>NAIC Model Insurance Fraud Prevention Act</td><td>§3 (referral procedures), §6 (pattern detection oversight)</td><td>Fraud Handler · SIU referral (PAC-FRD-002, PAC-SIU-001)</td></tr>
            <tr><td>49 CFR Part 571</td><td>FMVSS safety standards (post-repair re-inspection)</td><td>Damage Handler · safety re-inspection (PAC-DAMAGE-003)</td></tr>
          </tbody>
        </table>
        <Callout variant="warn">
          v1's regulatoryBasis strings reproduce paragraph identifiers without verbatim text. The intent is to give Legal &amp; Compliance reviewers a precise pointer; the actual statutory text is not embedded. v1.5 may add a one-click drill-through to the regulator's published text where available.
        </Callout>
      </Section>

      <Section title="Why this is not the same as ADR-0006">
        <Narrative>
          ADR-0006 in the team's <code>adp-base</code> describes a formal Fabric IQ ontology with versioned business rules, classification taxonomies, and full RDF/OWL publication. v1.1's binding is the runtime-honest subset: the entity names + relationships v1's runtime can actually substantiate today. When the team's <code>adp-claims</code> or <code>adp-sandbox</code> stands up the full ontology, v1 inherits the broader namespace without changing its pipeline — only the front-matter expands.
        </Narrative>
      </Section>
    </div>
  );
}
