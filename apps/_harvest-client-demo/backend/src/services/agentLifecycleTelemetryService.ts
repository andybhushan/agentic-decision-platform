/**
 * Agent Lifecycle Telemetry Service
 *
 * Records a rich, immutable audit event to Cosmos DB for every meaningful
 * change in an agent's lifecycle:
 *
 *   agent_created   — first time an agent definition is saved
 *   agent_updated   — any field change, with a full before/after diff
 *   agent_deployed  — pushed to Azure AI Foundry (or any runtime)
 *   agent_revoked   — deployment suspended / access withdrawn
 *   agent_deleted   — agent permanently removed
 *
 * Container: agentLifecycle  |  Partition key: /agentId
 *
 * All writes are fire-and-forget / non-fatal so they never block responses.
 */

import { randomUUID, createHash } from 'crypto';
import { CosmosRepository } from './cosmosRepository';
import type { Agent } from '../types';
import type { EntraUserProfile } from './entraService';
import type { A365UnusualAccessPatterns } from './a365Service';

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentLifecycleEventType =
  | 'agent_created'
  | 'agent_updated'
  | 'agent_deployed'
  | 'agent_revoked'
  | 'agent_deleted';

export interface AgentLifecycleEvent {
  id: string;
  eventType: AgentLifecycleEventType;

  // Agent identity
  agentId: string;
  agentName: string;
  agentVersion: string;
  agentArchetype?: string;
  agentAuthorityLevel?: string;

  // Timestamp (also used for Cosmos TTL / ordering)
  ts: string;

  // Actor who triggered the event
  actorId: string;
  actorName: string;
  actorEmail?: string;

  // HTTP request context
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  triggerSource: 'ui' | 'api' | 'workflow' | 'system';

  // ── Deploy-specific ──────────────────────────────────────────────────────
  deploymentId?: string;
  deploymentEndpoint?: string;
  modelId?: string;
  /** SHA-256 of the spec/prompt used at deploy time. */
  specHash?: string;
  specLength?: number;
  specGeneratedAt?: string;
  environment?: string;

  // ── Update-specific ──────────────────────────────────────────────────────
  /** Top-level field names that changed. */
  changedFields?: string[];
  /** Snapshot of the changed fields *before* the update. */
  previousSnapshot?: Record<string, unknown>;
  /** Snapshot of the changed fields *after* the update. */
  newSnapshot?: Record<string, unknown>;
  changeReason?: string;

  // ── Revoke-specific ──────────────────────────────────────────────────────
  revokeReason?: string;
  wasDeployed?: boolean;
  lastActiveAt?: string;
  totalInteractionCount?: number;

  // ── Agent profile snapshot at event time ─────────────────────────────────
  agentSnapshot: {
    status?: string;
    capabilities: string[];
    limitations: string[];
    governanceControls: string[];
    escalationCriteria: string[];
    systemPromptLength?: number;
    hasGeneratedSpec: boolean;
    hasFoundryDeployment: boolean;
    operatingModes: string[];
    interactionStyle?: string;
    orchestrates?: string[];
  };

  // ── Identity & governance signals ────────────────────────────────────────
  entraProfile?: EntraUserProfile | null;
  a365Signals?: A365UnusualAccessPatterns | null;
}

// ── Repository ─────────────────────────────────────────────────────────────

const lifecycleRepo = new CosmosRepository<AgentLifecycleEvent>('agentLifecycle');

let _containerReady: boolean | null = null;

