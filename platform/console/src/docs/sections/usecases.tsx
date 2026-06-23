import { Badge, tokens } from "@fluentui/react-components";
import { useDocsStyles, PageHero, Section, Diagram, Callout, InfoCard, Narrative } from "../common";
import { ClaimWorkflowDiagram } from "../diagrams";
import { MeridianAsIsDiagram, MeridianToBeDiagram, MeridianSolutionArchitectureDiagram } from "../meridian-diagrams";

// ============= Meridian Customer Brief =============
export function MeridianOverviewPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Use Case · Meridian P&C Auto Claims"
        title="Customer Brief · Meridian Personal Auto Claims"
        lead="The customer, the problem, why Microsoft, why ADP, and what success looks like. Read this first if you're new to the use case."
        badges={[
          { label: "Client Zero", color: "success" },
          { label: "Personal Auto P&C", color: "brand" },
          { label: "Frontier insurance firm", color: "brand" },
        ]}
      />

      <Section title="The customer" lead="Who Meridian is in one paragraph.">
        <Narrative>
          Meridian is a Fortune-100 global property &amp; casualty insurer underwriting roughly $50B in gross premiums across personal lines, commercial lines, and specialty. Personal Auto sits inside the personal-lines book and is one of the largest single claim-volume lines: high-frequency, mid-severity events with a strict regulatory floor (NAIC + per-state). The line is competitive on cycle time, settlement accuracy, and customer satisfaction — three metrics that all point at the same operational lever: <b>how fast and how well a single claim moves through the lifecycle</b>.
        </Narrative>
        <Narrative>
          Meridian runs a Microsoft-anchored enterprise IT estate — Azure for core workloads, Entra for identity, Microsoft 365 for collaboration — alongside legacy line-of-business systems (Duck Creek for policy and claims, PeopleSoft for HR, Oracle EBS for finance). Their data and AI investment is moving toward Microsoft Fabric and Azure AI Foundry, but the day-to-day claims process is still a string of human-and-spreadsheet steps stitched across those legacy systems. <b>That gap is what Project ADP is here to close.</b>
        </Narrative>
      </Section>

      <Section title="Stakeholders we're solving for">
        <div className={s.threeCol}>
          <InfoCard label="Persona 1" title="Policyholder">
            Margaret Ellison files a loss. She expects acknowledgement in minutes, a coverage answer in hours, and clear visibility into what happens next. Today she waits days.
          </InfoCard>
          <InfoCard label="Persona 2" title="Adjuster">
            Owns the file. Today they flip between Duck Creek, email threads, photo libraries, Excel rate sheets, and a state-rules binder. The cognitive load is the cost.
          </InfoCard>
          <InfoCard label="Persona 3" title="Claims Supervisor">
            Reviews exceptions, approves settlements above thresholds, owns SLAs. Today there is no single pane of glass; supervisors learn about backlog from spreadsheets.
          </InfoCard>
          <InfoCard label="Persona 4" title="SIU Investigator">
            Triggered by fraud signals. Today fraud surfaces post-pay, after the loss has already been disbursed. SIU wants signals at intake.
          </InfoCard>
          <InfoCard label="Persona 5" title="CSR">
            Call-centre staff who type the FNOL into Duck Creek. Today this is a 10-20 minute manual entry per call.
          </InfoCard>
          <InfoCard label="Persona 6" title="Compliance / Legal">
            Owns state-specific disclosure language, appeal rights, NAIC unfair-claims practices. Today they audit retrospectively from sampled cases.
          </InfoCard>
        </div>
      </Section>

      <Section title="Problems &amp; challenges Meridian is fighting today">
        <Narrative>
          The personal-auto claim process is a series of human handoffs across siloed systems. Each handoff carries judgement risk, latency, and an audit-chain gap. The result is a customer experience that competitors are now winning on, an adjuster workload that creates burn-out, and a compliance posture that is reactive rather than provable. The specifics:
        </Narrative>
        <table className={s.table}>
          <thead><tr><th>Pain</th><th>Today</th><th>Why it persists</th></tr></thead>
          <tbody>
            <tr><td><b>Cycle time</b></td><td>21–45 days from FNOL to settlement</td><td>Manual handoffs between Duck Creek, PeopleSoft roster, email, Excel rate sheets</td></tr>
            <tr><td><b>Coverage decision errors</b></td><td>0.5–2% error rate (industry-typical)</td><td>Adjuster manually cross-references PAC-COV-* binder against incident facts</td></tr>
            <tr><td><b>Triage inconsistency</b></td><td>Severity bands vary by adjuster</td><td>No shared classifier; each adjuster anchors on their own caseload</td></tr>
            <tr><td><b>Assignment latency</b></td><td>Hours of "the file is on someone's desk"</td><td>Routing is a workload spreadsheet not a live skill+presence query</td></tr>
            <tr><td><b>Fraud caught late</b></td><td>Post-pay, after disbursement</td><td>No pattern-scan at intake; SIU sees a stack at end-of-week</td></tr>
            <tr><td><b>Disclosure errors</b></td><td>NAIC Unfair Claims complaints rising</td><td>State-specific language lives in a binder, not in process</td></tr>
            <tr><td><b>Audit chain</b></td><td>Reconstructed from email, Excel, memory</td><td>Decisions are not recorded as they happen — they're reconstructed later</td></tr>
            <tr><td><b>Adjuster burn-out</b></td><td>30–60% workload variance · attrition climbing</td><td>The cognitive cost of stitching the systems together falls on the adjuster</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Why this hasn't already been solved" lead="The reasonable question.">
        <Narrative>
          The industry has bought workflow tools, RPA, point-AI models, and digital-claim apps for fifteen years. They help at the edges but they don't fundamentally change the shape of the work. <b>Each tool solves one step</b> — OCR for FNOL fields, ML for severity, rule engines for coverage — but the <b>reasoning across steps</b> still happens in a human's head. The platform-grade answer requires three things to be simultaneously true: agents that can reason on a single claim across steps, a federated context layer that brings the right business / regulatory / collaboration signals to every step, and a HITL surface that pauses the orchestration the moment a decision needs human judgement. Until very recently no Microsoft-native stack delivered all three. That changed with Azure AI Foundry Agent Service, Fabric IQ, and Microsoft Graph as a real Work-IQ surface. <b>ADP is the first platform to stitch them together at production grade for insurance.</b>
        </Narrative>
      </Section>

      <Section title="What success looks like">
        <Narrative>
          The bar isn't "AI helps somewhere in the process." The bar is: <b>every reasoning step in every claim is owned by a named agent, grounded in cited sources, gated by HITL on consequential moments, recorded in an immutable decision journal as it happens</b>. Operationally that means cycle time collapses from weeks to days, coverage errors drop below the 0.5% SLO, fraud is scored at intake (not post-pay), workload is balanced live across the adjuster roster, and every settlement letter cites the exact state-specific template that produced it.
        </Narrative>
        <Callout>
          Next: read <b>Meridian · AS-IS Today</b> for the existing process and pain in one diagram, then <b>Meridian · TO-BE with ADP</b> for the same lifecycle re-shaped on the platform, then <b>Meridian · 4 Digital Workers</b> for the implementation detail.
        </Callout>
      </Section>
    </div>
  );
}

