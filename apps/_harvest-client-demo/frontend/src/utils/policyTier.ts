/**
 * Branded policy-holder prestige tiers for the UI.
 *
 * Maps the underlying ClientServiceTier to its customer-facing brand name and a
 * Carbon Tag colour, escalating in prominence so the top tiers cannot be missed.
 */
import type { ClientServiceTier } from '../types';

export interface PolicyTierDisplay {
  label: string;
  /** Carbon <Tag> type. */
  tagType: 'cool-gray' | 'teal' | 'purple' | 'high-contrast';
  rank: number;
  topTier: boolean;
}

export const POLICY_TIER_DISPLAY: Record<ClientServiceTier, PolicyTierDisplay> = {
  standard: { label: 'Core', tagType: 'cool-gray', rank: 1, topTier: false },
  priority: { label: 'Premier', tagType: 'teal', rank: 2, topTier: false },
  white_glove: { label: 'Masterpiece', tagType: 'purple', rank: 3, topTier: true },
  signature: { label: 'Masterpiece Signature', tagType: 'high-contrast', rank: 4, topTier: true },
};

/** Accepts either a typed tier or a raw API string. */
function normalizeTier(tier?: string | null): ClientServiceTier | null {
  if (!tier) return null;
  return (tier in POLICY_TIER_DISPLAY) ? (tier as ClientServiceTier) : null;
}

export function tierDisplay(tier?: string | null): PolicyTierDisplay | null {
  const normalized = normalizeTier(tier);
  return normalized ? POLICY_TIER_DISPLAY[normalized] : null;
}

export function tierLabel(tier?: string | null): string | null {
  return tierDisplay(tier)?.label ?? null;
}

export function isTopTier(tier?: string | null): boolean {
  return Boolean(tierDisplay(tier)?.topTier);
}
