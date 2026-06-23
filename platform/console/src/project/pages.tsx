import { Card, makeStyles, tokens, Badge } from "@fluentui/react-components";
import { useThemeMode } from "../ThemeContext";
import { InfographicGenerator, PromptPreset } from "../components/InfographicGenerator";
import { ResourceHierarchyCompact } from "../docs/ResourceHierarchy";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: "32px", maxWidth: "1180px" },

  // Cinematic page hero
  hero: {
    position: "relative",
    margin: "0 -48px 8px",
    minHeight: "320px",
    padding: "64px 64px 56px",
    color: "#FFFFFF",
    overflow: "hidden",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "10px",
  },
  heroBg: {
    position: "absolute",
    inset: 0,
    backgroundImage: "url('/images/adp/hero1.webp')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    zIndex: 0,
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg, rgba(15,98,254,0.9) 0%, rgba(92,46,145,0.88) 60%, rgba(0,157,154,0.8) 100%)",
    zIndex: 1,
  },
  heroOverlayDeep: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg, rgba(11,18,32,0.86) 0%, rgba(15,98,254,0.78) 100%)",
    zIndex: 1,
  },
  heroInner: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "920px",
  },
  brandRow: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" },
  brandBadge: {
    padding: "4px 14px",
    borderRadius: "14px",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "2px",
    textTransform: "uppercase",
    border: "1px solid rgba(255,255,255,0.35)",
  },
  brandLogo: { height: "32px", objectFit: "contain" },
  heroTitle: { fontSize: "44px", fontWeight: 800, lineHeight: 1.06, letterSpacing: "-0.8px", color: "#FFFFFF" },
  heroLead: { fontSize: "17px", lineHeight: 1.6, color: "rgba(255,255,255,0.95)", maxWidth: "780px", marginTop: "8px" },
  heroChips: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "18px" },
  heroChip: {
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.32)",
  },
  heroPartners: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(255,255,255,0.22)",
    flexWrap: "wrap",
  },
  heroPartnersLabel: { fontSize: "10px", color: "rgba(255,255,255,0.88)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 600 },
  heroPartnerTile: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 14px",
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  },
  heroPartnerLogo: { height: "22px", objectFit: "contain", display: "block" },

  // Section
  section: { display: "flex", flexDirection: "column", gap: "14px" },
  sectionTitle: { fontSize: "26px", fontWeight: 700, color: tokens.colorNeutralForeground1, letterSpacing: "-0.3px" },
  sectionLead: { fontSize: "15px", color: tokens.colorNeutralForeground2, lineHeight: 1.55, maxWidth: "900px" },
  paragraph: { fontSize: "15px", color: tokens.colorNeutralForeground2, lineHeight: 1.7, maxWidth: "900px" },
  inlineCode: { fontFamily: "Consolas, monospace", fontSize: "13px", padding: "1px 6px", borderRadius: "4px", backgroundColor: tokens.colorNeutralBackground3 },

  // Tile grid
  tileGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" },
  tile: {
    padding: "22px 24px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    transition: "transform 120ms ease, box-shadow 120ms ease",
    cursor: "pointer",
    "&:hover": { transform: "translateY(-2px)" },
  },
  tileLabel: { fontSize: "10px", color: tokens.colorBrandForeground1, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 700 },
  tileTitle: { fontSize: "20px", fontWeight: 700, color: tokens.colorNeutralForeground1 },
  tileBody: { fontSize: "13px", color: tokens.colorNeutralForeground2, lineHeight: 1.6 },
  tileFooter: { fontSize: "11px", color: tokens.colorNeutralForeground3, marginTop: "auto", paddingTop: "10px" },

  // Stat row
  statRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" },
  stat: {
    padding: "18px 20px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statN: { fontSize: "30px", fontWeight: 800, color: tokens.colorNeutralForeground1, lineHeight: 1.05, letterSpacing: "-0.5px" },
  statL: { fontSize: "11px", color: tokens.colorNeutralForeground3, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 },

  // Timeline
  timeline: { display: "flex", flexDirection: "column", gap: "0" },
  timelineRow: { display: "grid", gridTemplateColumns: "140px 1fr", gap: "20px", padding: "16px 0", borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  timelineDate: { fontSize: "12px", color: tokens.colorBrandForeground1, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" },
  timelineBody: { display: "flex", flexDirection: "column", gap: "6px" },
  timelineTitle: { fontSize: "15px", fontWeight: 600, color: tokens.colorNeutralForeground1 },
  timelineText: { fontSize: "13px", color: tokens.colorNeutralForeground2, lineHeight: 1.6 },

  // Callout / Quote
  callout: {
    padding: "20px 24px",
    backgroundColor: tokens.colorBrandBackground2,
    borderLeft: `4px solid ${tokens.colorBrandStroke1}`,
    borderRadius: "0 8px 8px 0",
    fontSize: "14px",
    color: tokens.colorNeutralForeground1,
    lineHeight: 1.65,
  },
  quote: {
    padding: "24px 28px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderLeft: `4px solid ${tokens.colorPalettePurpleBorderActive}`,
    borderRadius: "0 10px 10px 0",
    fontSize: "16px",
    fontStyle: "italic",
    lineHeight: 1.6,
    color: tokens.colorNeutralForeground1,
  },

  // Two-col
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },

  // Code prompt block
  codeBlock: {
    fontFamily: "Consolas, 'Cascadia Code', monospace",
    fontSize: "12.5px",
    backgroundColor: "#0b1220",
    color: "#e6edf7",
    padding: "20px 24px",
    borderRadius: "8px",
    lineHeight: 1.7,
    overflow: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    whiteSpace: "pre-wrap",
    maxHeight: "560px",
  },

  // Method card
  methodCard: {
    padding: "22px 24px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  methodHead: { display: "flex", alignItems: "center", gap: "12px" },
  methodTitle: { fontSize: "16px", fontWeight: 700, color: tokens.colorNeutralForeground1 },
  methodRole: { fontSize: "10px", color: tokens.colorBrandForeground1, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 700 },
});

interface HeroProps {
  eyebrow: string;
  title: string;
  lead: string;
  chips?: string[];
  partners?: boolean;
  variant?: "bright" | "deep";
}

function PageHero({ eyebrow, title, lead, chips, partners = true, variant = "bright" }: HeroProps) {
  const s = useStyles();
  return (
    <div className={s.hero}>
      <div className={s.heroBg} />
      <div className={variant === "deep" ? s.heroOverlayDeep : s.heroOverlay} />
      <div className={s.heroInner}>
        <div className={s.brandRow}>
          <span className={s.brandBadge}>{eyebrow}</span>
          <img src="/images/adp/adp-logo.webp" alt="" className={s.brandLogo} />
        </div>
        <h1 className={s.heroTitle}>{title}</h1>
        <p className={s.heroLead}>{lead}</p>
        {chips && chips.length > 0 && (
          <div className={s.heroChips}>
            {chips.map((c) => <span key={c} className={s.heroChip}>{c}</span>)}
          </div>
        )}
        {partners && (
          <div className={s.heroPartners}>
            <span className={s.heroPartnersLabel}>Co-built by</span>
            <span className={s.heroPartnerTile}>
              <img src="/images/ibm-logo.png" alt="IBM" className={s.heroPartnerLogo} />
            </span>
            <span className={s.heroPartnerTile}>
              <img src="/images/ms-logo.png" alt="Microsoft" className={s.heroPartnerLogo} />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 1. HUB / Welcome
// ============================================================
export function HubPage({ navigate }: { navigate: (id: string) => void }) {
  const s = useStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Project ADP · v1.0 · live"
        title="A Microsoft-native agentic platform for frontier insurance firms — proven end-to-end, validated across two industries."
        lead="The IBM-Project-Adp initiative is shaping the long-arc vision. adp-v1 is the working reference build that turns that vision into Azure resources, deployed packages, citing agents, an operator console, and a docs portal — running right now in the IBM Alliance tenant. This portal tells the build's story."
        chips={["Microsoft-native", "Meridian P&C Auto + Banking", "5 packages deployed", "16 ADRs accepted", "v1.0 live"]}
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Three doors</h2>
        <p className={s.sectionLead}>The portal has three top-nav surfaces. Each answers a different question.</p>
        <div className={s.tileGrid}>
          <Card className={s.tile} onClick={() => navigate("brief")}>
            <span className={s.tileLabel}>Project · narrative</span>
            <h3 className={s.tileTitle}>Project Portal</h3>
            <p className={s.tileBody}>You are here. The story behind the solo build — why I did this, how I worked, what I built, where it's going.</p>
            <span className={s.tileFooter}>Start with the Brief or Vision below</span>
          </Card>
          <Card className={s.tile} onClick={() => window.location.hash = "docs/home"}>
            <span className={s.tileLabel}>Docs · technical reference</span>
            <h3 className={s.tileTitle}>Docs Portal</h3>
            <p className={s.tileBody}>What is built, where it lives, how it runs. 26+ pages: architecture layers, L5 federation, application architecture, Azure topology, 16 ADRs, deployment runbook.</p>
            <span className={s.tileFooter}>Reference material for architects and engineers</span>
          </Card>
          <Card className={s.tile} onClick={() => window.location.hash = "operator"}>
            <span className={s.tileLabel}>Operator · live demo</span>
            <h3 className={s.tileTitle}>Operator Console</h3>
            <p className={s.tileBody}>The working surface. Five packages (4 Meridian DWs + Banking Loan Handler). Run a claim, watch the live tail, exercise HITL Approve / Escalate.</p>
            <span className={s.tileFooter}>Drive the platform yourself</span>
          </Card>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>By the numbers</h2>
        <p className={s.sectionLead}>What the solo build produced.</p>
        <div className={s.statRow}>
          <div className={s.stat}><span className={s.statN}>~30</span><span className={s.statL}>focused hours · across 4 calendar days</span></div>
          <div className={s.stat}><span className={s.statN}>5</span><span className={s.statL}>compiled packages deployed</span></div>
          <div className={s.stat}><span className={s.statN}>2</span><span className={s.statL}>industries proven · insurance + banking</span></div>
          <div className={s.stat}><span className={s.statN}>16</span><span className={s.statL}>ADRs accepted</span></div>
          <div className={s.stat}><span className={s.statN}>~20</span><span className={s.statL}>Azure + Fabric resources · IBM Alliance tenant</span></div>
          <div className={s.stat}><span className={s.statN}>~6,100</span><span className={s.statL}>lines of platform C#</span></div>
          <div className={s.stat}><span className={s.statN}>24</span><span className={s.statL}>knowledge docs indexed</span></div>
          <div className={s.stat}><span className={s.statN}>~$3.50</span><span className={s.statL}>per-day idle · ibmalliance tenant</span></div>
        </div>
        <div className={s.callout} style={{ marginTop: "12px" }}>
          All v1 resources are provisioned in the <b>IBM Alliance tenant</b> (<code>ibmalliance.onmicrosoft.com</code>) under the <code>Project-IBMMSOFFERINGSPOC</code> Azure subscription. The Fabric workspace is bound to capacity <code>offeringsfabric001</code> shared with the broader MS-DT offering footprint — no new capacity provisioned. Azure portal + Microsoft Fabric platform are the two surfaces through which everything was deployed.
        </div>
      </section>

      <section className={s.section}>
        <div className={s.quote}>
          "The team is shaping what to build. The solo build is the proof that the vision compiles, deploys, runs, and holds the boundary under a second industry. Both are necessary; neither replaces the other."
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 2. BRIEF
// ============================================================
export function BriefPage() {
  const s = useStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="The Brief"
        title="Why a solo build, and why now."
        lead="The team-wide IBM-Project-Adp initiative is doing the right thing — shaping vision, accumulating stakeholder consensus, working through process. The gap was a working end-to-end stack the vision can be tested against. This solo build fills that gap."
        partners={false}
        variant="deep"
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Where this fits</h2>
        <p className={s.paragraph}>
          IBM-Project-Adp is the broader, team-led initiative that captures the platform vision IBM Consulting is taking
          to frontier-insurance clients in conversation with Microsoft. That work is largely about <b>shaping intent</b> —
          requirements, stakeholder alignment, architecture-spec documents, the visual narrative that pre-sales and
          executives need.
        </p>
        <p className={s.paragraph}>
          adp-v1 is a parallel <b>solo build</b> — not a replacement, not a competitor. The goal was different:
          take the platform thesis, the L5 federation idea, the agent-package-as-contract pattern, the HITL discipline, and
          <b> compile it down to actual Azure resources running in our subscription right now</b>. So that anything the team
          decides has a working reference architecture to compare against.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>The two artefacts the build started from</h2>
        <p className={s.paragraph}>
          The build began with exactly one folder — <code className={s.inlineCode}>adp-v1/</code> — containing
          exactly two files:
        </p>
        <div className={s.twoCol}>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Artefact 1 · ground zero</span>
            <h3 className={s.tileTitle}>SPEC.md</h3>
            <p className={s.tileBody}>System-level specifications. The entire storyline — what the platform is, what the use case is, what success looks like, what's in v0 vs. v1+, what the agnostic boundary means, why Microsoft-native. The one-page pin everything else descends from.</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Artefact 2 · ground zero</span>
            <h3 className={s.tileTitle}>High-level architecture sketch</h3>
            <p className={s.tileBody}>One diagram that captured the platform stack at the right altitude — operator surface, agent runtime, orchestration, L5 federation, state & events, data substrate. Refined iteratively against SPEC.md as the build moved forward.</p>
          </Card>
        </div>
        <p className={s.paragraph}>
          Every subsequent decision — every Bicep module, every .NET project, every package JSON — descended from those two
          files. They evolved alongside the build, not ahead of it.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>The thesis the build tests</h2>
        <ol style={{ paddingLeft: "20px", lineHeight: 1.8, color: tokens.colorNeutralForeground2, fontSize: "15px", margin: 0 }}>
          <li>The platform thesis is testable: <b>agent package as integration contract</b>, <b>L5 federation across Foundry IQ / Fabric IQ / Work IQ</b>, <b>HITL pause/resume as a first-class state</b>.</li>
          <li>The boundary is mechanical: a second industry should cost a folder, not a fork. Banking was added to prove this — zero platform code changed.</li>
          <li>The cost surface is real: ~$3.50/day idle, ~$0.05/run. The platform doesn't need ambitious infrastructure to deliver the experience.</li>
          <li>The build is reproducible by one person from one folder of specifications and a steady iteration discipline.</li>
        </ol>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What this is not</h2>
        <div className={s.callout}>
          Not a competitor to IBM-Project-Adp. Not the production platform Meridian will run. Not a pitch deck. Not a finished
          product. It is a working reference architecture that the team-wide vision can be compared against — and a personal
          proof that the platform thesis holds at code level, not just at slide level.
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 3. VISION & WHY
// ============================================================
export function VisionPage() {
  const s = useStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Vision & Why"
        title="Why this had to be built — and what it unlocks."
        lead="Modern Microsoft has assembled the pieces a real agentic platform needs: Azure AI Foundry Agent Service for per-agent identity, Fabric Lakehouse for the semantic store, Microsoft Graph as a delegated-scope Work-IQ surface, Durable Functions for HITL discipline. The gap was a build that stitches them together for one industry, end-to-end. adp-v1 is that build."
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Why solo</h2>
        <p className={s.paragraph}>
          A team initiative produces consensus; a solo build produces a working stack. Both matter. The solo path was chosen
          for three reasons. <b>Velocity</b>: the design surface needs many small reversible decisions per day, and a single
          architect with clear intent can move through them faster than any committee. <b>Coherence</b>: 16 ADRs sit on top of
          one another with no internal contradictions because they came from one head and one set of priorities.
          <b> Demonstrability</b>: pre-sales, executives, and engineers need a single click-to-run reference. Solo build
          delivers that without coordination overhead.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>The vision in one paragraph</h2>
        <div className={s.quote}>
          Run claim operations agentically, end-to-end. Every decision made by a named agent. Every output grounded in cited
          sources. Every consequential moment gated by a human-in-the-loop. Auditable, replayable, accountable. Microsoft-native
          throughout. One industry depth-tuned (Meridian P&amp;C Auto). The platform under any frontier firm's vertical operations —
          banking, healthcare, public sector, supply chain are sibling folders, not forks.
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What this unlocks</h2>
        <div className={s.tileGrid}>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Unlock 1</span>
            <h3 className={s.tileTitle}>Pre-sales conviction</h3>
            <p className={s.tileBody}>A live operator console driving four Digital Workers across two industries. Not a screenshot deck. The conversation with a client moves from "this is what we'd build" to "this is what we have, here is your customised version."</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Unlock 2</span>
            <h3 className={s.tileTitle}>Architect confidence</h3>
            <p className={s.tileBody}>Every ADR has an as-built consequence. When a new pattern is proposed (a new IQ source, a new tool kit, a new industry), the impact can be measured against the reference build, not estimated from scratch.</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Unlock 3</span>
            <h3 className={s.tileTitle}>Boundary proof</h3>
            <p className={s.tileBody}>Banking with two agents, two knowledge docs, two MCP tools, zero platform changes. The agnostic boundary is no longer aspirational — it is CI-enforced and load-tested by a second industry.</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Unlock 4</span>
            <h3 className={s.tileTitle}>Engineering reference</h3>
            <p className={s.tileBody}>26 docs pages, 16 ADRs, an AS-IS/TO-BE diagram pair, a step-by-step runbook. Any engineer joining the team can reproduce the deploy in ~45 minutes from a clean Azure subscription.</p>
          </Card>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Where this can go (v1.5 → v2 → beyond)</h2>
        <p className={s.paragraph}>
          v1.5 closes the obvious gaps: Foundry Agent Service runtime (code ready, RBAC pending), Power BI semantic model with
          named DAX measures, Defender for AI + Sentinel + Purview wiring, real backends behind the MCP tools (Duck Creek,
          J.D. Power, ISO ClaimSearch, tri-bureau). v2 extends to a third industry (healthcare claims looks like the right
          next vertical) and proves the boundary holds at three. Beyond that, the platform itself is a candidate for IBM
          packaging — a customer-facing offering distinguished by depth in one vertical at a time.
        </p>
      </section>
    </div>
  );
}

// ============================================================
// 4. WHAT & HOW
// ============================================================
export function WhatHowPage() {
  const s = useStyles();
  const { mode } = useThemeMode();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="What & How I built it"
        title="From two files to ~20 Azure resources, in a steady iteration."
        lead="The build moved in tracks. Each track had a definite scope and a definite acceptance check. Platform and use case progressed side-by-side — never platform-first, never use-case-first, always both in lockstep so the boundary couldn't drift."
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>The architecture poster</h2>
        <p className={s.sectionLead}>
          A v1-accurate poster is in flight. For now the source-of-truth visuals are the inline SVG diagrams on the Docs
          portal — System Overview, Ten Layers, Application Architecture, L5 Federation, Deployment Topology, Claim
          Workflow, and the Meridian AS-IS / TO-BE / Solution diagrams.
        </p>
        <div className={s.callout}>
          The placeholder you may have seen earlier on Docs · Welcome was the adp-portal team's <i>conceptual</i> poster.
          It does not accurately reflect what was built here ({mode === "light" ? "light" : "dark"} mode visible). A new
          v1-accurate poster is pending generation via ChatGPT-5.5. The prompt for that poster is reproduced on the Docs
          · System Overview page so anyone can regenerate it.
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Where v1 sits inside the broader ADP topology</h2>
        <p className={s.sectionLead}>
          The broader adp architecture (per the team's ADR-0005 in <code>adp-base</code>) is an event-driven, service-owned-data topology where each business domain runs its own service and they integrate via Service Bus and Event Grid. v1 is not an alternative to that topology, it is one service inside it.
        </p>
        <p className={s.paragraph}>
          Specifically, v1 is <b>the Claims Processing Service</b>. It runs the full agentic claim lifecycle (FNOL, damage, fraud, settlement) inside a single Durable Functions orchestrator, owns its own Cosmos + Lakehouse state, and publishes every agent decision to the Event Hubs Kafka journal. When the team's other domain services (policy admin, billing, customer 360, payments) are stood up alongside it, the integration follows ADR-0005: v1 publishes claim-lifecycle domain events to Service Bus, and consumes upstream events the same way. The shared event-contract catalog the ADR calls for is the v1.5 boundary work; the publication sink is already wired through <code>CompositeDecisionSink</code> and just needs a second sink implementation.
        </p>
        <p className={s.paragraph}>
          So if v1 is later introduced to the broader team, the right reading is "v1 is the runtime proof that the Claims Processing Service slot inside ADR-0005 is executable today on Microsoft-native infrastructure" — not "v1 is a single-service alternative to the multi-service vision." The agentic-claims-alpha PRD personas (Patricia, Derek, Maya, Renee) describe the audience v1 was already built for, and v1 covers most of the alpha PRD's stated asks today (see Docs portal → Reference → Team Repo Alignment).
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>The arc · ~30 focused hours · 4 calendar days</h2>
        <p className={s.sectionLead}>The build moved in phases, not equal days. Some phases were a single concentrated sitting; others spanned a calendar day with breaks. Total focused-work time was ~30 hours across 4 calendar days. Platform and use case in parallel throughout.</p>
        <div className={s.timeline}>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Phase 0</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>Ground zero · SPEC + sketch</span>
              <span className={s.timelineText}>One folder, two files. SPEC.md captured the storyline; a single high-level architecture diagram captured the stack. Both refined iteratively as the build moved forward — and both kept intact in the project root to this day as a record of where it started.</span>
            </div>
          </div>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Phase 1</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>Platform scaffold + first Bicep deploy</span>
              <span className={s.timelineText}>13 Bicep modules covering 18 of 19 resources. Functions plan, Cosmos, Event Hubs, AI Search, SignalR, SQL, Storage, Key Vault, 6 user-assigned managed identities. First clean RG deploy at ~$3.50/day idle in the IBM Alliance tenant.</span>
            </div>
          </div>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Phase 2</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>FNOL Handler DW · first end-to-end run</span>
              <span className={s.timelineText}>Package model, compile pipeline, StepRunner, ContextRouter, L5 sources (Foundry IQ + Fabric IQ stub + Work IQ stub), legacy AOAI adapter. First trace lands in Cosmos.</span>
            </div>
          </div>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Phase 3</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>HITL discipline + operator console + live tail</span>
              <span className={s.timelineText}>Durable Functions FnolOrchestrator with WaitForExternalEvent. Operator console (Vite + React 19 + Fluent UI v9). SignalR live tail. First HITL Approve / Escalate exercised end-to-end.</span>
            </div>
          </div>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Phase 4</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>Fabric Lakehouse · real semantic layer</span>
              <span className={s.timelineText}>Workspace adp-v1 + Lakehouse adp + 3 Delta tables (dim_policyholder, dim_vehicle, fact_claims) via Fabric REST + OneLake DFS, bound to capacity offeringsfabric001 already provisioned in the IBM Alliance tenant. FabricLakehouseSource implements IContextSource against the Lakehouse SQL endpoint.</span>
            </div>
          </div>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Phase 5</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>3 more Meridian DWs · Damage · Fraud · Settlement</span>
              <span className={s.timelineText}>Each DW added with new knowledge docs + new package JSON + a switch-arm intent dispatch + new HITL gates. Full Meridian lifecycle running by the end of this phase.</span>
            </div>
          </div>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Phase 6</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>v1.0 tracks · real IQ federation · agnostic boundary · demo-ready</span>
              <span className={s.timelineText}>Track 1: Fabric IQ aggregation primitives (ADR-0014). Track 2: Foundry Agent Service adapter (ADR-0013). Track 3: Microsoft Graph Work IQ (ADR-0015). Track 4: tool kits relocated under usecases (ADR-0001 v0.6). Track 5: schema-aware entity-history (ADR-0016). Track 6: docs portal + demo script.</span>
            </div>
          </div>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Phase 7</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>Banking · second industry · agnostic boundary stress test</span>
              <span className={s.timelineText}>Three-agent banking package: intake → eligibility → decision-letter. Five BANK-* knowledge docs. Twelve runtime applications. Zero platform code changes. Boundary holds.</span>
            </div>
          </div>
          <div className={s.timelineRow}>
            <span className={s.timelineDate}>Now</span>
            <div className={s.timelineBody}>
              <span className={s.timelineTitle}>Docs Portal + Project Portal + Operator Console + Studio</span>
              <span className={s.timelineText}>Three top-nav surfaces. Operator drives the platform; Docs is reference; Project tells the build's story; Studio (under Project) generates visuals on demand. Theme-aware diagrams, IBM Carbon + Microsoft Fluent icons, sidebar navigation across both portals.</span>
            </div>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What's deployed where · Azure + Fabric</h2>
        <p className={s.sectionLead}>
          All v1 resources live in the IBM Alliance Azure tenant under the Project-IBMMSOFFERINGSPOC subscription. Two physical platforms: <b>Azure portal</b> (resource group <code>rg-adp-v1</code>) and <b>Microsoft Fabric</b> (workspace <code>adp-v1</code> bound to capacity <code>offeringsfabric001</code>). Region: eastus2 for everything except AI Search, which lives in eastus due to Basic SKU capacity at provisioning time.
        </p>
        <p className={s.sectionLead}>
          The chain of containers — tenant → subscription → resource group → resources — looks like this:
        </p>
        <div style={{ marginTop: "8px", marginBottom: "8px" }}>
          <ResourceHierarchyCompact />
        </div>
        <p className={s.paragraph}>
          The Docs portal carries the full tree under <b>Deployment → Resource Group Structure</b> with every resource by name, SKU, and purpose; the spatial topology under <b>Deployment → Topology</b>; the per-category SKU table under <b>Deployment → Azure Resources</b>. What follows here is the surface-level summary table.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginTop: "8px" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: tokens.colorNeutralForeground2 }}>Surface</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: tokens.colorNeutralForeground2 }}>Resource</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: tokens.colorNeutralForeground2 }}>Region</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: tokens.colorNeutralForeground2 }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              { surface: "Azure portal", res: "rg-adp-v1", region: "eastus2", desc: "Single resource group · all v1 Azure resources" },
              { surface: "Azure portal", res: "func-adp-v1-fnol", region: "eastus2", desc: "Azure Functions Flex Consumption · .NET 10 isolated · 11 functions hosted" },
              { surface: "Azure portal", res: "swa-adp-v1-console", region: "eastus2", desc: "Static Web App (Free) · operator + docs + project portals + studio" },
              { surface: "Azure portal", res: "cdb-adp-v1", region: "eastus2", desc: "Cosmos DB Serverless · Decision Journal container dw-state · partition /subjectId" },
              { surface: "Azure portal", res: "evh-adp-v1", region: "eastus2", desc: "Event Hubs Standard · Kafka API · topic adp-v1-decisions" },
              { surface: "Azure portal", res: "signalr-adp-v1", region: "eastus2", desc: "SignalR Free_F1 Serverless · hub fnoltrace for live operator tail" },
              { surface: "Azure portal", res: "srch-adp-v1", region: "eastus", desc: "Azure AI Search Basic · index adp-knowledge · 24 docs · 3072-d vectors" },
              { surface: "Azure portal", res: "ai-adp-v1 + projects/adp-v1", region: "eastus2", desc: "Foundry account + project · connection to dt-navigator-openai for AOAI reuse" },
              { surface: "Azure portal", res: "sql-adp-v1", region: "eastus2", desc: "Azure SQL Basic · fallback semantic layer (SEMANTIC_BACKEND=sql)" },
              { surface: "Azure portal", res: "stadpv1", region: "eastus2", desc: "Storage account · Function deployment blobs + AzureWebJobsStorage" },
              { surface: "Azure portal", res: "kv-adp-v1", region: "eastus2", desc: "Key Vault · reserved (idle in v1)" },
              { surface: "Azure portal", res: "cae-adp-v1", region: "eastus2", desc: "Container Apps environment · idle · v1.5 decision-ingest worker" },
              { surface: "Azure portal", res: "egt-adp-v1-fanout", region: "eastus2", desc: "Event Grid topic · idle (v1.5 dispatch surface)" },
              { surface: "Azure portal", res: "log-adp-v1 + appi-adp-v1", region: "eastus2", desc: "Log Analytics + Application Insights · observability" },
              { surface: "Azure portal", res: "6 user-assigned managed identities", region: "eastus2", desc: "id-adp-v1-{orchestrator, decision-ingest, context-router, mcp-claim-store, mcp-policy-store, console-api}" },
              { surface: "Microsoft Fabric", res: "Workspace adp-v1", region: "shared capacity offeringsfabric001", desc: "Bound to existing IBM-Alliance Fabric capacity · no new capacity provisioned" },
              { surface: "Microsoft Fabric", res: "Lakehouse adp", region: "OneLake (capacity-region)", desc: "5 Delta tables: dim_policyholder · dim_vehicle · fact_claims · dim_borrower · fact_loan_applications" },
              { surface: "Cross-tenant reuse", res: "dt-navigator-openai", region: "eastus2 · rg-microsoft-navigator", desc: "Reused MS-DT navigator AOAI · gpt-4o + text-embedding-3-large · zero new model cost" },
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontSize: "12px", color: tokens.colorBrandForeground1, fontWeight: 600 }}>{r.surface}</td>
                <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontSize: "12px" }}><code style={{ fontFamily: "Consolas, monospace", fontSize: "11px", backgroundColor: tokens.colorNeutralBackground3, padding: "1px 6px", borderRadius: "4px" }}>{r.res}</code></td>
                <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontSize: "12px", color: tokens.colorNeutralForeground2 }}>{r.region}</td>
                <td style={{ padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontSize: "12px", color: tokens.colorNeutralForeground2 }}>{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={s.callout} style={{ marginTop: "12px" }}>
          The full per-resource Bicep + provisioning runbook is on the Docs portal — <b>Deployment → Bicep & IaC</b> and <b>Deployment → Provisioning Runbook</b>. The narrative summary here intentionally keeps tenant + region + purpose at the front; the Docs side keeps the operational detail.
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>The discipline that held it together</h2>
        <div className={s.tileGrid}>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Discipline 1</span>
            <h3 className={s.tileTitle}>SPEC.md is the pin</h3>
            <p className={s.tileBody}>Every track checked against the spec before merging. The spec evolved with the build, but never in response to convenience — only in response to genuine learning.</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Discipline 2</span>
            <h3 className={s.tileTitle}>ADR-per-decision</h3>
            <p className={s.tileBody}>16 ADRs. Every substantive architectural choice has a context, a decision, a rationale, and a trade-off section. No silent decisions; no "we just did it this way."</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Discipline 3</span>
            <h3 className={s.tileTitle}>Boundary CI</h3>
            <p className={s.tileBody}>scripts/check-boundary.mjs blocks any platform → use case import. Tool kits get a narrow allow-list. The boundary cannot drift silently.</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Discipline 4</span>
            <h3 className={s.tileTitle}>Both sides in lockstep</h3>
            <p className={s.tileBody}>Every platform increment came with a use-case increment. Never "build platform first, then use case." That's how the boundary stays honest.</p>
          </Card>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 5. METHODOLOGY
// ============================================================
export function MethodologyPage() {
  const s = useStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Methodology"
        title="How I actually worked — the tools, the cadence, the conversations."
        lead="The build is solo in the sense that one person held the intent and the architecture. But it was anything but unaccompanied — IBM BOB was the primary execution partner (it exposes frontier reasoning models at an IBM-optimized level for internal use), GitHub Copilot Chat handled IDE-bound work and longer-reasoning tracks through the model routing it supports, and infographics were generated through a deliberate mix of paths (Microsoft Copilot, Azure OpenAI, sometimes OpenAI direct — chosen per artifact, used cautiously where the path was outside Microsoft commercial terms). Each tool did what it does best."
        partners={false}
        variant="deep"
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>How the build started</h2>
        <p className={s.paragraph}>
          One folder. Two files. SPEC.md captured the entire storyline of what the platform was meant to be — the agentic
          claim lifecycle, the L5 federation, the HITL discipline, the agnostic-boundary thesis. A high-level architecture
          diagram captured the stack at the right altitude — operator surface above, agent runtime in the middle, state and
          data below. Everything else — every Bicep module, every .NET project, every package JSON — descended from those
          two files. They were refined iteratively as the build moved forward, never frozen, never running ahead of the
          code.
        </p>
        <p className={s.paragraph}>
          The cadence was straightforward: refine SPEC + sketch → pick the next track → execute that track end-to-end →
          verify against SPEC → update SPEC if learning warranted it → next track. Platform and use case moved together
          throughout — never platform-first, never use-case-first.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>The AI tooling — who did what</h2>
        <p className={s.sectionLead}>
          Three execution lanes across the build. Each had a defined role; none replaced the others.
        </p>
        <div className={s.tileGrid}>
          <div className={s.methodCard}>
            <div className={s.methodHead}>
              <Badge size="large" appearance="filled" color="brand">Primary</Badge>
              <div>
                <span className={s.methodRole}>Execution partner</span>
                <h3 className={s.methodTitle}>IBM BOB</h3>
              </div>
            </div>
            <p className={s.tileBody}>
              The primary coding assistant for the build. <b>BOB is IBM's internal AI partner that exposes frontier
              reasoning models at an IBM-optimized level</b> — under IBM's internal governance, with the model routing,
              guardrails, and security posture appropriate for IBM-internal use. BOB sat alongside me for every track of
              execution work: drafting Bicep modules, scaffolding the .NET projects, writing the Functions code,
              generating the Vite SPA, working through the Fabric REST provisioning scripts. The conversation was
              continuous — I held intent, prior MVP experience, and architectural taste; BOB drafted, refined, and
              explained. Most lines of code in the repo started in a BOB conversation.
            </p>
          </div>
          <div className={s.methodCard}>
            <div className={s.methodHead}>
              <Badge size="large" appearance="filled" color="brand">IDE + reasoning</Badge>
              <div>
                <span className={s.methodRole}>In-editor assist + long-context tracks</span>
                <h3 className={s.methodTitle}>GitHub Copilot Chat</h3>
              </div>
            </div>
            <p className={s.tileBody}>
              The in-editor assist for short-range tasks (type signatures, completing using statements, expanding switch
              arms) <b>and</b> the surface for the longer-reasoning tracks where the design surface needed many small
              decisions held in context at once — the L5 federation contract, the HITL gate trigger forms, the
              schema-aware Fabric IQ primitive. Copilot Chat's model selection lets the same surface cover both modes
              without leaving the IDE.
            </p>
          </div>
          <div className={s.methodCard}>
            <div className={s.methodHead}>
              <Badge size="large" appearance="filled" color="informative">Visual</Badge>
              <div>
                <span className={s.methodRole}>Infographics + posters · multi-path</span>
                <h3 className={s.methodTitle}>Image generation</h3>
              </div>
            </div>
            <p className={s.tileBody}>
              Image and infographic generation used a deliberate <b>multi-path approach</b> — manual or automated,
              depending on the artifact. The primary paths were <b>Microsoft Copilot</b> (visual surfaces for one-off
              illustrations) and <b>Azure OpenAI image deployments</b> (for automated generation under Microsoft
              commercial terms with data residency in the IBM Alliance tenant). <b>Direct OpenAI</b> was used selectively
              and cautiously where it was the only practical option for a specific model variant; the Studio component
              in this portal demonstrates that path. The discipline across all three: structured prompts with explicit
              layout, palette, and content directives.
            </p>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What I brought</h2>
        <p className={s.paragraph}>
          The tools above are powerful but not autonomous in the meaningful sense — they execute well within an intent
          someone holds. What I brought to the partnership: <b>clear architectural intent</b> (the L5 thesis, the agnostic
          boundary, the HITL discipline, the Microsoft-native stack choice), <b>prior MVP experience</b> (this is the
          third or fourth build of this rough shape — including DT demo workloads and personal projects such as
          <a href="https://fractalseer.com" target="_blank" rel="noopener noreferrer" style={{ color: tokens.colorBrandForeground1 }}> fractalseer.com</a>),
          and <b>taste over alternatives</b> (where to prefer Bicep vs Terraform, when to defer Foundry runtime, why a
          Fabric Lakehouse Beats a Synapse pool here). The tools amplified the work; they did not replace the architect.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>The iteration shape</h2>
        <div className={s.callout}>
          Ground zero → SPEC.md + sketch → first Bicep deploy → first end-to-end FNOL run → HITL discipline → operator
          console → Fabric Lakehouse → second / third / fourth Meridian DW → v1.0 tracks (real IQ federation) → banking
          stress test → docs portal → project portal. Each step landed something that ran. No "build everything, deploy
          once" big-bang. Ten increments, each measured against the original SPEC, each producing a working deployment.
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What the prior MVPs taught</h2>
        <p className={s.paragraph}>
          This is the 3rd-4th MVP I have built in this shape. The earlier ones — DT demo platforms, fractalseer.com, the
          UC1/UC2 stacks — were each different domains but the same iteration discipline. The lessons that carried over:
          <b> ground zero matters more than ground perfect</b> (start with the worst version of SPEC + sketch and refine
          forward); <b>both sides in lockstep beats either-first</b> (platform and use case as one cadence);
          <b> reversibility-of-decision is the budget</b> (cheap reversible decisions go fast; expensive irreversible ones
          get an ADR); <b>shipping small increments builds confidence</b> (a working deploy at day 5 is worth more than a
          perfect spec at day 10).
        </p>
      </section>
    </div>
  );
}

