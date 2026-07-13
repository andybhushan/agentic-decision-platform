import { Button, Tag, Tile } from "@carbon/react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Chat,
  Document,
  Download,
  FlowData,
  Launch,
  Network_3,
  Rocket,
  Security,
} from "@carbon/icons-react";

// Solution documentation: the whole platform captured as built, on the platform itself.
// Follows the DT live-demo documentation convention (downloadable .md + standalone SVG
// diagrams + as-built facts), styled in the console's own Carbon + Fluent language.

const TOC = [
  { id: "why", label: "What & why" },
  { id: "architecture", label: "Architecture" },
  { id: "flow", label: "Process flow" },
  { id: "grounding", label: "IQ federation" },
  { id: "chat", label: "Conversational AI" },
  { id: "stack", label: "Technology stack" },
  { id: "api", label: "API surface" },
  { id: "governance", label: "Governance" },
  { id: "operations", label: "Deployment & ops" },
  { id: "roadmap", label: "Roadmap" },
];

const PILLARS = [
  { title: "Grounded", text: "Every agent step retrieves through the Microsoft IQ federation and the citations are stored per step, per source, with relevance scores." },
  { title: "Governed", text: "Confidence below the package's declared threshold opens a human gate organically. Judgments and governed actions are first-class journal events." },
  { title: "Explainable", text: "The immutable journal reconstructs into a print-ready Decision Record, the artifact a regulator receives, for any subject on demand." },
  { title: "Multimodal", text: "Members upload damage photos at FNOL; GPT-4o vision describes them once at intake and the assessment travels to every downstream agent." },
  { title: "Portable", text: "One PromptContract, three swappable runtimes: legacy Azure OpenAI, Microsoft Agent Framework (active), Azure AI Foundry Agent Service (prepared)." },
];

const DIAGRAMS = [
  {
    src: "/docs/adp-solution-architecture.svg",
    id: "architecture",
    Icon: Network_3,
    title: "Solution architecture: five planes, one governed engine",
    blurb:
      "Experience, decision, agent runtime, context, and data planes, with the governance rail running the full height. The use case is a signed package the platform runs; two industries run side by side on this instance to prove it.",
  },
  {
    src: "/docs/adp-process-flow.svg",
    id: "flow",
    Icon: FlowData,
    title: "End-to-end process flow: phone to regulator",
    blurb:
      "A member files a claim with damage photos; vision runs once at intake; four lifecycle stages decide with grounding and organic human gates; the member tracks everything including the repair estimate; the journal reconstructs the regulator artifact.",
  },
  {
    src: "/docs/adp-iq-federation.svg",
    id: "grounding",
    Icon: Network_3,
    title: "Grounding: one step through the IQ federation",
    blurb:
      "The ContextRouter fans each step across Foundry IQ (AI Search vectors), Fabric IQ (lakehouse semantic layer plus the published Data Agent), and Work IQ. Merged cited fragments enter the prompt; the citations persist to the journal, the console, and the Decision Record.",
  },
  {
    src: "/docs/adp-azure-topology.svg",
    id: "operations",
    Icon: Rocket,
    title: "Deployment topology: rg-adp-v1",
    blurb:
      "One SPA origin (Static Web Apps proxying /api), one backend Container App, and the state, event, and AI services around it, including the prepared Foundry Agent Service path. The deployment path with its exit-code gates runs along the bottom.",
  },
  {
    src: "/docs/adp-conversational.svg",
    id: "chat",
    Icon: Chat,
    title: "Conversational AI: two chat surfaces, two entitlements",
    blurb:
      "The member assistant lives in both branded portals and answers only from the signed-in member's own records, with fraud detail excluded from its context by construction. The operator copilot is a real Microsoft Agent Framework agent on the console with three governed tools: the decision journal, subject records, and the Fabric IQ Data Agent. Both return contextual follow-up questions in the same structured response.",
  },
];

