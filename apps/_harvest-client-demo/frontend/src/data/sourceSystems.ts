// Deterministic mapping of claim data elements to the (fictional) external
// systems that would supply them in a real Progressive/Chubb-style landscape.
//
// This tells the orchestration story from the transcript: Imagine sits above
// several existing systems of record and pulls data from each of them — the
// business user never has to know or care which. Everything here is derived
// from metadata already on the claim; nothing is fetched or invented per-view.
//
// Landscape (approved):
//   PolicyCore PAS — policy & coverage data (the policy admin system)
//   ClaimVault DMS — evidence documents, photos, witness/police statements
//   SentinelIQ     — fraud / SIU analytics signals
//   RepairNet      — repair quotes & approved-vendor data
//   ClearPay       — settlement payment execution

import type { EvidenceItem } from '../types';

export const SOURCE_SYSTEMS = {
  POLICY: 'PolicyCore PAS',
  EVIDENCE: 'ClaimVault DMS',
  FRAUD: 'SentinelIQ',
  REPAIR: 'RepairNet',
  PAYMENT: 'ClearPay',
} as const;

export type SourceSystemName = (typeof SOURCE_SYSTEMS)[keyof typeof SOURCE_SYSTEMS];

const lower = (s: string | undefined): string => (s ?? '').toLowerCase();

/**
 * Which system of record supplied a given evidence artifact. Repair quotes/
 * estimates come from RepairNet (the vendor-quoting system); everything else
 * evidentiary (photos, statements, reports) lives in the claim's document
 * store, ClaimVault DMS.
 */
export function deriveEvidenceSourceSystem(evidence: EvidenceItem): SourceSystemName {
  const text = `${lower(evidence.type)} ${lower(evidence.description)}`;
  if (/repair (quote|estimate)|vendor quote|body shop|mechanic/.test(text)) {
    return SOURCE_SYSTEMS.REPAIR;
  }
  return SOURCE_SYSTEMS.EVIDENCE;
}

/** Fraud / anomaly signals are always sourced from the fraud analytics platform. */
export function anomalySignalSourceSystem(): SourceSystemName {
  return SOURCE_SYSTEMS.FRAUD;
}

/** Policy & coverage facts are always sourced from the policy admin system. */
export function policySourceSystem(): SourceSystemName {
  return SOURCE_SYSTEMS.POLICY;
}

/** Repair quotes/vendor benchmarking data is always sourced from RepairNet. */
export function repairQuoteSourceSystem(): SourceSystemName {
  return SOURCE_SYSTEMS.REPAIR;
}

/** Settlement payment execution always writes to the payments platform. */
export function paymentSourceSystem(): SourceSystemName {
  return SOURCE_SYSTEMS.PAYMENT;
}
