import { tokens } from "@fluentui/react-components";
import { useDocsStyles, PageHero, Section, Callout, StatCard, InfoCard } from "../common";

// ============= Repo at a Glance =============
export function RepoPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Reference"
        title="Repo at a Glance"
        lead="As-is scan at v1.0 deploy time. Captured by find + wc -l. Source-of-record under Project ADP/adp-v1/."
      />

      <Section title="By the numbers">
        <div className={s.statGrid}>
          <StatCard n="~5,970" label="lines of platform C#" />
          <StatCard n="50" label="platform .cs files" />
          <StatCard n="8" label="platform .NET projects" />
          <StatCard n="13" label="Bicep modules" />
          <StatCard n="5" label="compiled packages" />
          <StatCard n="21" label="knowledge docs indexed" />
          <StatCard n="16" label="ADRs" />
          <StatCard n="6" label="MCP tools (4 Meridian + 2 banking)" />
          <StatCard n="5" label="Fabric Delta tables" />
          <StatCard n="3" label="IQ sources federated" />
          <StatCard n="2" label="industries proven" />
          <StatCard n="14" label="agent steps per claim lifecycle" />
        </div>
      </Section>

      <Section title="Top-level layout">
        <div className={s.codeBlock}>{`adp-v1/
├── README.md              · Quick overview + entry pointers
├── SPEC.md                · The original one-page pin (v0 commitments)
├── platform/              · industry-agnostic stack
│   ├── src/               · 8 .NET 10 projects
│   ├── infra/             · 13 Bicep modules
│   ├── console/           · Vite + React 19 + Fluent UI v9 SPA
│   └── schemas/           · agent-package.v1.schema.json
├── usecases/              · per-industry contributions
│   ├── meridian-pnc-auto-claims/
│   │   ├── packages/      · 4 JSON packages
│   │   ├── knowledge/     · 19 PAC-* markdown docs
│   │   ├── data/          · claims-1k.json synthetic corpus
│   │   └── tools/         · MeridianTools.csproj (4 tools)
│   └── banking-loan-origination/
│       ├── packages/      · loan-handler.json
│       ├── knowledge/     · BANK-001/002
│       ├── data/          · borrowers-30.json
│       └── tools/         · BankingTools.csproj (2 tools)
├── scripts/               · provisioning + boundary check
├── docs/                  · ADRs + ARCHITECTURE.md + DEMO-SCRIPT.md + V1.0-COMPLETE.md
└── build/                 · compiled artefacts (gitignored)`}</div>
      </Section>

      <Section title="Lines of code by project">
        <table className={s.table}>
          <thead><tr><th>Project</th><th>Files</th><th>Lines</th></tr></thead>
          <tbody>
            <tr><td>ContextLayer/</td><td>10</td><td>2,493 — largest project; L5 federation logic</td></tr>
            <tr><td>TracesApi/</td><td>12</td><td>829 — Functions worker</td></tr>
            <tr><td>Agents/</td><td>3</td><td>719 — adapters + factory</td></tr>
            <tr><td>PackageCompiler/</td><td>8</td><td>680 — adpc CLI</td></tr>
            <tr><td>Orchestration/</td><td>5</td><td>519</td></tr>
            <tr><td>DecisionIngest/</td><td>5</td><td>449</td></tr>
            <tr><td>PackageModel/</td><td>1</td><td>177 — schema record types</td></tr>
            <tr><td>ToolRuntime/</td><td>2</td><td>103 — contracts only post-Track 4</td></tr>
            <tr><td><b>Total platform code</b></td><td><b>50 files (.cs only)</b></td><td><b>~5,969</b></td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Console source (platform/console/src/)">
        <div className={s.codeBlock}>{`Shell.tsx           · top-nav router (Operator | Docs)
App.tsx             · operator console (8 buttons + SignalR live tail + HITL)
DocsPortal.tsx      · docs portal layout + router
OutcomesPanel.tsx   · live aggregate read (claims, traces, steps, grounded, confidence, HITL)
docs/
  nav.ts            · sidebar nav structure
  common.tsx        · shared styles + PageHero + Section + Diagram + Callout
  diagrams.tsx      · 10 inline SVG diagrams
  sections/
    overview.tsx    · home + mission + system overview + tech stack + live status
    platform.tsx    · 7 platform pages
    usecases.tsx    · 5 Meridian + 1 banking pages
    deployment.tsx  · 5 deployment pages
    adrs.tsx        · 16 ADRs in detail
    reference.tsx   · repo + honest gaps + glossary
runClient.ts        · POST /api/runs + pollUntilTerminal + resolveHitl
traceClient.ts      · GET /api/traces/{subject}
liveTail.ts         · SignalR subscription keyed by subjectId`}</div>
      </Section>

      <Section title="Knowledge corpus inventory">
        <table className={s.table}>
          <tbody>
            <tr><td><b>Meridian</b> (insurance · 19 docs)</td><td>PAC-COV-001/002, PAC-TRI-001, PAC-FRD-001/002/003, PAC-ROUTE-001, PAC-INTAKE-001, PAC-REG-001/002, PAC-DAMAGE-001/002/003, PAC-SHOP-001, PAC-TOTAL-LOSS-001, PAC-SIU-001, PAC-SET-001/002/003</td></tr>
            <tr><td><b>Banking</b> (banking · 2 docs)</td><td>BANK-001 (Consumer Loan Eligibility Framework), BANK-002 (Application Intake — Required Fields)</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Packages compiled">
        <table className={s.table}>
          <thead><tr><th>Package</th><th>Agents</th><th>Skills</th><th>Tools</th><th>HITL gates</th><th>Bounded zones</th></tr></thead>
          <tbody>
            <tr><td><code>fnol-handler.json</code></td><td>4</td><td>9</td><td>5</td><td>1</td><td>0</td></tr>
            <tr><td><code>damage-handler.json</code></td><td>4</td><td>8</td><td>4</td><td>2</td><td>0</td></tr>
            <tr><td><code>fraud-handler.json</code></td><td>4</td><td>9</td><td>5</td><td>2 incl. mandatory</td><td>1</td></tr>
            <tr><td><code>settlement-handler.json</code></td><td>4</td><td>11</td><td>4</td><td>3 incl. mandatory</td><td>1</td></tr>
            <tr><td><code>loan-handler.json</code> (banking)</td><td>2</td><td>6</td><td>2</td><td>2</td><td>0</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ============= Honest Gaps · v1.5 =============
