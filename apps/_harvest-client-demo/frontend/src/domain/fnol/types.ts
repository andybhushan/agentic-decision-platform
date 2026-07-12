/**
 * Client-side domain types for the FNOL conversational PWA.
 * Mirror of backend/src/types/fnolSession.ts with client-only additions.
 */

export type FNOLPhase =
  | 'GREETING'
  | 'POLICY_VERIFY'
  | 'INCIDENT_CAPTURE'
  | 'DETAILS'
  | 'EVIDENCE'
  | 'CONSENT'
  | 'SUMMARY'
  | 'SUBMITTED'
  | 'CALLBACK_SCHEDULED'
  | 'CALLBACK_COMPLETE'
  | 'ESCALATED';

export const PHASE_LABELS: Record<FNOLPhase, string> = {
  GREETING: 'Identity',
  POLICY_VERIFY: 'Policy',
  INCIDENT_CAPTURE: 'Incident',
  DETAILS: 'Details',
  EVIDENCE: 'Evidence',
  CONSENT: 'Consent',
  SUMMARY: 'Summary',
  SUBMITTED: 'Submitted',
  CALLBACK_SCHEDULED: 'Callback',
  CALLBACK_COMPLETE: 'Complete',
  ESCALATED: 'Escalated',
};

export const PHASE_ORDER: FNOLPhase[] = [
  'GREETING',
  'POLICY_VERIFY',
  'INCIDENT_CAPTURE',
  'DETAILS',
  'EVIDENCE',
  'CONSENT',
  'SUMMARY',
  'SUBMITTED',
];

export interface FNOLGates {
  vehicleConfirmed: boolean;
  dateConfirmed: boolean;
  coverageExplained: boolean;
  injuryAssessed: boolean;
  thirdPartyRecorded: boolean;
  evidenceOffered: boolean;
  consentGiven: boolean;
  summaryConfirmed: boolean;
}

export const initialGates = (): FNOLGates => ({
  vehicleConfirmed: false,
  dateConfirmed: false,
  coverageExplained: false,
  injuryAssessed: false,
  thirdPartyRecorded: false,
  evidenceOffered: false,
  consentGiven: false,
  summaryConfirmed: false,
});

export interface FNOLMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rawTranscript?: string;
  confidence?: number;
  timestamp: string;
  clientEventSeq: number;
}

export interface ConsentArtifact {
  id: string;
  consentType: 'data_processing' | 'dashcam_access' | 'telematics_access' | 'evidence_submission';
  timestamp: string;
  channel: 'web' | 'voice';
}

export interface EvidenceItem {
  id: string;
  type: 'photo' | 'document' | 'police_reference' | 'dashcam';
  filename?: string;
  mimeType?: string;
  policeRef?: string;
  uploadedAt: string;
  blobName?: string;
  containerName?: string;
  category?: 'own_vehicle' | 'third_party' | 'scene' | 'medical_record' | 'witness_statement' | 'police_report' | 'other';
  analysisText?: string;
}

export interface FNOLClientSession {
  sessionId: string;
  callerId: string;
  personaId?: string;
  policyRef?: string;
  phase: FNOLPhase;
  gates: FNOLGates;
  messages: FNOLMessage[];
  consentArtifacts: ConsentArtifact[];
  evidenceItems: EvidenceItem[];
  lastClientEventSeq: number;
  claimId?: string;
  escalatedAt?: string;
  updatedAt: string;
}

// ── Events ──────────────────────────────────────────────────────────────────

export type FNOLEvent =
  | { type: 'USER_MESSAGE'; content: string; rawTranscript?: string }
  | { type: 'AGENT_REPLY'; content: string; confidence?: number; escalateToHuman?: boolean; phase?: FNOLPhase }
  | { type: 'CONFIRM_VEHICLE' }
  | { type: 'CONFIRM_DATE' }
  | { type: 'EXPLAIN_COVERAGE' }
  | { type: 'GIVE_CONSENT'; consentType: ConsentArtifact['consentType'] }
  | { type: 'UPLOAD_EVIDENCE'; item: Omit<EvidenceItem, 'id' | 'uploadedAt'> }
  | { type: 'SCHEDULE_CALLBACK' }
  | { type: 'CONFIRM_SUMMARY' }
  | { type: 'SUBMIT' }
  | { type: 'ESCALATE' }
  | { type: 'RESUME'; session: FNOLClientSession };

// ── Offline queue ────────────────────────────────────────────────────────────

export interface OfflineOp {
  id?: number;
  sessionId: string;
  clientEventSeq: number;
  idempotencyKey: string;
  opType: 'turn' | 'consent' | 'evidence' | 'submit' | 'phase';
  payload: unknown;
  createdAt: string;
  retries: number;
}