// ============= Meridian AS-IS =============
export function MeridianAsIsPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Use Case · Meridian · Current State"
        title="AS-IS · The Meridian claim lifecycle today"
        lead="Siloed systems, manual handoffs, disconnected reasoning, and an audit chain reconstructed retrospectively. The diagram below shows the actual process and the pain points behind it."
        badges={[
          { label: "Cycle time: 21-45 days", color: "danger" },
          { label: "Coverage error: 0.5-2%", color: "warning" },
          { label: "Fraud: post-pay", color: "danger" },
        ]}
      />

      <Section title="Process + systems + outcomes" lead="One canvas, top-to-bottom: channels, manual process, underlying systems, business outcomes.">
        <Diagram caption="AS-IS Meridian personal-auto claim lifecycle. Each manual step adds latency; each siloed system adds handoff cost; the resulting business outcomes are exactly what ADP is here to change.">
          <MeridianAsIsDiagram />
        </Diagram>
      </Section>

      <Section title="The AS-IS process in narrative form">
        <Narrative>
          <b>FNOL capture.</b> A loss is reported on the mobile app, web portal, or via the call centre. In the call-centre path, a CSR types the FNOL into Duck Creek over a 10-20 minute call. Field extraction quality varies by CSR; fields are sometimes left blank for the adjuster to chase later.
        </Narrative>
        <Narrative>
          <b>Coverage verification.</b> An adjuster (or sometimes the CSR) opens the policy in Duck Creek and reads the coverage sections. They cross-reference against the incident facts and judge whether the loss is covered. Industry coverage-error rates run 0.5-2%; Meridian is at the lower end but still sees a steady complaint trickle attributable to coverage mis-calls.
        </Narrative>
        <Narrative>
          <b>Triage.</b> The adjuster reads the FNOL, looks at any photos, and classifies severity (informational / minor / moderate / severe). The classification anchors on the adjuster's recent caseload — there is no shared severity model and no historical-pattern check.
        </Narrative>
        <Narrative>
          <b>Assignment.</b> The supervisor or a routing coordinator looks at the workload spreadsheet, weighs skill + region + caseload, and picks an adjuster. This step is often <i>hours</i> of latency just because no one looks at the spreadsheet until the next morning.
        </Narrative>
        <Narrative>
          <b>Damage assessment.</b> The field adjuster inspects the vehicle (or reviews photos), categorises damage by band, and estimates repair cost. Estimates rely on the adjuster's experience plus a rate sheet in Excel; there is no live cross-check against the historical loss data Meridian already holds.
        </Narrative>
        <Narrative>
          <b>Fraud.</b> Most fraud surfaces <i>after</i> settlement, when a downstream pattern (same shop, repeat claimant, anomalous hour-of-day) flags something a single claim never would. SIU receives a stack of cases weekly and works backwards from disbursement.
        </Narrative>
        <Narrative>
          <b>Settlement.</b> The adjuster calculates the payout in Excel, picks a letter template from a binder of state-specific forms, and routes for supervisor approval if the amount exceeds the authority threshold. The letter is mailed; the disbursement is initiated via Oracle EBS or the digital payments channel. Median time from approved settlement to letter-in-mailbox is 3-7 days.
        </Narrative>
      </Section>

      <Section title="Where the audit chain breaks">
        <Callout variant="warn">
          Every step above produces evidence — email threads, Excel exports, CSR call notes, photos uploaded to SharePoint, the adjuster's hand-written notes — but none of it is <b>linked together at the decision level</b>. When a complaint comes in and a regulator asks "why was this claim denied," Meridian's compliance team reconstructs the answer from sampled artefacts. The decision wasn't recorded as a decision; it was recorded as a side-effect.
        </Callout>
      </Section>

      <Section title="The handoff matrix" lead="Every named handoff is a place where cycle time, accuracy, and audit chain are at risk.">
        <table className={s.table}>
          <thead><tr><th>Handoff</th><th>From</th><th>To</th><th>Today's latency</th><th>Today's evidence</th></tr></thead>
          <tbody>
            <tr><td>FNOL → Coverage</td><td>CSR · mobile · web</td><td>Adjuster</td><td>hours – 1 day</td><td>Duck Creek record</td></tr>
            <tr><td>Coverage → Triage</td><td>Adjuster</td><td>Adjuster (same)</td><td>minutes</td><td>Duck Creek note</td></tr>
            <tr><td>Triage → Assignment</td><td>Adjuster</td><td>Supervisor / coordinator</td><td>hours – 1 day</td><td>workload spreadsheet</td></tr>
            <tr><td>Assignment → Damage</td><td>Supervisor</td><td>Field adjuster</td><td>1-3 days</td><td>email + photos</td></tr>
            <tr><td>Damage → Fraud (rare)</td><td>Field adjuster</td><td>SIU (weekly batch)</td><td>5-7 days</td><td>SIU spreadsheet</td></tr>
            <tr><td>Damage → Settlement</td><td>Field adjuster</td><td>Adjuster</td><td>1-3 days</td><td>Excel rate-sheet</td></tr>
            <tr><td>Settlement → Approval</td><td>Adjuster</td><td>Supervisor (if &gt;authority)</td><td>1-2 days</td><td>email approval thread</td></tr>
            <tr><td>Approval → Letter</td><td>Supervisor</td><td>Mail vendor</td><td>1-3 days</td><td>printed letter</td></tr>
            <tr><td>Approval → Disburse</td><td>Supervisor</td><td>Oracle EBS / digital payments</td><td>1-2 days</td><td>EBS journal</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ============= Meridian TO-BE =============
