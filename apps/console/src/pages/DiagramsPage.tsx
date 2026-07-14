import { Button, Tag, Tile } from "@carbon/react";
import { Link } from "react-router-dom";
import { ArrowLeft, Document, Download, Launch } from "@carbon/icons-react";

// Diagram library: end-to-end visual coverage of the platform as built, one section per
// diagram with its process steps and system flow. Every SVG is standalone and downloadable
// for decks and architecture reviews.

interface DiagramEntry {
  id: string;
  group: string;
  num: number;
  star?: boolean;
  title: string;
  blurb: string;
  steps: string[];
  sysflow: string;
  src: string;
}

const GROUPS = ["Architecture", "Journeys & scenes", "Platform internals"];

const DIAGRAMS: DiagramEntry[] = [
  {
    id: "solution-architecture",
    group: "Architecture",
    num: 1,
    star: true,
    title: "Solution architecture: five planes, one governed engine",
    blurb:
      "The whole platform on one canvas: experience, decision, agent runtime, context, and data planes, with the governance rail running the full height. The single sentence that explains it: the use case is a package the platform runs, not a product the platform becomes.",
    steps: [
      "A human acts on a branded surface (operator console, member portal, borrower portal).",
      "The decision plane (.NET 10 Durable Functions on Container Apps) executes the signed package's plan.",
      "The active agent adapter runs each step on gpt-4o; vision runs at intake for photo evidence.",
      "The ContextRouter grounds every step through the IQ federation and merges cited fragments.",
      "State lands in the data plane: journal, intake, events, live tail, evidence blobs, Fabric gold.",
      "The governance rail reads everything: gates, Decision Record, agent registry, Outcomes.",
    ],
    sysflow: "surfaces -> decision plane -> agent runtime -> IQ federation -> { Cosmos, Event Hubs, SignalR, Blob, Fabric } -> governance surfaces",
    src: "/docs/adp-solution-architecture.svg",
  },
  {
    id: "agentic-layers",
    group: "Architecture",
    num: 2,
    star: true,
    title: "Agentic layers: seven layers, one domain-aware",
    blurb:
      "The agentic stack from the human surface down to the model. Each layer only knows the one below it, and domain knowledge enters only at layer 3, the digital workers declared by the signed package. Everything underneath is use-case-agnostic platform.",
    steps: [
      "L1 Experience: branded portals and the operator console.",
      "L2 Orchestration: Durable Functions walks the plan, suspends at gates, journals every step.",
      "L3 Digital workers: the five staged workers this instance runs (the only domain-aware layer).",
      "L4 Agents: every step is the same governed loop: ground, reason, act, score, journal or gate.",
      "L5 Skills + tools: the industry-aware registry composes per-use-case MCP tool kits.",
      "L6 Adapters: one PromptContract across Agent Framework (active), Foundry (prepared), legacy.",
      "L7 Model: gpt-4o for reasoning and vision, embeddings for retrieval.",
    ],
    sysflow: "L1 experience -> L2 orchestration -> L3 workers -> L4 agent loop -> L5 tools -> L6 adapters -> L7 gpt-4o",
    src: "/docs/adp-agentic-layers.svg",
  },
  {
    id: "azure-topology",
    group: "Architecture",
    num: 3,
    title: "Deployment topology: rg-adp-v1",
    blurb:
      "The physical view: one SPA origin on Static Web Apps proxying /api to the ca-tracesapi Container App, the state and event services it writes, the AI and knowledge services it reads, and the exit-code-gated deployment path along the bottom.",
    steps: [
      "The browser loads the SPA from Static Web Apps; /api proxies to the Container App (one origin).",
      "The backend writes Cosmos (journal + intake), Event Hubs, SignalR, and the evidence blob container.",
      "Grounding and reasoning read Azure OpenAI, AI Search, and the Fabric Data Agent.",
      "The Foundry Agent Service path is staged; the flip is one env var after the RBAC grant.",
      "Deploys: dotnet publish (gated) then az acr build then containerapp update; SWA CLI for the frontend.",
    ],
    sysflow: "browser -> SWA -> ca-tracesapi -> { cdb-adp-v1, evh-adp-v1, sigr-adp-v1, stadpv1 } + { dt-navigator-openai, srch-adp-v1, Fabric, aif-adp-v1 }",
    src: "/docs/adp-azure-topology.svg",
  },
  {
    id: "runtime-portability",
    group: "Architecture",
    num: 4,
    title: "Runtime portability: one contract, three backends",
    blurb:
      "Decision semantics live in the shared PromptContract, not in any vendor SDK. Microsoft Agent Framework is the active runtime, Foundry Agent Service is one grant away, and the legacy adapter stays as the honest fallback. Swapping is an environment variable.",
    steps: [
      "The package's instructions, the subject record, cited context, and tools assemble into the PromptContract.",
      "The active adapter (AGENT_BACKEND) executes the contract verbatim.",
      "The journal records identical decision shapes regardless of backend: that is the portability test.",
    ],
    sysflow: "PromptContract -> { agent-framework (ACTIVE) | foundry (prepared) | legacy } -> identical journal",
    src: "/docs/adp-runtime-portability.svg",
  },
  {
    id: "integration",
    group: "Architecture",
    num: 5,
    star: true,
    title: "Platform stack and use-case stack: the four sockets",
    blurb:
      "The separation that makes the platform a platform, drawn as the puzzle joints they are. The platform stack (left) ships zero domain logic and is never edited per client; the use-case stack (right) ships everything domain as signed content. They interlock at exactly four typed contracts.",
    steps: [
      "Package socket: agent-package.v1, compiled and signed by adpc, loaded and verified at runtime.",
      "Corpus socket: corpusBinding (array key + subject id field) drives the queue, intake ids, and the portals.",
      "Grounding socket: per-step sourceBindings plus ontology-tagged knowledge decide which IQ fires.",
      "Tooling socket: one IToolRegistry registration line per industry; every call journaled.",
      "Proof of the contract: banking went live as one package plus one registry line, zero platform edits.",
    ],
    sysflow: "use-case content -> { package | corpus | grounding | tooling } sockets -> platform engine -> journal proves behavior on both sides of any change",
    src: "/docs/adp-platform-usecase-integration.svg",
  },
  {
    id: "process-flow",
    group: "Journeys & scenes",
    num: 6,
    star: true,
    title: "Master end-to-end: phone to regulator",
    blurb:
      "The claim's whole journey across three lanes: the member files and tracks, the platform decides with grounding and gates, the operator judges and the regulator artifact falls out of the journal. Dashed green is what flows back to the member.",
    steps: [
      "Member signs in and files a claim with damage photos (steps 1-2).",
      "Photos upload to blob; intake assigns the id and runs vision once (steps 3-4).",
      "Four lifecycle stages run as Durable orchestrations, every step grounded and journaled (step 5).",
      "Low confidence opens an organic HITL gate; the operator judges and the run resumes (steps 6-7).",
      "The member tracks everything, including the vision assessment and the repair estimate (step 8).",
      "Decision Record and Outcomes reconstruct from the journal.",
    ],
    sysflow: "member portal -> POST /evidence -> POST /intake (vision) -> queue -> 4 stage runs -> HITL -> tracker + Decision Record + Outcomes",
    src: "/docs/adp-process-flow.svg",
  },
  {
    id: "scene-fnol",
    group: "Journeys & scenes",
    num: 7,
    title: "Scene: FNOL with photo evidence",
    blurb:
      "The feature in closest detail: a member reports an accident with photos and the platform turns them into decision-grade evidence at intake. Verified live end to end (CLM-2026-10028: photo to assessment to a $1,320 estimate on the tracker).",
    steps: [
      "Member signs in; profile, policy, and vehicles derive live from the records API.",
      "The 3-step wizard prefills everything known; the member adds the incident and up to 6 photos.",
      "Photos resize client-side (1024px JPEG) and upload to POST /api/evidence (blob, grouped).",
      "POST /api/intake assigns the next claim number, runs GPT-4o vision once, embeds the assessment in the record.",
      "The claim is queued and runnable immediately; Decision Mode shows a Submitted evidence card.",
      "The tracker returns the photos, the assessment, and later the stage's repair estimate.",
    ],
    sysflow: "wizard -> POST /evidence (blob) -> POST /intake (vision, alias, Cosmos) -> queue -> tracker",
    src: "/docs/adp-scene-fnol.svg",
  },
  {
    id: "scene-hitl",
    group: "Journeys & scenes",
    num: 8,
    title: "Scene: a human gate trips",
    blurb:
      "Human-in-the-loop as governance, not theater. Gates open organically when a step's calibrated confidence falls below the threshold the package declares; the run suspends, a person judges with the evidence attached, and the judgment itself is journaled.",
    steps: [
      "Steps execute and score; the journal is written before the run moves on.",
      "A step lands below the package threshold; the Durable orchestration suspends.",
      "The queue flips to needs-review live (SignalR); Decision Mode presents the gate with evidence.",
      "The operator approves, overrides, or redirects, with a rationale.",
      "POST /runs/{runId}/resolve-hitl journals the judgment and resumes the run exactly where it stopped.",
      "The Decision Record reprints the intervention; Outcomes counts it in the oversight rate.",
    ],
    sysflow: "low-confidence step -> suspend -> operator judgment -> resolve-hitl -> resume -> journal + record",
    src: "/docs/adp-scene-hitl.svg",
  },
  {
    id: "iq-federation",
    group: "Platform internals",
    num: 9,
    title: "Grounding: one step through the IQ federation",
    blurb:
      "What grounded actually means here: the ContextRouter fans each step across Foundry IQ, Fabric IQ (semantic layer plus the published Data Agent), and Work IQ; the merged cited fragments enter the prompt and the citations survive to the regulator artifact.",
    steps: [
      "A step's intent goes to the ContextRouter with the subject's record already in the prompt.",
      "Foundry IQ returns scored policy and regulatory fragments from AI Search.",
      "Fabric IQ answers from the gold semantic layer; the Data Agent answers in natural language, once per subject.",
      "Work IQ adds collaboration context (synthetic today, Graph-ready).",
      "Citations persist per step: source system, document, title, relevance score.",
      "The console, the Decision Record, and the grounding-rate KPI all read those citations.",
    ],
    sysflow: "step -> ContextRouter -> { FoundryIQ, FabricIQ + Data Agent, WorkIQ } -> cited fragments -> journal (citedSourcesFull)",
    src: "/docs/adp-iq-federation.svg",
  },
  {
    id: "package-model",
    group: "Platform internals",
    num: 10,
    title: "The package model: how a use case ships",
    blurb:
      "The anatomy of the signed agent package (agent-package.v1) and its pipeline: author declaratively, compile and sign with adpc, ship inside the API image, load and validate at run time. Northwind lending went live as one package plus one registration line.",
    steps: [
      "Author the package JSON beside the use case's corpus and data generators.",
      "adpc validates against the schema, resolves skills and tools, signs, and emits a zip per worker.",
      "The artifacts ship in the container image (v1+ pulls from blob or a Process Studio, same loader).",
      "PlanExecutor loads and verifies at run time; the queue, tracker, and governance surfaces render from it.",
    ],
    sysflow: "package.json -> adpc compile+sign -> Resources/*.zip -> PlanExecutor -> queue + gates + registry + outcomes",
    src: "/docs/adp-package-model.svg",
  },
  {
    id: "journal-explainability",
    group: "Platform internals",
    num: 11,
    title: "The decision journal: write once, explain forever",
    blurb:
      "Every step is an event with its reasoning, retrieval scores, tool calls, confidence, and any human judgment, journaled before the run proceeds. The Decision Record, both trace views, and every Outcomes KPI are replays of this log with no private inputs.",
    steps: [
      "The step runner emits a DecisionEvent through composite sinks.",
      "Cosmos dw-state stores it immutably; Event Hubs fans out; SignalR streams the live tail.",
      "The Decision Record reconstructs the regulator artifact entirely from the log.",
      "Decision Mode and the member tracker render the same journal for two audiences.",
      "Outcomes computes runs, grounding rate, oversight rate, and cycle-time percentiles from it.",
    ],
    sysflow: "step -> DecisionEvent -> { Cosmos dw-state, Event Hubs, SignalR } -> record + trackers + aggregates",
    src: "/docs/adp-journal-explainability.svg",
  },
  {
    id: "data-semantic",
    group: "Platform internals",
    num: 12,
    title: "Data and semantic foundation",
    blurb:
      "What the agents stand on: three operational stores (bundled corpus, runtime intake, evidence blobs) plus the journal, and the Fabric side that gives the same universe a governed semantic shape: the 24-table gold lakehouse, the ontology, and the published Data Agent.",
    steps: [
      "The corpus ships in the package and defines the id pattern; runtime intake continues it.",
      "Evidence photos live in blob with a subject alias for read-side resolution.",
      "The gold generator produces the lakehouse CSVs; loaders land them reproducibly.",
      "The ontology gives the tables business meaning; steps journal which entities they touched.",
      "The published Data Agent answers natural-language questions and is cited per step.",
    ],
    sysflow: "corpus + intake + evidence -> runs -> journal; generators -> lakehouse (24 tables) -> ontology -> Data Agent -> citations",
    src: "/docs/adp-data-semantic.svg",
  },
  {
    id: "conversational",
    group: "Platform internals",
    num: 13,
    title: "Conversational AI: assistant + copilot",
    blurb:
      "The two chat surfaces side by side: the member assistant (both portals, member-scoped grounding assembled server-side, fraud excluded by construction) and the operator copilot (a real Agent Framework agent with journal, records, and Fabric Data Agent tools). Shared foundation: gpt-4o, one structured response with contextual follow-ups, graceful degradation.",
    steps: [
      "A member asks in their portal; the browser sends only the conversation and their member id.",
      "POST /api/assist assembles that member's records + journey server-side and calls gpt-4o over REST.",
      "Fraud stages enter the context only as 'routine review'; their outputs are never included.",
      "An operator asks on the console; POST /api/copilot runs a Microsoft Agent Framework agent.",
      "The agent picks tools per question: query_journal, query_records, or ask_fabric_data_agent.",
      "Both return {reply, followUps}; the UI shows source chips (copilot) and next-question chips.",
    ],
    sysflow: "portal dock -> /assist (member-scoped REST) | console dock -> /copilot (AF agent -> {journal, records, Data Agent}) -> reply + followUps",
    src: "/docs/adp-conversational.svg",
  },
  {
    id: "lifecycle-reference",
    group: "Platform internals",
    num: 14,
    title: "Lifecycle reference: stages and workers",
    blurb:
      "The declared lifecycles side by side: the four claims stages with what each digital worker decides and when it gates, and the banking origination stage that proves portability. Stages are data in the packages, never code.",
    steps: [
      "Intake & Routing (FNOL Handler): validate, verify coverage, triage, route.",
      "Damage & Estimation (Damage Handler): categorize damage, produce the estimate the member sees.",
      "Fraud Screen (Fraud Handler): integrity signals, narrative-versus-evidence consistency.",
      "Settlement & Payment (Settlement Handler): settlement figures with journaled provenance.",
      "Origination Decision (Consumer Loan Handler): approve / refer / decline with cited grounding.",
    ],
    sysflow: "packages declare stage + stageOrder -> queue lifecycle -> member tracker -> journey -> outcomes lens",
    src: "/docs/adp-lifecycle-reference.svg",
  },
];

