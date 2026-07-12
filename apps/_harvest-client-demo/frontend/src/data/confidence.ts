// Single source of truth for a claim's confidence score, the auto-approval gap,
// and the complexity-driven SLA / effort figures.
//
// The authoritative confidence number is the AI-generated `aiConfidenceScore`
// stored on the claim by the Foundry LLM at seed/FNOL time. Every surface that
// displays a confidence percentage MUST call `confidenceScore(claim)` here —
// never read `aiConfidenceScore` or `confidenceLevel` directly from the claim.

import type { Claim, ClaimComplexity } from '../types';

const clamp = (n: number, min = 0, max = 100): number => Math.max(min, Math.min(max, n));

/** Score at or above which a decision could auto-approve straight-through. */
export const AUTO_APPROVE_THRESHOLD = 90;

/**
 * The unified confidence percentage for a claim.
 * Returns the AI-generated score (`aiConfidenceScore`) produced by the Foundry LLM
 * when the claim was seeded or created via FNOL. Falls back to a rules-based
 * computation from the seeded confidence level + evidence penalties for legacy
 * records that pre-date the AI scoring pipeline.
 */
export function confidenceScore(claim: Claim): number {
  if (typeof claim.aiConfidenceScore === 'number') {
    return clamp(claim.aiConfidenceScore);
  }
  // Fallback for legacy records without AI scoring
  const BASE: Record<string, number> = { high: 88, medium: 72, low: 52 };
  const base = BASE[claim.confidenceLevel] ?? 60;
  const disputed = (claim.narrativeSynthesis ?? []).filter((n) => n.status === 'Disputed').length;
  const pendingEv = (claim.evidenceItems ?? []).filter((e) => e.status !== 'verified').length;
  return clamp(base - disputed * 6 - Math.min(pendingEv, 2) * 3);
}

/** Points of confidence still needed to reach the straight-through threshold. */
export function confidenceGapPts(claim: Claim): number {
  return Math.max(0, AUTO_APPROVE_THRESHOLD - confidenceScore(claim));
}

/**
 * Is this claim eligible for "clear the greens" batch approve? High confidence,
 * no open blocker, not already resolved, and the settlement exposure is within
 * the signed-in adjuster's delegated authority (otherwise it still needs
 * senior sign-off — batch approve never bypasses that governance gate).
 */
export function isBatchApproveEligible(claim: Claim, authorityLimit?: number | null): boolean {
  if (claim.claimStage === 'settlement' || claim.claimStage === 'closed') return false;
  if (claim.blockerReason) return false;
  if (confidenceScore(claim) < AUTO_APPROVE_THRESHOLD) return false;
  const exposure = claim.recommendedAction?.financialImpact?.estimatedAmount ?? 0;
  if (typeof authorityLimit === 'number' && exposure > authorityLimit) return false;
  return true;
}

// Base turnaround hours keyed off complexity. Tier multipliers are then applied
// so high-value clients (Masterpiece/Signature) are served faster and standard
// (Core) clients get the full window.
const SLA_HOURS_BY_COMPLEXITY: Record<ClaimComplexity, number> = {
  low: 24,
  medium: 48,
  high: 72,
};

// Tier multiplier: top-tier clients get a much tighter SLA; Core (standard) is the
// baseline.  Applied as a simple multiplier on the complexity base.
const SLA_TIER_MULTIPLIER: Record<string, number> = {
  signature: 0.25,   // e.g. 6h / 12h / 18h
  white_glove: 0.5,  // e.g. 12h / 24h / 36h
  priority: 0.75,    // e.g. 18h / 36h / 54h
  standard: 1.0,     // baseline (24h / 48h / 72h)
};

/** SLA target in hours for the claim, complexity- and tier-driven (fraud gets the longest). */
export function slaTargetHours(claim: Claim): number {
  if (claim.pendingDecisionType === 'Fraud Investigation') return 120;
  const base = SLA_HOURS_BY_COMPLEXITY[claim.complexity] ?? 48;
  const multiplier = SLA_TIER_MULTIPLIER[claim.clientServiceTier ?? 'standard'] ?? 1.0;
  return Math.max(4, Math.round(base * multiplier));
}

// Estimated adjuster effort to clear the decision, again complexity-driven so the
// queue's "estimated effort" never contradicts the claim's complexity tag.
const EFFORT_MINS_BY_COMPLEXITY: Record<ClaimComplexity, number> = {
  low: 8,
  medium: 18,
  high: 35,
};