const FLOW_STEPS = [
  { n: 1, who: "Member", what: "Signs in; identity, policy, vehicles, and history derive live from the records API." },
  { n: 2, who: "Member", what: "Files a claim: prefilled FNOL wizard, incident narrative, up to 6 damage photos resized client-side." },
  { n: 3, who: "Platform", what: "Photos land in the evidence blob store under a groupId that rides on the claim record." },
  { n: 4, who: "Platform", what: "Intake assigns the next claim number from the corpus pattern; GPT-4o vision describes the photos once and the assessment embeds inside the record." },
  { n: 5, who: "Platform", what: "Lifecycle stages run as Durable orchestrations: Intake & Routing, Damage & Estimation, Fraud Screen, Settlement & Payment. Every step grounded, scored, journaled." },
  { n: 6, who: "Platform", what: "Confidence below the package threshold suspends the run at an organic HITL gate, evidence attached." },
  { n: 7, who: "Operator", what: "Approves, overrides, or redirects in Decision Mode; the judgment journals and the run resumes. Governed actions execute with rationale." },
  { n: 8, who: "Member", what: "Tracks every stage in member language: submitted photos, what our AI saw, and the estimated repair cost from the estimation step." },
];

const IQ_SOURCES = [
  { name: "Foundry IQ", system: "Azure AI Search (vector + semantic)", gives: "Policy wordings, guidelines, regulatory text with relevance scores" },
  { name: "Fabric IQ", system: "Microsoft Fabric lakehouse SQL endpoint", gives: "The gold semantic layer: policyholders, vehicles, claims, loans" },
  { name: "Fabric IQ Data Agent", system: "Published claims_data_agent", gives: "Natural-language answers over the ontology, consulted per subject and cited" },
  { name: "Work IQ", system: "Synthetic today, Microsoft Graph-ready", gives: "Collaboration context: adjuster threads, prior discussion signals" },
];

const AZURE_RESOURCES = [
  ["Container Apps", "ca-tracesapi", "The entire backend: API + Durable orchestration"],
  ["Static Web Apps", "swa-adp-v1-console", "The SPA: console, both portals, this documentation"],
  ["Container Registry", "acradpv1", "Backend images, built in-cloud via az acr build"],
  ["Cosmos DB", "cdb-adp-v1", "Immutable decision journal + runtime intake"],
  ["Event Hubs", "evh-adp-v1", "Decision event fan-out"],
  ["SignalR Service", "sigr-adp-v1", "Live step tail to the console (serverless)"],
  ["Storage", "stadpv1", "Functions runtime + evidence blob container"],
  ["AI Search", "srch-adp-v1", "Foundry IQ vector index"],
  ["AI Foundry", "aif-adp-v1 / adp-v1", "Foundry Agent Service, prepared path"],
  ["Azure OpenAI", "dt-navigator-openai", "gpt-4o reasoning + vision, embeddings (shared)"],
  ["Key Vault / Insights", "kv-adp-v1 / appi-adp-v1", "Secrets, telemetry, Log Analytics"],
  ["Microsoft Fabric", "lakehouse + claims_data_agent", "Gold semantic layer (24 tables), ontology, Data Agent"],
];

const API_ROUTES = [
  ["GET /health", "Liveness"],
  ["GET /decisions", "Queue: subjects, packages, latest traces, lifecycle progress"],
  ["POST /runs", "Start a decision run; optional backend picks the runtime (agent-framework | foundry | legacy)"],
  ["GET /runs/{runId}/status", "Durable orchestration status"],
  ["POST /runs/{runId}/resolve-hitl", "Resume a gated run with the operator judgment"],
  ["GET /traces/{subjectId}", "Full trace: steps, citations, tool calls, gates"],
  ["GET /journey/{subjectId}", "Every trace ever journaled for a subject"],
  ["GET /records?industry=", "Subject records: corpus + runtime intake merged"],
  ["POST /intake", "File a new subject; assigns id, runs evidence vision"],
  ["POST /evidence", "Upload damage photos (base64, max 6)"],
  ["GET /evidence/subject/{id}", "Resolve a subject's photo group"],
  ["GET /evidence/file/{group}/{name}", "Serve a photo"],
  ["POST /actions", "Execute a governed operator action with rationale"],
  ["POST /assist", "Member assistant: chat grounded server-side in the member's own records"],
  ["POST /copilot", "Operator copilot: Agent Framework agent with journal, records, and Fabric Data Agent tools"],
  ["GET /agents", "Governance registry: declared estate + observed behavior"],
  ["GET /aggregate/outcomes", "KPI aggregates, filterable per use case"],
  ["GET /aggregate/timeline", "Time-bucketed run and confidence series"],
  ["GET /aggregate/cycletime", "Decision cycle time percentiles per worker"],
];