export function HonestGapsPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Reference"
        title="Honest Gaps · v1.5 Backlog"
        lead="What v1.0 is NOT, deliberately, and what the planned v1.5 work looks like. The platform doesn't pretend to be more done than it is."
      />

      <Section title="Active gaps tracked into v1.5">
        <table className={s.table}>
          <thead><tr><th>Gap</th><th>Status today</th><th>What v1.5 does</th></tr></thead>
          <tbody>
            <tr>
              <td>Foundry Agent Service runtime</td>
              <td>Code ready; <b>2 RBAC role assignments pending</b>. Function stays on the legacy AOAI chat-completions adapter until granted.</td>
              <td>Out-of-band Owner runs the two <code>az role assignment create</code> commands (Azure AI User on the AIServices account). Function flips to <code>AGENT_BACKEND=foundry</code>.</td>
            </tr>
            <tr>
              <td>Microsoft Graph Work IQ</td>
              <td>Code path tested. Default cloud backend = synthetic. Local CLI activates with <code>WORKIQ_BACKEND=graph</code>.</td>
              <td>User-tenant seeding by the deployer (Outlook emails / OneDrive files / Calendar entries containing claim IDs). Then re-record demo with real Graph citations.</td>
            </tr>
            <tr>
              <td>Power BI semantic model with named DAX measures</td>
              <td>Fabric IQ today uses SQL aggregation primitives over the default semantic surface.</td>
              <td>Author a PBI semantic model on top of <code>dim_policyholder</code> + <code>fact_claims</code> with named DAX measures. Unlocks Copilot-for-PowerBI and cached measures.</td>
            </tr>
            <tr>
              <td>Defender for AI · Sentinel · Purview</td>
              <td>Wiring documented in ADR-0007/0008 but not active.</td>
              <td>v1.1 follow-on after Foundry runtime activates. <code>entraAgentId</code> propagation through trace records is the first prerequisite.</td>
            </tr>
            <tr>
              <td>Decision Ingest as a Container Apps service</td>
              <td>Today's cloud path uses <code>CompositeDecisionSink</code> directly to Cosmos + SignalR. Event Hubs consumer is CLI-only (<code>adpc ingest</code>).</td>
              <td>Promote the consumer to a Container App on <code>cae-adp-v1</code>. Already provisioned and idle.</td>
            </tr>
            <tr>
              <td>Real backends for MCP tools</td>
              <td>Synthetic data drawn from ambient claim/application.</td>
              <td>Duck Creek for <code>tool.claim-store</code>, J.D. Power for <code>tool.vehicle-lookup</code>, ISO ClaimSearch for fraud, tri-bureau for <code>tool.credit-bureau-lookup</code>. Tool kits stay use-case-owned; only their internals change.</td>
            </tr>
            <tr>
              <td>HITL field-value evaluator</td>
              <td>Keyword match in v0. Adequate for current gate definitions.</td>
              <td>Agents emit a JSON sidecar; HitlGateEvaluator runs against parsed state with a proper expression engine.</td>
            </tr>
            <tr>
              <td>Closure / archival</td>
              <td>Out of v0 by design.</td>
              <td>Closure DW (DW-5): final audit + journal seal + archival. Likely Fabric Lakehouse cold-tier write.</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Two activation commands pending">
        <Callout variant="warn">
          Foundry runtime needs Owner-level action. The two commands are documented exactly in
          <code>Deployment → Provisioning Runbook → Step 9</code>. Once executed, set
          <code>AGENT_BACKEND=foundry</code> on the Function app to flip the live path.
        </Callout>
      </Section>

      <Section title="What v1.0 deliberately is">
        <div className={s.twoCol}>
          <InfoCard label="In v1.0" title="Honest about what's real">
            Three IQ sources running on real Microsoft services. Full Meridian lifecycle. Banking stress test. Boundary CI. Docs portal. Live operator console. 16 ADRs.
          </InfoCard>
          <InfoCard label="Not in v1.0" title="Not pretending to be done">
            Foundry runtime is code-ready, not active. Defender for AI / Sentinel / Purview are documented, not wired. Power BI semantic model is planned, not built. Each gap is in an ADR.
          </InfoCard>
        </div>
      </Section>
    </div>
  );
}

