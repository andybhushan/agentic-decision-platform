// ARCHIVED � workforce data is now served from Cosmos DB via GET /api/v1/workforces
// Demo workforce data derived from the Claims end-to-end process (Claims.json).
// A "Workforce" bundles multiple Digital Workers (agentic orchestrators), each of
// which coordinates a set of agent tasks and human steps to deliver an end-to-end
// business process - as opposed to an individual worker (point solution).

export type WorkforceMemberKind =
  | 'orchestrator'
  | 'agent'
  | 'human'
  | 'rules'
  | 'system'
  | 'channel';

export type AuthorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface MemberIO {
  name: string;
  description: string;
}

export interface MemberGovernance {
  authorityLevel: AuthorityLevel;
  humanInLoop?: string[];
  boundaries?: string[];
}

export interface WorkforceMember {
  id: string;
  name: string;
  kind: WorkforceMemberKind;
  role: string;
  capability?: string;
  /** Optional richer fields. When omitted, sensible defaults are derived by kind. */
  description?: string;
  capabilities?: string[];
  inputs?: MemberIO[];
  outputs?: MemberIO[];
  governance?: MemberGovernance;
}

export interface WorkforceStage {
  id: string;
  name: string;
  summary: string;
  /** What this stage hands off to the next stage in the process. */
  handoff: string;
  /** Stage ids of the Digital Workers this stage's orchestrator coordinates (DSL adjacency). */
  coordinates?: string[];
  members: WorkforceMember[];
}

export interface Workforce {
  id: string;
  name: string;
  vertical: string;
  description: string;
  outcome: string;
  /** Ordered Digital Workers that make up the end-to-end process. */
  stages: WorkforceStage[];
}

