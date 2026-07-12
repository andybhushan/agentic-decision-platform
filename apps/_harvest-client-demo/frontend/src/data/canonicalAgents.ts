// Single source of truth for mapping workforce / process-model nodes onto the
// canonical deployable backend Agent that represents them. This keeps the channel
// drill-down, the Workforce view and the Individual Workers catalog all pointing at
// the SAME `/agents/:id` entity, so "the web intake agent" is identical everywhere
// (Point 1).
//
// Invariant: the backend agent referenced here is a projection of the matching
// claimsModel node. If you rename/restructure that node, update the backend record
// (and vice-versa) so the two cannot silently diverge.

export const CANONICAL_AGENT_BY_NODE: Record<string, string> = {
  // Web Intake channel (claimsWorkforce N2 / claimsModel subflow 'N2')
  N2: 'agent_claims_intake',
  // Mobile Intake channel (claimsWorkforce N3 / claimsModel subflow 'N3')
  N3: 'agent_claims_mobile_intake',
};

/** The canonical deployable agent id for a workforce/model node, if one exists. */
export function canonicalAgentIdForNode(nodeId: string | undefined): string | undefined {
  if (!nodeId) return undefined;
  return CANONICAL_AGENT_BY_NODE[nodeId];
}

/** Reverse lookup: the workforce/model node a canonical agent projects from. */
export function nodeForCanonicalAgentId(agentId: string | undefined): string | undefined {
  if (!agentId) return undefined;
  const found = Object.entries(CANONICAL_AGENT_BY_NODE).find(([, id]) => id === agentId);
  return found?.[0];
}

/** Friendly display names for the AI agents that act on a claim before it reaches an adjuster. */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  agent_claims_intake: 'Intake DW',
  agent_claims_mobile_intake: 'Intake DW',
  agent_coverage: 'Coverage DW',
  agent_claims_policy_verification: 'Coverage DW',
  agent_siu: 'SIU DW',
  agent_claims_fraud: 'SIU DW',
  agent_damage: 'Damage DW',
  agent_steward: 'AI Steward',
  agent_claims_settlement: 'Settlement DW',
};

/** Human-friendly agent name for an audit-trail userId. Non-agent users (adjusters, system) return undefined. */
export function agentDisplayName(userId: string | undefined): string | undefined {
  if (!userId) return undefined;
  if (AGENT_DISPLAY_NAMES[userId]) return AGENT_DISPLAY_NAMES[userId];
  if (userId.startsWith('agent_')) {
    // Fallback: turn agent_some_thing into "Some Thing DW".
    const words = userId.replace(/^agent_/, '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1));
    return `${words.join(' ')} DW`;
  }
  return undefined;
}

interface AuditLike {
  userId: string;
  action: string;
  outcome: string;
}

/**
 * Derive the auditable "Completed work" list for a claim from its audit trail.
 * Only agent-performed entries are included; adjuster/system entries are excluded.
 */
export function completedAgentActions(
  auditTrail: AuditLike[] | undefined,
): Array<{ agent: string; action: string; outcome: string }> {
  if (!auditTrail || auditTrail.length === 0) return [];
  return auditTrail
    .map(e => {
      const agent = agentDisplayName(e.userId);
      return agent ? { agent, action: e.action, outcome: e.outcome } : null;
    })
    .filter((x): x is { agent: string; action: string; outcome: string } => x !== null);
}