// ============= Glossary =============
const GLOSSARY = [
  { term: "Agent", definition: "A single reasoning unit declared in a package's digitalWorker.agents[]. Has an id, an intent, a confidenceCalibration, contextBindings, tool references." },
  { term: "Agent Package", definition: "The declarative JSON file that describes a Digital Worker. Validated against agent-package.v1.schema.json. Compiled by adpc compile into a signed zip." },
  { term: "Bounded Reasoning Zone", definition: "Per-agent allowance of multiple LLM passes before a decision is forced. Used by fraud-pattern-scan (5 passes) and settlement-disclosure (3 passes)." },
  { term: "ContextBinding", definition: "Per-intent map { intent → { sourceBindings: { FoundryIQ: [...], FabricIQ: [...], WorkIQ: [...] }, dimensions: [...] } }. Declared in the package." },
  { term: "ContextRouter", definition: "Platform service that fans a ContextRequest to all three L5 sources in parallel and merges fragments." },
  { term: "Decision Journal", definition: "Persistent record of every step decision. Stored in Cosmos adp.dw-state. Read via GET /api/traces/{subject}." },
  { term: "Decision Event", definition: "One record in the Decision Journal. Identifies the step, the agent, the citations, the output, the confidence, the timestamp." },
  { term: "Digital Worker (DW)", definition: "A named composition of cooperating agents that own one stage of a domain workflow. Meridian has 4 (FNOL, Damage, Fraud, Settlement)." },
  { term: "Durable Functions", definition: "Microsoft's stateful-orchestrator extension for Azure Functions. ADP uses it for the FnolOrchestrator with HITL pause/resume." },
  { term: "Entra Agent ID", definition: "Per-agent identity issued by Foundry Agent Service. Propagates into TraceStep + DecisionEvent so Defender for AI / Sentinel can correlate." },
  { term: "Fabric IQ", definition: "Layer-5 source backed by Microsoft Fabric Lakehouse. 8 named primitives over 5 Delta tables." },
  { term: "Field-value gate", definition: "HITL trigger of the form step.<X>.<field> == <value>. Evaluated by HitlGateEvaluator on step output." },
  { term: "Foundry Agent Service", definition: "Microsoft Azure AI Foundry's managed agent runtime. Provides per-agent identity, persistent threads, function-tool dispatch." },
  { term: "Foundry IQ", definition: "Layer-5 source backed by Azure AI Search vector index. 21 knowledge docs (19 Meridian + 2 banking)." },
  { term: "Grounded / Derived", definition: "Provenance tag on every context fragment. GROUNDED = came from an authoritative source. DERIVED = inferred by Foundry IQ at query time." },
  { term: "HITL gate", definition: "Declarative trigger that pauses an orchestration awaiting an operator decision. Three types: confidence, field-value boolean, field-value string." },
  { term: "adpc", definition: "The platform CLI. Built from PackageCompiler. Subcommands: compile, execute, index, ingest, show-state, semantic-load." },
  { term: "IndustryAwareToolRegistry", definition: "Composite registry that holds per-industry tool kits. Resolved at run-time off Package.Industry." },
  { term: "IQ Trio / L5 Federation", definition: "The three context sources — Foundry IQ + Fabric IQ + Work IQ — that the platform federates at L5." },
  { term: "MCP", definition: "Model Context Protocol — the contract for tools callable by agents. IMcpTool is the platform-side interface." },
  { term: "Operator", definition: "The persona running the demo. Proxy for adjuster + supervisor in v1.0." },
  { term: "Package", definition: "Synonym for Agent Package." },
  { term: "Schema-aware primitive", definition: "Fabric IQ primitive (entity-history) whose SQL is templated off the package's schemaBinding. Enables one source, many industries." },
  { term: "SchemaBinding", definition: "Per-DW declaration of primary entity + secondary entity (table, primary key, foreign key) and similarity filters. Drives entity-history." },
  { term: "Source Binding", definition: "Within a contextBinding, which named primitives a given source should run for a given intent. List-valued (a single intent can call multiple primitives)." },
  { term: "StepRunner", definition: "Single-step engine in platform/src/Orchestration. Called by both the CLI execute path and the Durable RunStepActivity." },
  { term: "Trace", definition: "Reified record of a full claim run. List of TraceStep ordered by stage. Identified by traceId + subjectId." },
  { term: "Work IQ", definition: "Layer-5 source for collaboration signals. Synthetic-deterministic default; real Microsoft Graph code path via WORKIQ_BACKEND=graph." },
];

