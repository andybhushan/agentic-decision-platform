import { randomUUID } from 'crypto';
import type { Claim, ClientServiceTier, ClaimHandlingMode, CustomerPersona } from '../types';
import type { Policy } from './policyService';
import { createPolicy } from './policyService';
import { ClaimsService } from './claimsService';
import { CosmosRepository } from './cosmosRepository';
import { getAdjusterProfiles } from './adjusterDataService';
import { recordInteraction } from './interactionService';
import { AgentService } from './agentService';
import type { Agent } from '../types';
import { clearAllInteractions } from './cosmosService';

type ScenarioProfile =
  | 'straightforward-collision'
  | 'injury-liability'
  | 'fraud-suspected'
  | 'high-value-loss'
  | 'late-notification';

export interface SeededClaimSuite {
  id: string;
  name: string;
  seed: string;
  totalCases: number;
  lineOfBusiness: 'Auto';
  status: 'draft' | 'generated' | 'executed' | 'evaluated' | 'archived';
  createdAt: string;
  updatedAt: string;
  metadata: {
    generatedBy: string;
    generatorVersion: string;
    persistedAsRealAssets: true;
  };
}

export interface SeededClaimCase {
  id: string;
  suiteId: string;
  caseNumber: number;
  claimId: string;
  policyRef: string;
  claimantName: string;
  clientTier: ClientServiceTier;
  scenarioProfile: ScenarioProfile;
  expectedHandlingMode: ClaimHandlingMode;
  expectedSeniorAdjuster: boolean;
  expectedSettlementBand: 'low' | 'medium' | 'high';
  assignmentPolicyFlags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SeededSuiteRun {
  id: string;
  suiteId: string;
  createdAt: string;
  agentIds: string[];
  executionPlan: {
    deployedAgentIds: string[];
    mockedAgentIds: string[];
  };
  summary: {
    processedCases: number;
    closedCases: number;
    settlementCases: number;
    totalEstimatedCostUsd: number;
    policyFlagCount: number;
  };
  perCase: Array<{
    caseId: string;
    claimId: string;
    finalStage: Claim['claimStage'];
    finalOwner: string | null;
    policyFlags: string[];
    estimatedCostUsd: number;
  }>;
}

export interface SeededSuiteEvaluation {
  id: string;
  suiteId: string;
  runId: string;
  createdAt: string;
  scores: {
    assignmentAccuracy: number;
    whiteGloveRoutingAccuracy: number;
    closureRate: number;
    policyFlagRate: number;
    avgCostPerCaseUsd: number;
  };
  findings: string[];
}

const suiteRepo = new CosmosRepository<SeededClaimSuite>('seeded-claim-suites');
const caseRepo = new CosmosRepository<SeededClaimCase>('seeded-claim-suite-cases');
const runRepo = new CosmosRepository<SeededSuiteRun>('seeded-claim-suite-runs');
const evalRepo = new CosmosRepository<SeededSuiteEvaluation>('seeded-claim-suite-evals');
const claimsRepo = new CosmosRepository<Claim>('claims');
const policiesRepo = new CosmosRepository<Policy>('policies');
const personasRepo = new CosmosRepository<CustomerPersona>('customer-personas');
const fnolSessionsRepo = new CosmosRepository<{ id: string }>('fnol-sessions');

const claimsService = new ClaimsService();
const agentService = new AgentService();

const RICHARD_PERSONA_ID = 'cust_richard_hogan';
const RICHARD_HOLDER_NAME = 'richard hogan';
const RICHARD_POLICY_REF = 'POL-AUTO-US-2026-RH01';

type SuiteExecutionAgent = {
  id: string;
  name: string;
  deployed: boolean;
};

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], rnd: () => number): T {
  return items[Math.floor(rnd() * items.length)];
}

function randomInt(min: number, max: number, rnd: () => number): number {
  return Math.floor(min + rnd() * (max - min + 1));
}

function handlingModeForTier(tier: ClientServiceTier): ClaimHandlingMode {
  if (tier === 'signature' || tier === 'white_glove') return 'human';
  if (tier === 'priority') return 'ai_oversight';
  return 'ai';
}

function inferExpectedSeniorAdjuster(tier: ClientServiceTier): boolean {
  return tier === 'signature' || tier === 'white_glove' || tier === 'priority';
}

function inferSettlementBand(profile: ScenarioProfile): 'low' | 'medium' | 'high' {
  if (profile === 'high-value-loss') return 'high';
  if (profile === 'injury-liability' || profile === 'fraud-suspected') return 'medium';
  return 'low';
}

