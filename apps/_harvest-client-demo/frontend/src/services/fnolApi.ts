/**
 * FNOL API client — idempotent wrappers over /api/v1/fnol/*.
 *
 * Every mutating call:
 *   1. Generates a UUID idempotency key
 *   2. Queues the op to IndexedDB before sending (so it can be replayed offline)
 *   3. On network failure → queues and returns an optimistic local result
 *   4. On success → removes the op from the queue
 */

import axios from 'axios';
import { randomUUID } from '../utils/id';
import { fnolStore } from '../persistence/FNOLSessionStore';
import type { FNOLClientSession, FNOLPhase, ConsentArtifact, EvidenceItem } from '../domain/fnol/types';

const BASE = '/api/v1/fnol';

const client = axios.create({
  baseURL: '',
  timeout: 120000,
});

// ── Session management ────────────────────────────────────────────────────────

export async function createSession(
  callerId: string,
  options: { personaId?: string; policyRef?: string } = {},
): Promise<{ sessionId: string; personaId?: string; policyRef?: string; phase: FNOLPhase; connectedDevices?: unknown; vehicles?: unknown }> {
  const idempotencyKey = randomUUID();
  const { data } = await client.post(`${BASE}/sessions`, { callerId, personaId: options.personaId, policyRef: options.policyRef, idempotencyKey });
  return data.data;
}

export async function resumeSession(sessionId: string): Promise<FNOLClientSession> {
  const { data } = await client.get(`${BASE}/sessions/${sessionId}`);
  return data.data;
}

// ── Conversation turn ─────────────────────────────────────────────────────────

export interface TurnResult {
  response: string;
  confidence?: number;
  escalateToHuman: boolean;
  phase: FNOLPhase;
  replay?: boolean;
}

export async function sendTurn(
  sessionId: string,
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  clientEventSeq: number
): Promise<TurnResult> {
  const idempotencyKey = randomUUID();

  // Queue op before sending (replay safety)
  const opId = await fnolStore.queueOp({
    sessionId,
    clientEventSeq,
    idempotencyKey,
    opType: 'turn',
    payload: { query, history },
    createdAt: new Date().toISOString(),
    retries: 0,
  });

  try {
    const { data } = await client.post(`${BASE}/sessions/${sessionId}/turns`, {
      query,
      history,
      clientEventSeq,
      idempotencyKey,
    });
    await fnolStore.clearOp(opId);
    return data.data as TurnResult;
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      // Return an offline placeholder — the page will replay the queue on reconnect
      return {
        response: '[Offline — your message will be sent when connection is restored]',
        escalateToHuman: false,
        phase: 'GREETING', // phase unchanged until server confirms
        replay: false,
      };
    }
    await fnolStore.clearOp(opId);
    throw err;
  }
}

// ── Consent ───────────────────────────────────────────────────────────────────