function DiagramSection({ d }: { d: DiagramEntry }) {
  return (
    <section id={d.id} className="adp-dgl__section">
      <Tile className={`adp-dgl__card${d.star ? " adp-dgl__card--star" : ""}`}>
        <div className="adp-docs__diagram-head">
          <h4>
            <span className="adp-dgl__num">{d.num}</span> {d.title}
            {d.star && <Tag type="purple" size="sm">key view</Tag>}
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
        <p className="adp-queue__dim adp-dgl__blurb">{d.blurb}</p>
        <div className="adp-dgl__meta">
          <div className="adp-dgl__steps">
            <span className="adp-dgl__meta-label adp-dgl__meta-label--steps">Process steps</span>
            <ol>
              {d.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
          <p className="adp-dgl__sys">
            <span className="adp-dgl__meta-label adp-dgl__meta-label--sys">System flow</span>
            <code>{d.sysflow}</code>
          </p>
        </div>
        <div className="adp-docs__diagram-frame">
          <img src={d.src} alt={d.title} loading="lazy" />
        </div>
      </Tile>
    </section>
  );
}

export default function DiagramsPage() {
  return (
    <div className="adp-docs">
      <section className="adp-docs__hero">
        <div className="adp-docs__hero-tags">
          <Tag type="blue">Diagram library</Tag>
          <Tag type="green">{DIAGRAMS.length} diagrams · as built</Tag>
          <Tag type="cool-gray">All data synthetic</Tag>
        </div>
        <h2>End-to-end diagram coverage</h2>
        <p>
          Every architecture view, journey, and platform internal, drawn from the live build: what runs today on
          rg-adp-v1, not an aspiration. Each diagram is a standalone SVG with its process steps and system flow, ready
          to open full size or drop into a deck.
        </p>
        <div className="adp-docs__hero-actions">
          <Button kind="tertiary" as={Link} to="/docs" renderIcon={ArrowLeft}>
            Back to documentation
          </Button>
          <Button as="a" kind="ghost" href="/docs/ADP-SOLUTION.md" download renderIcon={Document}>
            Full documentation (.md)
          </Button>
        </div>
      </section>

      <nav className="adp-dgl__nav" aria-label="Diagram index">
        {GROUPS.map((g) => (
          <span key={g} className="adp-dgl__nav-group">
            <span className="adp-dgl__nav-label">{g}</span>
            {DIAGRAMS.filter((d) => d.group === g).map((d) => (
              <a key={d.id} href={`#${d.id}`} className={d.star ? "adp-dgl__chip adp-dgl__chip--star" : "adp-dgl__chip"}>
                {d.num} · {d.title.split(":")[0]}
              </a>
            ))}
          </span>
        ))}
      </nav>

      {GROUPS.map((g) => (
        <div key={g}>
          <h3 className="adp-section-title adp-dgl__group-title">{g}</h3>
          {DIAGRAMS.filter((d) => d.group === g).map((d) => (
            <DiagramSection key={d.id} d={d} />
          ))}
        </div>
      ))}

      <p className="adp-queue__dim adp-docs__closing">
        IBM Consulting: Data Transformation on Microsoft Cloud. Demonstration asset, all data synthetic. Diagrams
        reflect the deployed build (tracesapi:v13-evidence-3) as of 2026-07-13.
      </p>
    </div>
  );
}