export function MeridianToBePage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Use Case · Meridian · Future State"
        title="TO-BE · The same lifecycle re-shaped on ADP"
        lead="Four Digital Workers cover the lifecycle agentically. Three IQ sources feed every step. Eight HITL gates pause the orchestration on consequential moments. Every decision is recorded in an immutable journal as it happens."
        badges={[
          { label: "Cycle time: minutes-days", color: "success" },
          { label: "Coverage SLO: ≤ 0.5%", color: "success" },
          { label: "Fraud: scored at intake", color: "success" },
          { label: "All decisions cited", color: "success" },
        ]}
      />

      <Section title="The TO-BE picture" lead="Unified operator surface on top, agentic process in the middle, federated context feeding every step, Microsoft-native substrate underneath.">
        <Diagram caption="TO-BE Meridian personal-auto claim lifecycle on ADP. The four Digital Workers replace the manual handoff matrix; the L5 federation replaces the binder + spreadsheet + email composite; HITL pause/resume replaces the supervisor-approval email thread.">
          <MeridianToBeDiagram />
        </Diagram>
      </Section>

      <Section title="The TO-BE solution architecture" lead="Five layers stacked, AS-IS systems wrapped at the bottom via MCP tools. This is what is actually deployed in Azure today.">
        <Diagram caption="Solution architecture — operator surface · agent runtime · L5 federation · compute + data substrate · identity + IaC + observability. AS-IS systems (Duck Creek, PeopleSoft, J.D. Power, ISO ClaimSearch, Oracle EBS) wrap at the bottom and are surfaced into the agentic process via MCP tools — they don't disappear, they're absorbed.">
          <MeridianSolutionArchitectureDiagram />
        </Diagram>
      </Section>

      <Section title="Step-by-step · how the TO-BE process replaces the AS-IS pain">
        <Narrative>
          <b>FNOL capture → FNOL Handler DW.</b> The claim-intake agent reads the inbound FNOL (mobile / web / call-centre transcript), extracts structured fields against <code>PAC-INTAKE-001</code>, and writes the canonical record. The CSR's manual data entry is replaced by a structured extraction step with an audit-grade trace; what used to be 10-20 minutes of typing collapses to a 5-10 second agent step. Confidence-gated → HITL fires only when the extraction itself is uncertain.
        </Narrative>
        <Narrative>
          <b>Coverage verification → coverage-verification agent.</b> Cross-references policy in <code>dim_policyholder</code> + similar-claims rollup in Fabric IQ against incident facts and applicable PAC-COV-* docs in Foundry IQ. The 0.5-2% manual error rate becomes the platform's grounded-rate measurement — every decision cites the exact policy sections and exclusions that produced it.
        </Narrative>
        <Narrative>
          <b>Triage → initial-triage agent.</b> Severity classification grounded in <code>PAC-TRI-001</code>, similar-claims pattern, severity-distribution-by-state aggregate from Fabric IQ, and the supervisor-thread signal from Work IQ. Confidence gate <code>gate.low-confidence-triage</code> pauses the orchestrator when classification is uncertain; the supervisor reviews and resolves, the orchestration resumes from where it paused.
        </Narrative>
        <Narrative>
          <b>Assignment → assignment-routing agent.</b> The <code>tool.adjuster-roster</code> MCP tool surfaces live workload + skill + region; the Calendar Signal primitive from Work IQ checks adjuster presence. What used to be "hours until someone reads the spreadsheet" becomes a sub-second routing decision with an immediate Teams notification to the picked adjuster.
        </Narrative>
        <Narrative>
          <b>Damage assessment → Damage Handler DW.</b> Damage-categorization cites historical similar-claims by category × vehicle make × state; <code>gate.total-loss-suspect</code> field-value gate fires automatically when the categorize agent's output contains the total-loss marker — the supervisor approves before any total-loss letter is generated. Repair-estimation cites the <code>incident-type-mix-by-state</code> aggregate and <code>vehicle-history</code> primitive; subjective bands become grounded bands. Shop-routing picks a Tier-1 OEM-certified shop per <code>PAC-SHOP-001</code>, cross-checked against the live shop-collaboration history from Work IQ.
        </Narrative>
        <Narrative>
          <b>Fraud → Fraud Handler DW.</b> Now fraud is scored <i>at intake</i> rather than post-pay. The fraud-pattern-scan agent runs in a bounded reasoning zone (up to 5 LLM passes) and cites three Fabric IQ aggregates at once — <code>similar-claims</code>, <code>hour-of-day-concentration</code>, <code>incident-type-mix-by-state</code>. The fraud-score agent classifies into clear / monitor / siu-priority bands; <code>gate.priority-fraud-review</code> is a mandatory HITL — every siu-priority case gets a human investigator's eyes before any disbursement. SIU sees signals at intake, not at end-of-week.
        </Narrative>
        <Narrative>
          <b>Settlement → Settlement Handler DW.</b> Settlement-calculation derives the right amount across 5 paths (full / repair / total-loss / partial-denial / full-denial); <code>gate.high-value-settlement</code> trips for amounts ≥ $25K. Settlement-disclosure is the state-aware step — the agent recognises the policyholder's state from <code>dim_policyholder</code> and selects the right template per <code>PAC-SET-002</code> (CA 30-day, NY appeal rights, TX form, FL deadlines, MA Spanish co-sign, IL default, NAIC fallback). Disclosure runs in its own bounded reasoning zone (3 passes) for complex multi-template letters. Disbursement routes the right channel (ACH / cheque / vendor-pay / managed-repair); <code>gate.full-denial-review</code> is a mandatory HITL on every denial.
        </Narrative>
      </Section>

      <Section title="Audit chain by construction" lead="The thing AS-IS reconstructs retrospectively, TO-BE records as it happens.">
        <Callout>
          Every step writes a <code>DecisionEvent</code> to Cosmos <code>dw-state</code> + Event Hubs <code>adp-v1-decisions</code> + SignalR <code>fnoltrace</code> at the same time. The event carries the agent's identifier, the cited sources, the confidence, the HITL resolution (if any), and the resulting output. When a regulator asks "why was this claim handled this way," the answer is one Cosmos query — not a reconstruction.
        </Callout>
      </Section>

      <Section title="What changes for each persona">
        <table className={s.table}>
          <thead><tr><th>Persona</th><th>Today</th><th>On ADP</th></tr></thead>
          <tbody>
            <tr><td>Policyholder</td><td>Wait days for acknowledgement, opaque to status</td><td>Acknowledged in minutes; trace inspector exposes status (v1.5 customer-facing)</td></tr>
            <tr><td>CSR</td><td>10-20 min typing per call</td><td>Agent extracts the structured fields; CSR validates exceptions</td></tr>
            <tr><td>Adjuster</td><td>Flips between 5+ systems · cognitive load</td><td>Operator Console is the single pane; the 5 systems become MCP tool calls</td></tr>
            <tr><td>Supervisor</td><td>Email approval threads · spreadsheet workload view</td><td>Live HITL queue with priority + context · Approve/Escalate inline</td></tr>
            <tr><td>SIU</td><td>Weekly post-pay batches</td><td>Scored at intake · referred only on siu-priority band · mandatory HITL upstream</td></tr>
            <tr><td>Compliance</td><td>Retrospective sampling</td><td>Decision journal is the audit surface · every cite recorded</td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ============= Meridian Personas & Journey =============