// ============================================================
// 6. ROADMAP
// ============================================================
export function RoadmapPage() {
  const s = useStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Roadmap"
        title="v1.0 → v1.5 → v2 → beyond."
        lead="What's done, what's queued, and what the long arc looks like. The build is paced for honesty — each milestone is what it claims to be, no aspirational positioning."
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>v1.0 · live · 2026-05-29</h2>
        <p className={s.sectionLead}>What is deployed and serving today.</p>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.85, color: tokens.colorNeutralForeground2, fontSize: "14px", margin: 0 }}>
          <li>Five compiled packages running in Azure Functions Flex Consumption</li>
          <li>L5 federation across Foundry IQ (AI Search) + Fabric IQ (Lakehouse, 8 primitives) + Work IQ (synthetic + Graph code-ready)</li>
          <li>Operator console + docs portal + project portal on Azure SWA (free tier)</li>
          <li>HITL discipline via Durable Functions WaitForExternalEvent across 8 gate definitions × 3 trigger types</li>
          <li>Banking second industry · agnostic boundary CI-enforced</li>
          <li>16 ADRs · 26+ docs pages · theme-aware diagrams · IBM Carbon + Microsoft Fluent icons</li>
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>v1.1 · imminent · short-cycle hardening</h2>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.85, color: tokens.colorNeutralForeground2, fontSize: "14px", margin: 0 }}>
          <li>Foundry Agent Service runtime activation (2 RBAC role assignments pending Owner)</li>
          <li>Defender for AI + Sentinel + Purview wiring (Entra Agent ID propagation through trace records is the prerequisite)</li>
          <li>v1-accurate architecture poster (ChatGPT-5.5 generation pending)</li>
          <li>Demo walkthrough recordings (Meridian + banking)</li>
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>v1.5 · ~6 weeks out</h2>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.85, color: tokens.colorNeutralForeground2, fontSize: "14px", margin: 0 }}>
          <li>Power BI semantic model with named DAX measures (unlocks Copilot-for-PBI + cached measures)</li>
          <li>Decision-Ingest promoted to Container Apps service (cae-adp-v1 currently idle)</li>
          <li>Real backends behind MCP tools — Duck Creek, J.D. Power, ISO ClaimSearch, tri-bureau credit</li>
          <li>Structured-JSON HITL gate evaluator (replaces v0 keyword matcher)</li>
          <li>Closure DW (DW-5) for Meridian · final audit + journal seal + archival</li>
          <li>Fair-lending disparate-impact monitor for banking (BANK-004 v1.5 requirement)</li>
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>v2 · long arc</h2>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.85, color: tokens.colorNeutralForeground2, fontSize: "14px", margin: 0 }}>
          <li>Third industry · healthcare claims looks like the right next vertical</li>
          <li>Multi-claim concurrency stress test · scale validation</li>
          <li>Foundry Local door-open · edge-resident agents for offline / air-gapped scenarios</li>
          <li>Real Duck Creek / Guidewire connectors replacing the synthetic MCP tool backends</li>
          <li>Customer-facing surfaces (policyholder app, adjuster workbench, SIU inbox)</li>
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Beyond</h2>
        <p className={s.paragraph}>
          The platform itself is a candidate for IBM packaging — a customer-facing offering distinguished by depth in one
          vertical at a time. The agnostic boundary that banking proved is the asset that makes packaging realistic; without
          it, each new industry is a fork.
        </p>
      </section>
    </div>
  );
}