export const claimsWorkforce: Workforce = {
  id: 'wf_claims_e2e',
  name: 'Claims Processing Workforce',
  vertical: 'Insurance',
  description:
    'A coordinated team of Digital Workers that takes an insurance claim from first notification of loss all the way through to settlement and closure, with continuous compliance oversight. Each Digital Worker orchestrates several specialist agents and hands off to the next.',
  outcome: 'First notification of loss → validated, assessed, settled and closed claim',
  stages: [
    {
      id: 'wf_channels',
      name: 'Intake Channels',
      summary:
        'Four channel-specific FNOL orchestrations, each tailored to its intake method. Every channel guides the claimant through first notification of loss and produces a normalised claim package handed off to the Claim Digital Worker.',
      handoff: 'Normalised claim package → Claim Digital Worker',
      members: [
        {
          id: 'N2',
          name: 'Web Intake',
          kind: 'channel',
          role: 'Conversational web self-service FNOL. Guides the claimant through intake, validates identity, collects evidence and normalises the result into a canonical claim package.',
          capability: 'Web Channel',
        },
        {
          id: 'N3',
          name: 'Mobile Intake',
          kind: 'channel',
          role: 'Mobile FNOL orchestration. Captures GPS location, photos and telematics data alongside loss details; normalises into the canonical claim package.',
          capability: 'Mobile Channel',
        },
        {
          id: 'N4',
          name: 'Call Centre',
          kind: 'channel',
          role: 'Voice FNOL orchestration. Transcribes the call, extracts structured data via NLP and provides real-time agent-assist; normalises into the canonical claim package.',
          capability: 'Voice Channel',
        },
        {
          id: 'N5',
          name: 'Branch',
          kind: 'channel',
          role: 'In-person FNOL orchestration. Supports CSR-assisted intake, paper document scanning and in-person identity verification; normalises into the canonical claim package.',
          capability: 'Branch Channel',
        },
      ],
    },
    {
      id: 'wf_intake',
      name: 'Claim Digital Worker',
      summary:
        'Receives the normalised claim package from any intake channel and orchestrates the full post-intake processing pipeline — Doc Review, Fraud, Policy, Settlement — with Compliance running continuously alongside.',
      handoff: 'Structured claim record → Doc Review',
      coordinates: ['wf_docreview', 'wf_fraud', 'wf_policy', 'wf_settlement', 'wf_compliance'],
      members: [
        {
          id: 'N7',
          name: 'Claim Digital Worker',
          kind: 'orchestrator',
          role: 'Post-intake orchestrator. Coordinates the full processing pipeline across Doc Review, Fraud, Policy, Settlement and Compliance.',
          capability: 'Claims Processing',
        },
        {
          id: 'N6',
          name: 'System of Record',
          kind: 'system',
          role: 'Core claims platform. The CDW creates the claim record here on receipt; every downstream digital worker reads and writes to it throughout processing.',
        },
        {
          id: 'N8',
          name: 'Doc Review Digital Worker',
          kind: 'orchestrator',
          role: 'Orchestrates document understanding and evidence collection.',
          capability: 'Evidence Collection',
        },
        {
          id: 'N12',
          name: 'Fraud Digital Worker',
          kind: 'orchestrator',
          role: 'Orchestrates the fraud assessment pipeline.',
          capability: 'Fraud Assessment',
        },
        {
          id: 'N20',
          name: 'Policy Digital Worker',
          kind: 'orchestrator',
          role: 'Orchestrates coverage determination and explainability.',
          capability: 'Policy Review',
        },
        {
          id: 'N28',
          name: 'Settlement Digital Worker',
          kind: 'orchestrator',
          role: 'Orchestrates settlement calculation, payment and closure.',
          capability: 'Settlement',
        },
        {
          id: 'N22',
          name: 'Compliance Agent',
          kind: 'orchestrator',
          role: 'Cross-cutting regulatory oversight running alongside the entire pipeline.',
          capability: 'Compliance',
        },
      ],
    },
    {
      id: 'wf_docreview',
      name: 'Doc Review Digital Worker',
      summary:
        'Ingests and understands submitted documents and evidence. Classifies, extracts and validates data, routing low-confidence cases to a human reviewer.',
      handoff: 'Validated evidence + extracted data → Fraud',
      members: [
        {
          id: 'N8',
          name: 'Doc Review Digital Worker',
          kind: 'orchestrator',
          role: 'Orchestrates document understanding and evidence collection.',
          capability: 'Evidence Collection',
        },
        { id: 'N10', name: 'Data Classifier', kind: 'agent', role: 'Classifies incoming documents by type.' },
        { id: 'N9', name: 'Data Extraction', kind: 'agent', role: 'Extracts structured fields from documents.' },
        { id: 'N19', name: 'Data Validation', kind: 'agent', role: 'Validates extracted data against expected schema.' },
        { id: 'N11', name: 'Low Confidence Review', kind: 'human', role: 'Claims handler reviews low-confidence extractions.' },
        { id: 'N18', name: 'Investigation', kind: 'human', role: 'Manual investigation for unclear cases.' },
      ],
    },
    {
      id: 'wf_fraud',
      name: 'Fraud Digital Worker',
      summary:
        'Assesses fraud risk using rules, scoring, network analysis and external data, then ranks the claim. High-risk cases escalate to a deep fraud review.',
      handoff: 'Fraud ranking + signals → Policy',
      members: [
        {
          id: 'N12',
          name: 'Fraud Digital Worker',
          kind: 'orchestrator',
          role: 'Orchestrates the fraud assessment pipeline.',
          capability: 'Fraud Assessment',
        },
        { id: 'N13', name: 'Rules Engine', kind: 'rules', role: 'Evaluates eligibility and fraud rules.' },
        { id: 'N14', name: 'Fraud Score', kind: 'agent', role: 'Produces a model-based fraud score.' },
        { id: 'N15', name: 'Network Analysis', kind: 'agent', role: 'Detects organised-fraud network patterns.' },
        { id: 'N16', name: 'External Data Checks', kind: 'agent', role: 'Checks third-party and watchlist data.' },
        { id: 'N17', name: 'Fraud Ranking', kind: 'agent', role: 'Combines signals into a ranked fraud risk.' },
        { id: 'N29', name: 'Deep Fraud Review', kind: 'human', role: 'Specialist reviews high-risk claims.' },
      ],
    },
    {
      id: 'wf_policy',
      name: 'Policy Digital Worker',
      summary:
        'Determines coverage against the policy, reasons about applicability and produces an explainable decision. Ambiguous cases escalate; claimants are kept informed.',
      handoff: 'Coverage decision + rationale → Settlement',
      members: [
        {
          id: 'N20',
          name: 'Policy Digital Worker',
          kind: 'orchestrator',
          role: 'Orchestrates coverage determination.',
          capability: 'Policy Review',
        },
        { id: 'N21', name: 'Policy Review', kind: 'agent', role: 'Matches the claim against policy terms.' },
        { id: 'N23', name: 'Reasoning Engine', kind: 'agent', role: 'Reasons over coverage applicability.' },
        { id: 'N24', name: 'Explainer Agent', kind: 'agent', role: 'Generates a plain-language decision rationale.' },
        { id: 'N25', name: 'Escalation', kind: 'human', role: 'Handles ambiguous coverage decisions.' },
        { id: 'N27', name: 'Outreach', kind: 'agent', role: 'Communicates updates and requests to the claimant.' },
      ],
    },
    {
      id: 'wf_settlement',
      name: 'Settlement Digital Worker',
      summary:
        'Calculates the settlement, runs sanctions/AML checks, makes payment and closes the claim. Negotiation is handled by a human where required.',
      handoff: 'Paid & closed claim → Compliance oversight',
      members: [
        {
          id: 'N28',
          name: 'Settlement',
          kind: 'orchestrator',
          role: 'Orchestrates settlement, payment and closure.',
          capability: 'Settlement',
        },
        { id: 'N31', name: 'Settlement Calculation', kind: 'agent', role: 'Calculates the settlement amount.' },
        { id: 'N32', name: 'Negotiation', kind: 'human', role: 'Human negotiates final settlement terms.' },
        { id: 'N33', name: 'Sanctions / AML', kind: 'agent', role: 'Runs sanctions and anti-money-laundering checks.' },
        { id: 'N34', name: 'Payment', kind: 'agent', role: 'Executes the payment to the claimant.' },
        { id: 'N35', name: 'Closure & Indexing', kind: 'agent', role: 'Closes and indexes the claim record.' },
      ],
    },
    {
      id: 'wf_compliance',
      name: 'Compliance Agent',
      summary:
        'Cross-cutting oversight running alongside the whole process. Captures telemetry, detects anomalies, samples cases, builds evidence packs and feeds improvements back in. All actions are logged for audit replay.',
      handoff: 'Audit evidence + improvement signals → continuous improvement',
      members: [
        {
          id: 'N22',
          name: 'Compliance Agent',
          kind: 'orchestrator',
          role: 'Coordinates regulatory oversight across the workforce.',
          capability: 'Compliance',
        },
        { id: 'N37', name: 'Telemetry', kind: 'agent', role: 'Captures process telemetry.' },
        { id: 'N38', name: 'Anomaly Detection', kind: 'agent', role: 'Flags anomalous process behaviour.' },
        { id: 'N39', name: 'Sampling Agent', kind: 'agent', role: 'Samples cases for quality assurance.' },
        { id: 'N40', name: 'Evidence Packs', kind: 'agent', role: 'Assembles regulator-ready evidence packs.' },
        { id: 'N41', name: 'Compliance Checker', kind: 'agent', role: 'Checks adherence to regulatory controls.' },
        { id: 'N42', name: 'Improvements', kind: 'agent', role: 'Recommends process improvements.' },
      ],
    },
  ],
};