function policyFromCase(caseNumber: number, claimantName: string, tier: ClientServiceTier, rnd: () => number): Omit<Policy, 'id'> {
  const regPrefix = ['AX', 'BY', 'CK', 'DM', 'EN', 'FP', 'GQ', 'HR'][caseNumber % 8];
  const policyRef = `POL-AUTO-SEEDED-${String(caseNumber).padStart(4, '0')}`;
  return {
    policyRef,
    policyType: tier === 'signature' || tier === 'white_glove' ? 'Prestige Motor' : 'Motor',
    holderName: claimantName,
    holderEmail: `${claimantName.toLowerCase().replace(/\s+/g, '.')}@example.co.uk`,
    holderPhone: `+44-7700-${String(randomInt(100000, 999999, rnd))}`,
    address: `${randomInt(10, 240, rnd)} Test Street, London`,
    coverageType: tier === 'white_glove' ? 'Prestige Motor — Agreed Value' : 'Comprehensive Motor',
    coverageActive: true,
    startDate: '2026-01-01',
    renewalDate: '2027-01-01',
    annualPremium: tier === 'white_glove' ? randomInt(7000, 14000, rnd) : randomInt(650, 2400, rnd),
    excessAmount: tier === 'white_glove' ? randomInt(750, 2000, rnd) : randomInt(150, 600, rnd),
    noClaims: randomInt(0, 9, rnd),
    vehicles: [
      {
        make: tier === 'white_glove' ? pick(['Mercedes-Benz', 'BMW', 'Porsche', 'Audi'], rnd) : pick(['Ford', 'Volkswagen', 'Toyota', 'Honda'], rnd),
        model: tier === 'white_glove' ? pick(['S-Class', '7 Series', 'Panamera', 'A8'], rnd) : pick(['Focus', 'Golf', 'Corolla', 'Civic'], rnd),
        registration: `${regPrefix}${randomInt(10, 99, rnd)} SEE`,
        year: randomInt(2019, 2025, rnd),
        colour: pick(['Black', 'Silver', 'Blue', 'White'], rnd),
        value: tier === 'white_glove' ? randomInt(70000, 260000, rnd) : randomInt(12000, 42000, rnd),
      },
    ],
    namedDrivers: [claimantName],
    notes: `Seeded suite policy for case ${caseNumber}`,
  };
}

function buildSubmission(
  claimantName: string,
  policyRef: string,
  profile: ScenarioProfile,
  rnd: () => number,
): {
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  incidentType: 'Auto';
  incidentDate: string;
  incidentLocation: string;
  partiesInvolved: Array<{ name: string; role: string }>;
  injuryIndicated: boolean;
  immediateNeeds: string[];
  preferredContactChannel: 'Email' | 'SMS' | 'Phone';
  incidentDescription: string;
  policyRef: string;
} {
  const injury = profile === 'injury-liability' || (profile === 'fraud-suspected' && rnd() < 0.5);
  const descriptions: Record<ScenarioProfile, string> = {
    'straightforward-collision': 'Rear-end collision at low speed in urban traffic. Third party details exchanged and damage moderate.',
    'injury-liability': 'Side-impact collision at junction with soft tissue injury report and disputed liability narrative.',
    'fraud-suspected': 'Late-night incident with inconsistent witness timeline and potential staged-collision indicators.',
    'high-value-loss': 'High-value vehicle severe front-end impact with potential total loss and expensive replacement logistics.',
    'late-notification': 'Incident reported several weeks after occurrence with partial document trail and delayed evidence.',
  };
  return {
    claimantName,
    claimantEmail: `${claimantName.toLowerCase().replace(/\s+/g, '.')}@example.co.uk`,
    claimantPhone: `+44-7700-${String(randomInt(100000, 999999, rnd))}`,
    incidentType: 'Auto',
    incidentDate: `2026-${String(randomInt(1, 6, rnd)).padStart(2, '0')}-${String(randomInt(1, 28, rnd)).padStart(2, '0')}`,
    incidentLocation: `${pick(['A40', 'M4', 'M25', 'A1', 'Park Lane'], rnd)} corridor`,
    partiesInvolved: [
      { name: claimantName, role: 'Claimant Driver' },
      { name: pick(['Alex Brown', 'Jordan Smith', 'Taylor Jones', 'Chris Evans'], rnd), role: 'Third Party Driver' },
    ],
    injuryIndicated: injury,
    immediateNeeds: injury ? ['Medical Support', 'Courtesy Vehicle'] : ['Vehicle Recovery'],
    preferredContactChannel: pick(['Email', 'SMS', 'Phone'], rnd),
    incidentDescription: descriptions[profile],
    policyRef,
  };
}

