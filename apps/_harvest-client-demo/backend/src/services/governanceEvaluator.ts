/**
 * Governance evaluator for governed settlement decisions.
 *
 * Pure, deterministic policy engine that decides whether a settlement/decision
 * can be auto-signed within delegated authority, must be escalated for senior
 * approval, or must be blocked outright. Mirrors the client-side assessment in
 * `frontend/src/data/decisionIntelligence.ts` so the UI preview and the server
 * verdict stay consistent — but THIS is the authoritative enforcement point.
 *
 * No new agent and no external calls: the recommendation comes from the existing
 * agents; this only governs the human/AI sign-off on that recommendation.
 */

import type {
  Claim,
  DecisionCategory,
  DecisionOutcome,
  GovernanceCriterion,
  GovernanceDecisionRecord,
} from '../types';

/** Settlement value above which senior sign-off applies (delegated authority). */
export const DEFAULT_AUTHORITY_LIMIT = 10000;

/**
 * Map an internal decision verb + verdict onto the canonical governed-action
 * taxonomy used across the governance specs and audit surface.
 */
export function toCanonicalCategory(
  decision: DecisionOutcome['decision'],
  status: GovernanceDecisionRecord['status'],
): DecisionCategory {
  if (decision === 'more_info_needed') return 'request-info';
  if (decision === 'rejected') return 'recommend-deny-for-human-review';
  if (decision === 'escalated') return 'route-to-adjuster';
  // decision === 'approved'
  if (status === 'blocked') return 'recommend-deny-for-human-review';
  if (status === 'requires_senior_approval') return 'route-to-adjuster';
  return 'approve';
}

/** Records-retention class applied to the persisted decision (compliance). */
function retentionClassFor(
  decision: DecisionOutcome['decision'],
  status: GovernanceDecisionRecord['status'],
): string {
  if (status === 'blocked') return 'regulatory-hold-10y';
  if (decision === 'approved') return 'financial-decision-7y';
  return 'standard-3y';
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
  }
}

export interface EvaluateOptions {
  /** Override the delegated-authority limit (e.g. from the assigned adjuster). */
  authorityLimit?: number;
  /** Settlement amount to evaluate against; falls back to the claim's estimate. */
  settlementAmount?: number;
  /** Approver captured at the HITL gate, if any. */
  approver?: { id?: string; name?: string; role?: string };
}

/**
 * Evaluate the governance posture of a decision on a claim.
 *
 * The verdict only gates `approved` decisions — de-escalations such as
 * `more_info_needed`, `escalated`, or `rejected` are always permitted and are
 * recorded as `within_authority` for audit completeness.
 */