const LESSONS = [
  "Gate on the publish exit code: grep-filtered dotnet publish output once masked a TreatWarningsAsErrors failure and shipped a stale image.",
  "Azure.AI.OpenAI 2.1 chat is binary-incompatible with the OpenAI 2.10 assembly Agent Framework resolves; new direct chat-completion code calls the REST API over HttpClient.",
  "Fabric Data Agent protocol: every call needs api-version=2024-05-01-preview, and the serving assistant is minted via POST /assistants; the artifact id is not an assistant id.",
  "Cosmos writes: the SDK's Newtonsoft default drops the id field on PascalCase records; write lowercase anonymous objects.",
  "Screenshot verification before claiming a UI fix: Carbon grid gutters required empirical fixes verified by Playwright, not reasoning from source.",
];

const ROADMAP = [
  ["Vision-informed estimation", "Shipped", "Damage agents reason over the photo assessment; estimate positions inside the band by visible damage (v14)"],
  ["Fraud evidence cross-check", "Shipped", "evidenceConsistency classification; photo vs narrative contradiction gates to a human (v15)"],
  ["Document evidence (police report)", "Shipped", "PDF upload at FNOL, stored + surfaced + listed on the record as documentEvidence (v16)"],
  ["Banking evidence parity", "Shipped", "Payslip photos + statement PDFs; vision reads the figures; intake agent verifies income against them (v17)"],
  ["Fabric write-back of intake", "Shipped", "scripts/sync-intake-to-fabric.ps1: universe + intake overlay; the Data Agent answers about subjects filed minutes ago"],
  ["Foundry Agent Service backend", "Shipped", "RBAC granted (Cognitive Services User); validated live 4/4 GROUNDED; now switchable per run vs Agent Framework (v22)"],
  ["Real Work IQ (Microsoft Graph)", "Synthetic today", "Tenant admin consent for Graph application permissions"],
  ["Banking tables in the Data Agent", "Config", "Tick fact_loan_applications + dim_borrower in claims_data_agent sources and re-publish"],
  ["Microsoft 365 Copilot surface", "Positioned", "Expose the operator copilot as a declarative agent (Copilot Studio / M365 Agents SDK) once tenant licensing + consent land"],
];

function DiagramCard({ d }: { d: (typeof DIAGRAMS)[number] }) {
  return (
    <Tile className="adp-docs__diagram">
      <div className="adp-docs__diagram-head">
        <h4>
          <d.Icon size={20} /> {d.title}
        </h4>
        <div className="adp-docs__diagram-actions">
          <Button kind="ghost" size="sm" href={d.src} target="_blank" rel="noopener noreferrer" renderIcon={Launch}>
            Full size
          </Button>
          <Button as="a" kind="tertiary" size="sm" href={d.src} download renderIcon={Download}>
            SVG
          </Button>
        </div>
      </div>
      <p className="adp-queue__dim">{d.blurb}</p>
      <div className="adp-docs__diagram-frame">
        <img src={d.src} alt={d.title} loading="lazy" />
      </div>
    </Tile>
  );
}