function emitSeedGenerationTelemetry(opts: {
  suiteId: string;
  caseNumber: number;
  claimId: string;
  claimantName: string;
  scenarioProfile: ScenarioProfile;
  clientTier: ClientServiceTier;
  assignmentPolicyFlags: string[];
  rnd: () => number;
}): void {
  const fnolInputTokens = randomInt(450, 2200, opts.rnd);
  const fnolOutputTokens = randomInt(180, 980, opts.rnd);
  const fnolCost = Number((((fnolInputTokens + fnolOutputTokens) / 1000) * 0.016).toFixed(6));
  const hasTierViolation = opts.assignmentPolicyFlags.includes('policy.white_glove_routing_breach');

  recordInteraction({
    agentId: 'fnol-session-service',
    sessionId: `suite-generate-${opts.suiteId}-${opts.caseNumber}`,
    claimId: opts.claimId,
    callerId: opts.claimantName,
    interactionType: 'fnol_submit',
    userContent: `Generated FNOL for suite case ${opts.caseNumber}`,
    assistantContent: `Seeded claim captured for ${opts.scenarioProfile}`,
    escalated: false,
    inputTokens: fnolInputTokens,
    outputTokens: fnolOutputTokens,
    meta: {
      durationMs: randomInt(700, 2600, opts.rnd),
      estimatedCostUsd: fnolCost,
      toolCalls: [{ name: 'fnol-schema-validation', success: true }],
      policyEvaluations: [
        {
          policyId: 'policy.intake-completeness',
          outcome: 'passed',
          actionTaken: 'none',
          severity: 'medium',
        },
      ],
      suiteId: opts.suiteId,
      caseNumber: opts.caseNumber,
      seededAsset: true,
    },
  });

  const stewardInputTokens = randomInt(500, 2600, opts.rnd);
  const stewardOutputTokens = randomInt(150, 1100, opts.rnd);
  const stewardCost = Number((((stewardInputTokens + stewardOutputTokens) / 1000) * 0.018).toFixed(6));

  recordInteraction({
    agentId: 'digital-steward',
    sessionId: `suite-generate-${opts.suiteId}-${opts.caseNumber}`,
    claimId: opts.claimId,
    callerId: opts.claimantName,
    interactionType: 'steward_chat',
    userContent: `Evaluate seeded assignment governance for case ${opts.caseNumber}`,
    assistantContent: hasTierViolation ? 'Detected tier routing breach' : 'Assignment policy validated',
    escalated: hasTierViolation,
    inputTokens: stewardInputTokens,
    outputTokens: stewardOutputTokens,
    meta: {
      durationMs: randomInt(900, 3000, opts.rnd),
      estimatedCostUsd: stewardCost,
      governanceOverride: hasTierViolation,
      toolCalls: [{ name: 'assignment-tier-check', success: true }],
      policyEvaluations: [
        {
          policyId: 'policy.assignment-tier',
          outcome: hasTierViolation ? 'violation' : 'passed',
          actionTaken: hasTierViolation ? 'override' : 'none',
          severity: hasTierViolation ? 'critical' : 'medium',
        },
      ],
      assignmentPolicyFlags: opts.assignmentPolicyFlags,
      suiteId: opts.suiteId,
      caseNumber: opts.caseNumber,
      seededAsset: true,
      clientTier: opts.clientTier,
    },
  });
}

async function ensureContainers(): Promise<void> {
  await Promise.all([
    suiteRepo.ensureContainer('/id'),
    caseRepo.ensureContainer('/suiteId'),
    runRepo.ensureContainer('/suiteId'),
    evalRepo.ensureContainer('/suiteId'),
    claimsRepo.ensureContainer('/id'),
    policiesRepo.ensureContainer('/id'),
    personasRepo.ensureContainer('/id'),
    fnolSessionsRepo.ensureContainer('/id'),
  ]);
}

export class SeededClaimsSuiteService {
  private isClaimsAgent(agent: Agent): boolean {
    if (agent.verticalId === 'claims') return true;
    const haystack = `${agent.id} ${agent.name} ${agent.description}`.toLowerCase();
    if (haystack.includes('healthcare')) return false;
    return ['claim', 'fnol', 'policy', 'steward', 'settlement'].some((token) => haystack.includes(token));
  }

  private isAgentDeployed(agent: Agent): boolean {
    return Boolean(agent.deploymentId || agent.deploymentEndpoint || agent.deployedAt);
  }

