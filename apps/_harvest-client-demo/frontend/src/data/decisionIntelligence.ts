// Deterministic "Decision Intelligence" derivation for Decision Mode (Beat 4).
//
// Given a Claim, this computes the decision-support surface — headline metrics,
// a governance/authority assessment, "things to consider", and a ranked list of
// decision-relevant evidence — purely from the claim's own data. No AI call, no
// randomness, so the demo is repeatable and explainable (same pattern as
// claimSimulation.ts / evidenceIntelligence.ts).
//
// Every number is traceable: each metric carries an honest `detail` string that
// states what it was derived from. We never invent figures that aren't grounded
// in the claim record.

import type {
  Claim,
  DecisionConfidenceComponent,
  DecisionIntelligence,
  DecisionInsight,
  DecisionMetric,
  DecisionTone,
  GovernanceAssessment,
  RankedEvidence,
} from '../types';
import { confidenceScore, slaTargetHours } from './confidence';

const clamp = (n: number, min = 0, max = 100): number => Math.max(min, Math.min(max, n));

const formatCurrency = (amount: number, currency = 'USD'): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
};

// Parse a human "time in queue" string ("3 days", "18 hours", "12 minutes")
// into hours. Falls back to 0 when unparseable.
const parseTimeInQueueHours = (raw: string | undefined): number => {
  if (!raw) return 0;
  const m = raw.trim().match(/([\d.]+)\s*(minute|min|hour|hr|day|week)/i);
  if (!m) return 0;
  const value = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith('min')) return value / 60;
  if (unit.startsWith('hour') || unit.startsWith('hr')) return value;
  if (unit.startsWith('day')) return value * 24;
  if (unit.startsWith('week')) return value * 24 * 7;
  return 0;
};

// ── Metric 1: Resolution progress (where the claim sits in its lifecycle) ──────
//
// Base is the claim's lifecycle stage. On top of that, meaningful signals push
// the number up or down so that a clean, decision-ready claim isn't equated
// with a blocked or disputed claim that happens to be at the same stage.
//
//   Base by stage: intake=15, investigation=40, evaluation=70, settlement=90, closed=100
//   +10  AI confidence score ≥ 90 (auto-approve eligible, one click away)
//   + 8  AI confidence score 80–89 (high, no material uncertainty)
//   + 5  No blockers
//   + 3  pendingDecisionType is 'Settlement Approval' (final step)
//   − 8  Has an active blocker
//   − 5  Any disputed narrative points
//   − 3  Any high-severity anomaly signals
//   − 3  Any unverified evidence items
//
const STAGE_PROGRESS_BASE: Record<string, number> = {
  intake: 15,
  investigation: 40,
  evaluation: 70,
  settlement: 90,
  closed: 100,
};

const buildResolutionMetric = (claim: Claim): DecisionMetric => {
  const base = STAGE_PROGRESS_BASE[claim.claimStage] ?? 40;

  // Fixed stages need no further adjustment
  if (claim.claimStage === 'closed' || claim.claimStage === 'intake') {
    const tone: DecisionTone = base >= 90 ? 'positive' : 'neutral';
    return {
      id: 'resolution',
      label: 'Resolution progress',
      value: `${base}%`,
      detail: `Claim is at the "${claim.claimStage}" stage of its lifecycle.`,
      tone,
      progress: base,
    };
  }

  const aiScore = confidenceScore(claim);
  const hasBlocker = Boolean(claim.blockerReason);
  const disputed = (claim.narrativeSynthesis ?? []).filter((n) => n.status === 'Disputed').length;
  const highAnomalies = (claim.anomalySignals ?? []).filter((a) => a.severity === 'high').length;
  const unverifiedEvidence = (claim.evidenceItems ?? []).filter((e) => e.status !== 'verified').length;
  const isSettlementDecision = claim.pendingDecisionType === 'Settlement Approval';

  let adjustment = 0;
  if (aiScore >= 90) adjustment += 10;
  else if (aiScore >= 80) adjustment += 8;

  if (!hasBlocker) adjustment += 5;
  if (isSettlementDecision) adjustment += 3;

  if (hasBlocker) adjustment -= 8;
  if (disputed > 0) adjustment -= Math.min(disputed * 5, 10);
  if (highAnomalies > 0) adjustment -= Math.min(highAnomalies * 3, 6);
  if (unverifiedEvidence > 0) adjustment -= Math.min(unverifiedEvidence * 3, 6);

  const progress = clamp(base + adjustment);
  const tone: DecisionTone = progress >= 85 ? 'positive' : progress >= 55 ? 'neutral' : 'caution';

  const detailParts: string[] = [`Claim is at the "${claim.claimStage}" stage`];
  if (isSettlementDecision) detailParts.push('settlement approval pending');
  if (hasBlocker) detailParts.push('blocked');
  else if (disputed > 0) detailParts.push(`${disputed} narrative point${disputed > 1 ? 's' : ''} disputed`);

  return {
    id: 'resolution',
    label: 'Resolution progress',
    value: `${progress}%`,
    detail: `${detailParts.join(', ')}.`,
    tone,
    progress,
  };
};

