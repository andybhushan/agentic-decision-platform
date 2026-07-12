/**
 * Provision the Azure AI Search `sop-chunks` index used by Digital Steward to
 * retrieve Standard Operating Procedure (SOP) sections as agent controls.
 *
 *   npm run provision:sop-search
 *
 * Idempotent — safe to re-run. Separate from `provision:claims-search`
 * (claim-chunk RAG) and `provision:search` (agent-interactions telemetry).
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { provisionSopChunksIndex } from '../services/aiSearchService';

async function main(): Promise<void> {
  console.log('[provision:sop-search] Provisioning sop-chunks index…');
  const result = await provisionSopChunksIndex();
  console.log(`[provision:sop-search] Done — index '${result.name}' ${result.created ? 'created' : 'updated'}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[provision:sop-search] Failed:', err);
  process.exit(1);
});