/** Estimated effort (minutes) to action the decision, complexity-driven. */
export function estimatedEffortMins(claim: Claim): number {
  if (claim.pendingDecisionType === 'Fraud Investigation') return 45;
  return EFFORT_MINS_BY_COMPLEXITY[claim.complexity] ?? 18;
}

// ── Priority score ────────────────────────────────────────────────────────────
// The percentage answers ONE question: "in what order should the adjuster
// work through their own open queue?" It is derived directly from the exact
// same pickup-order ranking used to produce Rank #1 / #2 / #3 on the priority
// cards (client tier, then AI confidence — highest/most action-ready first,
// then oldest queue age, then financial exposure) — so Rank #1 is always
// (and can only ever be) 100%, and the score strictly decreases from there.
// It is deliberately NOT a generic "urgency"/risk score: a claim can be
// low-risk but still be next in the pickup order (e.g. a clean glass claim
// that is fully ready to auto-approve), and a claim can be high-risk but
// further down the list because something else is even more ready to action.

const TIER_WEIGHT: Record<string, number> = {
  signature: 4,
  white_glove: 3,
  priority: 2,
  standard: 1,
};

/** Client-tier weight used to break ties in pickup order (signature > ... > standard). */
export function tierWeight(tier?: string | null): number {
  return TIER_WEIGHT[tier ?? ''] ?? 1;
}

/** Minutes a claim has been sitting in the queue, parsed from `timeInQueue` (e.g. "2 days 11 hours"). */
export function queueAgeMinutes(claim: Claim): number {
  const text = claim.timeInQueue;
  if (!text) return 0;
  const dayMatch = text.match(/(\d+)\s*day/i);
  const hourMatch = text.match(/(\d+)\s*hour/i);
  const minMatch = text.match(/(\d+)\s*minute/i);
  let total = 0;
  if (dayMatch) total += Number(dayMatch[1]) * 24 * 60;
  if (hourMatch) total += Number(hourMatch[1]) * 60;
  if (minMatch) total += Number(minMatch[1]);
  return total;
}

/**
 * The single source of truth for "which claim should be picked up next".
 * Mirrors the priority-card ranking exactly:
 *  1. Client service tier (signature > white_glove > priority > standard)
 *  2. AI confidence score, highest first (nearest to action-ready)
 *  3. Queue age, oldest first (avoid stagnation)
 *  4. Financial exposure, highest first
 */
export function comparePickupOrder(a: Claim, b: Claim): number {
  const tierDelta = tierWeight(b.clientServiceTier) - tierWeight(a.clientServiceTier);
  if (tierDelta !== 0) return tierDelta;

  const confDelta = (b.aiConfidenceScore ?? 0) - (a.aiConfidenceScore ?? 0);
  if (confDelta !== 0) return confDelta;

  const queueDelta = queueAgeMinutes(b) - queueAgeMinutes(a);
  if (queueDelta !== 0) return queueDelta;

  const exposureA = a.recommendedAction?.financialImpact?.estimatedAmount || 0;
  const exposureB = b.recommendedAction?.financialImpact?.estimatedAmount || 0;
  return exposureB - exposureA;
}

/** Sorts claims into pickup order (soonest-to-work first). */
export function sortByPickupOrder(claims: Claim[]): Claim[] {
  return [...claims].sort(comparePickupOrder);
}

/**
 * Priority score (0-100) for a claim: its position in the pickup order,
 * expressed as a percentage of `pool` — the set of open claims the current
 * adjuster (or the organisation, if no persona is selected) can actually
 * see. Rank #1 in that pool is always 100%; the last claim in the pool is
 * always 0%. Never scored against claims outside that visible pool.
 */
export function pickupOrderScore(claim: Claim, pool: Claim[]): number {
  if (pool.length <= 1) return 100;
  const sorted = sortByPickupOrder(pool);
  const idx = sorted.findIndex((c) => c.id === claim.id);
  if (idx === -1) return 0;
  return Math.round(((pool.length - 1 - idx) / (pool.length - 1)) * 100);
}

export type PriorityScoreTone = 'critical' | 'elevated' | 'standard';

/** Visual tone + trend arrow for a priority score, for consistent badge rendering. */
export function priorityScoreTone(score: number): { tone: PriorityScoreTone; arrow: 'up' | 'flat' | 'down' } {
  if (score >= 75) return { tone: 'critical', arrow: 'up' };
  if (score >= 45) return { tone: 'elevated', arrow: 'flat' };
  return { tone: 'standard', arrow: 'down' };
}