// ── Metric 2: Confidence (verification strength of the assembled narrative) ────
const buildConfidenceMetric = (claim: Claim): DecisionMetric => {
  const narrative = claim.narrativeSynthesis ?? [];
  const confirmed = narrative.filter((n) => n.status === 'Confirmed').length;
  const disputed = narrative.filter((n) => n.status === 'Disputed').length;
  // Single source of truth — identical to the Decision Queue card and table.
  const score = confidenceScore(claim);
  const tone: DecisionTone = score >= 80 ? 'positive' : score >= 55 ? 'caution' : 'critical';
  const detailParts = [`AI confidence: ${claim.confidenceLevel}`];
  if (narrative.length > 0) {
    detailParts.push(`${confirmed}/${narrative.length} narrative points confirmed`);
  }
  if (disputed > 0) detailParts.push(`${disputed} disputed`);
  return {
    id: 'confidence',
    label: 'Confidence',
    value: `${score}%`,
    detail: `${detailParts.join(' · ')}.`,
    tone,
    progress: score,
  };
};

// ── Metric 3: Estimate variance (how much the settlement figure could move) ────
const buildVarianceMetric = (claim: Claim): DecisionMetric => {
  const fi = claim.recommendedAction?.financialImpact;
  const net = fi?.estimatedAmount ?? 0;
  const currency = fi?.currency ?? 'USD';

  const narrative = claim.narrativeSynthesis ?? [];
  const disputedNarrative = narrative.filter((n) => n.status === 'Disputed').length;
  const pendingNarrative = narrative.filter((n) => n.status === 'Pending').length;
  const pendingEvidence = (claim.evidenceItems ?? []).filter((e) => e.status !== 'verified').length;
  const highAnomalies = (claim.anomalySignals ?? []).filter((a) => a.severity === 'high').length;
  const ambiguity = claim.policyContext?.ambiguityIndicators?.length ?? 0;

  // Each unresolved signal widens the plausible band around the estimate.
  const factor = clamp(
    disputedNarrative * 0.05 +
      pendingEvidence * 0.03 +
      highAnomalies * 0.04 +
      pendingNarrative * 0.02 +
      ambiguity * 0.02,
    0,
    0.4,
  );
  const pct = Math.round(factor * 100);
  const band = Math.round(net * factor);
  const tone: DecisionTone = pct >= 20 ? 'critical' : pct >= 8 ? 'caution' : 'positive';

  const drivers: string[] = [];
  if (disputedNarrative) drivers.push(`${disputedNarrative} disputed account(s)`);
  if (pendingEvidence) drivers.push(`${pendingEvidence} unverified item(s)`);
  if (highAnomalies) drivers.push(`${highAnomalies} high-severity anomaly(ies)`);
  if (ambiguity) drivers.push(`${ambiguity} coverage ambiguity(ies)`);

  const detail =
    drivers.length > 0
      ? `±${formatCurrency(band, currency)} on a ${formatCurrency(net, currency)} estimate, driven by ${drivers.join(', ')}.`
      : `Estimate of ${formatCurrency(net, currency)} is stable — no unresolved signals widening it.`;

  return {
    id: 'variance',
    label: 'Estimate variance',
    value: pct > 0 ? `±${pct}%` : 'Stable',
    detail,
    tone,
  };
};

