/**
 * FNOL Session Service — Cosmos DB backed
 *
 * All public functions are async. Sessions are stored as individual Cosmos
 * documents in the `fnol-sessions` container (partition key: /id).
 *
 * Retains full idempotency, clientEventSeq ordering guard, phase progression,
 * and audit emit logic from the original JSON implementation.
 */

import { randomUUID } from 'crypto';
import { CosmosRepository } from './cosmosRepository';
import { writeInteraction } from './cosmosService';
import type {
  FNOLSession,
  FNOLPhase,
  FNOLAuditEvent,
  ConsentArtifact,
  EvidenceItem,
  ConsentRequest,
  EvidenceRequest,
} from '../types/fnolSession';

// Sessions stored with id = sessionId for point-read efficiency.
type FNOLSessionDoc = FNOLSession & { id: string };

const repo = new CosmosRepository<FNOLSessionDoc>('fnol-sessions');

// ── Audit emit ────────────────────────────────────────────────────────────

function emitAudit(event: FNOLAuditEvent): void {
  // Fire-and-forget into the agent-interactions container (docType = fnol_audit).
  writeInteraction({
    agentId: 'fnol-session-service',
    sessionId: event.sessionId,
    interactionType: 'fnol_turn',
    userContent: event.step,
    assistantContent: JSON.stringify(event.detail ?? {}),
    phase: event.phase,
    ts: event.timestamp,
    meta: { step: event.step, outcome: event.outcome, actor: event.actor },
  }).catch(() => {});
}

// ── Phase progression ─────────────────────────────────────────────────────

const PHASE_ORDER: FNOLPhase[] = [
  'GREETING', 'POLICY_VERIFY', 'INCIDENT_CAPTURE', 'DETAILS',
  'EVIDENCE', 'CONSENT', 'SUMMARY', 'SUBMITTED',
];

function phaseRank(p: FNOLPhase): number {
  return PHASE_ORDER.indexOf(p);
}

function advancePhase(current: FNOLPhase, responseText: string, agentPhase?: FNOLPhase): FNOLPhase {
  const lower = responseText.toLowerCase();
  if (current === 'SUBMITTED' || current === 'ESCALATED') return current;
  if (lower.includes('[escalate_to_human]')) return 'ESCALATED';
  if (current === 'CALLBACK_SCHEDULED' || current === 'CALLBACK_COMPLETE') return current;

  if (agentPhase) {
    const sr = phaseRank(agentPhase);
    const cr = phaseRank(current);
    const cap = phaseRank('EVIDENCE');
    if (sr !== -1 && sr > cr && sr <= cap) return agentPhase;
  }

  return current;
}

// ── Public API ────────────────────────────────────────────────────────────

export async function createSession(
  callerId: string,
  idempotencyKey: string,
  opts: { personaId?: string; policyRef?: string } = {},
): Promise<{ session: FNOLSession; resumed: boolean }> {
  // Idempotency: scan for existing session with same create key.
  // For demo scale this is fine; at production scale index idempotencyKey.
  const all = await repo.findAll();
  const existing = all.find(
    (s) => s.callerId === callerId && s.idempotencyLog['__create__'] === idempotencyKey
  );
  if (existing) return { session: existing, resumed: true };

  const sessionId = randomUUID();
  const session: FNOLSessionDoc = {
    id: sessionId,
    sessionId,
    callerId,
    personaId: opts.personaId,
    policyRef: opts.policyRef,
    phase: 'GREETING',
    lastClientEventSeq: -1,
    idempotencyLog: { __create__: idempotencyKey },
    messages: [],
    consentArtifacts: [],
    evidenceItems: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await repo.upsert(session);

  emitAudit({
    requestId: randomUUID(),
    sessionId,
    phase: 'GREETING',
    step: 'session_created',
    outcome: 'success',
    actor: callerId,
    timestamp: session.createdAt,
  });

  return { session, resumed: false };
}

export async function getSession(sessionId: string): Promise<FNOLSession | null> {
  return repo.findById(sessionId);
}

export async function getSessionByClaimId(claimId: string): Promise<FNOLSession | null> {
  const matches = await repo.query<FNOLSessionDoc>({
    query: 'SELECT * FROM c WHERE c.claimId = @claimId OFFSET 0 LIMIT 1',
    parameters: [{ name: '@claimId', value: claimId }],
  });
  return matches[0] ?? null;
}

export interface AddTurnResult {
  response: string;
  confidence?: number;
  escalateToHuman: boolean;
  phase: FNOLPhase;
  replay: boolean;
}

export async function recordTurn(
  sessionId: string,
  clientEventSeq: number,
  idempotencyKey: string,
  userQuery: string,
  agentResponse: string,
  confidence?: number,
  escalateToHuman?: boolean,
  agentPhase?: FNOLPhase
): Promise<AddTurnResult> {
  const session = await repo.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });

  if (session.idempotencyLog[idempotencyKey]) {
    return {
      ...(session.idempotencyLog[idempotencyKey] as AddTurnResult),
      replay: true,
    };
  }

  if (clientEventSeq <= session.lastClientEventSeq) {
    emitAudit({
      requestId: randomUUID(),
      sessionId,
      phase: session.phase,
      step: 'turn_conflict',
      outcome: 'conflict',
      timestamp: new Date().toISOString(),
      detail: { clientEventSeq, lastClientEventSeq: session.lastClientEventSeq },
    });
    throw Object.assign(
      new Error(`clientEventSeq ${clientEventSeq} conflicts with last accepted ${session.lastClientEventSeq}`),
      { status: 409, code: 'SEQ_CONFLICT' }
    );
  }

  const newPhase = advancePhase(session.phase, agentResponse, agentPhase);
  if (newPhase === 'ESCALATED' && session.phase !== 'ESCALATED') {
    session.escalatedAt = new Date().toISOString();
  }

  session.phase = newPhase;
  session.lastClientEventSeq = clientEventSeq;
  session.updatedAt = new Date().toISOString();
  session.messages.push({
    role: 'user',
    content: userQuery,
    timestamp: session.updatedAt,
    clientEventSeq,
  });
  session.messages.push({
    role: 'assistant',
    content: agentResponse,
    confidence,
    timestamp: session.updatedAt,
    clientEventSeq,
  });

  const result: AddTurnResult = {
    response: agentResponse,
    confidence,
    escalateToHuman: escalateToHuman ?? false,
    phase: newPhase,
    replay: false,
  };

  session.idempotencyLog[idempotencyKey] = result;
  await repo.upsert(session);

  emitAudit({
    requestId: randomUUID(),
    sessionId,
    phase: newPhase,
    step: 'turn_recorded',
    outcome: 'success',
    timestamp: session.updatedAt,
    detail: { clientEventSeq, escalateToHuman },
  });

  return result;
}