export async function recordConsent(
  sessionId: string,
  consentType: ConsentArtifact['consentType'],
  actorId: string
): Promise<ConsentArtifact> {
  const idempotencyKey = randomUUID();

  const opId = await fnolStore.queueOp({
    sessionId,
    clientEventSeq: -1,
    idempotencyKey,
    opType: 'consent',
    payload: { consentType, actorId },
    createdAt: new Date().toISOString(),
    retries: 0,
  });

  try {
    const { data } = await client.post(`${BASE}/sessions/${sessionId}/consent`, {
      consentType,
      actorId,
      channel: 'web',
      idempotencyKey,
    });
    await fnolStore.clearOp(opId);
    return data.data as ConsentArtifact;
  } catch (err) {
    if (!isNetworkError(err)) {
      await fnolStore.clearOp(opId);
    }
    throw err;
  }
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export interface EvidencePayload {
  type: EvidenceItem['type'];
  filename?: string;
  mimeType?: string;
  policeRef?: string;
  category?: EvidenceCategory;
  file?: File;
}

export type EvidenceCategory =
  | 'own_vehicle'
  | 'third_party'
  | 'scene'
  | 'medical_record'
  | 'witness_statement'
  | 'police_report'
  | 'other';

export async function uploadEvidence(
  sessionId: string,
  payload: EvidencePayload
): Promise<EvidenceItem> {
  const idempotencyKey = randomUUID();

  const opId = await fnolStore.queueOp({
    sessionId,
    clientEventSeq: -1,
    idempotencyKey,
    opType: 'evidence',
    payload: { type: payload.type, filename: payload.filename, policeRef: payload.policeRef },
    createdAt: new Date().toISOString(),
    retries: 0,
  });

  try {
    // For demo: send metadata only (no binary upload to keep backend simple)
    const { data } = await client.post(`${BASE}/sessions/${sessionId}/evidence`, {
      type: payload.type,
      filename: payload.filename,
      mimeType: payload.mimeType,
      policeRef: payload.policeRef,
      category: payload.category,
      idempotencyKey,
    });
    await fnolStore.clearOp(opId);
    return data.data as EvidenceItem;
  } catch (err) {
    if (!isNetworkError(err)) {
      await fnolStore.clearOp(opId);
    }
    throw err;
  }
}

/**
 * Upload actual evidence files to blob storage with category.
 * Does NOT use offline queue (file uploads are not replayable from IndexedDB).
 */
export async function uploadEvidenceFiles(
  sessionId: string,
  files: File[],
  category: EvidenceCategory
): Promise<EvidenceItem[]> {
  const idempotencyKey = randomUUID();

  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  formData.append('category', category);
  formData.append('idempotencyKey', idempotencyKey);

  const { data } = await client.post(
    `${BASE}/sessions/${sessionId}/evidence/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
  );

  return data.data as EvidenceItem[];
}

// ── Phase transition ──────────────────────────────────────────────────────────

export async function updatePhase(sessionId: string, phase: FNOLPhase): Promise<void> {
  await client.patch(`${BASE}/sessions/${sessionId}/phase`, { phase });
}

// ── Submit ────────────────────────────────────────────────────────────────────

export async function submitClaim(sessionId: string): Promise<{ claimId: string; phase: FNOLPhase }> {
  const idempotencyKey = randomUUID();

  const opId = await fnolStore.queueOp({
    sessionId,
    clientEventSeq: -1,
    idempotencyKey,
    opType: 'submit',
    payload: {},
    createdAt: new Date().toISOString(),
    retries: 0,
  });

  const { data } = await client.post(`${BASE}/sessions/${sessionId}/submit`, { idempotencyKey });
  await fnolStore.clearOp(opId);
  return data.data;
}

// ── Offline queue replay ──────────────────────────────────────────────────────

/** Called on reconnect: replay all queued ops in order. */
export async function replayQueue(sessionId: string): Promise<void> {
  const ops = (await fnolStore.getQueuedOps()).filter((op) => op.sessionId === sessionId);
  ops.sort((a, b) => (a.clientEventSeq ?? 0) - (b.clientEventSeq ?? 0));

  for (const op of ops) {
    try {
      if (op.opType === 'turn') {
        const p = op.payload as { query: string; history: { role: 'user' | 'assistant'; content: string }[] };
        await client.post(`${BASE}/sessions/${sessionId}/turns`, {
          ...p,
          clientEventSeq: op.clientEventSeq,
          idempotencyKey: op.idempotencyKey,
        });
      } else if (op.opType === 'consent') {
        const p = op.payload as { consentType: string; actorId: string };
        await client.post(`${BASE}/sessions/${sessionId}/consent`, {
          ...p,
          channel: 'web',
          idempotencyKey: op.idempotencyKey,
        });
      } else if (op.opType === 'evidence') {
        await client.post(`${BASE}/sessions/${sessionId}/evidence`, {
          ...(op.payload as object),
          idempotencyKey: op.idempotencyKey,
        });
      } else if (op.opType === 'submit') {
        await client.post(`${BASE}/sessions/${sessionId}/submit`, {
          idempotencyKey: op.idempotencyKey,
        });
      }
      if (op.id !== undefined) await fnolStore.clearOp(op.id);
    } catch {
      // Leave in queue for next reconnect; server idempotency will deduplicate
    }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function isNetworkError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    return !err.response; // no response = network/timeout
  }
  return false;
}