// ── Metric 4: Cycle-time impact (queue time against a complexity-based SLA) ─────
const buildCycleTimeMetric = (claim: Claim): DecisionMetric => {
  // SLA target is driven by the claim's complexity (low = 24h, medium = 48h,
  // high = 72h, fraud = 120h) — so a low-complexity glass job is held to a
  // same-day target, never a 3-day settlement window.
  const target = slaTargetHours(claim);
  const hours = parseTimeInQueueHours(claim.timeInQueue);
  const pct = target > 0 ? Math.round((hours / target) * 100) : 0;
  const tone: DecisionTone = pct >= 100 ? 'critical' : pct >= 70 ? 'caution' : 'positive';
  const targetLabel = target >= 24 && target % 24 === 0 ? `${Math.round(target / 24)}d` : `${target}h`;
  return {
    id: 'cycle-time',
    label: 'Cycle-time impact',
    value: claim.timeInQueue || '—',
    detail: `${pct}% of the ${targetLabel} target for a ${claim.complexity}-complexity ${claim.pendingDecisionType}.`,
    tone,
    progress: clamp(pct),
  };
};

// ── Governance / authority assessment ──────────────────────────────────────────
const DEFAULT_AUTHORITY_LIMIT = 10000;

const buildGovernance = (claim: Claim): GovernanceAssessment => {
  const reasons: string[] = [];
  const amount = claim.recommendedAction?.financialImpact?.estimatedAmount ?? 0;
  const currency = claim.recommendedAction?.financialImpact?.currency ?? 'USD';
  // Use the adjuster's real authority limit enriched from the backend; fall back to
  // the default so the function stays pure and doesn't need an async adjuster fetch.
  const authorityLimit = claim.adjusterAuthorityLimit ?? DEFAULT_AUTHORITY_LIMIT;

  if (amount > authorityLimit) {
    reasons.push(
      `Settlement value ${formatCurrency(amount, currency)} exceeds the ${formatCurrency(authorityLimit, currency)} delegated-authority limit.`,
    );
  }
  if (claim.confidenceLevel === 'low') {
    reasons.push('AI confidence is low — automated sign-off is withheld.');
  }
  if (claim.policyContext?.coverageApplicability === 'ambiguous') {
    reasons.push('Coverage applicability is ambiguous and needs human interpretation.');
  }
  if (claim.policyContext?.coverageApplicability === 'excluded') {
    reasons.push('Policy indicates the loss may be excluded — declination requires review.');
  }
  if (claim.injuryIndicated) {
    reasons.push('Injury is indicated, which carries mandatory human review.');
  }
  const highAnomalies = (claim.anomalySignals ?? []).filter((a) => a.severity === 'high').length;
  if (highAnomalies > 0) {
    reasons.push(`${highAnomalies} high-severity anomaly signal(s) are unresolved.`);
  }
  // Straight-through (glass-only / total-loss-obvious) approvals are exempt from
  // senior routing; everything else of type Settlement Approval / Fraud / Policy
  // Interpretation routes to a human (mirrors the server-side evaluator).
  //
  // Per SOP-001's two independent escalation axes: Fraud Investigation and
  // Policy Interpretation are DIRECT specialist referrals (SIU / Legal) — they
  // bypass supervisor/senior sign-off entirely and are not resolved by
  // "redirecting to a senior" regardless of the requesting adjuster's own
  // seniority. Settlement Approval (non-STP) is a genuine delegated-authority
  // ceiling, which a senior with higher authority CAN sign off.
  const stpEligible = claim.straightThroughEligible === true;
  const specialistReferralTypes = ['Fraud Investigation', 'Policy Interpretation'];
  const specialistReferralRequired = specialistReferralTypes.includes(claim.pendingDecisionType);
  const routesToSenior =
    specialistReferralRequired ||
    (claim.pendingDecisionType === 'Settlement Approval' && !stpEligible);
  if (specialistReferralRequired) {
    const specialist = claim.pendingDecisionType === 'Fraud Investigation' ? 'SIU' : 'Legal';
    reasons.push(
      `Decision type "${claim.pendingDecisionType}" is a direct ${specialist} referral — it cannot be unblocked by senior adjuster sign-off.`,
    );
  } else if (routesToSenior) {
    reasons.push(`Decision type "${claim.pendingDecisionType}" routes to senior adjuster sign-off.`);
  }

  const requiresApproval = reasons.length > 0;
  if (requiresApproval) {
    return {
      requiresApproval: true,
      title: specialistReferralRequired ? 'Specialist referral in progress' : 'Senior adjuster approval required',
      summary:
        claim.blockerReason ||
        (specialistReferralRequired
          ? 'This claim is blocked pending specialist (SIU/Legal) findings. No adjuster sign-off — senior or otherwise — can unblock it.'
          : 'This recommended action falls outside delegated authority and must be approved before it can proceed.'),
      reasons,
      tone: claim.confidenceLevel === 'low' ? 'critical' : 'caution',
      straightThroughEligible: stpEligible,
      specialistReferralRequired,
    };
  }

  return {
    requiresApproval: false,
    title: stpEligible ? 'Within authority · straight-through' : 'Within delegated authority',
    summary: stpEligible
      ? 'This clean glass-only loss is inside the straight-through scope — the agent can auto-finalise it within delegated authority.'
      : 'The recommended action is inside automated thresholds. An adjuster can sign it off without escalation.',
    reasons: [
      `Settlement value ${formatCurrency(amount, currency)} is within the ${formatCurrency(authorityLimit, currency)} limit.`,
      `AI confidence is ${claim.confidenceLevel}.`,
    ],
    tone: 'positive',
    straightThroughEligible: stpEligible,
  };
};