  private async resolveExecutionAgents(agentIds?: string[]): Promise<SuiteExecutionAgent[]> {
    const allAgents = await agentService.getAll();
    const byId = new Map(allAgents.map((agent) => [agent.id, agent]));
    const fallback: SuiteExecutionAgent[] = [
      { id: 'agent_claims_mobile_intake', name: 'Claims Mobile Intake Agent', deployed: false },
      { id: 'digital-steward', name: 'Digital Steward', deployed: false },
      { id: 'fnol-session-service', name: 'FNOL Session Service', deployed: false },
    ];

    if (agentIds && agentIds.length > 0) {
      const explicit = agentIds.flatMap((id) => {
        const agent = byId.get(id);
        if (!agent) {
          const looksClaims = /(claim|fnol|policy|steward|settlement)/i.test(id) && !/healthcare/i.test(id);
          return looksClaims ? [{ id, name: id, deployed: false }] : [];
        }
        if (!this.isClaimsAgent(agent)) return [];
        return [{ id: agent.id, name: agent.name, deployed: this.isAgentDeployed(agent) }];
      });
      return explicit.length > 0 ? explicit : fallback;
    }

    const claimsAgents = allAgents.filter((agent) => this.isClaimsAgent(agent));
    const deployed = claimsAgents
      .filter((agent) => this.isAgentDeployed(agent))
      .map((agent) => ({ id: agent.id, name: agent.name, deployed: true }));
    const undeployed = claimsAgents
      .filter((agent) => !this.isAgentDeployed(agent))
      .map((agent) => ({ id: agent.id, name: agent.name, deployed: false }));
    const combined = [...deployed, ...undeployed];
    return combined.length > 0 ? combined : fallback;
  }

  async listSuites(): Promise<SeededClaimSuite[]> {
    await ensureContainers();
    return suiteRepo.findAll();
  }

  async getSuite(id: string): Promise<{
    suite: SeededClaimSuite | null;
    cases: SeededClaimCase[];
    runs: SeededSuiteRun[];
    evaluations: SeededSuiteEvaluation[];
  }> {
    await ensureContainers();
    const [suite, cases, runs, evaluations] = await Promise.all([
      suiteRepo.findById(id),
      caseRepo.query<SeededClaimCase>({ query: 'SELECT * FROM c WHERE c.suiteId = @suiteId ORDER BY c.caseNumber ASC', parameters: [{ name: '@suiteId', value: id }] }),
      runRepo.query<SeededSuiteRun>({ query: 'SELECT * FROM c WHERE c.suiteId = @suiteId ORDER BY c.createdAt DESC', parameters: [{ name: '@suiteId', value: id }] }),
      evalRepo.query<SeededSuiteEvaluation>({ query: 'SELECT * FROM c WHERE c.suiteId = @suiteId ORDER BY c.createdAt DESC', parameters: [{ name: '@suiteId', value: id }] }),
    ]);
    return { suite, cases, runs, evaluations };
  }

