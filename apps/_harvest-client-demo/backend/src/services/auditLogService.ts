/**
 * Audit Log Service for recording deployments to Cosmos DB.
 * Collection: deploymentAuditLog (partition key: /deployedBy)
 * Graceful degradation if Cosmos not available.
 */

import { randomUUID } from 'crypto';
import { CosmosClient, type Container } from '@azure/cosmos';
import { entraService, type EntraUserProfile } from './entraService';
import { a365Service, type A365UnusualAccessPatterns } from './a365Service';

export interface DeploymentAudit {
  id: string;
  agentId: string;
  deployedBy: string; // userId (partition key)
  deployedByName: string;
  deployedAt: string;
  version: string;
  entraProfile?: EntraUserProfile | null;
  a365Signals?: A365UnusualAccessPatterns | null;
}

const CONTAINER_NAME = 'deploymentAuditLog';

let _container: Container | null = null;
let _initAttempted = false;

function getContainer(): Container | null {
  if (_initAttempted) return _container;
  _initAttempted = true;

  const endpoint = process.env.COSMOS_ENDPOINT ?? '';
  const key = process.env.COSMOS_KEY ?? '';
  const dbName = process.env.COSMOS_DB_NAME ?? 'project-imagine';

  if (!endpoint) {
    console.warn('[AuditLogService] COSMOS_ENDPOINT not set — audit log persistence disabled');
    return null;
  }

  try {
    const client = new CosmosClient(key ? { endpoint, key } : { endpoint });
    _container = client.database(dbName).container(CONTAINER_NAME);
    console.info(`[AuditLogService] Connected to Cosmos container '${CONTAINER_NAME}'`);
  } catch (error) {
    console.error('[AuditLogService] Failed to initialize Cosmos container:', error);
  }

  return _container;
}

export async function recordDeployment(
  agentId: string,
  userId: string,
  userName: string,
  entraProfile?: EntraUserProfile | null,
  a365Signals?: A365UnusualAccessPatterns | null
): Promise<void> {
  try {
    const container = getContainer();
    if (!container) {
      console.info('[AuditLogService] Cosmos not available, skipping audit log');
      return;
    }

    const audit: DeploymentAudit = {
      id: randomUUID(),
      agentId,
      deployedBy: userId,
      deployedByName: userName,
      deployedAt: new Date().toISOString(),
      version: '1.0',
      entraProfile,
      a365Signals,
    };

    await container.items.create(audit);
    console.info(`[AuditLogService] Recorded deployment: ${agentId} by ${userId}`);
  } catch (error) {
    console.error('[AuditLogService] Failed to record deployment:', error);
    // Non-fatal: do not throw
  }
}

export async function getRecentDeployments(
  limitDays = 30,
  limit = 50
): Promise<DeploymentAudit[]> {
  try {
    const container = getContainer();
    if (!container) {
      console.info('[AuditLogService] Cosmos not available, returning empty list');
      return [];
    }

    const since = new Date();
    since.setDate(since.getDate() - limitDays);
    const sinceIso = since.toISOString();

    // Query for recent deployments (no need for parameters in basic query)
    const query = `
      SELECT * FROM c
      WHERE c.deployedAt >= '${sinceIso}'
      ORDER BY c.deployedAt DESC
    `;

    const { resources } = await container.items
      .query<DeploymentAudit>(query)
      .fetchAll();

    return resources.slice(0, limit);
  } catch (error) {
    console.error('[AuditLogService] Failed to fetch deployments:', error);
    return [];
  }
}