// ============================================================
// 7. SHOWCASE
// ============================================================
export function ShowcasePage() {
  const s = useStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Showcase"
        title="The build in action."
        lead="For now the best showcase is the working surface itself — click through to the Operator tab and drive any of the five packages. Recorded walkthroughs and customer-shaped vignettes are queued for v1.1."
        partners={false}
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Drive it yourself</h2>
        <div className={s.tileGrid}>
          <Card className={s.tile} onClick={() => window.location.hash = "operator"}>
            <span className={s.tileLabel}>Operator → FNOL</span>
            <h3 className={s.tileTitle}>Run a Meridian FNOL claim</h3>
            <p className={s.tileBody}>Pick FNOL Handler · Meridian in the Package dropdown. Pick any subject. Click Run. Live tail shows step-by-step over ~60 seconds. Citations from all three L5 sources interleaved by the assignment step.</p>
            <span className={s.tileFooter}>~60 seconds</span>
          </Card>
          <Card className={s.tile} onClick={() => window.location.hash = "operator"}>
            <span className={s.tileLabel}>Operator → HITL</span>
            <h3 className={s.tileTitle}>Exercise HITL pause/resume</h3>
            <p className={s.tileBody}>Pick Damage Handler · Meridian. Click Run with HITL. Step 2 trips gate.total-loss-suspect. Click Approve. Orchestration resumes from the operator's resolution. Trace records the operator action with the agent's prior output.</p>
            <span className={s.tileFooter}>~90 seconds</span>
          </Card>
          <Card className={s.tile} onClick={() => window.location.hash = "operator"}>
            <span className={s.tileLabel}>Operator → Cross-industry</span>
            <h3 className={s.tileTitle}>Run Banking · Spanish co-sign</h3>
            <p className={s.tileBody}>Pick Loan Handler · Banking. Pick subject LOAN-2026-50002 (Maria Hernandez, Spanish preference). Click Run. Step 3 generates a state-aware FCRA + ECOA-compliant decision letter in Spanish.</p>
            <span className={s.tileFooter}>~120 seconds</span>
          </Card>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Read the full demo script</h2>
        <p className={s.paragraph}>
          The 7-minute spoken walkthrough — Acts 1 through 5 covering all four Meridian DWs plus the banking stress test — is
          on the Docs portal under <code className={s.inlineCode}>Meridian · Demo Script</code>. Use it for live walk-throughs
          or as an inspection guide when reviewing a recording.
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Coming in v1.1</h2>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.85, color: tokens.colorNeutralForeground2, fontSize: "14px", margin: 0 }}>
          <li>5-minute screen-capture recording of the full Meridian walkthrough · narrated subtitles</li>
          <li>3-minute banking cross-industry vignette · "two agents, zero platform changes"</li>
          <li>Architect explainer · L5 federation in 90 seconds</li>
          <li>Stakeholder pitch · the 12-slide deck the platform descends from</li>
        </ul>
      </section>
    </div>
  );
}

