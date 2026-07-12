import { Router } from 'express';
import type { InteractionDoc } from '../services/cosmosService';
import { getRecentInteractions } from '../services/cosmosService';
import { GOVERNANCE_SYNTHETIC_AGENTS } from '../services/governanceSyntheticConfig';
import {
  getSyntheticGovernanceInteractions,
  getSyntheticGovernanceState,
  isSyntheticGovernanceModeEnabled,
  loadSyntheticGovernanceDataset,
  resetSyntheticGovernanceDataset,
} from '../services/governanceSyntheticStore';
import type { GovernanceEventType, GovernanceSeverity, SyntheticGovernanceEvent } from '../services/governanceSyntheticTypes';
import { getRecentDeployments } from '../services/auditLogService';
import { ClientSecretCredential } from '@azure/identity';

const router = Router();

type DerivedGovernanceEvent = {
  id: string;
  ts: string;
  agentId: string;
  sessionId: string;
  claimId: string | null;
  eventType: GovernanceEventType;
  severity: GovernanceSeverity;
  message: string;
  actorId: string | null;
};

const sensitivityByAgent = new Map(
  GOVERNANCE_SYNTHETIC_AGENTS.map((agent) => [agent.id, agent.sensitivityTier]),
);

function parseWindowDays(input: unknown, fallback = 7): number {
  const parsed = typeof input === 'string' ? Number.parseInt(input, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(90, parsed);
}

function parseLimit(input: unknown, fallback: number, max = 5000): number {
  const parsed = typeof input === 'string' ? Number.parseInt(input, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, parsed);
}

function isViolation(outcome: unknown): boolean {
  if (typeof outcome !== 'string') return false;
  const normalized = outcome.toLowerCase();
  return normalized === 'failed' || normalized === 'blocked' || normalized === 'violation';
}

function getExternalSignals() {
  return {
    entra: {
      enabled: Boolean(process.env.ENTRA_TENANT_ID),
      status: process.env.ENTRA_TENANT_ID ? 'connected' : 'not_connected',
      source: 'Microsoft Entra ID',
    },
    a365: {
      enabled: Boolean(process.env.A365_TENANT_ID || process.env.M365_TENANT_ID),
      status: process.env.A365_TENANT_ID || process.env.M365_TENANT_ID ? 'connected' : 'not_connected',
      source: 'A365 / M365',
    },
    github: {
      enabled: Boolean(process.env.GITHUB_TOKEN),
      status: process.env.GITHUB_TOKEN ? 'connected' : 'not_connected',
      source: 'GitHub Delivery Signals',
    },
  };
}

function normalizeSeverity(input: unknown): GovernanceSeverity {
  if (input === 'critical' || input === 'high' || input === 'medium') return input;
  return 'medium';
}

function extractGovernanceEvents(interaction: InteractionDoc): DerivedGovernanceEvent[] {
  const meta = (interaction.meta ?? {}) as Record<string, unknown>;
  const explicit = Array.isArray(meta.governanceEvents) ? meta.governanceEvents as SyntheticGovernanceEvent[] : null;
  if (explicit && explicit.length > 0) {
    return explicit.map((event) => ({
      id: event.id,
      ts: event.timestamp,
      agentId: event.agentId,
      sessionId: interaction.sessionId,
      claimId: interaction.claimId ?? null,
      eventType: event.type,
      severity: normalizeSeverity(event.severity),
      message: event.message,
      actorId: event.actorId ?? null,
    }));
  }

  const policyEvaluations = Array.isArray(meta.policyEvaluations) ? meta.policyEvaluations : [];
  const calls = Array.isArray(meta.toolCalls) ? meta.toolCalls : [];
  const actorId = typeof meta.actorId === 'string'
    ? meta.actorId
    : typeof meta.userId === 'string'
      ? meta.userId
      : interaction.callerId ?? null;
  const derived: DerivedGovernanceEvent[] = [];

  let violationIndex = 0;
  for (const evaluation of policyEvaluations) {
    const outcome = typeof evaluation === 'object' && evaluation !== null ? (evaluation as { outcome?: unknown }).outcome : undefined;
    if (isViolation(outcome)) {
      const policyId = typeof (evaluation as { policyId?: unknown })?.policyId === 'string'
        ? (evaluation as { policyId?: string }).policyId
        : 'policy-unknown';
      derived.push({
        id: `${interaction.id}-policy-${violationIndex}`,
        ts: interaction.ts,
        agentId: interaction.agentId,
        sessionId: interaction.sessionId,
        claimId: interaction.claimId ?? null,
        eventType: 'policy_violation',
        severity: normalizeSeverity((evaluation as { severity?: unknown })?.severity),
        message: `Policy violation: ${policyId}`,
        actorId,
      });
      violationIndex += 1;
    }
  }

  const hasOverride = meta.governanceOverride === true || policyEvaluations.some((evaluation) => (
    typeof evaluation === 'object' &&
    evaluation !== null &&
    (evaluation as { actionTaken?: unknown }).actionTaken === 'override'
  ));
  if (hasOverride) {
    derived.push({
      id: `${interaction.id}-override`,
      ts: interaction.ts,
      agentId: interaction.agentId,
      sessionId: interaction.sessionId,
      claimId: interaction.claimId ?? null,
      eventType: 'governance_override',
      severity: 'critical',
      message: 'Governance override was applied',
      actorId,
    });
  }

  if (typeof meta.errorCode === 'string' && meta.errorCode.trim().length > 0) {
    derived.push({
      id: `${interaction.id}-runtime-error`,
      ts: interaction.ts,
      agentId: interaction.agentId,
      sessionId: interaction.sessionId,
      claimId: interaction.claimId ?? null,
      eventType: 'runtime_error',
      severity: 'high',
      message: `Runtime error: ${meta.errorCode}`,
      actorId,
    });
  }

  if (interaction.escalated === true) {
    derived.push({
      id: `${interaction.id}-escalation`,
      ts: interaction.ts,
      agentId: interaction.agentId,
      sessionId: interaction.sessionId,
      claimId: interaction.claimId ?? null,
      eventType: 'human_escalation',
      severity: 'medium',
      message: 'Escalated to human review',
      actorId,
    });
  }

  const failedCalls = calls.filter((call) => (
    typeof call === 'object' &&
    call !== null &&
    (call as { success?: unknown }).success === false
  ));
  if (failedCalls.length > 0) {
    derived.push({
      id: `${interaction.id}-tool-failure`,
      ts: interaction.ts,
      agentId: interaction.agentId,
      sessionId: interaction.sessionId,
      claimId: interaction.claimId ?? null,
      eventType: 'tool_failure',
      severity: 'medium',
      message: `${failedCalls.length} tool call${failedCalls.length > 1 ? 's' : ''} failed`,
      actorId,
    });
  }

  return derived;
}

function getInteractionsInWindow(allInteractions: InteractionDoc[], windowDays: number): InteractionDoc[] {
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return allInteractions.filter((interaction) => Date.parse(interaction.ts) >= since);
}

/**
 * Contract map (source-of-truth):
 * - Summary tiles read fields from this route's `summary` aggregate object.
 * - Agent telemetry table reads entries from `risk-matrix.agents`.
 * - Audit trail reads rows from `audit-log.events`.
 * All three are derived from the same interaction+event stream.
 */
function aggregateGovernance(interactions: InteractionDoc[]) {
  const events = interactions.flatMap((interaction) => extractGovernanceEvents(interaction));
  let policyChecks = 0;
  let toolCalls = 0;
  let toolFailures = 0;
  let totalDurationMs = 0;
  let durationCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let tokenRows = 0;
  let totalCostUsd = 0;
  let costRows = 0;

  const agentRows = new Map<string, {
    interactions: number;
    policyChecks: number;
    policyViolations: number;
    overrides: number;
    errors: number;
    escalations: number;
    toolCalls: number;
    toolFailures: number;
    latestTs: string;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    costRows: number;
    tokenRows: number;
  }>();

  for (const interaction of interactions) {
    const meta = (interaction.meta ?? {}) as Record<string, unknown>;
    const evaluations = Array.isArray(meta.policyEvaluations) ? meta.policyEvaluations : [];
    const calls = Array.isArray(meta.toolCalls) ? meta.toolCalls : [];
    const eventSlice = extractGovernanceEvents(interaction);

    policyChecks += evaluations.length;
    toolCalls += calls.length;
    toolFailures += calls.filter((call) => (
      typeof call === 'object' &&
      call !== null &&
      (call as { success?: unknown }).success === false
    )).length;

    if (typeof meta.durationMs === 'number') {
      totalDurationMs += meta.durationMs;
      durationCount += 1;
    }
    if (typeof interaction.inputTokens === 'number' || typeof interaction.outputTokens === 'number') {
      totalInputTokens += typeof interaction.inputTokens === 'number' ? interaction.inputTokens : 0;
      totalOutputTokens += typeof interaction.outputTokens === 'number' ? interaction.outputTokens : 0;
      tokenRows += 1;
    }
    if (typeof meta.estimatedCostUsd === 'number') {
      totalCostUsd += meta.estimatedCostUsd;
      costRows += 1;
    }

    const row = agentRows.get(interaction.agentId) ?? {
      interactions: 0,
      policyChecks: 0,
      policyViolations: 0,
      overrides: 0,
      errors: 0,
      escalations: 0,
      toolCalls: 0,
      toolFailures: 0,
      latestTs: interaction.ts,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      costRows: 0,
      tokenRows: 0,
    };
    row.interactions += 1;
    if (typeof interaction.inputTokens === 'number' || typeof interaction.outputTokens === 'number') {
      row.totalInputTokens += typeof interaction.inputTokens === 'number' ? interaction.inputTokens : 0;
      row.totalOutputTokens += typeof interaction.outputTokens === 'number' ? interaction.outputTokens : 0;
      row.tokenRows += 1;
    }
    if (typeof meta.estimatedCostUsd === 'number') {
      row.totalCostUsd += meta.estimatedCostUsd;
      row.costRows += 1;
    }
    row.policyChecks += evaluations.length;
    row.policyViolations += eventSlice.filter((event) => event.eventType === 'policy_violation').length;
    row.overrides += eventSlice.filter((event) => event.eventType === 'governance_override').length;
    row.errors += eventSlice.filter((event) => event.eventType === 'runtime_error').length;
    row.escalations += eventSlice.filter((event) => event.eventType === 'human_escalation').length;
    row.toolCalls += calls.length;
    row.toolFailures += eventSlice
      .filter((event) => event.eventType === 'tool_failure')
      .reduce((sum, event) => {
        const match = /(\d+)/.exec(event.message);
        const count = match ? Number.parseInt(match[1], 10) : 1;
        return sum + count;
      }, 0);
    if (interaction.ts > row.latestTs) row.latestTs = interaction.ts;
    agentRows.set(interaction.agentId, row);
  }

  const totalInteractions = interactions.length;
  const policyViolations = events.filter((event) => event.eventType === 'policy_violation').length;
  const governanceOverrides = events.filter((event) => event.eventType === 'governance_override').length;
  const errorCount = events.filter((event) => event.eventType === 'runtime_error').length;
  const escalations = events.filter((event) => event.eventType === 'human_escalation').length;

  const summary = {
    totalInteractions,
    policyChecks,
    policyViolations,
    violationRate: policyChecks > 0 ? policyViolations / policyChecks : null,
    governanceOverrides,
    overrideRate: totalInteractions > 0 ? governanceOverrides / totalInteractions : null,
    escalations,
    escalationRate: totalInteractions > 0 ? escalations / totalInteractions : null,
    errorCount,
    errorRate: totalInteractions > 0 ? errorCount / totalInteractions : null,
    toolCalls,
    toolFailures,
    toolFailureRate: toolCalls > 0 ? toolFailures / toolCalls : null,
    avgDurationMs: durationCount > 0 ? totalDurationMs / durationCount : null,
    avgInputTokens: tokenRows > 0 ? totalInputTokens / tokenRows : null,
    avgOutputTokens: tokenRows > 0 ? totalOutputTokens / tokenRows : null,
    avgEstimatedCostUsd: costRows > 0 ? totalCostUsd / costRows : null,
    topViolations: Array.from(agentRows.entries())
      .map(([agentId, row]) => ({
        agentId,
        violations: row.policyViolations,
        checks: row.policyChecks,
        violationRate: row.policyChecks > 0 ? row.policyViolations / row.policyChecks : null,
        interactions: row.interactions,
      }))
      .filter((row) => row.violations > 0)
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 6),
  };

  const riskMatrix = {
    agents: Array.from(agentRows.entries())
      .map(([agentId, row]) => {
        const violationRate = row.policyChecks > 0 ? row.policyViolations / row.policyChecks : 0;
        const overrideRate = row.interactions > 0 ? row.overrides / row.interactions : 0;
        const escalationRate = row.interactions > 0 ? row.escalations / row.interactions : 0;
        const errorRate = row.interactions > 0 ? row.errors / row.interactions : 0;
        const toolFailureRate = row.toolCalls > 0 ? row.toolFailures / row.toolCalls : 0;
        const tier = sensitivityByAgent.get(agentId) ?? 'medium';
        const tierMultiplier = tier === 'high' ? 1.25 : tier === 'low' ? 0.9 : 1;

        /**
         * Weighted risk score:
         * ((violationSeverityWeight * violationRate) + (0.25 * escalationRate) + (0.2 * errorRate)) * sensitivityTierMultiplier
         * where violationSeverityWeight is approximated by 0.55 and sensitivity tiers scale impact (high > medium > low).
         */
        const riskScore = Math.min(
          100,
          Number((((violationRate * 0.55) + (escalationRate * 0.25) + (errorRate * 0.2) + (toolFailureRate * 0.1)) * 100 * tierMultiplier).toFixed(2)),
        );

        return {
          agentId,
          interactions: row.interactions,
          policyChecks: row.policyChecks,
          policyViolations: row.policyViolations,
          violationRate,
          overrideRate,
          escalationRate,
          errorRate,
          toolFailureRate,
          riskScore,
          latestTs: row.latestTs,
          totalTokenCostUsd: row.costRows > 0 ? row.totalCostUsd : null,
          avgInputTokens: row.tokenRows > 0 ? row.totalInputTokens / row.tokenRows : null,
          avgOutputTokens: row.tokenRows > 0 ? row.totalOutputTokens / row.tokenRows : null,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore),
  };

  const audit = {
    totalEvents: events.length,
    events: events.sort((a, b) => (b.ts > a.ts ? 1 : -1)),
  };

  return { summary, riskMatrix, audit };
}

async function resolveInteractions(windowDays: number, scanLimit: number): Promise<InteractionDoc[]> {
  const source = isSyntheticGovernanceModeEnabled()
    ? getSyntheticGovernanceInteractions()
    : await getRecentInteractions(scanLimit);
  return getInteractionsInWindow(source, windowDays);
}

router.get('/summary', async (req, res, next) => {
  try {
    const windowDays = parseWindowDays(req.query.windowDays, 7);
    const scanLimit = parseLimit(req.query.scanLimit, 2500);
    const interactions = await resolveInteractions(windowDays, scanLimit);
    const { summary } = aggregateGovernance(interactions);

    res.json({
      success: true,
      data: {
        windowDays,
        ...summary,
        externalSignals: getExternalSignals(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/agents/risk-matrix', async (req, res, next) => {
  try {
    const windowDays = parseWindowDays(req.query.windowDays, 7);
    const scanLimit = parseLimit(req.query.scanLimit, 2500);
    const interactions = await resolveInteractions(windowDays, scanLimit);
    const { riskMatrix } = aggregateGovernance(interactions);

    res.json({
      success: true,
      data: {
        windowDays,
        agents: riskMatrix.agents,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audit-log', async (req, res, next) => {
  try {
    const windowDays = parseWindowDays(req.query.windowDays, 7);
    const scanLimit = parseLimit(req.query.scanLimit, 2500);
    const pageSize = parseLimit(req.query.pageSize, 100, 300);
    const interactions = await resolveInteractions(windowDays, scanLimit);
    const { audit } = aggregateGovernance(interactions);

    res.json({
      success: true,
      data: {
        windowDays,
        totalEvents: audit.totalEvents,
        events: audit.events.slice(0, pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/demo/load', (req, res, next) => {
  try {
    const body = req.body as { seed?: string; windowDays?: number; interactionsPerAgent?: number };
    const { dataset, consistency } = loadSyntheticGovernanceDataset({
      seed: body.seed,
      windowDays: typeof body.windowDays === 'number' ? Math.max(1, Math.min(90, Math.floor(body.windowDays))) : undefined,
      interactionsPerAgent: typeof body.interactionsPerAgent === 'number' ? Math.max(10, Math.min(500, Math.floor(body.interactionsPerAgent))) : undefined,
    });

    res.json({
      success: true,
      data: {
        enabled: true,
        seed: dataset.seed,
        generatedAt: dataset.generatedAt,
        windowDays: dataset.windowDays,
        interactionCount: dataset.interactions.length,
        consistency,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/demo/reset', (req, res) => {
  resetSyntheticGovernanceDataset();
  res.json({
    success: true,
    data: {
      enabled: false,
    },
  });
});

router.get('/demo/status', (req, res) => {
  res.json({
    success: true,
    data: getSyntheticGovernanceState(),
  });
});

// GET /api/v1/governance/deployments - Get recent deployments with Entra/A365 signals
router.get('/deployments', async (req, res, next) => {
  try {
    const limitDays = typeof req.query.limitDays === 'string' ? Math.max(1, Math.min(90, Number.parseInt(req.query.limitDays, 10))) : 30;
    const limit = typeof req.query.limit === 'string' ? Math.max(1, Math.min(500, Number.parseInt(req.query.limit, 10))) : 50;

    const deployments = await getRecentDeployments(limitDays, limit);

    res.json({
      success: true,
      data: {
        deployments,
        totalCount: deployments.length,
        externalSignals: getExternalSignals(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/governance/identity-signals - Entra/A365 live identity and access signals
router.get('/identity-signals', async (req, res, next) => {
  try {
    const tenantId = process.env.ENTRA_TENANT_ID;
    const clientId = process.env.ENTRA_CLIENT_ID;
    const clientSecret = process.env.ENTRA_CLIENT_SECRET;

    const configured = Boolean(tenantId && clientId && clientSecret);
    const consentUrl = configured
      ? `https://login.microsoftonline.com/${tenantId}/adminconsent?client_id=${clientId}&redirect_uri=http://localhost:3000`
      : null;

    if (!configured) {
      return res.json({
        success: true,
        data: {
          status: 'not_configured',
          message: 'Entra credentials not set in environment.',
          tenantId: null,
          orgName: null,
          permissionsGranted: false,
          consentUrl: null,
          signals: null,
        },
      });
    }

    // Attempt to get a Graph token and probe what's accessible
    let token: string | null = null;
    let permissionsGranted = false;
    let orgName: string | null = null;
    let userCount: number | null = null;
    let riskyUserCount: number | null = null;
    let recentSignInFailures: number | null = null;
    let conditionalAccessPolicies: number | null = null;
    let graphError: string | null = null;

    // A365 signals
    let a365SecureScore: number | null = null;
    let a365SecureScoreMax: number | null = null;
    let a365ActiveUsers: number | null = null;
    let a365ActiveAlerts: number | null = null;
    let a365DlpPolicies: number | null = null;
    let a365ComplianceScore: number | null = null;
    let a365TeamsMessages: number | null = null;

    try {
      const credential = new ClientSecretCredential(tenantId!, clientId!, clientSecret!);
      const tokenResp = await credential.getToken('https://graph.microsoft.com/.default');
      token = tokenResp.token;
    } catch (err) {
      graphError = err instanceof Error ? err.message : 'Token acquisition failed';
    }

    if (token) {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      // Try org info
      try {
        const orgResp = await fetch('https://graph.microsoft.com/v1.0/organization?$select=id,displayName,verifiedDomains', { headers });
        if (orgResp.ok) {
          const orgData = (await orgResp.json()) as { value: { displayName: string }[] };
          orgName = orgData.value?.[0]?.displayName ?? null;
          permissionsGranted = true;
        } else {
          const err = (await orgResp.json()) as { error?: { message?: string } };
          graphError = err.error?.message ?? `HTTP ${orgResp.status}`;
        }
      } catch { /* silent */ }

      // Try user count
      if (permissionsGranted) {
        try {
          const usersResp = await fetch('https://graph.microsoft.com/v1.0/users/$count', {
            headers: { ...headers, ConsistencyLevel: 'eventual' },
          });
          if (usersResp.ok) {
            userCount = Number(await usersResp.text());
          }
        } catch { /* silent */ }

        // Try risky users
        try {
          const riskyResp = await fetch('https://graph.microsoft.com/v1.0/identityProtection/riskyUsers?$count=true&$top=1&ConsistencyLevel=eventual', {
            headers: { ...headers, ConsistencyLevel: 'eventual' },
          });
          if (riskyResp.ok) {
            const d = (await riskyResp.json()) as { '@odata.count'?: number };
            riskyUserCount = d['@odata.count'] ?? null;
          }
        } catch { /* silent */ }

        // Try sign-in logs (last 24h failures)
        try {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const filter = encodeURIComponent(`createdDateTime ge ${since} and status/errorCode ne 0`);
          const signInResp = await fetch(`https://graph.microsoft.com/v1.0/auditLogs/signIns?$count=true&$top=1&$filter=${filter}`, {
            headers: { ...headers, ConsistencyLevel: 'eventual' },
          });
          if (signInResp.ok) {
            const d = (await signInResp.json()) as { '@odata.count'?: number };
            recentSignInFailures = d['@odata.count'] ?? null;
          }
        } catch { /* silent */ }

        // Try conditional access policies count
        try {
          const caResp = await fetch('https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies?$count=true&$top=1', {
            headers: { ...headers, ConsistencyLevel: 'eventual' },
          });
          if (caResp.ok) {
            const d = (await caResp.json()) as { '@odata.count'?: number; value?: unknown[] };
            conditionalAccessPolicies = d['@odata.count'] ?? (Array.isArray(d.value) ? d.value.length : null);
          }
        } catch { /* silent */ }

        // --- A365 / M365 signals ---

        // Microsoft Secure Score
        try {
          const scoreResp = await fetch('https://graph.microsoft.com/v1.0/security/secureScores?$top=1', { headers });
          if (scoreResp.ok) {
            const d = (await scoreResp.json()) as { value?: { currentScore?: number; maxScore?: number; activeUserCount?: number }[] };
            const latest = d.value?.[0];
            if (latest) {
              a365SecureScore = latest.currentScore ?? null;
              a365SecureScoreMax = latest.maxScore ?? null;
              a365ActiveUsers = latest.activeUserCount ?? null;
            }
          }
        } catch { /* silent */ }

        // Active security alerts (high + medium)
        try {
          const alertFilter = encodeURIComponent("status ne 'resolved'");
          const alertResp = await fetch(`https://graph.microsoft.com/v1.0/security/alerts_v2?$count=true&$top=1&$filter=${alertFilter}`, {
            headers: { ...headers, ConsistencyLevel: 'eventual' },
          });
          if (alertResp.ok) {
            const d = (await alertResp.json()) as { '@odata.count'?: number; value?: unknown[] };
            a365ActiveAlerts = d['@odata.count'] ?? (Array.isArray(d.value) ? d.value.length : null);
          }
        } catch { /* silent */ }

        // DLP policy count
        try {
          const dlpResp = await fetch('https://graph.microsoft.com/v1.0/security/dataLossPreventionPolicies?$count=true&$top=1', {
            headers: { ...headers, ConsistencyLevel: 'eventual' },
          });
          if (dlpResp.ok) {
            const d = (await dlpResp.json()) as { '@odata.count'?: number; value?: unknown[] };
            a365DlpPolicies = d['@odata.count'] ?? (Array.isArray(d.value) ? d.value.length : null);
          }
        } catch { /* silent */ }

        // Compliance manager score (Purview)
        try {
          const compResp = await fetch('https://graph.microsoft.com/beta/compliance/complianceManagement/scores', { headers });
          if (compResp.ok) {
            const d = (await compResp.json()) as { value?: { score?: number; maxScore?: number }[] };
            const latest = d.value?.[0];
            if (latest) {
              a365ComplianceScore = latest.score ?? null;
            }
          }
        } catch { /* silent */ }

        // Teams messaging activity (last 7 days)
        try {
          const teamsResp = await fetch("https://graph.microsoft.com/v1.0/reports/getTeamsTeamActivityCounts(period='D7')", { headers });
          if (teamsResp.ok) {
            const text = await teamsResp.text();
            // CSV: Date,Messages,Meetings,...
            const lines = text.trim().split('\n');
            let total = 0;
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',');
              const msgs = Number(cols[1]);
              if (!Number.isNaN(msgs)) total += msgs;
            }
            a365TeamsMessages = total || null;
          }
        } catch { /* silent */ }
      }
    }

    return res.json({
      success: true,
      data: {
        status: permissionsGranted ? 'connected' : 'consent_required',
        message: permissionsGranted
          ? 'Live identity signals available'
          : graphError ?? 'Admin consent required. Grant Graph API permissions to enable live signals.',
        tenantId,
        orgName,
        permissionsGranted,
        consentUrl,
        signals: permissionsGranted ? {
          userCount,
          riskyUserCount,
          recentSignInFailures,
          conditionalAccessPolicies,
          lastRefreshed: new Date().toISOString(),
        } : null,
        a365Signals: permissionsGranted ? {
          secureScore: a365SecureScore,
          secureScoreMax: a365SecureScoreMax,
          activeUsers: a365ActiveUsers,
          activeAlerts: a365ActiveAlerts,
          dlpPolicies: a365DlpPolicies,
          complianceScore: a365ComplianceScore,
          teamsMessages7d: a365TeamsMessages,
          lastRefreshed: new Date().toISOString(),
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

