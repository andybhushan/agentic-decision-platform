/**
 * FNOL Session Routes
 *
 * Provides the full FNOL session lifecycle:
 *   POST   /api/v1/fnol/sessions              — create session
 *   GET    /api/v1/fnol/sessions/:id          — resume session
 *   POST   /api/v1/fnol/sessions/:id/turns    — idempotent conversation turn
 *   POST   /api/v1/fnol/sessions/:id/consent  — record consent artifact
 *   POST   /api/v1/fnol/sessions/:id/evidence — upload evidence metadata
 *   POST   /api/v1/fnol/sessions/:id/submit   — submit claim and close session
 *   PATCH  /api/v1/fnol/sessions/:id/phase    — client-driven phase transition
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { testDeployedAgent } from '../services/foundryAgentDeployer';
import { formatPolicyContext, getPolicyByHolder, getPolicyByRef, getPrimaryAutoPolicyByPersona } from '../services/policyService';
import { buildMobileFnolInstructions } from '../services/fnolPromptMobile';
import { ClaimsService } from '../services/claimsService';
import { recordInteraction } from '../services/interactionService';
import { formatCustomerPersonaContext, getCustomerPersona, getCustomerPersonaByName } from '../services/customerPersonaService';
import {
  createSession,
  getSession,
  recordTurn,
  recordConsent,
  addEvidence,
  transitionPhase,
  submitSession,
} from '../services/fnolSessionService';
import type { ConsentRequest, EvidenceRequest, FNOLPhase } from '../types/fnolSession';

const router = Router();
const claimsService = new ClaimsService();

function formatTodayContext(timeZone = 'America/New_York'): string {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(now);
  return `TODAY: ${formatted} (${timeZone})`;
}

/** Build the today-date + policy + customer profile context strings injected into the FNOL prompt. */
async function buildFnolContext(session: { callerId: string; personaId?: string; policyRef?: string }): Promise<{
  todayContext: string;
  policyContext: string;
  customerContext: string;
}> {
  const persona = session.personaId
    ? await getCustomerPersona(session.personaId)
    : await getCustomerPersonaByName(session.callerId);
  const todayContext = formatTodayContext(persona?.timeZone ?? 'America/New_York');
  const callerPolicy = session.policyRef
    ? await getPolicyByRef(session.policyRef)
    : persona?.id
      ? await getPrimaryAutoPolicyByPersona(persona.id)
      : session.personaId
        ? await getPrimaryAutoPolicyByPersona(session.personaId)
        : await getPolicyByHolder(session.callerId);
  const policyContext = callerPolicy ? formatPolicyContext(callerPolicy) : '';
  const customerContext = persona ? formatCustomerPersonaContext(persona) : '';

  return { todayContext, policyContext, customerContext };
}

type ObservabilityIssueFlag = {
  code: string;
  label: string;
  severity: 'info' | 'warning' | 'critical';
};

type ObservabilityDecisionPoint = {
  label: string;
  outcome: string;
};

function detectClientIssueFlags(text: string): ObservabilityIssueFlag[] {
  const lower = text.toLowerCase();
  const flags: ObservabilityIssueFlag[] = [];
  if (/(injur|whiplash|hurt|pain|ambulance|hospital|concussion|fracture)/.test(lower)) {
    flags.push({ code: 'injury', label: 'Injury indicators', severity: 'critical' });
  }
  if (/(fraud|staged|ghost passenger|flee|untraced|hit and run)/.test(lower)) {
    flags.push({ code: 'fraud', label: 'Fraud or traceability concern', severity: 'critical' });
  }
  if (/(angry|complain|upset|distress|anxious|urgent)/.test(lower)) {
    flags.push({ code: 'customer-distress', label: 'Client distress or urgency', severity: 'warning' });
  }
  if (/(tow|recovery|undriveable|not drivable|cannot drive|stuck)/.test(lower)) {
    flags.push({ code: 'mobility', label: 'Immediate vehicle mobility issue', severity: 'warning' });
  }
  if (/(police|crime reference|reference number)/.test(lower)) {
    flags.push({ code: 'police', label: 'Police involvement referenced', severity: 'info' });
  }
  return flags;
}

function mergeIssueFlags(...groups: ObservabilityIssueFlag[][]): ObservabilityIssueFlag[] {
  const deduped = new Map<string, ObservabilityIssueFlag>();
  for (const group of groups) {
    for (const flag of group) deduped.set(flag.code, flag);
  }
  return Array.from(deduped.values());
}