// ── "Things to consider" — bounded insights from real signals ──────────────────
const buildInsights = (claim: Claim): DecisionInsight[] => {
  const insights: DecisionInsight[] = [];

  (claim.narrativeSynthesis ?? [])
    .filter((n) => n.status === 'Disputed')
    .forEach((n, i) => {
      insights.push({
        id: `narrative-disputed-${i}`,
        severity: 'critical',
        title: 'Conflicting account in the timeline',
        detail: `${n.description} (source: ${n.source}). This part of the narrative is disputed and is not yet reconciled.`,
      });
    });

  (claim.anomalySignals ?? [])
    .filter((a) => a.severity === 'high')
    .forEach((a) => {
      insights.push({
        id: `anomaly-${a.id}`,
        severity: 'critical',
        title: `Anomaly: ${a.type}`,
        detail: `${a.description} ${a.explanation ? `— ${a.explanation}` : ''}`.trim(),
      });
    });

  (claim.policyContext?.ambiguityIndicators ?? []).forEach((amb, i) => {
    insights.push({
      id: `ambiguity-${i}`,
      severity: 'caution',
      title: 'Coverage ambiguity',
      detail: amb,
    });
  });

  // Negative financial adjustments (deductibles, limit excesses) materially change
  // the net payout and are worth flagging explicitly.
  (claim.recommendedAction?.financialImpact?.breakdown ?? [])
    .filter((b) => b.amount < 0)
    .forEach((b, i) => {
      insights.push({
        id: `financial-adj-${i}`,
        severity: 'caution',
        title: `Payout reduction: ${b.category}`,
        detail: `${b.description} (${formatCurrency(b.amount, claim.recommendedAction?.financialImpact?.currency ?? 'USD')}).`,
      });
    });

  const pendingEvidence = (claim.evidenceItems ?? []).filter((e) => e.status === 'pending');
  if (pendingEvidence.length > 0) {
    insights.push({
      id: 'evidence-pending',
      severity: 'caution',
      title: `${pendingEvidence.length} evidence item(s) still pending`,
      detail: `Awaiting: ${pendingEvidence.map((e) => e.type).join(', ')}. The decision rests partly on unverified material.`,
    });
  }

  if (claim.injuryIndicated) {
    insights.push({
      id: 'injury',
      severity: 'caution',
      title: 'Injury indicated',
      detail: 'Reported injuries raise the exposure and trigger mandatory human review of the medical component.',
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'clear',
      severity: 'info',
      title: 'No blocking signals detected',
      detail:
        'The assembled narrative, evidence and policy context show no disputes, high anomalies or coverage ambiguity.',
    });
  }

  return insights;
};

