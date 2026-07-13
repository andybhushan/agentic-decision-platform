// The guided demo: ten beats over the live console. Narration follows DEMO-RUNBOOK.md;
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
      "ADP is use-case-agnostic: the same platform runs Meridian's auto claims (blue) and Northwind Bank's loan origination (purple), each with its own client-branded front door. A use case is a signed package of agents the platform compiles and executes; nothing here is hardcoded to an industry.",
    action: "Scan the two use-case cards and their portals: claims and lending, same machinery.",
  },
  {
    id: "frontdoor",
    title: "3 · The front door, with real evidence",
    path: "/member",
    narration:
      "Claims enter the way real customers file them: sign in as a member, report an accident in two minutes, and upload photos of the damage. GPT-4o vision reads the photos once at intake, and the tracker shows the member 'what our AI saw' plus the repair estimate the agents produce. A police report PDF attaches the same way; on the banking side, applicants upload payslips and the AI reads the figures.",
    action: "File a claim with a photo, or open a decided claim's tracker to see the assessment and estimate.",
  },
  {
    id: "run",
    title: "4 · Watch it decide (the hero)",
    path: "/decisions",
    narration:
      "The adjuster works decisions, not documents. Open a claim: the lifecycle rail shows the whole process (intake, damage, fraud screen, settlement). Run a stage and four agents stream live on GPT-4o, grounded, scored, and journaled step by step.",
    action: "Open a claim from the queue and press Run; watch the steps stream in.",
  },
  {
    id: "runtime",
    title: "5 · Choose the engine",
    path: "/decisions",
    narration:
      "The runtime is swappable per run: the same signed package executes on Microsoft Agent Framework or on Azure AI Foundry Agent Service, chosen from the dropdown next to the Run button. The Foundry path hosts the agents as persistent agents you can open in the AI Foundry portal. Same grounding, same gates, same journal: that is what portable means here.",
    action: "Flip the runtime dropdown to Foundry Agent Service and run the stage again.",
  },
  {
    id: "grounding",
    title: "6 · Grounded by the IQ federation",
    path: "/decisions",
    narration:
      "Every step cites its evidence, attributed to the system that produced it: Foundry IQ knowledge documents, the live Fabric IQ Data Agent answering over the ontology and lakehouse (claims and lending tables alike), and Work IQ collaboration context. The model cites its sources; hallucination is a visible, measurable exception.",
    action: "In the trace, hover the evidence chips: blue is Foundry IQ, cyan is Fabric IQ, gray is Work IQ.",
  },
  {
    id: "hitl",
    title: "7 · It knows what it doesn't know",
    path: "/decisions",
    narration:
      "When a step's confidence drops below its declared threshold, a gate fires automatically and the run pauses for a human. Photo evidence participates: ambiguous or contradictory images gate organically, and the fraud screen compares what the photos show against what the narrative claims. The judgment is journaled immutably alongside the agent steps.",
    action: "Run again with Force review gate on, then resolve the gate in the right rail.",
  },
  {
    id: "assistants",
    title: "8 · Ask the platform",
    path: "/decisions",
    narration:
      "Two conversational surfaces, two entitlements. Members chat with their account assistant in the portals, grounded only in their own records; fraud detail cannot leak because it is never in the context. Operators use the Platform copilot: a Microsoft Agent Framework agent with three tools (the decision journal, subject records, and the Fabric IQ Data Agent) that cites its sources as chips and links straight into Decision Mode.",
    action:
      "Close this guide for a moment, open the Platform copilot bottom-right, and ask which subjects are waiting for judgment. Reopen the guide from the play button; it resumes right here.",
  },
  {
    id: "outcomes",
    title: "9 · The COO's view",
    path: "/outcomes",
    narration:
      "Every run lands in the outcomes dashboard: throughput, grounding rate, confidence, and cycle-time percentiles per digital worker, filterable per use case. The governance insights row tells the trust story: where the evidence came from (the IQ federation mix), the confidence distribution that explains the gate policy, and how often humans agreed with the agents versus overrode them.",
    action: "Flip the use-case lens, then walk the three governance insight charts.",
  },
  {
    id: "governance",
    title: "10 · Why it can ship",
    path: "/agents",
    narration:
      "Governance is the feature. The Agents page is the control view: every digital worker with its declared identity, guardrails, and journal-observed behavior, plus the platform assistants themselves. Any decision prints as a Decision Record: the audit artifact a regulator can walk, citation by citation, judgment by judgment. And the whole build is documented on the platform, at Docs, including a downloadable diagram library.",
    action: "Show the Agents page, print a Decision Record, and land on Docs to close.",
  },
];
