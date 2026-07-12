// Deterministic "Evidence Intelligence" derivation.
//
// Given a single EvidenceItem and its parent Claim, this produces an
// EvidenceIntelligence packet for the "Trace the truth" view. Everything here is
// computed from the artifact's own metadata + the claim — no AI call, no
// randomness — so the demo is repeatable and explainable (same pattern as
// claimSimulation.ts).
//
// Honesty rules (kept deliberately conservative):
//  - Language is bounded to what metadata can support ("based on metadata",
//    "treated as", "does not independently verify"). We never claim the artifact
//    "proves" anything unless its status is 'verified', and even then we scope it.
//  - The claim-level financial breakdown is only surfaced as artifact line items
//    when the evidence is clearly an estimate/invoice/repair document, and it is
//    always labelled as claim-level financial impact, never as extracted figures.

import type {
  Claim,
  EvidenceArtifact,
  EvidenceArtifactLineItem,
  EvidenceIntelligence,
  EvidenceItem,
  EvidenceLineage,
  EvidenceTrustLevel,
} from '../types';
import { deriveEvidenceSourceSystem } from './sourceSystems';

const formatCurrency = (amount?: number, currency = 'USD'): string => {
  if (amount == null) return '';
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

const lower = (s: string | undefined): string => (s ?? '').toLowerCase();

// Does this evidence represent a structured financial document (estimate / invoice
// / repair order)? Only those should borrow the claim's financial breakdown as a
// line-item illustration.
const isFinancialArtifact = (evidence: EvidenceItem): boolean => {
  const text = `${lower(evidence.type)} ${lower(evidence.description)}`;
  return /estimate|invoice|repair|quote|appraisal|bill|supplement/.test(text);
};

// Short category label shown as a chip.
const deriveCategory = (evidence: EvidenceItem): string => {
  const t = lower(evidence.type);
  if (/photo|image|picture/.test(t)) return 'Photo set';
  if (/report/.test(t)) return 'Report';
  if (/record|medical/.test(t)) return 'Record';
  if (/estimate|invoice|repair|quote|appraisal|bill|supplement/.test(t)) return 'Document';
  if (/statement/.test(t)) return 'Statement';
  if (/policy/.test(t)) return 'Policy document';
  return 'Document';
};

// Which Digital Worker would have captured this artifact, inferred from its kind.
const deriveCollectedBy = (evidence: EvidenceItem): string => {
  const text = `${lower(evidence.type)} ${lower(evidence.description)}`;
  if (/medical|injury|hospital|treatment/.test(text)) return 'Medical DW';
  if (/estimate|repair|damage|photo|image/.test(text)) return 'Damage DW';
  if (/police|liability|statement|witness/.test(text)) return 'Liability DW';
  if (/policy|coverage|clause/.test(text)) return 'Coverage DW';
  if (evidence.provenance === 'Agent Inferred') return 'Intake DW';
  return 'Intake DW';
};

// The named system of record for this artifact (part of the orchestration
// story — Imagine pulls from several existing systems, the adjuster never has
// to know or care which). See data/sourceSystems.ts for the full landscape.
const deriveSystemOfRecord = (evidence: EvidenceItem): string => deriveEvidenceSourceSystem(evidence);

// Trust level: verification STATUS dominates; provenance is only a secondary
// signal that can downgrade an otherwise-verified item.
const deriveTrustLevel = (evidence: EvidenceItem): EvidenceTrustLevel => {
  if (evidence.status === 'disputed') return 'disputed';
  if (evidence.status === 'pending') return 'source-limited';
  // status === 'verified' from here on
  if (evidence.provenance === 'Agent Inferred') return 'source-limited';
  if (evidence.provenance === 'Public Record' || evidence.provenance === 'Third Party') {
    return 'corroborated';
  }
  return 'usable'; // verified but claimant-provided
};

const TRUST_POSTURE: Record<EvidenceTrustLevel, string> = {
  corroborated:
    'Independently sourced and verified. Suitable to rely on, while still reading it alongside the rest of the file.',
  usable:
    'Usable, but self-reported rather than independently sourced — corroborate before it carries a decision on its own.',
  'source-limited':
    'Attached source is usable but limited (pending or inferred). Its limitations must carry into the decision rationale.',
  disputed:
    'Contested by another part of the file. Do not rely on it until the conflict is reconciled.',
};

// "What this does not prove" — bounded statements driven by provenance + status.
const deriveDoesNotProve = (evidence: EvidenceItem): string[] => {
  const out: string[] = [];
  switch (evidence.provenance) {
    case 'Claimant Provided':
      out.push('Self-reported by the claimant; not independently corroborated.');
      break;
    case 'Agent Inferred':
      out.push('Inferred by a Digital Worker from other signals, not directly observed.');
      break;
    case 'Third Party':
      out.push('Reflects the third party’s assessment; scope may not cover the full claim.');
      break;
    case 'Public Record':
      out.push('Establishes the record of events, not the disputed interpretation of them.');
      break;
  }
  if (evidence.status === 'pending') {
    out.push('Not yet verified — treat as provisional until confirmation is received.');
  }
  if (evidence.status === 'disputed') {
    out.push('Currently disputed — conflicts with at least one other item in the file.');
  }
  if (isFinancialArtifact(evidence)) {
    out.push('Lists costed work, but does not by itself confirm the underlying damage is covered.');
  }
  return out;
};

// "What this says" — a short, bounded reading of the artifact's metadata.
const deriveWhatThisSays = (evidence: EvidenceItem): string[] => {
  const says: string[] = [];
  says.push(`Based on metadata: ${evidence.description}`);
  says.push(`Recorded as a ${deriveCategory(evidence).toLowerCase()} from ${evidence.source}.`);
  if (evidence.status === 'verified') {
    says.push('Verification status: verified against the system of record.');
  } else if (evidence.status === 'pending') {
    says.push('Verification status: pending — awaiting confirmation.');
  } else {
    says.push('Verification status: disputed — flagged for reconciliation.');
  }
  return says;
};

const deriveWhyThisMatters = (evidence: EvidenceItem, claim: Claim): string => {
  const blocker = claim.blockerReason?.trim();
  const action = claim.recommendedAction?.actionType?.trim();
  if (isFinancialArtifact(evidence) && blocker) {
    return `This artifact is a primary input to the open blocker: "${blocker}". It directly informs the recommended action${action ? ` (${action})` : ''}.`;
  }
  if (blocker) {
    return `Relevant to the open decision on this claim: "${blocker}".`;
  }
  return `Part of the evidence set the workforce assembled for ${claim.claimantName}'s claim.`;
};

// Build the renderable artifact "document", reusing REAL claim-level financial
// data only for genuine financial documents, and always labelling its source.
const buildArtifact = (evidence: EvidenceItem, claim: Claim): EvidenceArtifact | undefined => {
  const fields: Array<{ label: string; value: string }> = [
    { label: 'Claim', value: claim.id },
    { label: 'Customer', value: claim.claimantName },
    { label: 'Source', value: evidence.source },
    { label: 'Received', value: new Date(evidence.dateReceived).toLocaleDateString() },
  ];

  let lineItems: EvidenceArtifactLineItem[] | undefined;
  let lineItemsLabel: string | undefined;
  let amount: number | undefined;
  let currency: string | undefined;

  const fi = claim.recommendedAction?.financialImpact;
  if (isFinancialArtifact(evidence) && fi?.breakdown && fi.breakdown.length > 0) {
    currency = fi.currency ?? 'USD';
    amount = fi.estimatedAmount;
    lineItems = fi.breakdown.map((b) => ({
      description: b.category,
      basis: b.description,
      amount: b.amount,
      currency,
    }));
    lineItemsLabel = 'Claim financial impact breakdown (claim-level, shown for context)';
  }

  return {
    vendor: evidence.source,
    headline: `${evidence.type} · ${evidence.provenance}`,
    amount,
    currency,
    fields,
    lineItems,
    lineItemsLabel,
  };
};

export const buildEvidenceIntelligence = (
  evidence: EvidenceItem,
  claim: Claim,
): EvidenceIntelligence => {
  const trustLevel = deriveTrustLevel(evidence);
  const artifact = buildArtifact(evidence, claim);

  const amountSuffix =
    artifact?.amount != null ? ` (${formatCurrency(artifact.amount, artifact.currency)})` : '';

  const lineage: EvidenceLineage = {
    origin: evidence.source,
    collectedBy: deriveCollectedBy(evidence),
    collectedAt: evidence.dateReceived,
    systemOfRecord: deriveSystemOfRecord(evidence),
    trustPosture: TRUST_POSTURE[trustLevel],
  };

  return {
    evidenceId: evidence.id,
    title: `${evidence.type} — ${evidence.source}${amountSuffix}`,
    summary: evidence.description,
    trustLevel,
    category: deriveCategory(evidence),
    whatThisSays: deriveWhatThisSays(evidence),
    whyThisMatters: deriveWhyThisMatters(evidence, claim),
    whatThisDoesNotProve: deriveDoesNotProve(evidence),
    lineage,
    artifact,
  };
};

export const TRUST_LABELS: Record<EvidenceTrustLevel, string> = {
  corroborated: 'Corroborated',
  usable: 'Usable',
  'source-limited': 'Source limited',
  disputed: 'Disputed',
};

export const formatEvidenceCurrency = formatCurrency;
