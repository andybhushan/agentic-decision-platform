/**
 * Azure Cosmos DB (NoSQL) persistence for agent interaction audit.
 *
 * Graceful fallback: if COSMOS_ENDPOINT is not set, every method is a no-op
 * and a single startup warning is logged. Nothing in the hot path crashes.
 *
 * Container: agent-interactions  |  Partition key: /sessionId
 */

import { CosmosClient, type CosmosClientOptions, type Container } from '@azure/cosmos';
import { randomUUID } from 'crypto';
import { CosmosRepository } from './cosmosRepository';

export interface InteractionDoc {
  /** Cosmos document id — set by caller or auto-generated. */
  id?: string;
  agentId: string;
  sessionId: string;
  claimId?: string;
  callerId?: string;
  interactionType: 'fnol_turn' | 'fnol_submit' | 'agent_test' | 'ai_review' | 'ai_generate' | 'ai_spec' | 'steward_chat' | 'steward_briefing' | 'steward_sop_sync' | 'settlement_decision';
  userContent: string;
  assistantContent: string;
  phase?: string;
  confidence?: number;
  escalated?: boolean;
  escalationReason?: string;
  ts: string;

  // ── Runtime timing ────────────────────────────────────────────────────────
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;

  // ── Model ─────────────────────────────────────────────────────────────────
  modelId?: string;
  modelVersion?: string;
  deploymentId?: string;

  // ── Tokens & cost ─────────────────────────────────────────────────────────
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;

  // ── Tool calls ────────────────────────────────────────────────────────────
  toolCalls?: Array<{
    toolName: string;
    success: boolean;
    durationMs?: number;
    errorCode?: string;
    inputSummary?: string;
  }>;
  toolCallsTotal?: number;
  toolCallsFailed?: number;

  // ── Policy & governance ───────────────────────────────────────────────────
  policyEvaluations?: Array<{
    policyId: string;
    outcome: 'passed' | 'failed' | 'blocked' | 'violation';
    threshold?: number;
    actual?: number;
    actionTaken?: 'none' | 'override';
    severity?: 'critical' | 'high' | 'medium' | 'low';
  }>;
  policyViolations?: number;

  // ── Risk ──────────────────────────────────────────────────────────────────
  riskScore?: number;

  // ── Routing & context ─────────────────────────────────────────────────────
  channelId?: string;
  callerType?: 'customer' | 'adjuster' | 'system';
  operatingContext?: 'standalone' | 'orchestrated';

  // ── Distributed tracing ───────────────────────────────────────────────────
  traceId?: string;
  spanId?: string;
  requestId?: string;

  // ── Outcome ───────────────────────────────────────────────────────────────
  status?: 'success' | 'error' | 'timeout' | 'escalated';
  errorCode?: string;
  errorMessage?: string;

  /** Extra freeform metadata (route, operation, etc.) */
  meta?: Record<string, unknown>;
}

// ── Config ─────────────────────────────────────────────────────────────────

const CONTAINER_NAME = 'agent-interactions';

let _container: Container | null = null;
let _initAttempted = false;

function getContainer(): Container | null {
  if (_initAttempted) return _container;
  _initAttempted = true;

  // Read lazily — dotenv has already run by the time this is first called.
  const endpoint = process.env.COSMOS_ENDPOINT ?? '';
  const key = process.env.COSMOS_KEY ?? '';
  const dbName = process.env.COSMOS_DB_NAME ?? 'project-imagine';

  if (!endpoint) {
    console.warn('[CosmosService] COSMOS_ENDPOINT not set — audit persistence disabled (JSON fallback active)');
    return null;
  }

  try {
    const opts: CosmosClientOptions = key
      ? { endpoint, key }
      : { endpoint }; // managed identity via DefaultAzureCredential when no key
    const client = new CosmosClient(opts);
    _container = client.database(dbName).container(CONTAINER_NAME);
    console.info(`[CosmosService] Connected → ${dbName}/${CONTAINER_NAME}`);
    return _container;
  } catch (err) {
    console.error('[CosmosService] Init failed — falling back to JSON:', err);
    return null;
  }
}

export type WorkforceDoc = Record<string, unknown> & { id: string };

const workforcesRepo = new CosmosRepository<WorkforceDoc>('workforces');