export function evaluateDecision(
  claim: Claim,
  decision: DecisionOutcome['decision'],
  options: EvaluateOptions = {},
): GovernanceDecisionRecord {
  const authorityLimit = options.authorityLimit ?? DEFAULT_AUTHORITY_LIMIT;
  const currency = claim.recommendedAction?.financialImpact?.currency ?? 'USD';
  const settlementAmount =
    options.settlementAmount ??
    claim.recommendedAction?.financialImpact?.estimatedAmount ??
    0;

  const criteria: GovernanceCriterion[] = [];
  const reasons: string[] = [];

  // Authority limit -----------------------------------------------------------
  const overLimit = settlementAmount > authorityLimit;
  criteria.push({
    id: 'authority-limit',
    label: 'Delegated authority limit',
    passed: !overLimit,
    detail: overLimit
      ? `Settlement value ${formatCurrency(settlementAmount, currency)} exceeds the ${formatCurrency(authorityLimit, currency)} delegated-authority limit.`
      : `Settlement value ${formatCurrency(settlementAmount, currency)} is within the ${formatCurrency(authorityLimit, currency)} limit.`,
  });
  if (overLimit) reasons.push(criteria[criteria.length - 1].detail);

  // AI confidence -------------------------------------------------------------
  const lowConfidence = claim.confidenceLevel === 'low';
  criteria.push({
    id: 'confidence-threshold',
    label: 'AI confidence threshold',
    passed: !lowConfidence,
    detail: lowConfidence
      ? 'AI confidence is low — automated sign-off is withheld.'
      : `AI confidence is ${claim.confidenceLevel}.`,
  });
  if (lowConfidence) reasons.push(criteria[criteria.length - 1].detail);

  // Coverage applicability ----------------------------------------------------
  const coverage = claim.policyContext?.coverageApplicability;
  if (coverage === 'ambiguous') {
    const detail = 'Coverage applicability is ambiguous and needs human interpretation.';
    criteria.push({ id: 'coverage', label: 'Coverage applicability', passed: false, detail });
    reasons.push(detail);
  } else if (coverage === 'excluded') {
    const detail = 'Policy indicates the loss may be excluded — declination requires review.';
    criteria.push({ id: 'coverage', label: 'Coverage applicability', passed: false, detail });
    reasons.push(detail);
  } else {
    criteria.push({
      id: 'coverage',
      label: 'Coverage applicability',
      passed: true,
      detail: 'Coverage applicability is confirmed.',
    });
  }

  // Injury --------------------------------------------------------------------
  if (claim.injuryIndicated) {
    const detail = 'Injury is indicated, which carries mandatory human review.';
    criteria.push({ id: 'injury', label: 'Bodily injury review', passed: false, detail });
    reasons.push(detail);
  }

  // High-severity anomalies ---------------------------------------------------
  const highAnomalies = (claim.anomalySignals ?? []).filter((a) => a.severity === 'high').length;
  if (highAnomalies > 0) {
    const detail = `${highAnomalies} high-severity anomaly signal(s) are unresolved.`;
    criteria.push({ id: 'anomalies', label: 'Anomaly signals', passed: false, detail });
    reasons.push(detail);
  }

  // Decision-type routing -----------------------------------------------------
  // Settlement Approval normally routes to senior sign-off, BUT straight-through
  // (glass-only / total-loss-obvious) claims are deliberately exempt: those clean
  // approvals can be auto-finalised within delegated authority (FR-4 / C-07).
  // Fraud Investigation and Policy Interpretation always route to a human.
  const stpEligible = claim.straightThroughEligible === true;
  const alwaysEscalate = ['Fraud Investigation', 'Policy Interpretation'];
  const routesToSenior =
    alwaysEscalate.includes(claim.pendingDecisionType) ||
    (claim.pendingDecisionType === 'Settlement Approval' && !stpEligible);
  if (routesToSenior) {
    const detail = `Decision type "${claim.pendingDecisionType}" routes to senior adjuster sign-off.`;
    criteria.push({ id: 'decision-routing', label: 'Decision-type routing', passed: false, detail });
    reasons.push(detail);
  } else if (claim.pendingDecisionType === 'Settlement Approval' && stpEligible) {
    criteria.push({
      id: 'decision-routing',
      label: 'Decision-type routing',
      passed: true,
      detail: 'Straight-through scope (glass-only) — eligible for auto-finalisation within authority.',
    });
  }

  // A claim can only be hard-blocked when someone tries to APPROVE a payout on
  // an excluded loss or with an open fraud investigation. Everything else that
  // fails routes to senior approval rather than an outright block.
  const isApproval = decision === 'approved';
  const hardBlock =
    isApproval &&
    (coverage === 'excluded' ||
      (claim.pendingDecisionType === 'Fraud Investigation' && highAnomalies > 0));

  let status: GovernanceDecisionRecord['status'];
  if (!isApproval) {
    // De-escalations are always allowed and recorded as within authority.
    status = 'within_authority';
  } else if (hardBlock) {
    status = 'blocked';
  } else if (reasons.length > 0) {
    status = 'requires_senior_approval';
  } else {
    status = 'within_authority';
  }

  return {
    status,
    requiresApproval: status === 'requires_senior_approval',
    blocked: status === 'blocked',
    decision,
    canonicalCategory: toCanonicalCategory(decision, status),
    straightThroughEligible: stpEligible,
    reasons: status === 'within_authority' ? [] : reasons,
    criteria,
    authorityLimit,
    settlementAmount,
    currency,
    confidenceLevel: claim.confidenceLevel,
    approver: options.approver,
    evaluatedAt: new Date().toISOString(),
    retentionClass: retentionClassFor(decision, status),
  };
}