  async generateSuite(options: {
    count?: number;
    seed?: string;
    name?: string;
    generatedBy?: string;
    autoRun?: boolean;
    agentIds?: string[];
  } = {}): Promise<{ suite: SeededClaimSuite; cases: SeededClaimCase[]; initialRun?: SeededSuiteRun }> {
    await ensureContainers();
    const count = Math.max(1, Math.min(250, options.count ?? 50));
    const seed = options.seed ?? `suite-${Date.now()}`;
    const rnd = mulberry32(hashSeed(seed));
    const suiteId = `suite-${randomUUID()}`;
    const now = new Date().toISOString();

    const suite: SeededClaimSuite = {
      id: suiteId,
      name: options.name ?? `Seeded Auto Suite (${count})`,
      seed,
      totalCases: count,
      lineOfBusiness: 'Auto',
      status: 'generated',
      createdAt: now,
      updatedAt: now,
      metadata: {
        generatedBy: options.generatedBy ?? 'copilot-cli',
        generatorVersion: 'v2-tier-routing',
        persistedAsRealAssets: true,
      },
    };

    const firstNames = ['Emma', 'Oliver', 'Sophie', 'Liam', 'Noah', 'Charlotte', 'James', 'Amelia', 'Ava', 'George'];
    const lastNames = ['Hughes', 'Turner', 'Patel', 'Khan', 'Murphy', 'Evans', 'Bennett', 'Carter', 'Cooper', 'Ward'];
    const tierPick: Array<{ tier: ClientServiceTier; p: number }> = [
      { tier: 'standard', p: 0.6 },
      { tier: 'priority', p: 0.25 },
      { tier: 'white_glove', p: 0.15 },
    ];
    const profiles: ScenarioProfile[] = [
      'straightforward-collision',
      'injury-liability',
      'fraud-suspected',
      'high-value-loss',
      'late-notification',
    ];

    const adjusters = await getAdjusterProfiles();
    const seniorAdjusters = adjusters.filter((adjuster) => ['Senior', 'Lead', 'Principal'].includes(adjuster.seniority));
    const juniorAdjusters = adjusters.filter((adjuster) => adjuster.seniority === 'Junior');
    const cases: SeededClaimCase[] = [];

    for (let i = 1; i <= count; i += 1) {
      const claimantName = `${pick(firstNames, rnd)} ${pick(lastNames, rnd)}`;
      const tierRoll = rnd();
      const tier = tierRoll < tierPick[0].p
        ? 'standard'
        : tierRoll < tierPick[0].p + tierPick[1].p
          ? 'priority'
          : 'white_glove';
      const profile = pick(profiles, rnd);
      const policyInput = policyFromCase(i, claimantName, tier, rnd);
      const policy = await createPolicy(policyInput);
      const submission = buildSubmission(claimantName, policy.policyRef, profile, rnd);
      const created = await claimsService.create(submission);

      const shouldInjectWhiteGloveMistake = tier === 'white_glove' && juniorAdjusters.length > 0 && rnd() < 0.12;
      const selectedAdjuster = shouldInjectWhiteGloveMistake
        ? pick(juniorAdjusters, rnd)
        : inferExpectedSeniorAdjuster(tier) && seniorAdjusters.length > 0
          ? pick(seniorAdjusters, rnd)
          : pick(adjusters, rnd);
      const expectedHandlingMode = handlingModeForTier(tier);
      const assignmentPolicyFlags = shouldInjectWhiteGloveMistake
        ? ['policy.white_glove_routing_breach']
        : [];

      const updatedClaim = await claimsService.update(created.id, {
        clientServiceTier: tier,
        handlingMode: shouldInjectWhiteGloveMistake ? 'ai' : expectedHandlingMode,
        assignedAdjusterId: selectedAdjuster?.id,
        assignedAdjusterName: selectedAdjuster?.name,
        assignmentReason: shouldInjectWhiteGloveMistake
          ? 'Injected scenario: white-glove incorrectly routed to non-qualified adjuster'
          : `Seeded routing aligned to ${tier} tier`,
        assignmentSignals: shouldInjectWhiteGloveMistake
          ? ['White-glove policy breach injected for evaluation']
          : ['Tier-aware seeded routing applied'],
      });

      const caseDoc: SeededClaimCase = {
        id: `case-${suiteId}-${i}`,
        suiteId,
        caseNumber: i,
        claimId: updatedClaim?.id ?? created.id,
        policyRef: policy.policyRef,
        claimantName,
        clientTier: tier,
        scenarioProfile: profile,
        expectedHandlingMode,
        expectedSeniorAdjuster: inferExpectedSeniorAdjuster(tier),
        expectedSettlementBand: inferSettlementBand(profile),
        assignmentPolicyFlags,
        createdAt: now,
        updatedAt: now,
      };
      emitSeedGenerationTelemetry({
        suiteId,
        caseNumber: i,
        claimId: caseDoc.claimId,
        claimantName,
        scenarioProfile: profile,
        clientTier: tier,
        assignmentPolicyFlags,
        rnd,
      });
      await caseRepo.upsert(caseDoc);
      cases.push(caseDoc);
    }

    await suiteRepo.upsert(suite);
    if (options.autoRun === false) {
      return { suite, cases };
    }

    const initialRun = await this.runSuite(suiteId, options.agentIds);
    return { suite, cases, initialRun };
  }

