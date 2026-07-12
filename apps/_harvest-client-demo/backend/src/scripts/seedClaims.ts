/**
 * Standalone reseed runner.
 *
 *   npm run seed:claims              # mock agent telemetry (fast, no Foundry calls)
 *   npm run seed:claims -- --real    # drive deployed agents via Foundry where available
 *
 * Wipes all demo claims/telemetry (preserving only Richard Hogan's customer +
 * policy data) and rebuilds the curated production dataset with agent telemetry.
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { reseedClaimDemoData } from '../services/claimsDemoSeeder';

async function main(): Promise<void> {
  const useRealAgents = process.argv.includes('--real');
  console.log(`[seed:claims] Reseeding claim demo data (useRealAgents=${useRealAgents})…`);
  const result = await reseedClaimDemoData({ useRealAgents });
  console.log('[seed:claims] Done:');
  console.table(result);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed:claims] Failed:', err);
  process.exit(1);
});