// ============================================================
// 8. STUDIO · generative infographics
// ============================================================

const STUDIO_PRESETS: PromptPreset[] = [
  {
    label: "Architecture poster · v1.0",
    size: "1536x1024",
    quality: "high",
    description: "The full ADP v1.0 architecture poster — ten layers, L5 federation, five DWs, IBM + Microsoft co-brand.",
    prompt: `Create a wide horizontal architecture poster (16:9 landscape) for an enterprise agentic AI platform called "PROJECT ADP v1.0" — Microsoft-native, deployed on Microsoft Azure, co-built by IBM Consulting and Microsoft.

STYLE: modern enterprise infographic, isometric-flat hybrid, premium technical brand aesthetic similar to AWS / Azure architecture posters. Depth via subtle gradients and soft drop shadows. Clean sans-serif typography. Suitable for a tech executive presentation backdrop.

PALETTE (strict): deep navy background (#0b1220) with horizontal gradient bands — IBM blue (#0f62fe), purple (#742774 to #8A3FFC), teal (#009d9a), warm orange-red accent (#D83B01). White text on dark; high contrast. No neon.

TITLE BLOCK (top center): "PROJECT ADP" bold uppercase, subtitle "Microsoft-native agentic platform for frontier insurance firms", and a small green status pill "v1.0 · live".

PARTNER BAR (top right): IBM logo + Microsoft logo paired horizontally with text "Co-built by IBM Consulting and Microsoft".

MAIN COMPOSITION: ten labeled horizontal layer bands stacked top-to-bottom, each a glass-morphic rounded rectangle with the layer label on the left and 3-6 service tiles on the right:
- L2 EXPERIENCE (orange): Operator Console · Docs Portal · Project Portal · SignalR Live Tail
- L3 AGENT RUNTIME (purple): Foundry Agent Service · Azure OpenAI gpt-4o · MCP Tools
- L4 ORCHESTRATION (purple): Durable Functions · FnolOrchestrator · HITL Pause/Resume
- L5 CONTEXT FEDERATION (teal): three prominent tiles "Foundry IQ" "Fabric IQ" "Work IQ" with a "ContextRouter" hub between them
- L6 STATE & EVENTS (IBM blue): Cosmos DB · Event Hubs Kafka · SignalR · Event Grid
- L7 DATA SUBSTRATE (IBM blue): Fabric Lakehouse · 5 Delta Tables · Azure OpenAI · AI Search · Azure SQL
- L8 COMPUTE & HOSTING (IBM blue): Azure Functions Flex · Container Apps env · Static Web App
- L1 IDENTITY (orange): Entra ID · 6 Managed Identities · Entra Agent ID · Key Vault
- L9 IaC (orange): Bicep · 13 modules · PowerShell scripts · az CLI
- L10 OBSERVABILITY (orange): App Insights · Log Analytics · Decision Journal

RIGHT SIDEBAR: five Digital Worker cards stacked vertically with small icons (claim / car / shield / dollar / bank): FNOL Handler · Damage Handler · Fraud Handler · Settlement Handler · Loan Handler (Banking).

BOTTOM BAND: six headline stats in white-on-dark monospace pill boxes: "5 packages deployed" · "2 industries proven" · "16 ADRs" · "8 HITL gates" · "24 knowledge docs" · "~$3.50/day idle".

STYLE NOTES: no photorealistic backgrounds, no people, no real Microsoft service brand icons beyond IBM and Microsoft logos, no neon glows. Generous whitespace between bands. Subtle directional flow arrows connect layers vertically. Glass-morphic semi-transparent tiles with thin 1px borders.`,
  },
  {
    label: "Architecture poster · light variant",
    size: "1536x1024",
    quality: "high",
    description: "Same architecture poster, light background for white-paper / print use.",
    prompt: `Create a wide horizontal architecture poster (16:9 landscape) for an enterprise agentic AI platform called "PROJECT ADP v1.0" — Microsoft-native, deployed on Microsoft Azure, co-built by IBM Consulting and Microsoft.

LIGHT VARIANT: pearl-white background (#FAFBFC). Horizontal gradient bands use the same palette family at 40% saturation. Body text is dark navy (#1A2233) on white. Use the same composition as the dark variant: ten labeled layer bands, L5 federation centerpiece, five Digital Worker sidebar, six headline stats bottom band, IBM + Microsoft co-brand top right, "PROJECT ADP" title block top center with "v1.0 · live" green pill.

PALETTE: IBM blue (#0f62fe), purple (#742774 / #8A3FFC), teal (#009d9a), orange (#D83B01) — used at 40% saturation as band fills, full saturation as borders and labels.

CONTENT: ten layer bands — L2 EXPERIENCE (Operator Console, Docs Portal, Project Portal, SignalR Live Tail), L3 AGENT RUNTIME (Foundry Agent Service, Azure OpenAI gpt-4o, MCP Tools), L4 ORCHESTRATION (Durable Functions, FnolOrchestrator, HITL Pause/Resume), L5 CONTEXT FEDERATION (Foundry IQ, Fabric IQ, Work IQ + central ContextRouter), L6 STATE & EVENTS (Cosmos DB, Event Hubs Kafka, SignalR, Event Grid), L7 DATA SUBSTRATE (Fabric Lakehouse, 5 Delta Tables, Azure OpenAI, AI Search, Azure SQL), L8 COMPUTE (Azure Functions Flex, Container Apps env, Static Web App), L1 IDENTITY (Entra ID, 6 Managed Identities, Entra Agent ID, Key Vault), L9 IaC (Bicep 13 modules, PowerShell, az CLI), L10 OBSERVABILITY (App Insights, Log Analytics, Decision Journal).

Five DW sidebar cards: FNOL · Damage · Fraud · Settlement · Loan Handler (Banking). Bottom stats: "5 packages deployed" · "2 industries proven" · "16 ADRs" · "8 HITL gates" · "24 knowledge docs" · "~$3.50/day idle".

STYLE: premium enterprise technical artwork, clean sans-serif typography, generous whitespace, glass-morphic tiles with thin 1px borders, no people, no neon, no fake Microsoft service logos beyond IBM and Microsoft co-brand.`,
  },
  {
    label: "L5 Federation centerpiece",
    size: "1024x1024",
    quality: "high",
    description: "Hero square: the ContextRouter fan-out to Foundry IQ + Fabric IQ + Work IQ with citation badges.",
    prompt: `Create a square hero infographic (1024x1024) depicting the "L5 Context Federation" pattern for an agentic AI platform.

CENTER: a glowing hexagonal hub labeled "CONTEXT ROUTER" in white uppercase bold text. Subtitle below: "fan-out · merge · score".

THREE FAN-OUT ARMS radiating out at 120-degree angles, each ending in a rounded rectangular tile labeled clearly:
- TOP-LEFT (violet gradient #742774 to #8A3FFC): "FOUNDRY IQ" — subtitle "Azure AI Search · vector embeddings"
- TOP-RIGHT (teal gradient #009d9a to #00B5AE): "FABRIC IQ" — subtitle "Lakehouse SQL · 8 primitives"
- BOTTOM (IBM blue gradient #0f62fe to #4589ff): "WORK IQ" — subtitle "Microsoft Graph · delegated scopes"

Around the hub, three small floating "citation badge" cards labeled "[Foundry]", "[FabricIQ]", "[WorkIQ]" with checkmark icons, showing the GROUNDED tag pattern.

BACKGROUND: deep navy (#0b1220) with subtle radial vignette toward dark indigo at corners.

STYLE: premium technical artwork, glass-morphic tiles with 12px corner radius and 1px borders, subtle directional flow arrows, generous whitespace, clean sans-serif typography. No people, no neon glow, no real Microsoft logos beyond the brand mark.`,
  },
  {
    label: "Claim lifecycle flow",
    size: "1536x1024",
    quality: "high",
    description: "Four-DW horizontal flow: FNOL → Damage → Fraud → Settlement with HITL gates called out.",
    prompt: `Create a horizontal landscape infographic (1536x1024) showing the Meridian personal-auto claim lifecycle on the ADP agentic platform.

FOUR VERTICAL DIGITAL WORKER COLUMNS left-to-right, each a rounded rectangle (~10px radius) with a colored header bar and four stacked step tiles inside:
1. DW-1 "FNOL HANDLER" (IBM blue header): claim-intake · coverage-verification · initial-triage (HITL low-confidence) · assignment-routing
2. DW-2 "DAMAGE HANDLER" (IBM blue header): damage-intake · damage-categorization (HITL total-loss) · repair-estimation · shop-routing
3. DW-3 "FRAUD HANDLER" (orange header): fraud-intake · fraud-pattern-scan (5-pass bounded zone) · fraud-score (HITL priority-band) · siu-routing
4. DW-4 "SETTLEMENT HANDLER" (teal header): settlement-intake · settlement-calculation (HITL >$25K) · settlement-disclosure (state-aware) · settlement-disbursement (HITL denial)

Connect the DWs with bold rightward arrows. HITL gate triggers shown as small amber pill labels under the affected steps.

BACKGROUND: deep navy (#0b1220). White text on dark. Subtitle at top center: "Four Digital Workers · One Claim Lifecycle · 16 Agent Steps · 8 HITL Gates". Bottom band: "Cascade: FNOL → Damage → Fraud → Settlement".

STYLE: premium enterprise infographic, glass-morphic tiles with 1px borders, clean sans-serif typography, generous whitespace. No people. No neon.`,
  },
  {
    label: "Agnostic boundary diagram",
    size: "1536x1024",
    quality: "high",
    description: "Two large containers (Platform · Use Cases) with a CI rule diamond in between.",
    prompt: `Create a horizontal landscape infographic (1536x1024) titled "AGNOSTIC BOUNDARY — Platform vs Use Cases" depicting how Project ADP keeps the platform industry-agnostic.

LEFT CONTAINER (IBM blue gradient, ~45% of canvas width): labeled "PLATFORM · platform/src/" — subtitle "zero industry vocabulary". Contains eight stacked tiles labeled: PackageModel · PackageCompiler (adpc CLI) · Agents (Foundry / Legacy / Stub) · ContextLayer (L5 federation) · Orchestration (StepRunner + HITL) · ToolRuntime (contracts only) · DecisionIngest (Cosmos + EH + SignalR) · TracesApi (Durable Functions worker).

CENTER DIAMOND (warm orange #D83B01 with dashed border): labeled "CI BOUNDARY · scripts/check-boundary.mjs". Subtitle inside: "blocks all imports · except tool kits".

RIGHT CONTAINER (teal gradient): labeled "USE CASES · usecases/". Two sub-containers:
- TOP: "meridian-pnc-auto-claims/" with bullet list: 4 packages · 19 PAC-* knowledge docs · claims-25.json · MeridianTools.csproj (4 tools)
- BOTTOM: "banking-loan-origination/" with bullet list: loan-handler.json (3 agents) · 5 BANK-* docs · borrowers-30.json · BankingTools.csproj (2 tools)

Two horizontal arrows between containers labeled "contracts only (IContextSource, IMcpTool, IAgentAdapter)" (top, green) and "tool kits referenced by TracesApi + PackageCompiler (ADR-0001 v0.6)" (bottom, green dashed).

BACKGROUND: deep navy (#0b1220). White text on dark.

STYLE: premium enterprise infographic, glass-morphic tiles with 1px borders, clean sans-serif typography, generous whitespace. No people, no neon.`,
  },
];