  async runSuite(
    suiteId: string,
    agentIds?: string[],
    options: { forceCompletion?: boolean } = {},
  ): Promise<SeededSuiteRun> {
    await ensureContainers();
    const cases = await caseRepo.query<SeededClaimCase>({
      query: 'SELECT * FROM c WHERE c.suiteId = @suiteId ORDER BY c.caseNumber ASC',
      parameters: [{ name: '@suiteId', value: suiteId }],
    });
    const executionAgents = await this.resolveExecutionAgents(agentIds);

    let closedCases = 0;
    let settlementCases = 0;
    let totalEstimatedCostUsd = 0;
    let policyFlagCount = 0;
    const perCase: SeededSuiteRun['perCase'] = [];

    for (const suiteCase of cases) {
      const claim = await claimsService.getById(suiteCase.claimId);
      if (!claim) continue;

      const flags = [...suiteCase.assignmentPolicyFlags];
      let stage: Claim['claimStage'] = claim.claimStage;
      const seedHash = hashSeed(`${suiteCase.id}:${suiteCase.caseNumber}`);
      const rnd = mulberry32(seedHash);
      let caseCost = 0;

      for (const executionAgent of executionAgents) {
        const agentId = executionAgent.id;
        const executionMode = executionAgent.deployed ? 'deployed' : 'mock';
        const inputTokens = randomInt(700, 4200, rnd);
        const outputTokens = randomInt(250, 1700, rnd);
        const ratePer1K = executionAgent.deployed
          ? (agentId === 'digital-steward' ? 0.018 : 0.022)
          : 0.0045;
        const estimatedCostUsd = Number((((inputTokens + outputTokens) / 1000) * ratePer1K).toFixed(6));
        const hasToolFailure = executionAgent.deployed ? rnd() < 0.08 : rnd() < 0.03;
        const hasEscalation = rnd() < (suiteCase.clientTier === 'white_glove' ? 0.25 : 0.12);
        const policyEvaluations = [
          {
            policyId: 'policy.assignment-tier',
            outcome: flags.includes('policy.white_glove_routing_breach') ? 'violation' : 'passed',
            threshold: 1,
            actual: flags.includes('policy.white_glove_routing_breach') ? 0 : 1,
            actionTaken: flags.includes('policy.white_glove_routing_breach') ? 'override' : 'none',
          },
        ];

        if (flags.includes('policy.white_glove_routing_breach') && agentId === 'digital-steward') {
          flags.push('policy.steward_assignment_mistake');
        }
        if (hasToolFailure) {
          flags.push('policy.tool_reliability_alert');
        }

        recordInteraction({
          agentId,
          sessionId: `suite-run-${suiteId}-${suiteCase.caseNumber}`,
          claimId: claim.id,
          callerId: suiteCase.claimantName,
          interactionType: 'agent_test',
          userContent: `Suite case ${suiteCase.caseNumber} (${executionMode})`,
          assistantContent: executionAgent.deployed
            ? `Processed ${suiteCase.scenarioProfile} by deployed agent ${executionAgent.name}`
            : `Mock processed ${suiteCase.scenarioProfile} for undeployed agent ${executionAgent.name}`,
          escalated: hasEscalation,
          inputTokens,
          outputTokens,
          meta: {
            durationMs: randomInt(900, 4100, rnd),
            estimatedCostUsd,
            governanceOverride: flags.includes('policy.white_glove_routing_breach'),
            toolCalls: [
              { name: 'coverage-check', success: !hasToolFailure },
              { name: 'assignment-check', success: true },
            ],
            policyEvaluations,
            assignmentPolicyFlags: flags,
            downstreamStageTarget: suiteCase.expectedSettlementBand,
            executionMode,
            mockedAgentExecution: !executionAgent.deployed,
            agentName: executionAgent.name,
          },
        });
        caseCost += estimatedCostUsd;
      }

      // push process beyond current deployed agents: simulated downstream settlement and closure progression
      if (options.forceCompletion) {
        stage = 'closed';
        settlementCases += 1;
        closedCases += 1;
      } else {
        const reachesSettlement = rnd() < 0.8;
        const reachesClosed = reachesSettlement && rnd() < 0.72;
        stage = reachesClosed ? 'closed' : reachesSettlement ? 'settlement' : 'evaluation';
        if (reachesSettlement) settlementCases += 1;
        if (reachesClosed) closedCases += 1;
      }

      await claimsService.update(claim.id, {
        claimStage: stage,
        lastAgentAction: stage === 'closed'
          ? 'Suite run progressed claim through settlement and closure simulation'
          : stage === 'settlement'
            ? 'Suite run progressed claim to settlement-ready state'
            : 'Suite run left claim under evaluation',
        updatedAt: new Date().toISOString(),
      });

      totalEstimatedCostUsd += caseCost;
      policyFlagCount += flags.length;
      perCase.push({
        caseId: suiteCase.id,
        claimId: claim.id,
        finalStage: stage,
        finalOwner: claim.owner ?? null,
        policyFlags: flags,
        estimatedCostUsd: Number(caseCost.toFixed(6)),
      });
    }

    const run: SeededSuiteRun = {
      id: `run-${randomUUID()}`,
      suiteId,
      createdAt: new Date().toISOString(),
      agentIds: executionAgents.map((agent) => agent.id),
      executionPlan: {
        deployedAgentIds: executionAgents.filter((agent) => agent.deployed).map((agent) => agent.id),
        mockedAgentIds: executionAgents.filter((agent) => !agent.deployed).map((agent) => agent.id),
      },
      summary: {
        processedCases: perCase.length,
        closedCases,
        settlementCases,
        totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
        policyFlagCount,
      },
      perCase,
    };
    await runRepo.upsert(run);
    await suiteRepo.update(suiteId, { status: 'executed', updatedAt: new Date().toISOString() });
    return run;
  }

