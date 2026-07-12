/**
 * FNOL Client State Machine
 *
 * Pure TypeScript state machine — no XState dependency.
 * All side effects (API calls, persistence) live outside this module.
 * Callers: dispatch(currentState, event) → nextState
 */

import { randomUUID } from '../../utils/id';
import type {
  FNOLPhase,
  FNOLClientSession,
  FNOLEvent,
  FNOLMessage,
  FNOLGates,
  ConsentArtifact,
  EvidenceItem,
} from './types';
import { initialGates, PHASE_ORDER } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function nextSeq(state: FNOLClientSession): number {
  return state.lastClientEventSeq + 1;
}

function phaseRank(p: FNOLPhase): number {
  return PHASE_ORDER.indexOf(p);
}

/**
 * Derive phase advancement from gate state plus the agent's [PHASE:x] marker.
 *
 * The agent marker (`serverPhase`) is an untrusted suggestion: escalation always
 * wins, and the marker may only move the conversation FORWARD and never past
 * EVIDENCE. Once the caller reaches EVIDENCE, the local gate cards
 * (evidence → consent → summary → submit) deterministically drive the remaining
 * phases — so the agent can never skip the consent or summary gate cards.
 */
function derivePhase(
  current: FNOLPhase,
  gates: FNOLGates,
  _agentReply: string,
  serverPhase?: FNOLPhase
): FNOLPhase {
  // Explicit overrides / sticky terminal + side-branch states.
  if (serverPhase === 'ESCALATED') return 'ESCALATED';
  if (current === 'SUBMITTED' || current === 'ESCALATED') return current;
  if (current === 'CALLBACK_SCHEDULED' || current === 'CALLBACK_COMPLETE') return current;

  // Gate-driven local advancement (one step from current).
  let local: FNOLPhase = current;
  if (current === 'GREETING' && gates.vehicleConfirmed) local = 'POLICY_VERIFY';
  else if (current === 'POLICY_VERIFY' && gates.coverageExplained) local = 'INCIDENT_CAPTURE';
  else if (current === 'INCIDENT_CAPTURE' && gates.dateConfirmed) local = 'DETAILS';
  else if (current === 'DETAILS' && gates.injuryAssessed && gates.thirdPartyRecorded) local = 'EVIDENCE';
  else if (current === 'EVIDENCE' && gates.evidenceOffered) local = 'CONSENT';
  else if (current === 'CONSENT' && gates.consentGiven) local = 'SUMMARY';
  else if (current === 'SUMMARY' && gates.summaryConfirmed) local = 'SUBMITTED';

  // Merge the agent suggestion: forward-only, capped at EVIDENCE.
  let candidate: FNOLPhase = local;
  if (serverPhase) {
    const sr = phaseRank(serverPhase);
    const cr = phaseRank(current);
    const cap = phaseRank('EVIDENCE');
    if (sr !== -1 && sr > cr && sr <= cap && sr > phaseRank(local)) {
      candidate = serverPhase;
    }
  }

  return candidate;
}

// ── Initial state factory ────────────────────────────────────────────────────

export function createInitialSession(sessionId: string, callerId: string, personaId?: string, policyRef?: string): FNOLClientSession {
  return {
    sessionId,
    callerId,
    personaId,
    policyRef,
    phase: 'GREETING',
    gates: initialGates(),
    messages: [],
    consentArtifacts: [],
    evidenceItems: [],
    lastClientEventSeq: 0,  // greeting uses seq 0; first user message will be seq 1
    updatedAt: now(),
  };
}

// ── Transition function ──────────────────────────────────────────────────────