async function isReady(): Promise<boolean> {
  if (_containerReady !== null) return _containerReady;
  _containerReady = await lifecycleRepo.ensureContainer('/agentId');
  return _containerReady;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function snapshotAgent(agent: Agent): AgentLifecycleEvent['agentSnapshot'] {
  return {
    capabilities: agent.capabilities ?? [],
    limitations: agent.limitations ?? [],
    governanceControls: (agent.governanceControls ?? []).map(c => c.type ?? String(c)),
    escalationCriteria: agent.escalationCriteria ?? [],
    systemPromptLength: agent.systemPrompt?.length,
    hasGeneratedSpec: !!(agent.generatedSpec && agent.foundryPrompt),
    hasFoundryDeployment: !!(agent.deploymentId && agent.deploymentEndpoint),
    operatingModes: agent.operatingModes ?? ['standalone'],
    interactionStyle: agent.interactionStyle,
    orchestrates: agent.orchestration?.coordinates,
  };
}

function diffAgents(
  before: Partial<Agent>,
  after: Partial<Agent>
): { changedFields: string[]; prev: Record<string, unknown>; next: Record<string, unknown> } {
  const SKIP = new Set(['updatedAt', 'id']);
  const changedFields: string[] = [];
  const prev: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (SKIP.has(key)) continue;
    const bVal = (before as any)[key];
    const aVal = (after as any)[key];
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changedFields.push(key);
      prev[key] = bVal;
      next[key] = aVal;
    }
  }
  return { changedFields, prev, next };
}

