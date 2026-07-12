// The guided demo: eight beats over the live console. Narration follows DEMO-RUNBOOK.md;
// each beat says where to be and what to do or notice. ADP / Meridian / Northwind branding only.

export interface DemoBeat {
  id: string;
  title: string;
  path: string;
  narration: string;
  action?: string;
}

export const DEMO_BEATS: DemoBeat[] = [
  {
    id: "brief",
    title: "1 · The client",
    path: "/",
    narration:
      "Meridian Mutual, a P&C auto carrier, loses money to claims leakage and slow FNOL handling, and its regulators expect every AI decision to be explainable. That is the problem this platform decides.",
  },
  {
    id: "platform",
    title: "2 · One platform, many use cases",
    path: "/",
    narration:
      "ADP is use-case-agnostic: the same platform runs Meridian's auto claims and Northwind Bank's loan origination, each with its own client-branded front door. A use case is a signed package of agents the platform compiles and executes; nothing here is hardcoded to an industry.",
    action: "Scan the use cases and their portals below: claims and lending, same machinery.",
  },
  {
    id: "frontdoor",
    title: "3 · The front door",
    path: "/member",
    narration:
      "Claims enter the system the way real customers file them. Sign in as a Meridian member: your policy, vehicle, and history are already on file; reporting an accident takes two minutes and works on a phone. The moment you submit, the claim is queued for the operators.",
    action: "Sign in as any member and file a claim, or just note the experience and move on.",
  },
  {
    id: "run",
    title: "4 · Watch it decide (the hero)",
    path: "/decisions",
    narration:
      "The adjuster works decisions, not documents. Open a claim: the lifecycle rail shows the whole process (intake, damage, fraud screen, settlement). Run a stage and four agents stream live on GPT-4o, orchestrated by Microsoft Agent Framework.",
    action: "Open a claim from the queue and press Run; watch the steps stream in.",
  },
  {
    id: "grounding",
    title: "5 · Grounded by the IQ federation",
    path: "/decisions",
    narration:
      "Every step cites its evidence, attributed to the system that produced it: Foundry IQ knowledge documents, the live Fabric IQ Data Agent answering over the ontology and lakehouse, and Work IQ collaboration context. The model cites its sources; hallucination is a visible, measurable exception.",
    action: "In the trace, hover the evidence chips: blue is Foundry IQ, cyan is Fabric IQ, gray is Work IQ.",
  },
  {
    id: "hitl",
    title: "6 · It knows what it doesn't know",
    path: "/decisions",
    narration:
      "When a step's confidence drops below its declared threshold, a gate fires automatically and the run pauses for a human. The reviewer approves or escalates with full rationale, and that judgment is journaled immutably alongside the agent steps.",
    action: "Run again with Force review gate on, then resolve the gate in the right rail.",
  },
  {
    id: "outcomes",
    title: "7 · The COO's view",
    path: "/outcomes",
    narration:
      "Every run lands in the outcomes dashboard: subjects decided, grounded-step rate, average confidence, human reviews, straight from the immutable journal, filterable per use case.",
    action: "Flip the use-case lens between claims and lending.",
  },
  {
    id: "governance",
    title: "8 · Why it can ship",
    path: "/agents",
    narration:
      "Governance is the feature. The Agents page is the control view: every digital worker with its declared identity, guardrails, and journal-observed behavior. And any decision can be printed as a Decision Record: the audit artifact a regulator can walk, entity by entity, citation by citation, judgment by judgment.",
    action: "Show the Agents page, then open any decided claim and print its Decision Record.",
  },
];