export async function recordConsent(sessionId: string, req: ConsentRequest): Promise<ConsentArtifact> {
  const session = await repo.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });

  if (session.idempotencyLog[req.idempotencyKey]) {
    return session.idempotencyLog[req.idempotencyKey] as ConsentArtifact;
  }

  const artifact: ConsentArtifact = {
    id: randomUUID(),
    sessionId,
    consentType: req.consentType,
    timestamp: new Date().toISOString(),
    channel: req.channel,
    actorId: req.actorId,
  };

  session.consentArtifacts.push(artifact);
  session.idempotencyLog[req.idempotencyKey] = artifact;
  session.updatedAt = new Date().toISOString();
  await repo.upsert(session);

  emitAudit({
    requestId: randomUUID(),
    sessionId,
    phase: session.phase,
    step: 'consent_recorded',
    outcome: 'success',
    actor: req.actorId,
    timestamp: artifact.timestamp,
    detail: { consentType: req.consentType, channel: req.channel },
  });

  return artifact;
}

export async function addEvidence(sessionId: string, req: EvidenceRequest): Promise<EvidenceItem> {
  const session = await repo.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });

  if (session.idempotencyLog[req.idempotencyKey]) {
    return session.idempotencyLog[req.idempotencyKey] as EvidenceItem;
  }

  const item: EvidenceItem = {
    id: randomUUID(),
    sessionId,
    type: req.type,
    filename: req.filename,
    mimeType: req.mimeType,
    policeRef: req.policeRef,
    storedAt: new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
    blobName: req.blobName,
    containerName: req.containerName,
    category: req.category,
    analysisText: req.analysisText,
  };

  session.evidenceItems.push(item);
  session.idempotencyLog[req.idempotencyKey] = item;
  session.updatedAt = new Date().toISOString();
  await repo.upsert(session);

  emitAudit({
    requestId: randomUUID(),
    sessionId,
    phase: session.phase,
    step: 'evidence_added',
    outcome: 'success',
    timestamp: item.uploadedAt,
    detail: { type: req.type, filename: req.filename },
  });

  return item;
}

export async function transitionPhase(sessionId: string, newPhase: FNOLPhase): Promise<FNOLSession> {
  const session = await repo.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });

  const prevPhase = session.phase;
  session.phase = newPhase;
  session.updatedAt = new Date().toISOString();
  await repo.upsert(session);

  emitAudit({
    requestId: randomUUID(),
    sessionId,
    phase: newPhase,
    step: 'phase_transition',
    outcome: 'success',
    timestamp: session.updatedAt,
    detail: { from: prevPhase, to: newPhase },
  });

  return session;
}

export async function submitSession(
  sessionId: string,
  claimId: string,
  idempotencyKey: string
): Promise<{ claimId: string }> {
  const session = await repo.findById(sessionId);
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });

  if (session.idempotencyLog[idempotencyKey]) {
    return session.idempotencyLog[idempotencyKey] as { claimId: string };
  }

  session.claimId = claimId;
  session.phase = 'SUBMITTED';
  session.idempotencyLog[idempotencyKey] = { claimId };
  session.updatedAt = new Date().toISOString();
  await repo.upsert(session);

  emitAudit({
    requestId: randomUUID(),
    sessionId,
    phase: 'SUBMITTED',
    step: 'claim_submitted',
    outcome: 'success',
    timestamp: session.updatedAt,
    detail: { claimId },
  });

  return { claimId };
}