async function ensureWorkforcesContainer(): Promise<void> {
  const ready = await workforcesRepo.ensureContainer('/id');
  if (!ready) {
    const error = new Error('Cosmos DB is not configured for workforces');
    (error as Error & { status?: number; code?: string }).status = 503;
    (error as Error & { status?: number; code?: string }).code = 'COSMOS_UNAVAILABLE';
    throw error;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Upsert an interaction document. No-op if Cosmos is not configured. */
export async function writeInteraction(doc: InteractionDoc): Promise<void> {
  const container = getContainer();
  if (!container) return;

  const record = { ...doc, id: doc.id ?? randomUUID() };
  try {
    await container.items.upsert(record);
  } catch (err) {
    console.error('[CosmosService] writeInteraction failed (non-fatal):', err);
  }
}

/** Retrieve all interactions for a session, ordered by ts asc. */
export async function getSessionHistory(sessionId: string): Promise<InteractionDoc[]> {
  const container = getContainer();
  if (!container) return [];

  try {
    const { resources } = await container.items
      .query<InteractionDoc>({
        query: 'SELECT * FROM c WHERE c.sessionId = @sid ORDER BY c.ts ASC',
        parameters: [{ name: '@sid', value: sessionId }],
      })
      .fetchAll();
    return resources;
  } catch (err) {
    console.error('[CosmosService] getSessionHistory failed:', err);
    return [];
  }
}

/** Retrieve all interactions for a claim, ordered by ts asc. */
export async function getClaimHistory(claimId: string): Promise<InteractionDoc[]> {
  const container = getContainer();
  if (!container) return [];

  try {
    const { resources } = await container.items
      .query<InteractionDoc>({
        query: 'SELECT * FROM c WHERE c.claimId = @cid ORDER BY c.ts ASC',
        parameters: [{ name: '@cid', value: claimId }],
      })
      .fetchAll();
    return resources;
  } catch (err) {
    console.error('[CosmosService] getClaimHistory failed:', err);
    return [];
  }
}

/** Retrieve up to `limit` recent interactions for an agent (cross-partition query). */
export async function getAgentInteractions(agentId: string, limit = 200): Promise<InteractionDoc[]> {
  const container = getContainer();
  if (!container) return [];

  try {
    const { resources } = await container.items
      .query<InteractionDoc>({
        query: 'SELECT TOP @limit c.id, c.agentId, c.sessionId, c.claimId, c.callerId, c.interactionType, c.phase, c.confidence, c.escalated, c.ts, c.inputTokens, c.outputTokens, c.meta FROM c WHERE c.agentId = @aid ORDER BY c.ts DESC',
        parameters: [
          { name: '@aid', value: agentId },
          { name: '@limit', value: limit },
        ],
      }, {})
      .fetchAll();
    return resources;
  } catch (err) {
    console.error('[CosmosService] getAgentInteractions failed:', err);
    return [];
  }
}

/** Retrieve up to `limit` recent interactions across all agents. */
export async function getRecentInteractions(limit = 2000): Promise<InteractionDoc[]> {
  const container = getContainer();
  if (!container) return [];

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(5000, Math.floor(limit))) : 2000;
  try {
    const { resources } = await container.items
      .query<InteractionDoc>({
        query: 'SELECT TOP @limit c.id, c.agentId, c.sessionId, c.claimId, c.callerId, c.interactionType, c.phase, c.confidence, c.escalated, c.ts, c.inputTokens, c.outputTokens, c.meta FROM c ORDER BY c.ts DESC',
        parameters: [{ name: '@limit', value: safeLimit }],
      }, {})
      .fetchAll();
    return resources;
  } catch (err) {
    console.error('[CosmosService] getRecentInteractions failed:', err);
    return [];
  }
}

/** Delete all interaction telemetry documents. Returns number of deleted rows. */
export async function clearAllInteractions(): Promise<number> {
  const container = getContainer();
  if (!container) return 0;

  try {
    const { resources } = await container.items.readAll<{ id?: string; sessionId?: string }>().fetchAll();

    if (resources.length === 0) return 0;
    let deleted = 0;
    await Promise.all(resources.map(async (resource) => {
      if (!resource.id) return;
      try {
        const pk = resource.sessionId ?? resource.id;
        await container.item(resource.id, pk).delete();
        deleted += 1;
      } catch (primaryErr) {
        if (resource.sessionId && resource.sessionId !== resource.id) {
          try {
            await container.item(resource.id, resource.id).delete();
            deleted += 1;
            return;
          } catch (fallbackErr) {
            console.error('[CosmosService] clearAllInteractions delete failed:', fallbackErr);
            return;
          }
        }
        console.error('[CosmosService] clearAllInteractions delete failed:', primaryErr);
      }
    }));
    return deleted;
  } catch (err) {
    console.error('[CosmosService] clearAllInteractions failed:', err);
    return 0;
  }
}


export async function getWorkforces(): Promise<WorkforceDoc[]> {
  await ensureWorkforcesContainer();
  return workforcesRepo.findAll();
}

export async function getWorkforce(id: string): Promise<WorkforceDoc | null> {
  await ensureWorkforcesContainer();
  return workforcesRepo.findById(id);
}

export async function upsertWorkforce(workforce: unknown): Promise<WorkforceDoc> {
  await ensureWorkforcesContainer();
  if (!workforce || typeof workforce !== 'object' || typeof (workforce as { id?: unknown }).id !== 'string') {
    const error = new Error('Workforce payload must include a string id');
    (error as Error & { status?: number; code?: string }).status = 400;
    (error as Error & { status?: number; code?: string }).code = 'INVALID_WORKFORCE';
    throw error;
  }

  return workforcesRepo.upsert(workforce as WorkforceDoc);
}

/** Return the active persistence mode for health/diagnostics. */
export function getPersistenceMode(): 'cosmos' | 'json' {
  return getContainer() ? 'cosmos' : 'json';
}