  async clearClaimsDemoData(): Promise<{
    suitesDeleted: number;
    casesDeleted: number;
    runsDeleted: number;
    evaluationsDeleted: number;
    claimsDeleted: number;
    policiesDeleted: number;
    policiesPreserved: number;
    personasDeleted: number;
    fnolSessionsDeleted: number;
    telemetryDeleted: number;
  }> {
    await ensureContainers();

    const [suites, cases, runs, evaluations, claims, policies, personas, fnolSessions] = await Promise.all([
      suiteRepo.findAll(),
      caseRepo.findAll(),
      runRepo.findAll(),
      evalRepo.findAll(),
      claimsRepo.findAll(),
      policiesRepo.findAll(),
      personasRepo.findAll(),
      fnolSessionsRepo.findAll(),
    ]);

    const policiesToDelete = policies.filter((policy) => {
      const holder = policy.holderName?.trim().toLowerCase() ?? '';
      const byPersona = policy.personaId === RICHARD_PERSONA_ID;
      const byHolder = holder === RICHARD_HOLDER_NAME;
      const byRef = policy.policyRef === RICHARD_POLICY_REF;
      return !(byPersona || byHolder || byRef);
    });
    const personasToDelete = personas.filter((persona) => persona.id !== RICHARD_PERSONA_ID);

    const telemetryDeletedPromise = clearAllInteractions();
    await Promise.all([
      Promise.all(suites.map((doc) => suiteRepo.delete(doc.id))),
      Promise.all(cases.map((doc) => caseRepo.delete(doc.id))),
      Promise.all(runs.map((doc) => runRepo.delete(doc.id))),
      Promise.all(evaluations.map((doc) => evalRepo.delete(doc.id))),
      Promise.all(claims.map((doc) => claimsRepo.delete(doc.id))),
      Promise.all(policiesToDelete.map((doc) => policiesRepo.delete(doc.id))),
      Promise.all(personasToDelete.map((doc) => personasRepo.delete(doc.id))),
      Promise.all(fnolSessions.map((doc) => fnolSessionsRepo.delete(doc.id))),
    ]);
    const telemetryDeleted = await telemetryDeletedPromise;

    return {
      suitesDeleted: suites.length,
      casesDeleted: cases.length,
      runsDeleted: runs.length,
      evaluationsDeleted: evaluations.length,
      claimsDeleted: claims.length,
      policiesDeleted: policiesToDelete.length,
      policiesPreserved: policies.length - policiesToDelete.length,
      personasDeleted: personasToDelete.length,
      fnolSessionsDeleted: fnolSessions.length,
      telemetryDeleted,
    };
  }

  async clearAndReimport(options: {
    count?: number;
    seed?: string;
    name?: string;
    generatedBy?: string;
    agentIds?: string[];
  } = {}): Promise<{
    cleared: Awaited<ReturnType<SeededClaimsSuiteService['clearClaimsDemoData']>>;
    suite: SeededClaimSuite;
    cases: SeededClaimCase[];
    run: SeededSuiteRun;
  }> {
    const cleared = await this.clearClaimsDemoData();
    const generated = await this.generateSuite({
      count: options.count,
      seed: options.seed,
      name: options.name,
      generatedBy: options.generatedBy,
      autoRun: false,
      agentIds: options.agentIds,
    });
    const run = await this.runSuite(generated.suite.id, options.agentIds, { forceCompletion: true });

    return {
      cleared,
      suite: generated.suite,
      cases: generated.cases,
      run,
    };
  }

