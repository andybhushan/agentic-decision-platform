/**
 * Branded policy-holder prestige tiers.
 *
 * The underlying `ClientServiceTier` drives AI-vs-human hand-off; this module
 * maps each tier to the customer-facing brand name and decides which clients
 * get an Appointed Representative (a firm/agent that manages claims on behalf of
 * a high-net-worth policyholder).
 */
import type { AppointedRepresentative, ClientServiceTier } from '../types';

export interface PolicyTierMeta {
  label: string;
  rank: number;
  topTier: boolean;
}

export const POLICY_TIER: Record<ClientServiceTier, PolicyTierMeta> = {
  standard: { label: 'Core', rank: 1, topTier: false },
  priority: { label: 'Premier', rank: 2, topTier: false },
  white_glove: { label: 'Masterpiece', rank: 3, topTier: true },
  signature: { label: 'Masterpiece Signature', rank: 4, topTier: true },
};

export function tierLabel(tier?: ClientServiceTier | null): string | null {
  if (!tier) return null;
  return POLICY_TIER[tier]?.label ?? null;
}

export function isTopTier(tier?: ClientServiceTier | null): boolean {
  return Boolean(tier && POLICY_TIER[tier]?.topTier);
}

// Deterministic pool of private-client firms used to fabricate a plausible
// Appointed Representative for top-tier claims that have no explicit persona.
const REPRESENTATIVE_FIRMS: ReadonlyArray<{ firmName: string; contactName: string }> = [
  { firmName: 'Meridian Private Client Partners', contactName: 'Jonathan Caldwell' },
  { firmName: 'Wexford Family Office', contactName: 'Eleanor Vance' },
  { firmName: 'Ashworth Private Wealth', contactName: 'Marcus Ellery' },
  { firmName: 'Sterling & Crane Advisory', contactName: 'Priscilla Stern' },
  { firmName: 'Halcyon Asset Stewardship', contactName: 'Gregory Whitfield' },
];

function hashName(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Resolve the Appointed Representative for a claim/persona. An explicit persona
 * value always wins; otherwise top-tier clients get a deterministic firm so the
 * relationship is consistent across reloads. Non-top tiers return undefined.
 */
export function deriveAppointedRepresentative(opts: {
  tier?: ClientServiceTier | null;
  explicit?: AppointedRepresentative;
  seedKey?: string;
}): AppointedRepresentative | undefined {
  if (opts.explicit) return opts.explicit;
  if (!isTopTier(opts.tier)) return undefined;
  const firm = REPRESENTATIVE_FIRMS[hashName(opts.seedKey ?? 'client') % REPRESENTATIVE_FIRMS.length];
  return {
    firmName: firm.firmName,
    contactName: firm.contactName,
    relationship: 'Appointed Representative',
  };
}
