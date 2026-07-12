// Thin "mock process" engine: pushes a real claim record (from GET /api/v1/claims)
// through the Claims Processing Workforce and derives, for each Digital Worker
// stage, what that stage would do with the claim. Everything here is deterministic
// and computed from the claim's own data - no AI call, no randomness - so the demo
// is repeatable and explainable.

import type { Claim } from '../types';
import { claimsWorkforce, type Workforce } from './claimsWorkforce.seed';

export type StageStatus = 'pass' | 'review' | 'flag';

export interface StageResult {
  stageId: string;
  stageName: string;
  status: StageStatus;
  headline: string;
  detail: string;
}

export type ClaimOutcome = 'Auto-approved' | 'Manual review' | 'Escalated / SIU' | 'Declined';

export interface ClaimSimulation {
  claimId: string;
  claimantName: string;
  incidentType: string;
  stageResults: StageResult[];
  outcome: ClaimOutcome;
  /** Final recommended action headline pulled from the claim. */
  finalAction: string;
  amount?: string;
}

const formatCurrency = (amount?: number, currency = 'USD'): string | undefined => {
  if (amount == null) return undefined;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

const stageName = (id: string, workforce: Workforce = claimsWorkforce): string =>
  workforce.stages.find((s) => s.id === id)?.name ?? id;

type SignalCategory = 'fraud' | 'liability' | 'financial';

// Classify an anomaly signal so it is assessed by the right Digital Worker.
// Only genuine fraud indicators (timeline/damage/identity/evidence mismatches,
// staged or duplicate claims, watchlist/network hits) escalate at the Fraud
// stage. Liability disputes go to Policy; medical-exposure / settlement-value /
// authority-threshold signals go to Settlement.
const classifySignal = (type: string, description = ''): SignalCategory => {
  const text = `${type} ${description}`.toLowerCase();
  const fraudHints = [
    'fraud',
    'timeline',
    'inconsistency',
    'mismatch',
    'damage pattern',
    'staged',
    'duplicate',
    'identity',
    'watchlist',
    'network',
    'forged',
    'missing evidence',
    'falsif',
    'suspicious',
  ];
  const financialHints = [
    'medical exposure',
    'exposure',
    'settlement',
    'authority',
    'threshold',
    'reserve',
    'quantum',
    'valuation',
    'exceed',
    'limit',
  ];
  const liabilityHints = ['liability', 'fault', 'coverage', 'dispute', 'negligence'];
  if (fraudHints.some((h) => text.includes(h))) return 'fraud';
  // Check financial before liability: medical-exposure / settlement-value
  // signals often mention "policy limits", which must not pull them into Policy.
  if (financialHints.some((h) => text.includes(h))) return 'financial';
  if (liabilityHints.some((h) => text.includes(h))) return 'liability';
  return 'financial';
};

/** Push a single claim through the workforce and derive a per-stage result. */
export const simulateClaim = (claim: Claim, workforce: Workforce = claimsWorkforce): ClaimSimulation => {
  const results: StageResult[] = [];

  const anomalies = claim.anomalySignals ?? [];
  const byCategory = {
    fraud: anomalies.filter((a) => classifySignal(a.type, a.description) === 'fraud'),
    liability: anomalies.filter((a) => classifySignal(a.type, a.description) === 'liability'),
    financial: anomalies.filter((a) => classifySignal(a.type, a.description) === 'financial'),
  };

  // 1. Claim Digital Worker - intake & routing.
  results.push({
    stageId: 'wf_intake',
    stageName: stageName('wf_intake', workforce),
    status: 'pass',
    headline: `Captured via ${claim.intakeChannel ?? 'Web Portal'}`,
    detail: `${claim.incidentType} claim for ${claim.claimantName} • Policy ${claim.policyRef}`,
  });

  // 2. Doc Review Digital Worker - evidence validation.
  const evidence = claim.evidenceItems ?? [];
  const verified = evidence.filter((e) => e.status === 'verified').length;
  const disputed = evidence.filter((e) => e.status === 'disputed').length;
  const docStatus: StageStatus = disputed > 0 ? 'flag' : verified < evidence.length ? 'review' : 'pass';
  results.push({
    stageId: 'wf_docreview',
    stageName: stageName('wf_docreview', workforce),
    status: docStatus,
    headline:
      docStatus === 'pass'
        ? `All ${evidence.length} evidence items verified`
        : docStatus === 'review'
          ? `${verified}/${evidence.length} verified — manual review`
          : `${disputed} disputed item(s) — investigation`,
    detail:
      evidence
        .slice(0, 3)
        .map((e) => e.type)
        .join(', ') || 'No documents attached',
  });

  // 3. Fraud Digital Worker - fraud risk assessment.
  const fraudSignals = byCategory.fraud;
  const fraudHigh = fraudSignals.filter((a) => a.severity === 'high').length;
  const fraudStatus: StageStatus =
    fraudHigh > 0 ? 'flag' : fraudSignals.length > 0 ? 'review' : 'pass';
  results.push({
    stageId: 'wf_fraud',
    stageName: stageName('wf_fraud', workforce),
    status: fraudStatus,
    headline:
      fraudSignals.length === 0
        ? 'No fraud signals detected'
        : fraudHigh > 0
          ? `${fraudSignals.length} fraud signal(s), ${fraudHigh} high — deep fraud review`
          : `${fraudSignals.length} low/medium fraud signal(s) — monitor`,
    detail: fraudSignals.length
      ? fraudSignals.map((a) => a.type).join(', ')
      : 'Rules, scoring & network checks clear',
  });

  // 4. Policy Digital Worker - coverage determination (factors in liability signals).
  const coverage = claim.policyContext?.coverageApplicability;
  const liabilitySignals = byCategory.liability;
  const policyStatus: StageStatus =
    coverage === 'excluded'
      ? 'flag'
      : coverage === 'ambiguous' || liabilitySignals.length > 0
        ? 'review'
        : 'pass';
  results.push({
    stageId: 'wf_policy',
    stageName: stageName('wf_policy', workforce),
    status: policyStatus,
    headline:
      coverage === 'excluded'
        ? 'Not covered under policy'
        : liabilitySignals.length > 0
          ? `Liability in dispute — ${liabilitySignals.length} signal(s), escalated`
          : coverage === 'ambiguous'
            ? 'Ambiguous — escalated for ruling'
            : 'Coverage confirmed',
    detail: liabilitySignals.length
      ? liabilitySignals.map((a) => a.type).join(', ')
      : `${claim.policyContext?.coverageType ?? 'Policy'} • confidence ${claim.confidenceLevel}`,
  });

  // 5. Settlement Digital Worker - calculation, AML & payment (factors in financial signals).
  const amount = formatCurrency(
    claim.recommendedAction?.financialImpact?.estimatedAmount,
    claim.recommendedAction?.financialImpact?.currency,
  );
  const financialSignals = byCategory.financial;
  const settleStatus: StageStatus =
    coverage === 'excluded'
      ? 'flag'
      : financialSignals.length > 0 || policyStatus === 'review'
        ? 'review'
        : 'pass';
  results.push({
    stageId: 'wf_settlement',
    stageName: stageName('wf_settlement', workforce),
    status: settleStatus,
    headline:
      coverage === 'excluded'
        ? 'No settlement — claim not covered'
        : financialSignals.length > 0
          ? `${amount ?? 'Settlement'} — senior approval required`
          : amount
            ? `Payment prepared: ${amount}`
            : 'Settlement calculated',
    detail: coverage === 'excluded'
      ? 'Closed without payment'
      : financialSignals.length
        ? financialSignals.map((a) => a.type).join(', ')
        : 'Sanctions / AML checks clear',
  });

  // 6. Compliance Agent - cross-cutting oversight.
  results.push({
    stageId: 'wf_compliance',
    stageName: stageName('wf_compliance', workforce),
    status: 'pass',
    headline: 'Logged & audit pack assembled',
    detail: `${(claim.auditTrail ?? []).length} audit entries • full decision trail captured`,
  });

  // Overall outcome.
  let outcome: ClaimOutcome = 'Auto-approved';
  if (coverage === 'excluded') outcome = 'Declined';
  else if (fraudStatus === 'flag') outcome = 'Escalated / SIU';
  else if (results.some((r) => r.status === 'review' || r.status === 'flag')) outcome = 'Manual review';

  return {
    claimId: claim.id,
    claimantName: claim.claimantName,
    incidentType: claim.incidentType,
    stageResults: results,
    outcome,
    finalAction: claim.recommendedAction?.actionType ?? '—',
    amount,
  };
};

export const outcomeTagType = (outcome: ClaimOutcome): string => {
  switch (outcome) {
    case 'Auto-approved':
      return 'green';
    case 'Manual review':
      return 'cyan';
    case 'Escalated / SIU':
      return 'magenta';
    case 'Declined':
      return 'red';
    default:
      return 'gray';
  }
};

export const stageStatusTagType = (status: StageStatus): string => {
  switch (status) {
    case 'pass':
      return 'green';
    case 'review':
      return 'cyan';
    case 'flag':
      return 'red';
    default:
      return 'gray';
  }
};