function buildTurnDecisionPoints(previousPhase: FNOLPhase, nextPhase: FNOLPhase, escalated: boolean): ObservabilityDecisionPoint[] {
  const points: ObservabilityDecisionPoint[] = [];
  if (previousPhase !== nextPhase) {
    points.push({
      label: `${previousPhase} -> ${nextPhase}`,
      outcome: 'Agent advanced the intake workflow',
    });
  }
  if (escalated) {
    points.push({
      label: 'Human escalation',
      outcome: 'Agent requested human intervention',
    });
  }
  if (!points.length) {
    points.push({
      label: previousPhase,
      outcome: 'Agent stayed in the current step to gather more information',
    });
  }
  return points;
}

function buildTranscriptSummary(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'No claimant summary captured yet.';
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
}

function normalizeFnolTranscript(text: string): string {
  return text
    .replace(/\bER\b/gi, 'emergency room')
    .replace(/\bA&E\b/gi, 'emergency room')
    .replace(/\bumm+\b/gi, '')
    .replace(/\buh+\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractClaimantFactHints(text: string): string[] {
  const lower = text.toLowerCase();
  const hints: string[] = [];

  if (/(neck pain|back pain|chest pain|whiplash|concussion|fracture|hurt|injur)/.test(lower)) {
    hints.push('Caller already reported an injury symptom.');
  }
  if (/(emergency room|hospital|urgent care|ambulance|medical check|medical report)/.test(lower)) {
    hints.push('Caller already said they sought medical attention.');
  }
  if (/(police attended|police came|police were there|reference number|basic report|police report)/.test(lower)) {
    hints.push('Caller already said police attended or provided a reference/report.');
  }
  if (/(witness|witness statement)/.test(lower)) {
    hints.push('Caller already said witness evidence exists.');
  }
  if (/(rear[- ]ended|rear ended|stationary|stopped at a red light|waiting to turn right)/.test(lower)) {
    hints.push('Caller already described rear-end impact circumstances.');
  }

  return Array.from(new Set(hints));
}

// ── POST /api/v1/fnol/sessions ─────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const { callerId, personaId, policyRef, idempotencyKey } = req.body as {
      callerId?: string;
      personaId?: string;
      policyRef?: string;
      idempotencyKey?: string;
    };

    if (!callerId) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'callerId is required' } });
    }

    const key = idempotencyKey || randomUUID();
    const resolvedPersona = personaId ? await getCustomerPersona(personaId) : await getCustomerPersonaByName(callerId);
    const resolvedPolicy = policyRef
      || (resolvedPersona?.id ? (await getPrimaryAutoPolicyByPersona(resolvedPersona.id))?.policyRef : undefined)
      || (personaId ? (await getPrimaryAutoPolicyByPersona(personaId))?.policyRef : undefined);
    const { session, resumed } = await createSession(callerId, key, { personaId, policyRef: resolvedPolicy });

    const callerPolicy = resolvedPolicy
      ? await getPolicyByRef(resolvedPolicy)
      : resolvedPersona?.id
        ? await getPrimaryAutoPolicyByPersona(resolvedPersona.id)
        : await getPolicyByHolder(callerId);
    const connectedDevices = callerPolicy?.connectedDevices ?? null;
    const vehicles = callerPolicy?.vehicles ?? null;

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.sessionId,
        personaId: session.personaId,
        policyRef: session.policyRef,
        phase: session.phase,
        createdAt: session.createdAt,
        resumed,
        connectedDevices,
        vehicles,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/fnol/sessions/:id ─────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }
    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/v1/fnol/sessions/:id/turns ──────────────────────────────────