function hashSpec(spec: string): string {
  return createHash('sha256').update(spec).digest('hex').slice(0, 16);
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function recordAgentCreated(opts: {
  agent: Agent;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  triggerSource?: AgentLifecycleEvent['triggerSource'];
  entraProfile?: EntraUserProfile | null;
  a365Signals?: A365UnusualAccessPatterns | null;
}): Promise<void> {
  const event: Omit<AgentLifecycleEvent, 'id' | 'ts'> = {
    eventType: 'agent_created',
    agentId: opts.agent.id,
    agentName: opts.agent.name,
    agentVersion: opts.agent.version,
    agentArchetype: opts.agent.archetype,
    agentAuthorityLevel: opts.agent.authorityLevel,
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorEmail: opts.actorEmail,
    requestId: opts.requestId,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    triggerSource: opts.triggerSource ?? 'ui',
    agentSnapshot: snapshotAgent(opts.agent),
    entraProfile: opts.entraProfile,
    a365Signals: opts.a365Signals,
  };
  await persistEvent(event);
}

export async function recordAgentUpdated(opts: {
  agentBefore: Agent;
  agentAfter: Agent;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  triggerSource?: AgentLifecycleEvent['triggerSource'];
  changeReason?: string;
  entraProfile?: EntraUserProfile | null;
  a365Signals?: A365UnusualAccessPatterns | null;
}): Promise<void> {
  const { changedFields, prev, next } = diffAgents(opts.agentBefore, opts.agentAfter);
  if (changedFields.length === 0) return; // nothing changed, skip

  const event: Omit<AgentLifecycleEvent, 'id' | 'ts'> = {
    eventType: 'agent_updated',
    agentId: opts.agentAfter.id,
    agentName: opts.agentAfter.name,
    agentVersion: opts.agentAfter.version,
    agentArchetype: opts.agentAfter.archetype,
    agentAuthorityLevel: opts.agentAfter.authorityLevel,
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorEmail: opts.actorEmail,
    requestId: opts.requestId,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    triggerSource: opts.triggerSource ?? 'ui',
    changedFields,
    previousSnapshot: prev,
    newSnapshot: next,
    changeReason: opts.changeReason,
    agentSnapshot: snapshotAgent(opts.agentAfter),
    entraProfile: opts.entraProfile,
    a365Signals: opts.a365Signals,
  };
  await persistEvent(event);
}

export async function recordAgentDeployed(opts: {
  agent: Agent;
  deploymentId: string;
  deploymentEndpoint: string;
  modelId?: string;
  specUsed?: string;
  environment?: string;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  triggerSource?: AgentLifecycleEvent['triggerSource'];
  entraProfile?: EntraUserProfile | null;
  a365Signals?: A365UnusualAccessPatterns | null;
}): Promise<void> {
  const event: Omit<AgentLifecycleEvent, 'id' | 'ts'> = {
    eventType: 'agent_deployed',
    agentId: opts.agent.id,
    agentName: opts.agent.name,
    agentVersion: opts.agent.version,
    agentArchetype: opts.agent.archetype,
    agentAuthorityLevel: opts.agent.authorityLevel,
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorEmail: opts.actorEmail,
    requestId: opts.requestId,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    triggerSource: opts.triggerSource ?? 'ui',
    deploymentId: opts.deploymentId,
    deploymentEndpoint: opts.deploymentEndpoint,
    modelId: opts.modelId ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? process.env.FOUNDRY_MODEL_ID,
    specHash: opts.specUsed ? hashSpec(opts.specUsed) : undefined,
    specLength: opts.specUsed?.length,
    specGeneratedAt: opts.agent.specGeneratedAt,
    environment: opts.environment ?? process.env.NODE_ENV ?? 'development',
    agentSnapshot: snapshotAgent(opts.agent),
    entraProfile: opts.entraProfile,
    a365Signals: opts.a365Signals,
  };
  await persistEvent(event);
}

export async function recordAgentRevoked(opts: {
  agent: Agent;
  revokeReason?: string;
  totalInteractionCount?: number;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  triggerSource?: AgentLifecycleEvent['triggerSource'];
  entraProfile?: EntraUserProfile | null;
  a365Signals?: A365UnusualAccessPatterns | null;
}): Promise<void> {
  const event: Omit<AgentLifecycleEvent, 'id' | 'ts'> = {
    eventType: 'agent_revoked',
    agentId: opts.agent.id,
    agentName: opts.agent.name,
    agentVersion: opts.agent.version,
    agentArchetype: opts.agent.archetype,
    agentAuthorityLevel: opts.agent.authorityLevel,
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorEmail: opts.actorEmail,
    requestId: opts.requestId,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    triggerSource: opts.triggerSource ?? 'ui',
    revokeReason: opts.revokeReason,
    wasDeployed: !!(opts.agent.deploymentId && opts.agent.deploymentEndpoint),
    lastActiveAt: opts.agent.deployedAt,
    totalInteractionCount: opts.totalInteractionCount,
    agentSnapshot: snapshotAgent(opts.agent),
    entraProfile: opts.entraProfile,
    a365Signals: opts.a365Signals,
  };
  await persistEvent(event);
}

export async function recordAgentDeleted(opts: {
  agent: Agent;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  triggerSource?: AgentLifecycleEvent['triggerSource'];
}): Promise<void> {
  const event: Omit<AgentLifecycleEvent, 'id' | 'ts'> = {
    eventType: 'agent_deleted',
    agentId: opts.agent.id,
    agentName: opts.agent.name,
    agentVersion: opts.agent.version,
    agentArchetype: opts.agent.archetype,
    agentAuthorityLevel: opts.agent.authorityLevel,
    actorId: opts.actorId,
    actorName: opts.actorName,
    actorEmail: opts.actorEmail,
    requestId: opts.requestId,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    triggerSource: opts.triggerSource ?? 'ui',
    wasDeployed: !!(opts.agent.deploymentId && opts.agent.deploymentEndpoint),
    agentSnapshot: snapshotAgent(opts.agent),
  };
  await persistEvent(event);
}

export async function getAgentLifecycleHistory(
  agentId: string,
  limit = 100
): Promise<AgentLifecycleEvent[]> {
  try {
    if (!(await isReady())) return [];
    return lifecycleRepo.query<AgentLifecycleEvent>({
      query: `SELECT * FROM c WHERE c.agentId = @agentId ORDER BY c.ts DESC OFFSET 0 LIMIT ${limit}`,
      parameters: [{ name: '@agentId', value: agentId }],
    });
  } catch (err) {
    console.error('[AgentLifecycleTelemetry] Failed to query history:', err);
    return [];
  }
}

// ── Internal ───────────────────────────────────────────────────────────────

async function persistEvent(event: Omit<AgentLifecycleEvent, 'id' | 'ts'>): Promise<void> {
  const full: AgentLifecycleEvent = {
    ...event,
    id: randomUUID(),
    ts: new Date().toISOString(),
  };

  try {
    if (!(await isReady())) {
      console.info(
        `[AgentLifecycleTelemetry] Cosmos unavailable — dry-run: ${full.eventType} agent=${full.agentId} actor=${full.actorId}`
      );
      return;
    }
    await lifecycleRepo.upsert(full);
    console.info(
      `[AgentLifecycleTelemetry] ${full.eventType} agent=${full.agentId} actor=${full.actorId} fields=${full.changedFields?.join(',') ?? '-'}`
    );
  } catch (err) {
    console.error('[AgentLifecycleTelemetry] Persist failed (non-fatal):', err);
  }
}
