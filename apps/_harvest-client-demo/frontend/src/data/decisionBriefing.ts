// Deterministic single-claim "Decision briefing" for Decision Mode.
//
// Mirrors the queue StewardBriefingCard's visual language but the content is the
// focused claim's decision context. Built purely from the claim record + the
// already-computed DecisionIntelligence (governance) — no AI call, so the opening
// overview is instant and repeatable (no LLM timeout wall-of-text).

import type { Claim, DecisionIntelligence } from '../types';
import type { BriefingTag, DecisionBriefingData } from '../services/stewardApi';
import { completedAgentActions } from './canonicalAgents';

function priorityTag(priority: string | undefined): BriefingTag | null {
  if (!priority) return null;
  const p = priority.toLowerCase();
  if (p === 'urgent' || p === 'high') return { label: `${cap(priority)} priority`, color: p === 'urgent' ? 'red' : 'orange' };
  if (p === 'medium') return { label: 'Medium priority', color: 'yellow' };
  return { label: `${cap(priority)} priority`, color: 'blue' };
}

function confidenceTag(level: string | undefined): BriefingTag | null {
  if (!level) return null;
  const l = level.toLowerCase();
  if (l === 'high') return { label: 'High confidence', color: 'green' };
  if (l === 'medium') return { label: 'Medium confidence', color: 'yellow' };
  if (l === 'low') return { label: 'Low confidence', color: 'red' };
  return null;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildDecisionBriefing(claim: Claim, intel: DecisionIntelligence): DecisionBriefingData {
  const tags: BriefingTag[] = [];
  const pTag = priorityTag(claim.priority);
  if (pTag) tags.push(pTag);
  const cTag = confidenceTag(claim.confidenceLevel);
  if (cTag) tags.push(cTag);
  if (claim.injuryIndicated) tags.push({ label: 'Injury indicated', color: 'orange' });
  const highAnomalies = (claim.anomalySignals ?? []).filter((a) => a.severity === 'high').length;
  if (highAnomalies > 0) tags.push({ label: 'Fraud signal', color: 'red' });

  const rec = claim.recommendedAction;
  const exposure = rec?.financialImpact?.estimatedAmount ?? 0;

  const completedWork = completedAgentActions(claim.auditTrail).map((a) => `${a.agent}: ${a.outcome}`);

  const gov = intel.governance;
  const recommendedSteps: string[] = [];
  if (claim.blockerReason) {
    recommendedSteps.push(`Clear the blocker first: ${claim.blockerReason}`);
  }
  if (gov?.requiresApproval) {
    recommendedSteps.push(gov.reasons?.[0] || 'Route to a senior adjuster for sign-off before executing.');
    recommendedSteps.push('Capture the approver, then confirm & execute in Action Preview.');
  } else if (rec) {
    recommendedSteps.push(`${cap(rec.actionType || 'Approve')} — ${rec.description}`);
    recommendedSteps.push('Confirm & execute in Action Preview, or redirect if you disagree.');
  }

  return {
    claimId: claim.id,
    name: claim.claimantName,
    incidentType: claim.incidentType,
    stage: claim.claimStage,
    tags,
    exposure,
    recommendation: rec ? `${cap(rec.actionType || 'Recommended action')} — ${rec.description}` : undefined,
    whyRecommended: rec?.rationale,
    blocker: claim.blockerReason || undefined,
    governanceTitle: gov?.title,
    governanceNote: gov?.summary,
    governanceTone: gov?.tone === 'critical' ? 'critical' : gov?.requiresApproval ? 'caution' : 'positive',
    completedWork,
    recommendedSteps,
  };
}
