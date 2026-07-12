import type { InteractionDoc } from './cosmosService';
import {
  GOVERNANCE_SYNTHETIC_AGENTS,
  GOVERNANCE_SYNTHETIC_MODEL_PRICING,
  GOVERNANCE_SYNTHETIC_POLICIES,
  type SyntheticAgentProfile,
} from './governanceSyntheticConfig';
import type {
  GovernanceConsistencyReport,
  GovernanceSyntheticDataset,
  SyntheticGovernanceEvent,
  SyntheticInteractionRecord,
} from './governanceSyntheticTypes';

interface GeneratorOptions {
  seed: string;
  windowDays: number;
  interactionsPerAgent: number;
}

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
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

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function profileParameters(profile: SyntheticAgentProfile['profile']) {
  switch (profile) {
    case 'cost_pressure':
      return {
        avgInputTokens: 3600,
        avgOutputTokens: 1300,
        errorRate: 0.06,
        escalationRate: 0.08,
        violationRate: 0.03,
        overrideRate: 0.01,
        toolFailureRate: 0.07,
        avgDurationMs: 2400,
      };
    case 'compliance_pressure':
      return {
        avgInputTokens: 2200,
        avgOutputTokens: 900,
        errorRate: 0.03,
        escalationRate: 0.2,
        violationRate: 0.14,
        overrideRate: 0.09,
        toolFailureRate: 0.05,
        avgDurationMs: 1850,
      };
    case 'healthy':
    default:
      return {
        avgInputTokens: 1400,
        avgOutputTokens: 600,
        errorRate: 0.015,
        escalationRate: 0.04,
        violationRate: 0.012,
        overrideRate: 0.005,
        toolFailureRate: 0.02,
        avgDurationMs: 1450,
      };
  }
}

function normaliseAround(base: number, rnd: () => number, spread = 0.4): number {
  const factor = 1 - spread / 2 + rnd() * spread;
  return Math.max(1, Math.round(base * factor));
}

function calculateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const pricing = GOVERNANCE_SYNTHETIC_MODEL_PRICING.find((entry) => entry.modelId === modelId);
  if (!pricing) return 0;
  const inputCost = (inputTokens / 1000) * pricing.inputPer1kUsd;
  const outputCost = (outputTokens / 1000) * pricing.outputPer1kUsd;
  return Number((inputCost + outputCost).toFixed(6));
}

function mapToInteractionDoc(record: SyntheticInteractionRecord): InteractionDoc {
  return {
    id: record.id,
    agentId: record.agentId,
    sessionId: record.sessionId,
    interactionType: 'agent_test',
    userContent: 'Synthetic governance interaction',
    assistantContent: 'Synthetic governance response',
    escalated: record.escalated,
    ts: record.timestamp,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    meta: {
      synthetic: true,
      modelId: record.modelId,
      durationMs: record.durationMs,
      estimatedCostUsd: record.estimatedCostUsd,
      toolCalls: Array.from({ length: record.toolCallsTotal }, (_, index) => ({
        name: `tool_${(index % 3) + 1}`,
        success: index >= record.toolCallsFailed,
      })),
      policyEvaluations: record.policyEvaluations,
      errorCode: record.errorCode,
      traceRef: record.traceReference,
      riskContribution: record.riskContribution,
      governanceEvents: record.events,
    },
  };
}