export function MeridianPersonasPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Use Case · Meridian"
        title="Personas & Customer Journey"
        lead="Five personas drive the v0 narrative. The Operator persona is what the live console exposes; the others are addressed via traces and downstream events."
      />

      <Section title="Personas">
        <table className={s.table}>
          <thead><tr><th>Persona</th><th>Touches</th><th>v0 surface</th></tr></thead>
          <tbody>
            <tr><td><b>Margaret Ellison</b> · Policyholder</td><td>Submits FNOL, receives settlement letter</td><td>Out of v0 UI — claim drawn from bundled corpus</td></tr>
            <tr><td><b>CSR</b></td><td>Call centre intake</td><td>Out of v0 UI</td></tr>
            <tr><td><b>Operator</b> · proxy for adjuster + supervisor</td><td>Reviews live trace, resolves HITL gates</td><td><b>Operator Console</b> — Run / Run-with-HITL / Approve / Escalate</td></tr>
            <tr><td><b>Adjuster</b></td><td>Receives the assignment, owns the file</td><td>Out of v0 UI — assignment event only</td></tr>
            <tr><td><b>SIU Investigator</b></td><td>Triggered by fraud signals</td><td>Out of v0 — SIU referral event is logged but no inbox</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="The journey">
        <div className={s.codeBlock}>{`Policyholder ──FNOL──► Coverage ──► Triage ──► Assignment ──► Adjuster
                                       │
                                       ├─► fraud signals ──► SIU
                                       │
                                       └─► Damage ──┬─► Investigation ──► Settlement ──► Closure
                                                    │
                                                    └─► Repair / Total-loss

      Supervisor oversees adjuster
      Supervisor approves settlements`}</div>
      </Section>

      <Section title="Where the platform actually touches the journey today">
        <Callout>
          The platform owns <b>every reasoning step</b> in FNOL → Damage → Fraud → Settlement. It does <b>not</b> own
          the human-handoff surfaces (Margaret submitting via mobile, the adjuster's workbench, the SIU inbox) —
          those are next-phase work tracked in v1.5.
        </Callout>
      </Section>
    </div>
  );
}