export function StudioPage() {
  const s = useStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Studio"
        title="Generate the project's visuals — automated path, one of several."
        lead="A reusable infographic studio implementing the automated image-generation path used in this build. Image generation across the project used a deliberate multi-path approach — Microsoft Copilot for one-offs, Azure OpenAI image deployments for the in-tenant automated path, and selectively OpenAI direct for specific model variants when that was the only option. This Studio is the OpenAI-direct lane wrapped behind a Function so the key stays server-side; an Azure OpenAI variant is the v1.5 enhancement."
        partners={false}
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>How it works</h2>
        <p className={s.paragraph}>
          The studio is a reusable React component (<code className={s.inlineCode}>InfographicGenerator</code>) backed by
          a Function-app endpoint (<code className={s.inlineCode}>POST /api/generate/infographic</code>). The Function
          holds an API-key app setting, calls the image-generation backend with the prompt + size + quality you choose,
          and returns the base64 PNG. The key is never exposed to the browser.
        </p>
        <p className={s.paragraph}>
          The current v1 implementation targets the OpenAI-direct backend (gpt-image-1) — appropriate for fast iteration
          on the visual content of this portal. The v1.5 path swaps the backend to <b>Azure OpenAI</b> image deployments
          under the IBM Alliance tenant for in-tenant data residency + Microsoft commercial terms, behind the same
          component (one env-var flip, no UI change).
        </p>
        <p className={s.paragraph}>
          Pick a preset to load a known-good prompt, or write your own. Hit Generate. Download the PNG. Drop it into the
          docs or any deck.
        </p>
      </section>

      <section className={s.section}>
        <InfographicGenerator
          title="Generate"
          description="Click a preset to load the prompt, then Generate. ~30-90 seconds for high quality at landscape resolution. ~$0.25-0.50 per generation."
          defaultSize="1536x1024"
          defaultQuality="high"
          presets={STUDIO_PRESETS}
          downloadFilenameStem="adp-poster"
        />
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Enabling the studio</h2>
        <p className={s.paragraph}>
          One-time setup: drop the OpenAI API key into the Function app settings. The Function reads it from the environment
          at request time; the key is never bundled into the SPA or visible to the browser.
        </p>
        <div className={s.codeBlock}>{`# One-time: set the OpenAI API key as a Function app setting
az functionapp config appsettings set \\
  --resource-group rg-adp-v1 \\
  --name func-adp-v1-fnol \\
  --settings OPENAI_API_KEY=sk-...

# Verify
curl -s -X POST https://func-adp-v1-fnol.azurewebsites.net/api/generate/infographic \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"a test square","size":"1024x1024","quality":"low"}' | jq '.format, .size'`}</div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Where this component is reused</h2>
        <p className={s.paragraph}>
          Because the component is self-contained and prop-driven, the same studio can sit on any page with any prompt
          library. Examples of where to drop another instance:
        </p>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.8, color: tokens.colorNeutralForeground2, fontSize: "14px", margin: 0 }}>
          <li><b>Docs · System Overview</b> — embed with the architecture-poster preset so anyone reading the docs can re-render the poster.</li>
          <li><b>Docs · per-DW pages</b> — give each Digital Worker page a tiny instance with a DW-specific lifecycle prompt as the default.</li>
          <li><b>Project · What &amp; How</b> — embed with the L5-federation centerpiece prompt to illustrate the federation in any presentation.</li>
          <li><b>Banking page</b> — preset for a "loan lifecycle on ADP" infographic with the three banking agents and the FCRA / ECOA disclosure callouts.</li>
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Honest limits</h2>
        <div className={s.callout}>
          Image models are excellent at composition, palette, and overall layout. They are decent at large title text and
          partner logos, less reliable at tiny resource-name labels (some may come out mangled). The studio is the right
          tool for hero posters and cinematic visuals; the precision diagrams (exact arrows, exact tile order, exact
          resource names) stay in the inline SVGs across the docs portal. That split is intentional.
        </div>
      </section>
    </div>
  );
}