export function generateSyntheticGovernanceDataset(options: GeneratorOptions): GovernanceSyntheticDataset {
  const rnd = mulberry32(hashSeed(options.seed));
  const now = Date.now();
  const interactions: InteractionDoc[] = [];

  for (const agent of GOVERNANCE_SYNTHETIC_AGENTS) {
    const params = profileParameters(agent.profile);
    const policyPool = GOVERNANCE_SYNTHETIC_POLICIES.filter((policy) => policy.appliesTo.includes(agent.id));
    const targetCount = options.interactionsPerAgent;

    for (let i = 0; i < targetCount; i += 1) {
      const ts = new Date(now - rnd() * options.windowDays * 24 * 60 * 60 * 1000).toISOString();
      const inputTokens = normaliseAround(params.avgInputTokens, rnd);
      const outputTokens = normaliseAround(params.avgOutputTokens, rnd);
      const estimatedCostUsd = calculateCostUsd(agent.modelId, inputTokens, outputTokens);
      const toolCallsTotal = Math.max(0, normaliseAround(agent.profile === 'cost_pressure' ? 3 : 2, rnd, 0.8) - 1);
      const toolCallsFailed = Array.from({ length: toolCallsTotal }).reduce<number>(
        (acc) => acc + (rnd() < params.toolFailureRate ? 1 : 0),
        0,
      );
      const hasRuntimeError = rnd() < params.errorRate;
      const escalated = rnd() < params.escalationRate;
      const status: SyntheticInteractionRecord['status'] = hasRuntimeError ? 'error' : 'success';

      const policyChecks = Math.max(1, normaliseAround(2, rnd, 0.6));
      const policyEvaluations: SyntheticInteractionRecord['policyEvaluations'] = [];
      const events: SyntheticGovernanceEvent[] = [];
      let violationCount = 0;
      let overrideHappened = false;

      for (let p = 0; p < policyChecks; p += 1) {
        const policy = pick(policyPool, rnd);
        const violated = rnd() < params.violationRate;
        const outcome = violated ? (rnd() < 0.35 ? 'blocked' : 'violation') : 'passed';
        const actionTaken = violated && rnd() < params.overrideRate ? 'override' : 'none';
        policyEvaluations.push({
          policyId: policy.id,
          outcome,
          threshold: 0.8,
          actual: Number((0.45 + rnd() * 0.5).toFixed(2)),
          actionTaken,
          severity: policy.severity,
        });

        if (violated) {
          violationCount += 1;
          events.push({
            id: `${agent.id}-${i}-violation-${p}`,
            interactionId: `${agent.id}-${i}`,
            agentId: agent.id,
            timestamp: ts,
            type: 'policy_violation',
            severity: policy.severity,
            message: `${policy.name} breached`,
            actorId: null,
            detail: {
              policyId: policy.id,
              threshold: 0.8,
              actual: Number((0.45 + rnd() * 0.5).toFixed(2)),
            },
          });
        }

        if (actionTaken === 'override') {
          overrideHappened = true;
          events.push({
            id: `${agent.id}-${i}-override-${p}`,
            interactionId: `${agent.id}-${i}`,
            agentId: agent.id,
            timestamp: ts,
            type: 'governance_override',
            severity: policy.severity === 'critical' ? 'critical' : 'high',
            message: `Override applied for ${policy.name}`,
            actorId: 'ops-supervisor',
            detail: {
              policyId: policy.id,
              reason: 'Manual risk acceptance for customer continuity',
            },
          });
        }
      }

      if (escalated) {
        events.push({
          id: `${agent.id}-${i}-escalation`,
          interactionId: `${agent.id}-${i}`,
          agentId: agent.id,
          timestamp: ts,
          type: 'human_escalation',
          severity: 'medium',
          message: 'Escalated for human review',
          actorId: null,
          detail: { queue: 'claims-escalations' },
        });
      }

      if (hasRuntimeError) {
        events.push({
          id: `${agent.id}-${i}-runtime`,
          interactionId: `${agent.id}-${i}`,
          agentId: agent.id,
          timestamp: ts,
          type: 'runtime_error',
          severity: 'high',
          message: 'Model invocation failed',
          actorId: null,
          detail: { errorCode: 'MODEL_TIMEOUT' },
        });
      }

      if (toolCallsFailed > 0) {
        events.push({
          id: `${agent.id}-${i}-tool`,
          interactionId: `${agent.id}-${i}`,
          agentId: agent.id,
          timestamp: ts,
          type: 'tool_failure',
          severity: 'medium',
          message: `${toolCallsFailed} tool call${toolCallsFailed > 1 ? 's' : ''} failed`,
          actorId: null,
          detail: { failedCalls: toolCallsFailed },
        });
      }

      const riskContribution = Number(
        (
          violationCount * (agent.sensitivityTier === 'high' ? 1.4 : agent.sensitivityTier === 'medium' ? 1.2 : 1) +
          (overrideHappened ? 1.5 : 0) +
          (escalated ? 0.8 : 0) +
          (hasRuntimeError ? 0.9 : 0)
        ).toFixed(2),
      );

      const syntheticRecord: SyntheticInteractionRecord = {
        id: `${agent.id}-${i}`,
        agentId: agent.id,
        sessionId: `session-${agent.id}-${Math.floor(i / 3)}`,
        timestamp: ts,
        durationMs: normaliseAround(params.avgDurationMs, rnd, 0.5),
        modelId: agent.modelId,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        status,
        toolCallsTotal,
        toolCallsFailed,
        escalated,
        riskContribution,
        traceReference: `trace-${agent.id}-${i}`,
        policyEvaluations,
        errorCode: hasRuntimeError ? 'MODEL_TIMEOUT' : undefined,
        events,
      };
      interactions.push(mapToInteractionDoc(syntheticRecord));
    }
  }

  interactions.sort((a, b) => (a.ts > b.ts ? 1 : -1));
  return {
    seed: options.seed,
    generatedAt: new Date().toISOString(),
    windowDays: options.windowDays,
    interactions,
  };
}

