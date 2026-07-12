/**
 * Interaction Service — orchestrates audit persistence and semantic indexing.
 *
 * Call `recordInteraction()` from any agent route after a successful agent call.
 * It writes to Cosmos DB and indexes to AI Search in a fire-and-forget pattern
 * so latency never blocks the response to the caller.
 *
 * Call `getRelevantContext()` before an agent call to retrieve scoped past
 * interactions. Always scoped to a session or claim — never cross-claimant.
 */

import { randomUUID } from 'crypto';
import { writeInteraction, getPersistenceMode, type InteractionDoc } from './cosmosService';
import { indexInteraction, retrieveContext, getSearchMode } from './aiSearchService';

export type { InteractionDoc };

// ── Record ─────────────────────────────────────────────────────────────────

/**
 * Persist an agent interaction turn-pair (user + assistant) to Cosmos DB and
 * index it in Azure AI Search. Both are best-effort — failures are logged but
 * never thrown.
 */
export function recordInteraction(doc: Omit<InteractionDoc, 'id' | 'ts'>): void {
  const full: InteractionDoc = {
    ...doc,
    id: randomUUID(),
    ts: new Date().toISOString(),
  };

  // Fire-and-forget — deliberately not awaited so the calling route returns fast.
  void writeInteraction(full).catch(() => {});
  void indexInteraction(full).catch(() => {});
}

// ── Retrieve ───────────────────────────────────────────────────────────────

/**
 * Retrieve relevant past interaction context for injection into agent prompts.
 * Scoped to a single session or claim — never crosses claimant boundaries.
 *
 * Returns an array of formatted context strings, or [] if AI Search is not
 * configured or the query fails.
 */
export async function getRelevantContext(opts: {
  sessionId?: string;
  claimId?: string;
  queryText: string;
  topN?: number;
}): Promise<string[]> {
  return retrieveContext(opts);
}

/**
 * Format retrieved context lines into a prompt block suitable for injection
 * into `overrideInstructions` (not into conversation history).
 *
 * Returns an empty string when there is no context so callers can safely
 * append it without adding whitespace.
 */
export function formatContextBlock(lines: string[]): string {
  if (!lines.length) return '';
  return [
    '\n\n--- RELEVANT PAST INTERACTIONS (from this session/claim) ---',
    ...lines,
    '--- END RELEVANT PAST INTERACTIONS ---\n',
  ].join('\n');
}

// ── Diagnostics ────────────────────────────────────────────────────────────

/** Summary of active persistence/search modes for the /health endpoint. */
export function getInteractionMode(): {
  persistence: ReturnType<typeof getPersistenceMode>;
  search: ReturnType<typeof getSearchMode>;
} {
  return {
    persistence: getPersistenceMode(),
    search: getSearchMode(),
  };
}