  async evaluateRun(suiteId: string, runId: string): Promise<SeededSuiteEvaluation> {
    await ensureContainers();
    const run = await runRepo.findById(runId);
    if (!run || run.suiteId !== suiteId) {
      const error = new Error('Run not found for suite');
      (error as Error & { status?: number }).status = 404;
      throw error;
    }
    const cases = await caseRepo.query<SeededClaimCase>({
      query: 'SELECT * FROM c WHERE c.suiteId = @suiteId ORDER BY c.caseNumber ASC',
      parameters: [{ name: '@suiteId', value: suiteId }],
    });
    const caseMap = new Map(cases.map((entry) => [entry.id, entry]));
    const assnCorrect = run.perCase.filter((entry) => !(entry.policyFlags.includes('policy.white_glove_routing_breach') || entry.policyFlags.includes('policy.steward_assignment_mistake'))).length;
    const whiteGloveCases = cases.filter((entry) => entry.clientTier === 'white_glove');
    const whiteGloveBreaches = run.perCase.filter((entry) => entry.policyFlags.includes('policy.white_glove_routing_breach')).length;
    const closureRate = run.summary.processedCases > 0 ? run.summary.closedCases / run.summary.processedCases : 0;
    const policyFlagRate = run.summary.processedCases > 0 ? run.summary.policyFlagCount / run.summary.processedCases : 0;
    const avgCost = run.summary.processedCases > 0 ? run.summary.totalEstimatedCostUsd / run.summary.processedCases : 0;

    const findings: string[] = [];
    if (whiteGloveBreaches > 0) findings.push(`${whiteGloveBreaches} white-glove routing breach(es) detected.`);
    if (policyFlagRate > 1.2) findings.push('Policy flag rate high: review assignment and tool reliability.');
    if (avgCost > 0.18) findings.push('Average cost per case exceeds expected envelope.');
    if (closureRate < 0.6) findings.push('Closure conversion below target for seeded flow.');

    for (const caseResult of run.perCase) {
      const c = caseMap.get(caseResult.caseId);
      if (!c) continue;
      if (c.expectedSeniorAdjuster && caseResult.policyFlags.includes('policy.white_glove_routing_breach')) {
        findings.push(`Case ${c.caseNumber}: expected senior adjuster path breached.`);
      }
    }

    const evaluation: SeededSuiteEvaluation = {
      id: `eval-${randomUUID()}`,
      suiteId,
      runId,
      createdAt: new Date().toISOString(),
      scores: {
        assignmentAccuracy: run.summary.processedCases > 0 ? assnCorrect / run.summary.processedCases : 0,
        whiteGloveRoutingAccuracy: whiteGloveCases.length > 0 ? (whiteGloveCases.length - whiteGloveBreaches) / whiteGloveCases.length : 1,
        closureRate,
        policyFlagRate,
        avgCostPerCaseUsd: Number(avgCost.toFixed(6)),
      },
      findings,
    };
    await evalRepo.upsert(evaluation);
    await suiteRepo.update(suiteId, { status: 'evaluated', updatedAt: new Date().toISOString() });
    return evaluation;
  }

  async exportFoundryEvalPayload(suiteId: string, runId: string): Promise<{
    suiteId: string;
    runId: string;
    generatedAt: string;
    notes: string;
    payload: {
      cases: Array<{
        caseId: string;
        claimId: string;
        expected: {
          handlingMode: ClaimHandlingMode;
          seniorAdjusterRequired: boolean;
          settlementBand: SeededClaimCase['expectedSettlementBand'];
        };
        observed: {
          finalStage: Claim['claimStage'];
          policyFlags: string[];
          estimatedCostUsd: number;
        };
      }>;
    };
  }> {
    const run = await runRepo.findById(runId);
    if (!run || run.suiteId !== suiteId) {
      const error = new Error('Run not found for suite');
      (error as Error & { status?: number }).status = 404;
      throw error;
    }
    const cases = await caseRepo.query<SeededClaimCase>({
      query: 'SELECT * FROM c WHERE c.suiteId = @suiteId ORDER BY c.caseNumber ASC',
      parameters: [{ name: '@suiteId', value: suiteId }],
    });
    const caseMap = new Map(cases.map((entry) => [entry.id, entry]));
    return {
      suiteId,
      runId,
      generatedAt: new Date().toISOString(),
      notes: 'Foundry execution gated by MFA availability. This payload is ready for submission once access returns.',
      payload: {
        cases: run.perCase.map((entry) => {
          const c = caseMap.get(entry.caseId);
          return {
            caseId: entry.caseId,
            claimId: entry.claimId,
            expected: {
              handlingMode: c?.expectedHandlingMode ?? 'ai',
              seniorAdjusterRequired: c?.expectedSeniorAdjuster ?? false,
              settlementBand: c?.expectedSettlementBand ?? 'medium',
            },
            observed: {
              finalStage: entry.finalStage,
              policyFlags: entry.policyFlags,
              estimatedCostUsd: entry.estimatedCostUsd,
            },
          };
        }),
      },
    };
  }
}
