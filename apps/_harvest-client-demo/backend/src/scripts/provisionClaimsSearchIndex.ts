/**
 * Provision the Azure AI Search `claims-chunks` index used by Digital Steward
 * for true vector/hybrid RAG retrieval over claim chunks.
 *
 *   npm run provision:claims-search
 *
 * Idempotent — safe to re-run. This is separate from `provision:search`
 * (which provisions the unrelated `agent-interactions` telemetry index).
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { provisionClaimsChunksIndex } from '../services/aiSearchService';

async function main(): Promise<void> {
  console.log('[provision:claims-search] Provisioning claims-chunks index…');
  const result = await provisionClaimsChunksIndex();
  console.log(`[provision:claims-search] Done — index '${result.name}' ${result.created ? 'created' : 'updated'}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[provision:claims-search] Failed:', err);
  process.exit(1);
});