export function evaluateSyntheticConsistency(dataset: GovernanceSyntheticDataset): GovernanceConsistencyReport {
  const interactions = dataset.interactions;
  const issues: string[] = [];

  const expectedCost = interactions.reduce((sum, interaction) => {
    const modelId = typeof interaction.meta?.modelId === 'string' ? interaction.meta.modelId : 'gpt-5.4';
    const computed = calculateCostUsd(modelId, interaction.inputTokens ?? 0, interaction.outputTokens ?? 0);
    return sum + computed;
  }, 0);
  const actualCost = interactions.reduce(
    (sum, interaction) => sum + (typeof interaction.meta?.estimatedCostUsd === 'number' ? interaction.meta.estimatedCostUsd : 0),
    0,
  );
  const costPassed = Math.abs(expectedCost - actualCost) < 0.001;
  if (!costPassed) issues.push('Cost arithmetic mismatch');

  let policyChecks = 0;
  let violations = 0;
  for (const interaction of interactions) {
    const policyEvaluations = Array.isArray(interaction.meta?.policyEvaluations)
      ? interaction.meta.policyEvaluations as Array<{ outcome?: string }>
      : [];
    policyChecks += policyEvaluations.length;
    violations += policyEvaluations.filter((evaluation) => (
      evaluation.outcome === 'failed' || evaluation.outcome === 'blocked' || evaluation.outcome === 'violation'
    )).length;
  }
  const expectedViolationRate = policyChecks > 0 ? violations / policyChecks : 0;
  const eventViolations = interactions.reduce((sum, interaction) => {
    const events = Array.isArray(interaction.meta?.governanceEvents)
      ? interaction.meta.governanceEvents as Array<{ type?: string }>
      : [];
    return sum + events.filter((event) => event.type === 'policy_violation').length;
  }, 0);
  const actualViolationRate = policyChecks > 0 ? eventViolations / policyChecks : 0;
  const violationPassed = Math.abs(expectedViolationRate - actualViolationRate) < 0.0001;
  if (!violationPassed) issues.push('Violation-rate mismatch');

  const byAgent = new Map<string, string>();
  for (const interaction of interactions) {
    const current = byAgent.get(interaction.agentId);
    if (!current || interaction.ts > current) byAgent.set(interaction.agentId, interaction.ts);
  }
  const mismatches = Array.from(byAgent.entries())
    .map(([agentId, expected]) => {
      const actual = interactions
        .filter((interaction) => interaction.agentId === agentId)
        .map((interaction) => interaction.ts)
        .sort((a, b) => (a > b ? 1 : -1))
        .at(-1) ?? '';
      return { agentId, expected, actual };
    })
    .filter((entry) => entry.expected !== entry.actual);
  const lastSeenPassed = mismatches.length === 0;
  if (!lastSeenPassed) issues.push('Last-seen mismatch');

  return {
    passed: issues.length === 0,
    checks: {
      costArithmetic: {
        passed: costPassed,
        expected: Number(expectedCost.toFixed(6)),
        actual: Number(actualCost.toFixed(6)),
      },
      violationRate: {
        passed: violationPassed,
        expected: Number(expectedViolationRate.toFixed(6)),
        actual: Number(actualViolationRate.toFixed(6)),
      },
      lastSeenIntegrity: {
        passed: lastSeenPassed,
        mismatches,
      },
    },
    issues,
  };
}