router.post('/:id/turns', async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const { query, history = [], clientEventSeq, idempotencyKey } = req.body as {
      query: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
      clientEventSeq: number;
      idempotencyKey: string;
    };

    if (!query) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'query is required' } });
    }
    if (typeof clientEventSeq !== 'number') {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'clientEventSeq is required' } });
    }
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'idempotencyKey is required' } });
    }

    // Idempotency is handled authoritatively inside recordTurn — no fast-path here
    // to avoid TOCTOU double-billing from concurrent requests.

    // Build dynamic FNOL context and call the mobile intake agent
    const normalizedQuery = normalizeFnolTranscript(query);
    const normalizedHistory = history.map((item) => ({
      ...item,
      content: item.role === 'user' ? normalizeFnolTranscript(item.content) : item.content,
    }));
    const claimantFactHints = extractClaimantFactHints(
      [...normalizedHistory.filter((item) => item.role === 'user').map((item) => item.content), normalizedQuery].join('\n')
    );

    const { todayContext, policyContext, customerContext } = await buildFnolContext(session);
    const overrideInstructions = buildMobileFnolInstructions(
      todayContext,
      policyContext,
      undefined,
      customerContext,
      claimantFactHints,
    );

    const FNOL_DEPLOYMENT_ID = process.env.FNOL_DEPLOYMENT_ID || 'claims-mobile-intake-agent';
    const previousPhase = session.phase;
    const turnStartedAt = Date.now();
    const agentResult = await testDeployedAgent(FNOL_DEPLOYMENT_ID, normalizedQuery, normalizedHistory, {
      context: 'standalone',
      overrideInstructions,
      confidenceMode: 'mobile-fnol',
    });

    if (!agentResult.success) {
      return res.status(502).json({
        success: false,
        error: { code: 'AGENT_ERROR', message: agentResult.message },
      });
    }

    const turnResult = await recordTurn(
      req.params.id,
      clientEventSeq,
      idempotencyKey,
      query,
      agentResult.response ?? '',
      agentResult.confidence,
      agentResult.escalateToHuman,
      agentResult.phase as FNOLPhase | undefined
    );

    // Audit: fire-and-forget — does not block the response.
    // Use the canonical Cosmos agent id so the Observability tab can find these interactions.
    if (!turnResult.replay) {
      const clientIssueFlags = detectClientIssueFlags(normalizedQuery);
      const decisionPoints = buildTurnDecisionPoints(previousPhase, turnResult.phase, agentResult.escalateToHuman ?? false);
      recordInteraction({
        agentId: 'agent_claims_mobile_intake',
        sessionId: req.params.id,
        callerId: session.callerId,
        interactionType: 'fnol_turn',
        userContent: normalizedQuery,
        assistantContent: agentResult.response ?? '',
        phase: turnResult.phase,
        confidence: agentResult.confidence,
        escalated: agentResult.escalateToHuman ?? false,
        meta: {
          context: 'mobile-fnol',
          durationMs: Date.now() - turnStartedAt,
          phaseTransition: previousPhase !== turnResult.phase ? `${previousPhase} -> ${turnResult.phase}` : null,
          clientIssueFlags,
          decisionPoints,
          summary: buildTranscriptSummary(normalizedQuery),
        },
      });
    }

    res.json({ success: true, data: turnResult });
  } catch (error: any) {
    if (error?.status === 409) {
      return res.status(409).json({
        success: false,
        error: { code: error.code || 'SEQ_CONFLICT', message: error.message, retryable: true },
      });
    }
    next(error);
  }
});

// ── POST /api/v1/fnol/sessions/:id/consent ────────────────────────────────

router.post('/:id/consent', async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const consentReq = req.body as ConsentRequest;
    if (!consentReq.consentType || !consentReq.actorId || !consentReq.idempotencyKey) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'consentType, actorId, and idempotencyKey are required' } });
    }

    consentReq.channel = consentReq.channel || 'web';
    const artifact = await recordConsent(req.params.id, consentReq);
    res.status(201).json({ success: true, data: artifact });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/v1/fnol/sessions/:id/evidence ───────────────────────────────

router.post('/:id/evidence', async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const evidenceReq = req.body as EvidenceRequest;
    if (!evidenceReq.type || !evidenceReq.idempotencyKey) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'type and idempotencyKey are required' } });
    }

    const item = await addEvidence(req.params.id, evidenceReq);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /api/v1/fnol/sessions/:id/phase ─────────────────────────────────

router.patch('/:id/phase', async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const { phase } = req.body as { phase: FNOLPhase };
    if (!phase) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'phase is required' } });
    }

    const updated = await transitionPhase(req.params.id, phase);
    res.json({ success: true, data: { sessionId: updated.sessionId, phase: updated.phase } });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/v1/fnol/sessions/:id/submit ─────────────────────────────────