export default function DocsPage() {
  return (
    <div className="adp-docs">
      <section className="adp-docs__hero">
        <div className="adp-docs__hero-tags">
          <Tag type="blue">Solution documentation</Tag>
          <Tag type="green">Live · as built</Tag>
          <Tag type="cool-gray">All data synthetic</Tag>
        </div>
        <h2>Everything about this platform, on the platform</h2>
        <p>
          What ADP is and why it exists, the architecture, the end-to-end process flow, the technology stack, and how
          it is deployed and governed. Captured as built, with downloadable diagrams for decks and architecture
          reviews, and the full document as markdown.
        </p>
        <div className="adp-docs__hero-actions">
          <Button as="a" href="/docs/ADP-SOLUTION.md" download renderIcon={Document}>
            Download full documentation (.md)
          </Button>
          <Button kind="tertiary" as={Link} to="/docs/diagrams" renderIcon={FlowData}>
            Diagram library (12 views)
          </Button>
          <Button kind="ghost" as={Link} to="/" renderIcon={ArrowRight}>
            Open the live platform
          </Button>
        </div>
      </section>

      <div className="adp-docs__layout">
        <nav className="adp-docs__toc" aria-label="Documentation sections">
          <p className="adp-docs__toc-title">On this page</p>
          {TOC.map((t) => (
            <a key={t.id} href={`#${t.id}`}>
              {t.label}
            </a>
          ))}
        </nav>

        <div className="adp-docs__body">
          <section id="why" className="adp-docs__section">
            <h3 className="adp-section-title">What ADP is, and why it exists</h3>
            <p className="adp-docs__lede">
              Regulated industries run on high-volume operational decisions: claim triage, damage estimation, fraud
              screens, settlement, loan origination. Manual handling is slow and opaque under audit; rule engines are
              blind to context and unstructured evidence; isolated AI pilots have no governance story and no reuse.
              Enterprises do not need another pilot. They need a decision platform: one governed engine that runs any
              regulated decision, grounded in the organisation's own data, gated by confidence, and journaled
              immutably for the regulator.
            </p>
            <blockquote className="adp-docs__thesis">
              The use case is a package the platform runs, not a product the platform becomes.
            </blockquote>
            <p className="adp-queue__dim">
              The platform ships zero domain logic. A use case arrives as a signed agent package: digital workers,
              agents, skills, tools, prompts, gate policy, SLOs, and a corpus binding. The same console, runtime,
              journal, and governance surfaces execute it. Two industries prove it side by side on this instance:
              P&amp;C auto claims (Meridian Mutual, 4 digital workers, 16 agents) and consumer loan origination
              (Northwind Bank).
            </p>
            <div className="adp-docs__pillars">
              {PILLARS.map((p) => (
                <Tile key={p.title} className="adp-docs__pillar">
                  <h4>{p.title}</h4>
                  <p>{p.text}</p>
                </Tile>
              ))}
            </div>
          </section>

          <section className="adp-docs__section">
            <DiagramCard d={DIAGRAMS[0]} />
          </section>

          <section id="flow" className="adp-docs__section">
            <h3 className="adp-section-title">The end-to-end process flow</h3>
            <DiagramCard d={DIAGRAMS[1]} />
            <ol className="adp-docs__steps">
              {FLOW_STEPS.map((s) => (
                <li key={s.n}>
                  <span className="adp-docs__step-num">{s.n}</span>
                  <span className="adp-docs__step-who">{s.who}</span>
                  <span>{s.what}</span>
                </li>
              ))}
            </ol>
            <p className="adp-queue__dim">
              The banking flow is the same platform verbatim: a borrower applies at /bank, the Consumer Loan Handler
              decides the origination stage, and the same journal, gates, Decision Record, and Outcomes apply.
            </p>
          </section>

          <section id="grounding" className="adp-docs__section">
            <h3 className="adp-section-title">Grounding: the Microsoft IQ federation</h3>
            <DiagramCard d={DIAGRAMS[2]} />
            <div className="adp-docs__table-wrap">
              <table className="adp-docs__table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>System</th>
                    <th>What it contributes</th>
                  </tr>
                </thead>
                <tbody>
                  {IQ_SOURCES.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="adp-docs__mono">{s.system}</td>
                      <td>{s.gives}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="chat" className="adp-docs__section">
            <h3 className="adp-section-title">Conversational AI: the two chat surfaces</h3>
            <DiagramCard d={DIAGRAMS[4]} />
            <div className="adp-docs__table-wrap">
              <table className="adp-docs__table">
                <thead>
                  <tr>
                    <th>Aspect</th>
                    <th>Member assistant</th>
                    <th>Operator copilot</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Where</td>
                    <td>Both branded portals (/member, /bank)</td>
                    <td>Platform console, every page</td>
                  </tr>
                  <tr>
                    <td>Endpoint</td>
                    <td className="adp-docs__mono">POST /api/assist</td>
                    <td className="adp-docs__mono">POST /api/copilot</td>
                  </tr>
                  <tr>
                    <td>Runtime</td>
                    <td>gpt-4o via direct Azure OpenAI REST (JSON response format)</td>
                    <td>Microsoft Agent Framework ChatClientAgent with 3 AIFunction tools</td>
                  </tr>
                  <tr>
                    <td>Grounding</td>
                    <td>Server-assembled: the signed-in member's own records + journey; nothing else reaches the browser</td>
                    <td>Tool calls the model chooses: decision journal, subject records, Fabric IQ Data Agent</td>
                  </tr>
                  <tr>
                    <td>Entitlement</td>
                    <td>Fraud detail excluded from context by construction; off-account questions redirect</td>
                    <td>Fraud detail allowed; answers cite subject ids and the tools used (source chips)</td>
                  </tr>
                  <tr>
                    <td>Follow-ups</td>
                    <td colSpan={2}>One structured response per turn ({"{"}reply, followUps{"}"}): contextual next questions as chips, zero extra calls</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="stack" className="adp-docs__section">
            <h3 className="adp-section-title">Technology stack</h3>
            <p className="adp-queue__dim">
              Backend: .NET 10 isolated Azure Functions + Durable Functions, Microsoft Agent Framework 1.13 over
              Azure OpenAI gpt-4o, central package management with warnings as errors. Frontend: React 18 +
              TypeScript + Vite, IBM Carbon v11 as the structural design system with Microsoft Fluent 2 iconography
              on Microsoft-stack surfaces, the same dual-brand convention as the DT offering website and collateral.
              Verification: a Playwright screenshot loop is part of the definition of done.
            </p>
            <div className="adp-docs__table-wrap">
              <table className="adp-docs__table">
                <thead>
                  <tr>
                    <th>Azure service</th>
                    <th>Resource</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {AZURE_RESOURCES.map((r) => (
                    <tr key={r[1]}>
                      <td>{r[0]}</td>
                      <td className="adp-docs__mono">{r[1]}</td>
                      <td>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="api" className="adp-docs__section">
            <h3 className="adp-section-title">API surface</h3>
            <p className="adp-queue__dim">Everything under /api, served by the Container App and proxied through the SWA.</p>
            <div className="adp-docs__table-wrap">
              <table className="adp-docs__table">
                <thead>
                  <tr>
                    <th>Endpoint</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {API_ROUTES.map((r) => (
                    <tr key={r[0]}>
                      <td className="adp-docs__mono">{r[0]}</td>
                      <td>{r[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="governance" className="adp-docs__section">
            <h3 className="adp-section-title">
              <Security size={22} /> Governance, audit, and honesty
            </h3>
            <ul className="adp-docs__list">
              <li>
                <strong>Immutable journal:</strong> every step of every run in Cosmos DB, never updated in place.
              </li>
              <li>
                <strong>Decision Record:</strong> the print-ready regulator artifact, reconstructed from the journal
                for any subject at /decisions/&#123;id&#125;/record.
              </li>
              <li>
                <strong>Agent registry:</strong> the declared estate (workers, agents, models, calibration, SLOs,
                Entra Agent ID declarations) joined with journal-observed reality at /agents.
              </li>
              <li>
                <strong>Honesty, stated on stage:</strong> all subject data is synthetic; Work IQ is a deterministic
                synthetic source until tenant Graph consent lands; the access key is demo hygiene, not security;
                agent reasoning is real gpt-4o inference, never scripted.
              </li>
            </ul>
          </section>

          <section id="operations" className="adp-docs__section">
            <h3 className="adp-section-title">Deployment and operations</h3>
            <DiagramCard d={DIAGRAMS[3]} />
            <h4 className="adp-docs__subhead">Engineering lessons worth keeping (paid for in deploys)</h4>
            <ul className="adp-docs__list">
              {LESSONS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>

          <section id="roadmap" className="adp-docs__section">
            <h3 className="adp-section-title">Roadmap</h3>
            <div className="adp-docs__table-wrap">
              <table className="adp-docs__table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Unlock</th>
                  </tr>
                </thead>
                <tbody>
                  {ROADMAP.map((r) => (
                    <tr key={r[0]}>
                      <td>{r[0]}</td>
                      <td>
                        <Tag size="sm" type={r[1] === "Shipped" ? "green" : r[1] === "Prepared" ? "blue" : "cool-gray"}>
                          {r[1]}
                        </Tag>
                      </td>
                      <td>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="adp-queue__dim adp-docs__closing">
              IBM Consulting: Data Transformation on Microsoft Cloud. Demonstration asset, all data synthetic.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