// ============= Meridian 4 Digital Workers =============
const DWS = [
  {
    id: "DW-1",
    title: "FNOL Handler",
    color: "#0078D4",
    slo: "90% intake ≤ 15 min · coverage error ≤ 0.5%",
    agents: [
      { name: "claim-intake", body: "Reads inbound FNOL; extracts structured fields (loss-date, loss-state, vehicles, drivers, narrative). Cites PAC-INTAKE-001.", citations: "Foundry · Fabric POLICYHOLDER_HISTORY" },
      { name: "coverage-verification", body: "Cross-references policy against incident; identifies applicable coverages, exclusions, deductibles. Cites PAC-COV-001/002 + PAC-REG-001.", citations: "Foundry · Fabric SIMILAR_CLAIMS" },
      { name: "initial-triage", body: "Severity classification (informational / minor / moderate / severe). Confidence-gated → HITL.", citations: "Foundry PAC-TRI-001 · Fabric SIMILAR_CLAIMS + SEVERITY_DIST · Work IQ TEAMS_THREAD" },
      { name: "assignment-routing", body: "Picks the right adjuster from the roster (workload + skill + state). Cites PAC-ROUTE-001.", citations: "Foundry · tool.adjuster-roster · Work IQ CALENDAR_SIGNAL" },
    ],
    gates: ["gate.low-confidence-triage"],
  },
  {
    id: "DW-2",
    title: "Damage Handler",
    color: "#0078D4",
    slo: "90% categorize ≤ 5 min · band drift ≤ 20% · shop accept ≥ 85%",
    agents: [
      { name: "damage-intake", body: "Photos + adjuster notes; canonical damage descriptor.", citations: "Foundry PAC-DAMAGE-001" },
      { name: "damage-categorization", body: "Minor / moderate / severe / total-loss-suspect. Field-value gate on totalLossSuspect.", citations: "Foundry · Fabric SIMILAR_CLAIMS + VEHICLE_HISTORY" },
      { name: "repair-estimation", body: "Cost band: by category × vehicle make × state.", citations: "Foundry PAC-DAMAGE-002 · Fabric INCIDENT_MIX_BY_STATE + VEHICLE_HISTORY" },
      { name: "shop-routing", body: "Tier-1 OEM-certified shop within region.", citations: "Foundry PAC-SHOP-001 · Work IQ SHAREPOINT_FILE/shop-history" },
    ],
    gates: ["gate.total-loss-suspect", "gate.low-confidence-damage"],
  },
  {
    id: "DW-3",
    title: "Fraud Handler",
    color: "#d4a64a",
    slo: "90% scan ≤ 10 min · SIU false-positive ≤ 10% · priority coverage 100%",
    agents: [
      { name: "fraud-intake", body: "Aggregates signals from prior steps.", citations: "Foundry PAC-FRD-001" },
      { name: "fraud-pattern-scan", body: "Bounded reasoning zone (5 LLM passes). Clustering / rings / sequences. Cites three Fabric primitives at once.", citations: "Foundry PAC-FRD-002 · Fabric SIMILAR_CLAIMS + HOUR_OF_DAY + INCIDENT_MIX" },
      { name: "fraud-score", body: "Composite score → band (clear / monitor / siu-priority). Mandatory HITL on siu-priority.", citations: "Foundry PAC-FRD-003" },
      { name: "siu-routing", body: "Picks SIU investigator if priority; otherwise no referral.", citations: "Foundry PAC-SIU-001 · Fabric POLICYHOLDER_HISTORY · Work IQ CALENDAR_SIGNAL" },
    ],
    gates: ["gate.priority-fraud-review", "gate.low-confidence-fraud"],
  },
  {
    id: "DW-4",
    title: "Settlement Handler",
    color: "#22a06b",
    slo: "90% letter ≤ 15d · disbursement accuracy ≥ 99.5% · high-value review 100%",
    agents: [
      { name: "settlement-intake", body: "Validates upstream artefacts (coverage, damage, fraud band).", citations: "Foundry" },
      { name: "settlement-calculation", body: "5 settlement paths: full / repair / total-loss / partial-denial / full-denial. Field-value gate at $25K+.", citations: "Foundry PAC-SET-001" },
      { name: "settlement-disclosure", body: "State-aware (CA 30-day window, NY appeal rights, TX form, FL deadlines, MA Spanish co-sign, IL default, NAIC fallback). Bounded reasoning zone (3 passes).", citations: "Foundry PAC-SET-002" },
      { name: "settlement-disbursement", body: "ACH / cheque / vendor-pay / managed-repair. Mandatory HITL on full-denial.", citations: "Foundry PAC-SET-003 · Fabric POLICYHOLDER_HISTORY · Work IQ TEAMS_THREAD/payment-ops" },
    ],
    gates: ["gate.high-value-settlement", "gate.full-denial-review", "gate.disclosure-template-revision"],
  },
];