export function transition(state: FNOLClientSession, event: FNOLEvent): FNOLClientSession {
  switch (event.type) {
    case 'USER_MESSAGE': {
      const seq = nextSeq(state);
      const msg: FNOLMessage = {
        id: randomUUID(),
        role: 'user',
        content: event.content,
        rawTranscript: event.rawTranscript,
        timestamp: now(),
        clientEventSeq: seq,
      };
      return {
        ...state,
        messages: [...state.messages, msg],
        lastClientEventSeq: seq,
        updatedAt: now(),
      };
    }

    case 'AGENT_REPLY': {
      const msg: FNOLMessage = {
        id: randomUUID(),
        role: 'assistant',
        content: event.content,
        confidence: event.confidence,
        timestamp: now(),
        clientEventSeq: state.lastClientEventSeq,
      };

      const nextPhase = event.escalateToHuman
        ? 'ESCALATED'
        : derivePhase(state.phase, state.gates, event.content, event.phase);

      return {
        ...state,
        messages: [...state.messages, msg],
        phase: nextPhase,
        escalatedAt: event.escalateToHuman && !state.escalatedAt ? now() : state.escalatedAt,
        updatedAt: now(),
      };
    }

    case 'CONFIRM_VEHICLE': {
      const gates: FNOLGates = { ...state.gates, vehicleConfirmed: true };
      return {
        ...state,
        gates,
        phase: derivePhase(state.phase, gates, '', undefined),
        updatedAt: now(),
      };
    }

    case 'CONFIRM_DATE': {
      const gates: FNOLGates = { ...state.gates, dateConfirmed: true };
      return {
        ...state,
        gates,
        phase: derivePhase(state.phase, gates, '', undefined),
        updatedAt: now(),
      };
    }

    case 'EXPLAIN_COVERAGE': {
      const gates: FNOLGates = { ...state.gates, coverageExplained: true };
      return {
        ...state,
        gates,
        phase: derivePhase(state.phase, gates, '', undefined),
        updatedAt: now(),
      };
    }

    case 'GIVE_CONSENT': {
      const artifact: ConsentArtifact = {
        id: randomUUID(),
        consentType: event.consentType,
        timestamp: now(),
        channel: 'web',
      };
      // Only the data-processing consent satisfies the CONSENT gate. Device
      // grants (dashcam/telematics) recorded at the EVIDENCE step are logged as
      // artifacts but must NOT pre-satisfy the processing-consent card.
      const gates: FNOLGates =
        event.consentType === 'data_processing'
          ? { ...state.gates, consentGiven: true }
          : state.gates;
      return {
        ...state,
        gates,
        consentArtifacts: [...state.consentArtifacts, artifact],
        phase: derivePhase(state.phase, gates, '', undefined),
        updatedAt: now(),
      };
    }

    case 'UPLOAD_EVIDENCE': {
      const item: EvidenceItem = {
        id: randomUUID(),
        ...event.item,
        uploadedAt: now(),
      };
      const gates: FNOLGates = { ...state.gates, evidenceOffered: true };
      return {
        ...state,
        gates,
        evidenceItems: [...state.evidenceItems, item],
        phase: derivePhase(state.phase, gates, '', undefined),
        updatedAt: now(),
      };
    }

    case 'SCHEDULE_CALLBACK':
      return { ...state, phase: 'CALLBACK_SCHEDULED', updatedAt: now() };

    case 'CONFIRM_SUMMARY': {
      const gates: FNOLGates = { ...state.gates, summaryConfirmed: true };
      return {
        ...state,
        gates,
        phase: derivePhase(state.phase, gates, '', undefined),
        updatedAt: now(),
      };
    }

    case 'SUBMIT':
      return { ...state, phase: 'SUBMITTED', updatedAt: now() };

    case 'ESCALATE':
      return { ...state, phase: 'ESCALATED', escalatedAt: now(), updatedAt: now() };

    case 'RESUME':
      return { ...event.session, updatedAt: now() };

    default:
      return state;
  }
}

// ── Utility queries ──────────────────────────────────────────────────────────

export function isTerminal(phase: FNOLPhase): boolean {
  return phase === 'SUBMITTED' || phase === 'ESCALATED';
}

export function phaseIndex(phase: FNOLPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function conversationHistory(
  messages: FNOLMessage[]
): { role: 'user' | 'assistant'; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}