export const workforces: Workforce[] = [claimsWorkforce];

export interface FoundMember {
  member: WorkforceMember;
  stage: WorkforceStage;
  workforce: Workforce;
}

/** Locate a workforce member (and its containing stage) by member id. */
export function findMember(memberId: string): FoundMember | undefined {
  for (const workforce of workforces) {
    for (const stage of workforce.stages) {
      const member = stage.members.find((m) => m.id === memberId);
      if (member) return { member, stage, workforce };
    }
  }
  return undefined;
}

export function findStageById(stageId: string): WorkforceStage | undefined {
  for (const workforce of workforces) {
    const stage = workforce.stages.find((s) => s.id === stageId);
    if (stage) return stage;
  }
  return undefined;
}

/** Non-orchestrator members of a stage (the agents / steps it runs directly). */
export function stageAgents(stage: WorkforceStage): WorkforceMember[] {
  return stage.members.filter((m) => m.kind !== 'orchestrator');
}

export function stageOrchestrator(stage: WorkforceStage): WorkforceMember | undefined {
  return stage.members.find((m) => m.kind === 'orchestrator');
}

/** A node in the coordination tree shown on an orchestrator's page. */
export interface CoordinatedWorker {
  stage: WorkforceStage;
  orchestrator: WorkforceMember;
  agents: WorkforceMember[];
  children: CoordinatedWorker[];
}

