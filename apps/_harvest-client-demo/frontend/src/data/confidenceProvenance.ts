// Confidence provenance — answers the question Don asked twice in the
// Progressive transcript: "what drives the confidence factor? Is that data
// Imagine is able to calculate, or is it just pulling data from different data
// stores?" This module makes the "why" auditable: the rationale sentence, a
// factor-by-factor breakdown (each attributed to the system that supplied it),
// and the SOP clauses that set the thresholds in play.
//
// Everything here is derived from metadata already on the claim — no AI call,
// no randomness — so the popover is repeatable and explainable, matching the
// existing evidenceIntelligence.ts / decisionIntelligence.ts pattern.

import type { Claim } from '../types';
import { confidenceScore, AUTO_APPROVE_THRESHOLD } from './confidence';
import {
  deriveEvidenceSourceSystem,
  anomalySignalSourceSystem,
  policySourceSystem,
} from './sourceSystems';

export interface ConfidenceFactor {
  label: string;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral';
  /** Which system of record supplied the underlying data for this factor. */
  sourceSystem: string;
}

export interface SopCitation {
  id: string;
  title: string;
  note: string;
}

export interface ConfidenceProvenance {
  score: number;
  rationale: string;
  factors: ConfidenceFactor[];
  sops: SopCitation[];
}

/** Structured "why this score" breakdown for the confidence popover. */
export function confidenceProvenance(claim: Claim): ConfidenceProvenance {
  const score = confidenceScore(claim);
  const evidenceItems = claim.evidenceItems ?? [];
  const verifiedCount = evidenceItems.filter((e) => e.status === 'verified').length;
  const disputedItems = evidenceItems.filter((e) => e.status === 'disputed');
  const pendingItems = evidenceItems.filter((e) => e.status === 'pending');
  const disputedNarrative = (claim.narrativeSynthesis ?? []).filter((n) => n.status === 'Disputed').length;

  const factors: ConfidenceFactor[] = [];

  // Evidence verification — attributed per-item so mixed sources are honest.
  if (evidenceItems.length > 0) {
    const evidenceSystems = Array.from(
      new Set(evidenceItems.map((e) => deriveEvidenceSourceSystem(e))),
    ).join(', ');
    factors.push({
      label: `Evidence verified (${verifiedCount}/${evidenceItems.length})`,
      detail:
        verifiedCount === evidenceItems.length
          ? 'All evidence on file has been independently verified.'
          : `${evidenceItems.length - verifiedCount} item(s) still pending or disputed reduce confidence.`,
      tone: verifiedCount === evidenceItems.length ? 'positive' : 'negative',
      sourceSystem: evidenceSystems,
    });
  }

  if (disputedItems.length > 0) {
    factors.push({
      label: `${disputedItems.length} disputed evidence item(s)`,
      detail: 'Conflicts with another part of the file — held back from the score until reconciled.',
      tone: 'negative',
      sourceSystem: Array.from(new Set(disputedItems.map((e) => deriveEvidenceSourceSystem(e)))).join(', '),
    });
  }

  if (pendingItems.length > 0) {
    factors.push({
      label: `${pendingItems.length} evidence item(s) pending`,
      detail: 'Awaiting verification — treated as provisional until confirmed.',
      tone: 'negative',
      sourceSystem: Array.from(new Set(pendingItems.map((e) => deriveEvidenceSourceSystem(e)))).join(', '),
    });
  }

  if (disputedNarrative > 0) {
    factors.push({
      label: `${disputedNarrative} disputed narrative statement(s)`,
      detail: 'Witness/party accounts do not agree — lowers confidence until resolved.',
      tone: 'negative',
      sourceSystem: 'ClaimVault DMS',
    });
  }

  // Coverage position
  factors.push({
    label: 'Coverage position',
    detail:
      claim.policyContext.coverageApplicability === 'covered'
        ? 'Coverage is confirmed applicable to this loss.'
        : claim.policyContext.coverageApplicability === 'excluded'
        ? 'Coverage position is excluded — this materially lowers confidence.'
        : 'Coverage applicability is ambiguous — treated as a confidence-reducing factor.',
    tone: claim.policyContext.coverageApplicability === 'covered' ? 'positive' : 'negative',
    sourceSystem: policySourceSystem(),
  });

  // Fraud / anomaly signals
  if (claim.anomalySignals && claim.anomalySignals.length > 0) {
    const highSeverity = claim.anomalySignals.some((s) => s.severity === 'high');
    factors.push({
      label: `${claim.anomalySignals.length} fraud/anomaly signal(s)`,
      detail: highSeverity
        ? 'At least one high-severity signal — confidence is held down pending SIU review.'
        : 'Lower-severity signals noted; factored into the score but not blocking.',
      tone: 'negative',
      sourceSystem: anomalySignalSourceSystem(),
    });
  } else {
    factors.push({
      label: 'No fraud/anomaly signals raised',
      detail: 'Fraud analytics found nothing to flag on this claim.',
      tone: 'positive',
      sourceSystem: anomalySignalSourceSystem(),
    });
  }

  const sops: SopCitation[] = [
    {
      id: 'SOP-010',
      title: 'Decision Governance, HITL Approval & Straight-Through Processing',
      note: `Straight-through eligibility requires a score at or above ${AUTO_APPROVE_THRESHOLD}%.`,
    },
    {
      id: 'SOP-002',
      title: 'Delegated Settlement Authority',
      note: 'Even a high-confidence claim still routes to senior approval once settlement exceeds the adjuster\u2019s authority limit.',
    },
  ];

  return {
    score,
    rationale: claim.aiConfidenceRationale?.trim() || 'No AI rationale recorded for this claim.',
    factors,
    sops,
  };
}