// ── Decision-relevant evidence (ranked, with deep links) ───────────────────────
const normalizeEvidenceType = (type: string | undefined): string => (type ?? '').trim().toLowerCase();

const getEvidencePriority = (claim: Claim, type: string): { scoreBoost: number; relevance?: string; tone?: DecisionTone } => {
  const normalized = normalizeEvidenceType(type);

  if (normalized.includes('witness')) {
    return {
      scoreBoost: 2.2,
      relevance: 'Independent witness testimony can corroborate how the incident happened.',
      tone: 'positive',
    };
  }

  if (normalized.includes('medical') || normalized.includes('er ') || normalized === 'er report' || normalized.includes('hospital')) {
    return {
      scoreBoost: claim.injuryIndicated ? 2.4 : 1.6,
      relevance: claim.injuryIndicated
        ? 'Medical documentation is material because the claim includes an injury component.'
        : 'Medical documentation may corroborate treatment or injury-related facts.',
      tone: claim.injuryIndicated ? 'caution' : 'positive',
    };
  }

  if (normalized.includes('police report') || normalized.includes('police reference')) {
    return {
      scoreBoost: 2.1,
      relevance: 'Police documentation independently supports the reported incident details.',
      tone: 'positive',
    };
  }

  if (normalized.includes('supporting document')) {
    return {
      scoreBoost: 1.2,
      relevance: 'Supporting documentation may corroborate parts of the claim beyond the photo evidence.',
      tone: 'neutral',
    };
  }

  return { scoreBoost: 0 };
};

const buildRelevantEvidence = (claim: Claim): RankedEvidence[] => {
  const anomalySources = new Set(
    (claim.anomalySignals ?? []).map((a) => (a.evidenceSource || '').toLowerCase()),
  );

  const scored = (claim.evidenceItems ?? []).map((item) => {
    let score = 1;
    let relevance = 'Supports the assembled narrative.';
    let tone: DecisionTone = 'neutral';

    if (item.status === 'disputed') {
      score = 4;
      relevance = 'Disputed — directly contests another part of the file and must be reconciled.';
      tone = 'critical';
    } else if (item.status === 'pending') {
      score = 3;
      relevance = 'Pending verification — the decision partly rests on this unconfirmed item.';
      tone = 'caution';
    } else if (anomalySources.has((item.source || '').toLowerCase())) {
      score = 2.5;
      relevance = 'Tied to a flagged anomaly signal on this claim.';
      tone = 'caution';
    } else if (item.provenance === 'Public Record' || item.provenance === 'Third Party') {
      score = 2;
      relevance = 'Independently sourced — strong corroboration for the decision.';
      tone = 'positive';
    }

    const priority = getEvidencePriority(claim, item.type);
    if (priority.scoreBoost > 0) {
      score += priority.scoreBoost;
      if (priority.relevance) relevance = priority.relevance;
      if (priority.tone) tone = priority.tone;
    }

    return { item, relevance, tone, deepLinkParam: item.id, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score, ...rest }) => rest);
};

// ── Decomposed confidence (per-component, with evidence refs) ──────────────────
// Breaks the single AI confidence down into the governance-relevant components so
// a reviewer can see WHICH dimension is strong or weak, not just an overall grade
// (FR-2 / C-02). Every score is derived deterministically from the claim record.
const toneForScore = (score: number): DecisionTone =>
  score >= 80 ? 'positive' : score >= 55 ? 'caution' : 'critical';