export function MeridianWorkersPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Use Case · Meridian"
        title="Four Digital Workers"
        lead="The full Meridian P&C Auto claim lifecycle, decomposed into four cooperating Digital Workers. Each DW has 4 agents (14 steps total across the lifecycle). 8 HITL gates spread across the 4 DWs."
      />

      <Section title="The cascade">
        <Diagram caption="FNOL Handler outputs feed Damage Handler; Damage Handler outputs feed Fraud Handler + Settlement Handler. The full lifecycle for one claim runs ~60-90 seconds without HITL, more if operator intervention is needed.">
          <ClaimWorkflowDiagram />
        </Diagram>
      </Section>

      {DWS.map((dw) => (
        <Section key={dw.id} title={`${dw.id} · ${dw.title}`} lead={`SLO: ${dw.slo}`}>
          <table className={s.table}>
            <thead><tr><th>Step</th><th>Agent</th><th>Responsibility</th><th>Typical citations</th></tr></thead>
            <tbody>
              {dw.agents.map((a, i) => (
                <tr key={a.name}>
                  <td><Badge size="small" appearance="filled" color="informative">{i + 1}</Badge></td>
                  <td><code>{a.name}</code></td>
                  <td>{a.body}</td>
                  <td style={{ fontSize: "12px", color: tokens.colorNeutralForeground3 }}>{a.citations}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.chips} style={{ marginTop: "8px" }}>
            <span style={{ fontSize: "11px", color: tokens.colorNeutralForeground3, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>HITL gates:</span>
            {dw.gates.map((g) => (
              <span key={g} className={s.chip} style={{ backgroundColor: tokens.colorPaletteYellowBackground2, color: tokens.colorPaletteYellowForeground2 }}>{g}</span>
            ))}
          </div>
        </Section>
      ))}

      <Section title="14-step lifecycle math">
        <table className={s.table}>
          <thead><tr><th>DW</th><th>Agents</th><th>Skills</th><th>Tools declared</th><th>HITL gates</th><th>Bounded zones</th></tr></thead>
          <tbody>
            <tr><td>FNOL Handler</td><td>4</td><td>9</td><td>5</td><td>1</td><td>0</td></tr>
            <tr><td>Damage Handler</td><td>4</td><td>8</td><td>4</td><td>2</td><td>0</td></tr>
            <tr><td>Fraud Handler</td><td>4</td><td>9</td><td>5</td><td>2 (incl. mandatory)</td><td>1 (5 LLM passes)</td></tr>
            <tr><td>Settlement Handler</td><td>4</td><td>11</td><td>4</td><td>3 (incl. mandatory)</td><td>1 (3 LLM passes)</td></tr>
            <tr><td><b>Total</b></td><td><b>16</b></td><td><b>37</b></td><td><b>18 declared</b></td><td><b>8</b></td><td><b>2</b></td></tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ============= Meridian Knowledge Corpus =============
const KNOWLEDGE = [
  { dw: "FNOL", id: "PAC-COV-001", title: "Personal Auto Policy — Coverage Sections", dims: "procedural · regulatory" },
  { dw: "FNOL", id: "PAC-COV-002", title: "Coverage Verification Rules + Exclusions", dims: "procedural · regulatory" },
  { dw: "FNOL", id: "PAC-TRI-001", title: "Initial Triage — Severity Classification", dims: "procedural · historical" },
  { dw: "FNOL", id: "PAC-FRD-001", title: "Fraud Indicators (NAIC-style)", dims: "procedural · historical" },
  { dw: "FNOL", id: "PAC-ROUTE-001", title: "Adjuster Assignment Policy", dims: "procedural · collaboration" },
  { dw: "FNOL", id: "PAC-REG-001", title: "NAIC Unfair Claims Practices", dims: "regulatory" },
  { dw: "FNOL", id: "PAC-INTAKE-001", title: "FNOL Field Extraction Standards", dims: "procedural · entity" },
  { dw: "FNOL", id: "PAC-REG-002", title: "State-Specific Rideshare / TNC Rules", dims: "regulatory · procedural" },
  { dw: "Damage", id: "PAC-DAMAGE-001", title: "Damage Categorization Framework", dims: "procedural · historical" },
  { dw: "Damage", id: "PAC-DAMAGE-002", title: "Repair Cost Estimation Bands", dims: "procedural · historical" },
  { dw: "Damage", id: "PAC-DAMAGE-003", title: "Safety Re-inspection Triggers", dims: "procedural · regulatory" },
  { dw: "Damage", id: "PAC-SHOP-001", title: "Repair Shop Network — Selection Policy", dims: "procedural · collaboration" },
  { dw: "Damage", id: "PAC-TOTAL-LOSS-001", title: "Total-Loss Threshold Rules", dims: "procedural · regulatory" },
  { dw: "Fraud", id: "PAC-FRD-002", title: "Fraud Pattern Detection — Clustering, Rings, Sequences", dims: "procedural · historical" },
  { dw: "Fraud", id: "PAC-FRD-003", title: "Fraud Score — Composition + Thresholds + Bands", dims: "procedural · regulatory" },
  { dw: "Fraud", id: "PAC-SIU-001", title: "SIU Referral Procedure + Investigator Routing", dims: "procedural · collaboration · regulatory" },
  { dw: "Settlement", id: "PAC-SET-001", title: "Settlement Amount Calculation — ACV, Repair, Deductibles", dims: "procedural · regulatory" },
  { dw: "Settlement", id: "PAC-SET-002", title: "Settlement Disclosure — State-Specific Language + Appeal Rights", dims: "regulatory · procedural" },
  { dw: "Settlement", id: "PAC-SET-003", title: "Payment Channel + Recipient Routing", dims: "procedural · collaboration" },
];
export function MeridianKnowledgePage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Use Case · Meridian"
        title="Knowledge Corpus · 19 PAC-* docs"
        lead="Markdown documents under usecases/meridian-pnc-auto-claims/knowledge/. Each doc has YAML front-matter (title, dimensions, domain). All are indexed into srch-adp-v1 with industry=insurance for clean cross-industry isolation."
      />

      <Section title="Indexing recipe">
        <div className={s.codeBlock}>{`# Local environment
$env:AZURE_OPENAI_ENDPOINT  = "https://dt-navigator-openai.openai.azure.com/"
$env:AZURE_OPENAI_API_KEY   = "<key>"
$env:AZURE_SEARCH_ENDPOINT  = "https://srch-adp-v1.search.windows.net"
$env:AZURE_SEARCH_API_KEY   = "<admin-key>"

# Index
dotnet run --project platform/src/PackageCompiler -- index \\
  --knowledge usecases/meridian-pnc-auto-claims/knowledge

# What happens:
#  1. Walk *.md files
#  2. Extract YAML front-matter (title, dimensions, domain → industry)
#  3. Embed body with text-embedding-3-large (3072-d)
#  4. Upsert into srch-adp-v1 index "adp-knowledge"`}</div>
      </Section>

      <Section title="The 19 documents">
        <table className={s.table}>
          <thead><tr><th>DW</th><th>ID</th><th>Title</th><th>Dimensions</th></tr></thead>
          <tbody>
            {KNOWLEDGE.map((k) => (
              <tr key={k.id}>
                <td><Badge size="small" appearance="outline" color={k.dw === "Fraud" ? "warning" : k.dw === "Settlement" ? "success" : "informative"}>{k.dw}</Badge></td>
                <td><code>{k.id}</code></td>
                <td>{k.title}</td>
                <td style={{ fontSize: "12px", color: tokens.colorNeutralForeground3 }}>{k.dims}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Dimensions vocabulary">
        <p className={s.sectionLead}>
          The <code>dimensions</code> YAML field is a free-form list. Five canonical values have emerged:
          <code> procedural</code> (how-to · process),
          <code> regulatory</code> (NAIC · state-specific · compliance),
          <code> historical</code> (claim patterns · prior incidents · loss data),
          <code> collaboration</code> (Teams · email · adjuster network),
          <code> entity</code> (data shape · field extraction standards).
          Packages declare which dimensions an intent needs; the source returns matching fragments.
        </p>
      </Section>
    </div>
  );
}

// ============= Meridian Demo Script =============
export function MeridianDemoPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Use Case · Meridian"
        title="Demo Script · 7-minute walkthrough"
        lead="One claim. Four Digital Workers. Three IQ sources cited live. Two HITL gates exercised. Use this script for live walk-throughs and as an inspection guide when watching the recording."
      />

      <Section title="Setup · 30 seconds">
        <ol style={{ paddingLeft: "20px", lineHeight: 1.7, color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
          <li>Open <code>witty-sea-0d12a380f.7.azurestaticapps.net</code>.</li>
          <li>Land on the docs portal. Show the hero, the architecture poster, mission cards. Move to top-nav → <b>Operator</b>.</li>
          <li>Reload to flush any stale SignalR connections (operator-only).</li>
          <li>From the <b>Package</b> dropdown pick <code>FNOL Handler · Meridian</code>; from the <b>Subject</b> dropdown pick <code>CLM-2026-10001 · multi-vehicle · TX</code>.</li>
        </ol>
      </Section>

      <Section title="Act 1 · FNOL Handler · 90 seconds">
        <ol style={{ paddingLeft: "20px", lineHeight: 1.7, color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
          <li>With the FNOL package selected, click <b>Run</b>. Live tail shows step 1 (claim-intake) within 5 seconds.</li>
          <li>Step 2 (coverage-verification) cites <code>[Foundry] PAC-COV-001</code> + <code>[FabricIQ] POLICYHOLDER_HISTORY/PH-208920</code>.</li>
          <li>Step 3 (initial-triage) — pause and call out the three sources interleaved: PAC-TRI-001 + Fabric SIMILAR_CLAIMS + Work IQ TEAMS_THREAD.</li>
          <li>Step 4 (assignment-routing) — confidence 0.92, lands on adjuster ADJ-014.</li>
        </ol>
      </Section>

      <Section title="Act 2 · Damage Handler with forced HITL · 120 seconds">
        <ol style={{ paddingLeft: "20px", lineHeight: 1.7, color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
          <li>Change <b>Package</b> to <code>Damage Handler · Meridian</code>. Keep the same subject. Click <b>Run with HITL</b>. Step 2 (categorize) returns confidence 0.95 but output contains <code>total-loss-suspect</code> → <code>gate.total-loss-suspect</code> trips.</li>
          <li>Live tail shows the step pinned to <i>needs-human-review</i>. Highlight the orchestrator is now in <code>WaitForExternalEvent</code>.</li>
          <li>Click <b>Approve</b> with comment "Verified — adjuster confirmed total loss". Step flips to completed.</li>
          <li>Steps 3 (estimate) + 4 (shop) complete; cites tier-1 shop per PAC-SHOP-001.</li>
        </ol>
      </Section>

      <Section title="Act 3 · Fraud Handler · 90 seconds">
        <ol style={{ paddingLeft: "20px", lineHeight: 1.7, color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
          <li>Change <b>Package</b> to <code>Fraud Handler · Meridian</code>. Click <b>Run</b>. Step 2 (pattern-scan) takes longer than other steps — call out the bounded-reasoning zone (5 passes) explicitly.</li>
          <li>Pattern-scan cites three Fabric primitives at once: <code>SIMILAR_CLAIMS</code> + <code>HOUR_OF_DAY</code> + <code>INCIDENT_MIX</code>. First step in the demo that fires multiple Fabric primitives simultaneously.</li>
          <li>Step 3 (fraud-score) lands in <code>clear</code> band → no SIU referral, mandatory gate doesn't fire.</li>
        </ol>
      </Section>

      <Section title="Act 4 · Settlement Handler · 90 seconds">
        <ol style={{ paddingLeft: "20px", lineHeight: 1.7, color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
          <li>Change <b>Package</b> to <code>Settlement Handler · Meridian</code>. Click <b>Run</b>. Step 2 (calculation) returns $18,200 → high-value gate (≥$25K) does NOT trip.</li>
          <li>Step 3 (disclosure) recognises CA state from <code>dim_policyholder</code> and picks the California-specific template with 30-day window per <code>PAC-SET-002</code>. <b>First state-aware regulatory reasoning step in the demo.</b></li>
          <li>Step 4 (disbursement) routes ACH direct deposit; cites <code>POLICYHOLDER_HISTORY/PH-208920</code> + <code>TEAMS_THREAD/CLM-2026-DEMO-001/payment-ops</code> + <code>PAC-SET-003</code>.</li>
        </ol>
      </Section>

      <Section title="Act 5 · Cross-industry · 120 seconds">
        <ol style={{ paddingLeft: "20px", lineHeight: 1.7, color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
          <li>Switch <b>Package</b> to <code>Loan Handler · Banking</code>. Subject dropdown auto-populates with banking applications. Pick <code>LOAN-2026-50002 · Maria Hernandez · TX · approve w/ cosign · Spanish</code>.</li>
          <li>Click <b>Run</b>. Step 1 (intake) parses the loan application per <code>BANK-002</code>. Step 2 (eligibility) cites <code>[Foundry] BANK-001</code> + <code>[FabricIQ] BORROWER_HISTORY/BOR-100001</code> + ECOA invariant <code>BANK-004</code>. Decision: approve-with-conditions, condition COSIGN attached.</li>
          <li>Step 3 (decision-letter) generates a Spanish-language FCRA + ECOA-compliant adverse-action notice per <code>BANK-003</code> + <code>BANK-004</code> + the TX state overlay. <b>This is the new agent — first banking demo with state-aware regulatory letter generation.</b></li>
          <li>Same platform, different industry, different regulatory regime. Zero Meridian-doc bleed in any citation. The boundary holds.</li>
        </ol>
      </Section>

      <Callout>
        <b>Total run time:</b> ~7 minutes spoken / ~10 minutes demo with full talk-back. If the audience is short on
        time, drop Act 5 (cross-industry) and trim Act 4 to one disclosure beat.
      </Callout>
    </div>
  );
}

// ============= Banking Stress Test =============
export function BankingPage() {
  const s = useDocsStyles();
  return (
    <div className={s.page}>
      <PageHero
        eyebrow="Use Case · Banking Loan Origination"
        title="Banking · Second Industry on ADP"
        lead="The agnostic-boundary stress test grown into a real second-industry demo. Three agents covering intake → eligibility → state-aware FCRA + ECOA-compliant decision letter. Five knowledge docs covering eligibility, intake, FCRA disclosure, ECOA Reg B, and fair-lending pricing bands. Live in the operator console with its own subject dropdown."
        badges={[
          { label: "3 agents", color: "brand" },
          { label: "5 BANK-* docs", color: "brand" },
          { label: "2 MCP tools", color: "brand" },
          { label: "30 borrowers · 40 historical apps · 12 runtime apps", color: "brand" },
          { label: "0 platform changes", color: "success" },
        ]}
      />

      <Section title="Why banking specifically">
        <p className={s.sectionLead}>
          Three reasons. <b>Different entity shape</b> — borrowers + applications are nothing like policyholders +
          claims. <b>Different regulatory vocabulary</b> — FCRA / ECOA, not NAIC. <b>Different tool surface</b> —
          credit bureau lookup, not adjuster roster. If the platform's agnostic boundary held only for
          insurance-shaped industries, that wouldn't be much of a proof.
        </p>
      </Section>

      <Section title="What's in the use case folder">
        <div className={s.codeBlock}>{`usecases/banking-loan-origination/
├── packages/
│   └── loan-handler.json            ← v0.2.0 · 3 agents (intake + eligibility + decision-letter)
├── knowledge/
│   ├── BANK-001.md                  ← Consumer Loan Eligibility Framework
│   ├── BANK-002.md                  ← Application Intake — Required Fields
│   ├── BANK-003.md                  ← FCRA Adverse-Action Disclosure Requirements
│   ├── BANK-004.md                  ← ECOA Reg B Prohibited Bases + Anti-Discrimination
│   └── BANK-005.md                  ← Fair Lending Pricing Bands + Counter-Offer Protocol
├── data/
│   ├── borrowers-30.json            ← 30 borrowers · 40 historical applications (Fabric IQ)
│   └── applications-runtime.json    ← 12 runtime applications (operator-console subject pool)
└── tools/
    ├── BankingTools.csproj
    └── BankingTools.cs              ← tool.borrower-profile + tool.credit-bureau-lookup

Fabric Lakehouse adp:
  + dim_borrower                     ← 30 rows loaded via scripts/load-fabric-banking.ps1
  + fact_loan_applications           ← 40 rows (drives the entity-history primitive)`}</div>
      </Section>

      <Section title="The three agents" lead="Same pattern as Meridian: each step is one agent, grounded in cited knowledge, gated by HITL on consequential moments.">
        <table className={s.table}>
          <thead><tr><th>Step</th><th>Agent</th><th>What it does</th><th>Gates / sources</th></tr></thead>
          <tbody>
            <tr>
              <td>1</td>
              <td><code>agent.loan-application-intake</code></td>
              <td>Parses incoming loan application per BANK-002. Verifies income, credit, collateral. Drops confidence below 0.6 if any verification fails.</td>
              <td>BANK-002 (intake)</td>
            </tr>
            <tr>
              <td>2</td>
              <td><code>agent.loan-eligibility</code></td>
              <td>Applies DTI / LTV / FICO gating per BANK-001 with stricter-of logic. Emits decision + conditions + risk stratum per BANK-005. Enforces ECOA Reg B prohibited bases per BANK-004 via invariant.</td>
              <td>BANK-001, BANK-004, BANK-005 · gate.low-confidence-eligibility · gate.refer-to-underwriter</td>
            </tr>
            <tr>
              <td>3 <span style={{ color: tokens.colorBrandForeground1, fontWeight: 600 }}>(new)</span></td>
              <td><code>agent.loan-decision-letter</code></td>
              <td>Generates state-aware FCRA + ECOA-compliant decision letter — adverse-action notice (BANK-003), federal ECOA statement (BANK-004), or offer letter with APR + conditions (BANK-005). Spanish branch for applicable applicants. 8th-grade reading-level check. Bounded reasoning zone (3 passes).</td>
              <td>BANK-003, BANK-004, BANK-005 · gate.full-denial-review · zone.letter-multipass</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Schema-aware activation">
        <p className={s.sectionLead}>
          The eligibility agent's <code>evaluate_eligibility</code> intent declares
          <code>sourceBindings: {`{ FabricIQ: ["entity-history"] }`}</code>. The package's <code>schemaBinding</code>
          tells the platform: primary entity is <code>dim_borrower</code> with primary key
          <code>borrower_id</code>; secondary entity is <code>fact_loan_applications</code> with foreign key
          <code>borrower_id</code>. The <code>entity-history</code> primitive templates a SQL query against the
          banking tables — no Meridian code is touched. <b>Per ADR-0016.</b>
        </p>
      </Section>

      <Section title="Trace evidence (last run)">
        <table className={s.table}>
          <thead><tr><th>Step</th><th>Citations</th><th>Status</th></tr></thead>
          <tbody>
            <tr>
              <td>loan-intake</td>
              <td><code>[Foundry] BANK-002</code></td>
              <td>completed · confidence 0.93</td>
            </tr>
            <tr>
              <td>evaluate-eligibility</td>
              <td><code>[Foundry] BANK-001</code> · <code>[FabricIQ] BORROWER_HISTORY/BOR-013</code> · <code>[tool] credit-bureau-lookup</code></td>
              <td>completed · confidence 0.88</td>
            </tr>
          </tbody>
        </table>
        <Callout>
          <b>Critical check:</b> the trace contains zero <code>PAC-*</code>, <code>POLICYHOLDER_HISTORY</code>, or
          <code>SIMILAR_CLAIMS</code> citations. The <code>industry</code> filter on Azure AI Search and the
          <code>schemaBinding</code> on Fabric IQ both work as designed.
        </Callout>
      </Section>

      <Section title="What this proves about the platform">
        <div className={s.threeCol}>
          <InfoCard label="L5 sources" title="Generic enough">
            All three sources (Foundry IQ, Fabric IQ, Work IQ) handled banking without code changes. The schema-aware
            primitive made Fabric IQ idiomatic for a non-insurance shape.
          </InfoCard>
          <InfoCard label="Tool runtime" title="Industry-composable">
            <code>IndustryAwareToolRegistry</code> composes the right tool kit at run-time from <code>Package.Industry</code>.
            Banking gets <code>BorrowerProfileTool</code> + <code>CreditBureauLookupTool</code>; Meridian gets its 4 tools.
            No tool-id collisions.
          </InfoCard>
          <InfoCard label="Boundary CI" title="Holds at the import level">
            <code>scripts/check-boundary.mjs</code> passes. Nothing under <code>platform/src/</code> references
            <code>usecases/</code>. The tool-kit exception is allow-listed and only fires for the two registered kits.
          </InfoCard>
        </div>
      </Section>
    </div>
  );
}