router.post('/:id/submit', async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const { idempotencyKey } = req.body as { idempotencyKey: string };
    if (!idempotencyKey) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'idempotencyKey is required' } });
    }

    // Idempotency fast-path
    if (session.idempotencyLog[idempotencyKey]) {
      return res.json({ success: true, data: session.idempotencyLog[idempotencyKey], replay: true });
    }

    // Parse incident date from session messages — look for date patterns in turn content
    const today = new Date().toISOString().split('T')[0];
    const datePattern = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;
    let incidentDate = today;
    for (const msg of session.messages ?? []) {
      const match = msg.content?.match(datePattern);
      if (match) {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          incidentDate = parsed.toISOString().split('T')[0];
          break;
        }
      }
    }

    const userTranscript = (session.messages ?? [])
      .filter((message) => message.role === 'user')
      .map((message) => message.content?.trim())
      .filter((content): content is string => Boolean(content))
      .join('\n');
    const transcriptLower = userTranscript.toLowerCase();
    const injuryIndicated = /(injur|whiplash|hurt|pain|ambulance|hospital|concussion|fracture|emergency room|urgent care|\ber\b)/.test(transcriptLower);
    const policeRefMatch = userTranscript.match(/\b([A-Z]{1,4}[-/]\d{2,4}[-/][A-Z0-9-]+)\b/);
    const immediateNeeds = [
      /(tow|recovery)/.test(transcriptLower) ? 'Vehicle Recovery' : null,
      /(hire car|courtesy car|rental)/.test(transcriptLower) ? 'Replacement Vehicle' : null,
      /(doctor|hospital|physio|medical|emergency room|urgent care|\ber\b)/.test(transcriptLower) ? 'Medical Support' : null,
    ].filter((value): value is string => Boolean(value));

    // Create claim then submit. If submit fails, best-effort clean up the orphaned claim.
    const claim = await claimsService.create({
      claimantName: session.callerId,
      claimantPersonaId: session.personaId,
      incidentType: 'Auto',
      incidentDate,
      incidentLocation: 'See session transcript',
      partiesInvolved: [{ name: session.callerId, role: 'Policyholder' }],
      injuryIndicated,
      policeReportRef: policeRefMatch?.[1],
      immediateNeeds,
      preferredContactChannel: 'Phone',
      incidentDescription: userTranscript || `FNOL session ${session.sessionId} — see full transcript.`,
      policyRef: session.policyRef,
    });
    await claimsService.syncClaimEvidenceFromSession(claim, session);

    let result: { claimId: string };
    const submitStartedAt = Date.now();
    try {
      result = await submitSession(req.params.id, claim.id, idempotencyKey);
    } catch (submitError) {
      // claimsService has no delete — log the orphaned claim ID for manual cleanup
      console.error(`[FNOL submit] submitSession failed; orphaned claim ${claim.id} for session ${req.params.id}`);
      throw submitError;
    }

    const transcriptFlags = detectClientIssueFlags(userTranscript);
    recordInteraction({
      agentId: 'agent_claims_mobile_intake',
      sessionId: req.params.id,
      claimId: claim.id,
      callerId: session.callerId,
      interactionType: 'fnol_submit',
      userContent: buildTranscriptSummary(userTranscript),
      assistantContent: `Claim ${claim.id} handed to ${claim.assignedAdjusterName ?? 'assigned adjuster'} for next-step handling.`,
      phase: 'SUBMITTED',
      confidence: claim.assignmentConfidence,
      escalated: false,
      meta: {
        context: 'mobile-fnol',
        claimantName: session.callerId,
        claimSummary: buildTranscriptSummary(userTranscript),
        durationMs: Date.now() - submitStartedAt,
        sessionDurationMs: Date.now() - new Date(session.createdAt).getTime(),
        turnCount: (session.messages ?? []).filter((message) => message.role === 'user').length,
        clientIssueFlags: transcriptFlags,
        decisionPoints: [
          { label: 'Claim submission', outcome: `Submitted as ${claim.incidentType} and moved to ${claim.assignedAdjusterName ?? 'assigned adjuster'}` },
          { label: 'Adjuster routing', outcome: claim.assignmentReason ?? 'Routed using workload and claim-type heuristics' },
        ],
        handoff: {
          targetType: 'adjuster',
          targetId: claim.assignedAdjusterId,
          targetName: claim.assignedAdjusterName,
          reason: claim.assignmentReason,
          confidence: claim.assignmentConfidence,
          signals: claim.assignmentSignals ?? [],
          serviceTier: claim.clientServiceTier,
          handlingMode: claim.handlingMode,
        },
      },
    });

    res.json({ success: true, data: { ...result, phase: 'SUBMITTED' } });
  } catch (error) {
    next(error);
  }
});

export default router;
