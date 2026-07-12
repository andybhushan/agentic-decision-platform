/**
 * Provision the Azure AI Search `agent-interactions` index.
 *
 *   npm run provision:search
 *
 * Idempotent — safe to re-run. Creates the index (with vector search) if it is
 * missing, or updates the schema in place. After this runs, agent-interaction
 * telemetry emitted by the seeder/agents becomes searchable instead of logging
 * non-fatal 404s.
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { provisionIndex } from '../services/aiSearchService';

async function main(): Promise<void> {
  console.log('[provision:search] Provisioning agent-interactions index…');
  const result = await provisionIndex();
  console.log(`[provision:search] Done — index '${result.name}' ${result.created ? 'created' : 'updated'}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[provision:search] Failed:', err);
  process.exit(1);
});