// ============================================================
// 9. REFLECTION
// ============================================================
export function ReflectionPage() {
  const s = useStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Reflection"
        title="Honest gaps · what didn't work · what I would do differently."
        lead="A solo build's strength is coherence; its weakness is blind spots. This page captures the build's blind spots openly — what is documented but not yet active, what was deferred deliberately, and what I would change if I started over today."
        partners={false}
        variant="deep"
      />

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What is documented but not yet active</h2>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.85, color: tokens.colorNeutralForeground2, fontSize: "14px", margin: 0 }}>
          <li><b>Foundry Agent Service runtime</b> — code ready; 2 RBAC role assignments pending Owner intervention. Function stays on the legacy AOAI chat-completions adapter until granted.</li>
          <li><b>Microsoft Graph Work IQ at the cloud Function</b> — local CLI activates with WORKIQ_BACKEND=graph + interactive sign-in. Cloud stays synthetic because admin consent would be required on the IBM tenant.</li>
          <li><b>Power BI semantic model</b> — Fabric IQ today uses SQL aggregation primitives. The named-DAX-measure model is v1.5.</li>
          <li><b>Defender for AI / Sentinel / Purview</b> — wired in ADRs 0007/0008 but not yet active. Activation depends on Foundry runtime activating first.</li>
          <li><b>Decision Ingest as a Container App</b> — today's path uses CompositeDecisionSink directly to Cosmos + SignalR. Event Hubs consumer is CLI-only. cae-adp-v1 is provisioned and idle for v1.5.</li>
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What was deferred deliberately</h2>
        <ul style={{ paddingLeft: "20px", lineHeight: 1.85, color: tokens.colorNeutralForeground2, fontSize: "14px", margin: 0 }}>
          <li>Closure / archival DW (DW-5) — not strictly part of the agentic reasoning lifecycle; v1.5 work.</li>
          <li>Customer-facing surfaces — policyholder mobile app, adjuster workbench, SIU inbox — explicitly out of scope to keep the focus on the platform.</li>
          <li>Real backends behind MCP tools — synthetic data is enough to prove the contract; real Duck Creek + J.D. Power + ISO ClaimSearch land in v1.5.</li>
          <li>Multi-claim concurrency stress test — v0 single happy path is enough to prove the orchestration; concurrency testing is v2.</li>
        </ul>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What I would change starting over today</h2>
        <div className={s.tileGrid}>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Hindsight 1</span>
            <h3 className={s.tileTitle}>Foundry runtime from D1</h3>
            <p className={s.tileBody}>The legacy AOAI adapter was the fastest path to a first running step, but the RBAC dance for Foundry should have happened on D1 not D14. Starting with Foundry would have surfaced the activation timing issues earlier.</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Hindsight 2</span>
            <h3 className={s.tileTitle}>Schema-aware primitive earlier</h3>
            <p className={s.tileBody}>The entity-history primitive landed as Track 5 of v1.0. If I had built it from D10 when Fabric Lakehouse first landed, the Meridian DWs would have been a touch cleaner — no Meridian-shaped names in the L5 source code from the start.</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Hindsight 3</span>
            <h3 className={s.tileTitle}>Docs portal earlier</h3>
            <p className={s.tileBody}>The docs portal landed late. If I had begun it at D8 (alongside the operator console) the architecture diagrams would have evolved with the build rather than being reconstructed at the end. Future builds: docs portal is week-1 infrastructure.</p>
          </Card>
          <Card className={s.tile}>
            <span className={s.tileLabel}>Hindsight 4</span>
            <h3 className={s.tileTitle}>Project portal from the brief</h3>
            <p className={s.tileBody}>This portal — the narrative one you are reading — should have existed alongside the docs portal from D8. The build's story is a separate artefact from the build's reference and both need to be authored as you go, not at the end.</p>
          </Card>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>What worked unambiguously</h2>
        <div className={s.callout}>
          The ground-zero discipline (one folder, two files — both kept intact in the project root) worked. The
          platform-and-use-case-in-lockstep discipline worked. The ADR-per-decision discipline worked. The boundary CI
          worked. The IBM BOB primary partnership worked. The ~30-focused-hours, 4-calendar-day arc was sustainable and
          produced a stack that costs ~$3.50/day to keep alive in the IBM Alliance tenant. Banking proved the boundary
          at the first test. None of these decisions need revision — they form the template for the next build.
        </div>
      </section>
    </div>
  );
}