// ============= Team Repo Alignment =============
export function TeamAlignmentPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Reference · v1.1"
        title="Team Repo Alignment"
        lead="How v1 sits relative to the team's adp-base ADRs + the stranded v2.4 ontology + the agentic-claims-alpha PRD. Honest summary of where v1 leads, follows, and defers."
      />

      <Section title="The team org state (scanned locally)" lead="From local clones under Project ADP/repos/. None pushed.">
        <table className={s.table}>
          <thead><tr><th>Repo</th><th>State</th><th>What's in it</th></tr></thead>
          <tbody>
            <tr><td><code>architecture</code></td><td><b>ARCHIVED</b></td><td>Stranded v2.4 auto-claims ontology (400-line master + 30 per-entity files + 6 agent designs + 3 API specs)</td></tr>
            <tr><td><code>adp-base</code></td><td>Active · canonical</td><td>6 ADRs · ADR-0001/2/3/4 accepted · <b>ADR-0005 + ADR-0006 still proposed</b></td></tr>
            <tr><td><code>adp-claims</code></td><td>Active · EMPTY</td><td>LICENSE + README + .gitignore only — intended home for claims domain</td></tr>
            <tr><td><code>adp-sandbox</code></td><td>Active · agent-scaffolding</td><td>60-day agentic-claims-alpha PRD on main · 5 mocked APIM services + Terraform infra on agent-scaffolding</td></tr>
            <tr><td><code>mvp-demo</code></td><td>Unchanged</td><td>Old May 13 demo</td></tr>
          </tbody>
        </table>
        <Callout variant="info">
          The stranded ontology is the most consequential gap. It lives nowhere active in the team's canonical repos. v1.1 adopts its vocabulary internally without touching the team's repos (per the no-github-pushes constraint). When <code>adp-claims</code> or <code>adp-sandbox</code> opens for contributions, v1 is the runtime that's pre-populated against the canonical entity names.
        </Callout>
      </Section>

      <Section title="ADR-by-ADR read" lead="The team's decisions are well-shaped. v1 is largely aligned. Three specific divergences worth naming.">
        <table className={s.table}>
          <thead><tr><th>ADR</th><th>Status</th><th>v1 alignment</th></tr></thead>
          <tbody>
            <tr><td><b>0001 · ADR practice</b></td><td>accepted</td><td>Same discipline. v1 has 17 ADRs (incl. v1.1 patch).</td></tr>
            <tr><td><b>0002 · Azure-native</b></td><td>accepted</td><td>100% — Functions Flex + Cosmos + AI Search + SignalR + Event Hubs + SWA + Fabric + Foundry + Entra.</td></tr>
            <tr><td><b>0003 · Terraform for IaC</b></td><td>accepted</td><td><b>Divergence.</b> v1 uses Bicep (13 modules). Defensible for solo Microsoft-native velocity; v1.5 may port to Terraform.</td></tr>
            <tr><td><b>0004 · Foundry IQ as KB</b></td><td>accepted</td><td>Same role. v1's <code>AzureSearchFoundryIQSource</code> + industry-filtered vector index.</td></tr>
            <tr><td><b>0005 · Event-driven, service-owned data</b></td><td>proposed</td><td><b>Frame, don't fight.</b> v1 is one service inside the topology — the Claims Processing Service. Service Bus publishing of decision events is v1.5 boundary work.</td></tr>
            <tr><td><b>0006 · Fabric IQ for domain ontology</b></td><td>proposed</td><td><b>v1.1 closes the vocabulary gap</b> by adopting v2.4 ontology entity names + regulatory paragraph mapping. Full ADR-0006 depth (versioned business rules, RDF/OWL publication) is broader v1.5+ work.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="The agentic-claims-alpha PRD ask-by-ask map" lead="v1 covers ~10 of 12 alpha-PRD asks today. The remaining two close via v1.5 schema expansion + Service Bus bridge.">
        <table className={s.table}>
          <thead><tr><th>Alpha PRD ask</th><th>v1 status</th></tr></thead>
          <tbody>
            <tr><td>Working alpha demo of agentic auto-claims processing</td><td>Yes — FNOL + Damage + Fraud + Settlement DWs running end-to-end</td></tr>
            <tr><td>Compresses 7-14 day FPC claim to same-day</td><td>Yes — trace shows ~5-10 min runtime</td></tr>
            <tr><td>Every adverse decision architecturally HITL-gated</td><td>Yes — <code>gate.total-loss-suspect</code> field-value + <code>gate.priority-fraud-review</code> mandatory</td></tr>
            <tr><td>Every decision end-to-end explainable</td><td>Yes — trace endpoint returns every step with citations + confidence + origin + hitlGateId</td></tr>
            <tr><td>NAIC AI Model Bulletin mapping</td><td><b>v1.1 yes</b> — <code>regulatoryBasis</code> tags per step now name §3.2 / §4.1 / §4.2</td></tr>
            <tr><td>CA Fair Claims Settlement Practices mapping</td><td><b>v1.1 yes</b> — <code>regulatoryBasis</code> tags name 10 CCR §2695.7(b)(1) / §2695.7(g) / §2695.8(b)(1)</td></tr>
            <tr><td>Working artifact, not a slide deck</td><td>Yes — live SPA at witty-sea-0d12a380f.7.azurestaticapps.net</td></tr>
            <tr><td>Survives CIO / CTO / General Counsel / adjuster in room</td><td>Verified — Satish walkthrough 2026-05-29</td></tr>
            <tr><td>Off-the-shelf Azure OpenAI via Foundry · no fine-tuning</td><td>Yes — cross-RG reuse of dt-navigator-openai via Foundry connection</td></tr>
            <tr><td>Synthetic data · no real PHI/PII</td><td>Yes — synthetic 1K claims corpus</td></tr>
            <tr><td>Mocked Duck Creek / Guidewire</td><td>Yes — 4 Meridian MCP tools (claim-store · policy-store · vehicle-lookup · adjuster-roster)</td></tr>
            <tr><td>Multi-service event-driven topology (ADR-0005)</td><td><b>Framing-level yes</b>: v1 IS one service inside the topology. Service Bus publish v1.5. Reframed on Project portal → What &amp; How.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Where v1 goes further than the team has committed" lead="Five patterns to contribute upward when v1 is introduced.">
        <table className={s.table}>
          <tbody>
            <tr><td><b>L5 federation with explicit ContextRouter</b></td><td>Team's ADR-0004 + ADR-0006 imply federation but no explicit router pattern named yet.</td></tr>
            <tr><td><b>Schema-aware Fabric IQ primitive (ADR-0016)</b></td><td><code>entity-history</code> driven by <code>package.schemaBinding</code>. One source serves both Meridian and banking shapes. Directly addresses ADR-0006's machine-readable shared model.</td></tr>
            <tr><td><b>Industry-aware tool registry</b></td><td>Per-industry MCP kits composed at runtime off <code>Package.Industry</code>. Banking + Meridian get separate tool families.</td></tr>
            <tr><td><b>HITL on Durable Functions</b></td><td><code>WaitForExternalEvent</code> replay-survives-restart. Exactly the alpha PRD's "architectural adverse-decision gate."</td></tr>
            <tr><td><b>Cross-RG AOAI reuse via Foundry connection</b></td><td>Zero new model spend in v1. Alpha PRD's off-the-shelf AOAI ask, with the cost-zero path demonstrated.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="What v1 defers · honest list">
        <ul style={{ paddingLeft: "20px", lineHeight: 1.7, color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
          <li><b>Terraform port</b> · v1.5 alignment to ADR-0003.</li>
          <li><b>Full Fabric Lakehouse expansion</b> · adding <code>dim_exposure</code>, <code>dim_coverage</code>, <code>dim_loss_event</code>, <code>dim_adjuster</code> to reach ~9 of the v2.4 entity surface.</li>
          <li><b>Service Bus publication</b> · second sink on <code>CompositeDecisionSink</code> for cross-service domain events.</li>
          <li><b>Pushing ontology / drafts into team repos</b> · blocked by <code>feedback-adp-no-github-pushes</code>; everything stays inside v1 + the Project ADP folder until WBS lands.</li>
          <li><b>Reorganising v1 agent runtime to match sandbox's prompt-agent / hosted-agent split</b> · sandbox is scaffolding, v1 is a working runtime — premature.</li>
        </ul>
      </Section>

      <Section title="Source of this page">
        <Callout variant="info">
          This page summarises the impact assessment at <code>Project ADP/Team_Repo_Impact_on_v1_2026-06-03.md</code>. That file holds the full ~400-line analysis with per-recommendation effort estimates. This page is the SPA-friendly distillation; the markdown is the canonical record. Both stay inside v1 + Project ADP folder — not pushed.
        </Callout>
      </Section>
    </div>
  );
}

export function GlossaryPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Reference"
        title="Glossary"
        lead="Every term that means something specific inside ADP. Alphabetical."
      />

      <Section title="A–Z">
        <table className={s.table}>
          <thead><tr><th>Term</th><th>Definition</th></tr></thead>
          <tbody>
            {GLOSSARY.sort((a, b) => a.term.localeCompare(b.term)).map((g) => (
              <tr key={g.term}>
                <td style={{ fontWeight: 600, color: tokens.colorBrandForeground1, minWidth: "180px" }}>{g.term}</td>
                <td>{g.definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
