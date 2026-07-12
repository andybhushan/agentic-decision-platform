/**
 * Data Seeder — seeds all Cosmos DB containers from the archived JSON files.
 *
 * Uses a per-container sentinel document { id: '__seed_meta' } to ensure
 * seeding is idempotent; safe to call on every startup.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CosmosRepository } from './cosmosRepository';

const DATA_DIR = path.join(__dirname, '../../data/_archive');

function readJson<T>(filename: string): T | null {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (err) {
    console.error(`[Seeder] Failed to read ${filename}:`, err);
    return null;
  }
}

async function seedContainer<T extends { id: string }>(
  repo: CosmosRepository<T>,
  name: string,
  docs: T[],
  options: { alwaysUpsert?: boolean } = {}
): Promise<void> {
  if (!(await repo.ensureContainer('/id'))) {
    console.warn(`[Seeder] Cosmos not available — skipping ${name}`);
    return;
  }

  if (!options.alwaysUpsert && (await repo.isSeedComplete())) {
    console.info(`[Seeder] ${name} already seeded — skipping`);
    return;
  }

  console.info(`[Seeder] Seeding ${name} (${docs.length} documents)…`);
  const errors: string[] = [];

  for (const doc of docs) {
    try {
      await repo.upsert(doc);
    } catch (err: any) {
      errors.push(`${doc.id}: ${err.message}`);
    }
  }

  if (errors.length) {
    console.error(`[Seeder] ${name} — ${errors.length} errors:`, errors.slice(0, 5));
  }

  await repo.markSeedComplete();
  console.info(`[Seeder] ${name} seeded ✓`);
}

export async function runSeeder(): Promise<void> {
  console.info('[Seeder] Starting data seed…');

  // ── Agents ──────────────────────────────────────────────────────────────
  const agentsRepo = new CosmosRepository<Record<string, unknown> & { id: string }>('agents');
  const agentsRaw = readJson<unknown[]>('agents.json');
  if (agentsRaw) {
    await seedContainer(agentsRepo, 'agents', agentsRaw as Array<Record<string, unknown> & { id: string }>);
  }

  // ── Claims ───────────────────────────────────────────────────────────────
  // Merge summary list with per-file detail documents (detail wins on conflict).
  const claimsRepo = new CosmosRepository<Record<string, unknown> & { id: string }>('claims');
  const claimsSummary = readJson<Array<Record<string, unknown> & { id: string }>>('claims.json');
  if (claimsSummary) {
    const claimsDir = path.join(DATA_DIR, 'claims');
    const merged = claimsSummary.map((summary) => {
      const detailPath = path.join(claimsDir, `${summary.id}.json`);
      if (fs.existsSync(detailPath)) {
        try {
          const detail = JSON.parse(fs.readFileSync(detailPath, 'utf-8'));
          return { ...summary, ...detail, id: summary.id };
        } catch {
          return summary;
        }
      }
      return summary;
    });
    await seedContainer(claimsRepo, 'claims', merged);
  }

  // ── Policies ─────────────────────────────────────────────────────────────
  // Policies use policyRef as their natural key — normalise id = policyRef.
  const policiesRepo = new CosmosRepository<Record<string, unknown> & { id: string }>('policies');
  const policiesRaw = readJson<Array<Record<string, unknown> & { policyRef: string }>>('policies.json');
  if (policiesRaw) {
    const docs = policiesRaw.map((p) => ({ ...p, id: p.policyRef })) as Array<Record<string, unknown> & { id: string }>;
    await seedContainer(policiesRepo, 'policies', docs);
  }

  // ── Workflows ────────────────────────────────────────────────────────────
  const workflowsRepo = new CosmosRepository<Record<string, unknown> & { id: string }>('workflows');
  const workflowsRaw = readJson<unknown[]>('workflows.json');
  if (workflowsRaw) {
    await seedContainer(workflowsRepo, 'workflows', workflowsRaw as Array<Record<string, unknown> & { id: string }>);
  }

  // ── Workforces ───────────────────────────────────────────────────────────
  const workforcesRepo = new CosmosRepository<Record<string, unknown> & { id: string }>('workforces');
  const workforcesRaw = readJson<unknown[]>('workforces.json');
  if (workforcesRaw) {
    await seedContainer(
      workforcesRepo,
      'workforces',
      workforcesRaw as Array<Record<string, unknown> & { id: string }>,
      { alwaysUpsert: true }
    );
  }

  // ── Verticals ────────────────────────────────────────────────────────────
  const verticalsRepo = new CosmosRepository<Record<string, unknown> & { id: string }>('verticals');
  const verticalsRaw = readJson<unknown[]>('verticals.json');
  if (verticalsRaw) {
    await seedContainer(verticalsRepo, 'verticals', verticalsRaw as Array<Record<string, unknown> & { id: string }>);
  }

  // ── FNOL Sessions ────────────────────────────────────────────────────────
  // fnol-sessions.json is a Record<sessionId, FNOLSession> — normalise id = sessionId.
  const fnolRepo = new CosmosRepository<Record<string, unknown> & { id: string }>('fnol-sessions');
  const fnolRaw = readJson<Record<string, Record<string, unknown> & { sessionId?: string }>>('fnol-sessions.json');
  if (fnolRaw) {
    const docs = Object.entries(fnolRaw).map(([sessionId, session]) => ({
      ...session,
      id: sessionId,
      sessionId,
    })) as Array<Record<string, unknown> & { id: string }>;
    if (docs.length > 0) {
      await seedContainer(fnolRepo, 'fnol-sessions', docs);
    }
  }

  console.info('[Seeder] Data seed complete ✓');
}
