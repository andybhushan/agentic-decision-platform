/**
 * Domain types for the FNOL (First Notice of Loss) session lifecycle.
 *
 * Sessions are the persistent, auditable unit of a claim intake conversation.
 * Every mutating operation is idempotency-keyed and emits an audit event.
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

export interface FNOLMessage {
  role: 'user' | 'assistant';
  content: string;
  rawTranscript?: string;
  confidence?: number;
  timestamp: string;
  clientEventSeq: number;
}

export interface ConsentArtifact {
  id: string;
  sessionId: string;
  consentType: 'data_processing' | 'dashcam_access' | 'telematics_access' | 'evidence_submission';
  timestamp: string;
  channel: 'web' | 'voice';
  actorId: string;
}

export interface EvidenceItem {
  id: string;
  sessionId: string;
  type: 'photo' | 'document' | 'police_reference' | 'dashcam';
  filename?: string;
  mimeType?: string;
  policeRef?: string;
  storedAt: string;
  uploadedAt: string;
  // Blob storage fields (populated when actual file is uploaded)
  blobName?: string;
  containerName?: string;
  category?: 'own_vehicle' | 'third_party' | 'scene' | 'medical_record' | 'witness_statement' | 'police_report' | 'other';
  analysisText?: string;
}

export interface CallbackSlot {
  date: string;
  timeSlot: string;
  confirmed: boolean;
}

export interface FNOLSession {
  sessionId: string;
  callerId: string;
  personaId?: string;
  policyRef?: string;
  phase: FNOLPhase;
  lastClientEventSeq: number;
  idempotencyLog: Record<string, unknown>;
  messages: FNOLMessage[];
  consentArtifacts: ConsentArtifact[];
  evidenceItems: EvidenceItem[];
  callbackSlot?: CallbackSlot;
  claimId?: string;
  escalatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FNOLAuditEvent {
  requestId: string;
  sessionId: string;
  phase: FNOLPhase;
  step: string;
  outcome: 'success' | 'conflict' | 'replay' | 'error';
  actor?: string;
  timestamp: string;
  detail?: unknown;
}

// --- API request / response shapes ---

export interface CreateSessionRequest {
  callerId: string;
  personaId?: string;
  policyRef?: string;
  idempotencyKey: string;
}

export interface AddTurnRequest {
  query: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  clientEventSeq: number;
  idempotencyKey: string;
}

export interface ConsentRequest {
  consentType: ConsentArtifact['consentType'];
  channel: ConsentArtifact['channel'];
  actorId: string;
  idempotencyKey: string;
}

export interface EvidenceRequest {
  type: EvidenceItem['type'];
  filename?: string;
  mimeType?: string;
  policeRef?: string;
  idempotencyKey: string;
  // Extended fields for blob-backed uploads
  blobName?: string;
  containerName?: string;
  category?: EvidenceItem['category'];
  analysisText?: string;
}

export interface SubmitRequest {
  idempotencyKey: string;
}