const buildConfidenceBreakdown = (claim: Claim): DecisionConfidenceComponent[] => {
  const components: DecisionConfidenceComponent[] = [];

  // Coverage applicability
  const coverage = claim.policyContext?.coverageApplicability;
  const coverageScore = coverage === 'covered' ? 92 : coverage === 'ambiguous' ? 52 : 24;
  components.push({
    id: 'coverage',
    label: 'Coverage applicability',
    score: coverageScore,
    tone: toneForScore(coverageScore),
    basis:
      coverage === 'covered'
        ? 'Policy and endorsements confirm the loss is covered.'
        : coverage === 'ambiguous'
        ? 'Coverage needs human interpretation before sign-off.'
        : 'Policy indicates the loss may be excluded.',
    evidenceRefs: claim.policyContext?.relevantClauses,
  });

  // Severity / valuation clarity (driven by narrative agreement)
  const narrative = claim.narrativeSynthesis ?? [];
  const disputed = narrative.filter((n) => n.status === 'Disputed').length;
  const confirmed = narrative.filter((n) => n.status === 'Confirmed').length;
  const severityScore = clamp(82 - disputed * 18 + (confirmed > 2 ? 6 : 0));
  components.push({
    id: 'severity',
    label: 'Severity & valuation',
    score: severityScore,
    tone: toneForScore(severityScore),
    basis:
      disputed > 0
        ? `${disputed} disputed account(s) widen the valuation band.`
        : `${confirmed} narrative point(s) confirmed; valuation is stable.`,
  });

  // Fraud / anomaly posture
  const highAnomalies = (claim.anomalySignals ?? []).filter((a) => a.severity === 'high');
  const medAnomalies = (claim.anomalySignals ?? []).filter((a) => a.severity === 'medium');
  const fraudScore = highAnomalies.length > 0 ? 28 : medAnomalies.length > 0 ? 62 : 94;
  components.push({
    id: 'fraud',
    label: 'Fraud / anomaly signals',
    score: fraudScore,
    tone: toneForScore(fraudScore),
    basis:
      highAnomalies.length > 0
        ? `${highAnomalies.length} high-severity anomaly signal(s) unresolved.`
        : medAnomalies.length > 0
        ? `${medAnomalies.length} medium-severity signal(s) noted.`
        : 'No anomaly signals on this claim.',
    evidenceRefs: (claim.anomalySignals ?? []).map((a) => a.evidenceSource).filter(Boolean) as string[],
  });

  // Prior-claim density (related claims)
  const related = claim.relatedClaims ?? [];
  const priorScore = related.length === 0 ? 90 : related.length <= 2 ? 68 : 44;
  components.push({
    id: 'prior-claim-density',
    label: 'Prior-claim density',
    score: priorScore,
    tone: toneForScore(priorScore),
    basis:
      related.length === 0
        ? 'No related claims linked to this claimant or vehicle.'
        : `${related.length} related claim(s) linked — review for pattern.`,
    evidenceRefs: related.map((r) => r.claimId).filter(Boolean) as string[],
  });

  // Vendor / repair-quote integrity
  const quotes = claim.recommendedAction?.financialImpact?.repairQuotes ?? [];
  const pendingEvidence = (claim.evidenceItems ?? []).filter((e) => e.status === 'pending').length;
  let vendorScore: number;
  let vendorBasis: string;
  if (quotes.length > 0) {
    const accepted = quotes.filter((q) => q.status === 'accepted').length;
    vendorScore = accepted > 0 ? 88 : 64;
    vendorBasis =
      accepted > 0
        ? 'Repair quote received and accepted against the loss.'
        : 'Repair quote received and pending review.';
  } else {
    vendorScore = pendingEvidence > 0 ? 66 : 80;
    vendorBasis =
      pendingEvidence > 0
        ? `${pendingEvidence} evidence item(s) still pending verification.`
        : 'Supporting evidence verified; no vendor anomalies.';
  }
  components.push({
    id: 'vendor-anomaly',
    label: 'Vendor / quote integrity',
    score: vendorScore,
    tone: toneForScore(vendorScore),
    basis: vendorBasis,
    evidenceRefs: quotes.map((q) => q.id).filter(Boolean) as string[],
  });

  return components;
};

export const buildDecisionIntelligence = (claim: Claim): DecisionIntelligence => ({
  metrics: [
    buildResolutionMetric(claim),
    buildConfidenceMetric(claim),
    buildVarianceMetric(claim),
    buildCycleTimeMetric(claim),
  ],
  governance: buildGovernance(claim),
  insights: buildInsights(claim),
  relevantEvidence: buildRelevantEvidence(claim),
  confidenceBreakdown: buildConfidenceBreakdown(claim),
});