/**
 * Build the tree of Digital Workers coordinated (directly and transitively) by a
 * stage, following the DSL adjacency in `stage.coordinates`. A visited set guards
 * against cycles; unknown stage ids are skipped; order follows the workforce order.
 */
export function buildCoordinationTree(
  stage: WorkforceStage,
  visited: Set<string> = new Set([stage.id]),
): CoordinatedWorker[] {
  const childIds = stage.coordinates ?? [];
  const result: CoordinatedWorker[] = [];
  for (const childId of childIds) {
    if (visited.has(childId)) continue;
    const childStage = findStageById(childId);
    if (!childStage) continue;
    const orchestrator = stageOrchestrator(childStage);
    if (!orchestrator) continue;
    visited.add(childId);
    result.push({
      stage: childStage,
      orchestrator,
      agents: stageAgents(childStage),
      children: buildCoordinationTree(childStage, visited),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Demo enrichment. The workforce is a static blueprint, so per-member detail is
// derived from the member kind + its role/stage rather than a backend record.
// ---------------------------------------------------------------------------

export interface EnrichedMember {
  description: string;
  capabilities: string[];
  inputs: MemberIO[];
  outputs: MemberIO[];
  governance: MemberGovernance;
}

const authorityByKind: Record<WorkforceMemberKind, AuthorityLevel> = {
  orchestrator: 'High',
  agent: 'Medium',
  rules: 'Medium',
  human: 'Critical',
  system: 'Low',
  channel: 'Low',
};

function defaultCapabilities(member: WorkforceMember, stage: WorkforceStage): string[] {
  const cap = member.capability;
  switch (member.kind) {
    case 'orchestrator':
      return [
        `Owns the ${cap ?? stage.name} outcome end-to-end`,
        'Coordinates specialist agents and human steps',
        'Routes work and handles exceptions and escalations',
        'Maintains process state and a full audit trail',
      ];
    case 'agent':
      return [
        member.role,
        cap ? `Specialised in ${cap}` : 'Autonomous task execution within guardrails',
        'Emits confidence scores and structured results',
      ];
    case 'rules':
      return [
        'Deterministic rule and eligibility evaluation',
        'Explainable pass / fail / refer decisions',
        'Configurable policy and fraud rule sets',
      ];
    case 'human':
      return [
        'Human judgement, review and sign-off',
        'Exception handling for low-confidence cases',
        'Accountable decision of record',
      ];
    case 'system':
      return [
        'System of record and source of truth',
        'Durable storage of claims, decisions and payments',
        'Serves data to every Digital Worker',
      ];
    case 'channel':
      return [
        'Customer interaction capture',
        'Omnichannel first notification of loss',
        'Normalises intake into a structured claim',
      ];
  }
}

function defaultInputs(member: WorkforceMember, stage: WorkforceStage): MemberIO[] {
  switch (member.kind) {
    case 'orchestrator':
      return [
        { name: 'Upstream handoff', description: `Work and context entering the ${stage.name} stage.` },
        { name: 'Policy & rules context', description: 'Governing policy terms, SLAs and business rules.' },
      ];
    case 'channel':
      return [
        { name: 'Customer submission', description: 'Loss details supplied by the policyholder.' },
        { name: 'Policy reference', description: 'Policy number or customer identity for matching.' },
      ];
    case 'system':
      return [
        { name: 'Claim record updates', description: 'Reads and writes from every Digital Worker.' },
      ];
    case 'human':
      return [
        { name: 'Flagged case', description: 'A low-confidence or exception case routed for review.' },
        { name: 'Evidence & context', description: 'Supporting documents and prior agent findings.' },
      ];
    default:
      return [
        { name: 'Structured claim data', description: `Claim context for the ${stage.name} stage.` },
        { name: 'Upstream signals', description: 'Outputs from preceding agents in the pipeline.' },
      ];
  }
}

function defaultOutputs(member: WorkforceMember, stage: WorkforceStage): MemberIO[] {
  switch (member.kind) {
    case 'orchestrator':
      return [
        { name: 'Stage outcome', description: stage.handoff },
        { name: 'Audit events', description: 'Structured decision and action log for compliance replay.' },
      ];
    case 'channel':
      return [{ name: 'Raw claim', description: 'Normalised intake payload passed to the Claim Digital Worker.' }];
    case 'system':
      return [{ name: 'Authoritative record', description: 'Current state of the claim, decisions and payment status.' }];
    case 'human':
      return [{ name: 'Decision of record', description: 'Reviewed outcome with rationale and sign-off.' }];
    case 'rules':
      return [{ name: 'Rule verdict', description: 'Pass / fail / refer with the rules that fired.' }];
    default:
      return [
        { name: 'Result + confidence', description: 'Agent output with a confidence score.' },
        { name: 'Signals', description: 'Findings handed downstream in the pipeline.' },
      ];
  }
}

function defaultHumanInLoop(member: WorkforceMember): string[] | undefined {
  switch (member.kind) {
    case 'orchestrator':
      return ['Low-confidence and exception cases are routed to a human reviewer.'];
    case 'human':
      return ['This step is performed by a person and is accountable for the decision.'];
    case 'agent':
      return ['Results below the confidence threshold are escalated for human review.'];
    default:
      return undefined;
  }
}

function defaultBoundaries(member: WorkforceMember): string[] | undefined {
  switch (member.kind) {
    case 'agent':
      return ['Operates only within its defined task scope', 'Cannot finalise payment or close a claim alone'];
    case 'orchestrator':
      return ['Delegates specialist work to its agents', 'Cannot override regulatory or compliance controls'];
    case 'channel':
      return ['Captures intake only — performs no assessment'];
    case 'system':
      return ['Stores and serves data — makes no decisions'];
    default:
      return undefined;
  }
}

/** Produce a fully-populated demo profile for a member, honouring any explicit fields. */
export function enrichMember(member: WorkforceMember, stage: WorkforceStage): EnrichedMember {
  return {
    description: member.description ?? member.role,
    capabilities: member.capabilities ?? defaultCapabilities(member, stage),
    inputs: member.inputs ?? defaultInputs(member, stage),
    outputs: member.outputs ?? defaultOutputs(member, stage),
    governance:
      member.governance ?? {
        authorityLevel: authorityByKind[member.kind],
        humanInLoop: defaultHumanInLoop(member),
        boundaries: defaultBoundaries(member),
      },
  };
}

