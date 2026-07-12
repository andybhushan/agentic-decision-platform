/**
 * FNOLConversationPage
 *
 * Drop-in replacement for FNOLIntakePage at /claims/intake.
 *
 * Responsibilities:
 * - Mount / resume FNOL session from IndexedDB + server
 * - Drive FNOLStateMachine via dispatch()
 * - Persist state to IndexedDB on every transition
 * - Call fnolApi for agent turns, consent, evidence, submit
 * - Detect online/offline; replay queued ops on reconnect
 * - Render status strip, chat surface, gate cards, composer, escalation modal
 */

import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  InlineNotification,
  Button,
  Loading,
} from '@carbon/react';
import { Phone, WarningAlt, ArrowLeft, VolumeUp, VolumeMute, StopFilledAlt } from '@carbon/icons-react';

import { fnolStore } from '../persistence/FNOLSessionStore';
import {
  createInitialSession,
  transition,
  isTerminal,
  conversationHistory,
  phaseIndex,
} from '../domain/fnol/FNOLStateMachine';
import {
  createSession as apiCreateSession,
  resumeSession as apiResumeSession,
  sendTurn,
  recordConsent,
  uploadEvidence,
  uploadEvidenceFiles,
  submitClaim,
  replayQueue,
} from '../services/fnolApi';
import { api } from '../services/api';

import { FNOLStatusStrip } from '../components/fnol/FNOLStatusStrip';
import { FNOLChatSurface } from '../components/fnol/FNOLChatSurface';
import {
  FNOLConsentCard,
  FNOLEvidenceCard,
  FNOLCallbackCard,
  FNOLSummaryCard,
  FNOLDeviceAccessCard,
} from '../components/fnol/FNOLGateCard';
import type { DeviceInfo } from '../components/fnol/FNOLGateCard';
import { FNOLComposer } from '../components/fnol/FNOLComposer';
import { storeActiveClaim } from './PolicyDashboardPage';
import { readStoredCustomerPersonaId, useCustomerPersonaStore } from '../store/useCustomerPersonaStore';

import type { FNOLClientSession, FNOLEvent, ConsentArtifact, EvidenceItem } from '../domain/fnol/types';
import type { CustomerPersona } from '../types';
import './FNOLConversationPage.scss';

const DEFAULT_CALLER = import.meta.env.VITE_DEMO_CALLER ?? 'Richard Hogan';

function getSessionStorageKey(personaId: string | null) {
  return `fnol_active_session_id:${personaId ?? 'default'}`;
}

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const maybeResponse = (err as { response?: { data?: { error?: unknown; message?: unknown } } }).response;
    const responseError = maybeResponse?.data?.error;
    if (typeof responseError === 'string' && responseError.trim()) return responseError;
    const responseMessage = maybeResponse?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'An unexpected error occurred.';
}

// ── State machine reducer ─────────────────────────────────────────────────────

function sessionReducer(state: FNOLClientSession, event: FNOLEvent): FNOLClientSession {
  return transition(state, event);
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FNOLConversationPage = () => {
  const navigate = useNavigate();
  const { activeCustomerId, hydrateActiveCustomer, setPersonas } = useCustomerPersonaStore();

  const [session, dispatchSession] = useReducer(
    sessionReducer,
    null as unknown as FNOLClientSession
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isMounting, setIsMounting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [pendingResume, setPendingResume] = useState<FNOLClientSession | null>(null);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);
  const [voiceOutput, setVoiceOutput] = useState(false); // only enable after user initiates voice input
  const voiceOutputRef = useRef(voiceOutput);
  voiceOutputRef.current = voiceOutput;
  const [connectedDevices, setConnectedDevices] = useState<DeviceInfo | null>(null);
  const [deviceAccessOffered, setDeviceAccessOffered] = useState(false);
  const [claimConfirmation, setClaimConfirmation] = useState<{ claimId: string; adjusterName: string } | null>(null);
  // Vehicles from policy — used to cross-check device card against the incident vehicle
  const [policyVehicles, setPolicyVehicles] = useState<Array<{ make: string; model: string; registration: string; hasDevices: boolean }>>([]);

  // Track whether we've auto-played a voice greeting
  const greetedRef = useRef(false);

  // ── IndexedDB init ────────────────────────────────────────────────────────

  const resolveActiveCustomer = useCallback(async (): Promise<CustomerPersona | null> => {
    const storedId = readStoredCustomerPersonaId() ?? activeCustomerId;
    if (storedId) {
      try {
        return await api.getCustomerPersona(storedId);
      } catch {
        // Fall back to selectable list below.
      }
    }

    try {
      const selectable = await api.getCustomerPersonas(true);
      if (selectable.length) {
        setPersonas(selectable);
        return selectable[0];
      }
    } catch {
      // Ignore and use the default caller fallback.
    }

    return null;
  }, [activeCustomerId, setPersonas]);

  useEffect(() => {
    hydrateActiveCustomer();
    fnolStore.open().then(async () => {
      const activeCustomer = await resolveActiveCustomer();
      const savedId = sessionStorage.getItem(getSessionStorageKey(activeCustomer?.id ?? null));
      if (savedId) {
        const snapshot = await fnolStore.loadSnapshot(savedId);
        if (snapshot && !isTerminal(snapshot.phase)) {
          setPendingResume(snapshot);
          setShowResumePrompt(true);
          setIsMounting(false);
          return;
        }
      }
      await startNewSession();
    }).catch((err) => {
      console.error('IndexedDB open failed, falling back to no persistence', err);
      startNewSession();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrateActiveCustomer, resolveActiveCustomer]);

  // ── Online/offline ────────────────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (session?.sessionId) {
        try {
          await replayQueue(session.sessionId);
        } catch {
          // Non-fatal — ops stay in queue for next reconnect
        }
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [session?.sessionId]);

  useEffect(() => {
    if (session?.phase !== 'SUBMITTED' || error) return;
    const redirectTimer = window.setTimeout(() => navigate('/claims/dashboard'), 3000);
    return () => window.clearTimeout(redirectTimer);
  }, [error, session?.phase, navigate]);

  // ── Session start / resume ────────────────────────────────────────────────

  const startNewSession = useCallback(async () => {
    setShowResumePrompt(false);
    setPendingResume(null);
    greetedRef.current = false;
    setDeviceAccessOffered(false);
    try {
      const activeCustomer = await resolveActiveCustomer();
      const callerName = activeCustomer?.displayName ?? DEFAULT_CALLER;
      const sessionData = await apiCreateSession(callerName, {
        personaId: activeCustomer?.id,
        policyRef: activeCustomer?.defaultPolicyRef,
      });
      const { sessionId } = sessionData;

      // Store connected device info from policy for the EVIDENCE gate card
      if (sessionData.connectedDevices) {
        const cd = sessionData.connectedDevices as {
          dashcam?: { manufacturer: string; model: string; registeredApp?: string; vehicleReg?: string };
          telematics?: { provider: string; vehicleReg?: string; appName?: string };
        };
        const vehicles = (sessionData as any).vehicles as Array<{ make: string; model: string; registration: string }> | undefined;

        // Collect all registrations that have connected devices
        const deviceRegs = new Set<string>();
        if (cd.dashcam?.vehicleReg) deviceRegs.add(cd.dashcam.vehicleReg);
        if (cd.telematics?.vehicleReg) deviceRegs.add(cd.telematics.vehicleReg);

        // Build policy vehicles list with hasDevices flag
        if (vehicles) {
          setPolicyVehicles(vehicles.map((v) => ({ ...v, hasDevices: deviceRegs.has(v.registration) })));
        }

        const dashcamVehicle = vehicles?.find((v) => v.registration === cd.dashcam?.vehicleReg);
        const vehicleDesc = dashcamVehicle
          ? `${dashcamVehicle.make} ${dashcamVehicle.model}`
          : cd.dashcam?.vehicleReg ?? cd.telematics?.vehicleReg ?? undefined;
        setConnectedDevices({
          dashcam: cd.dashcam
            ? { manufacturer: cd.dashcam.manufacturer, model: cd.dashcam.model, app: cd.dashcam.registeredApp }
            : undefined,
          telematics: cd.telematics
            ? { provider: cd.telematics.provider, app: cd.telematics.appName }
            : undefined,
          vehicleDescription: vehicleDesc,
        });
      }

      const initial = createInitialSession(sessionId, callerName, activeCustomer?.id, sessionData.policyRef ?? activeCustomer?.defaultPolicyRef);
      dispatchSession({ type: 'RESUME', session: initial });
      sessionStorage.setItem(getSessionStorageKey(activeCustomer?.id ?? null), sessionId);
      await fnolStore.saveSnapshot(initial);

      // Send the greeting turn automatically
      setIsMounting(false);
      await sendGreeting(sessionId, initial);
    } catch (err) {
      console.error('Failed to create FNOL session', err);
      setError('Unable to start session. Please try again.');
      setIsMounting(false);
    }
  }, [resolveActiveCustomer]);

  const resumeExistingSession = useCallback(async (snapshot: FNOLClientSession) => {
    setShowResumePrompt(false);
    try {
      // Merge local snapshot with server state. Phase merge is forward-only so a
      // server lagging behind local card progress can never regress the UI, and
      // a terminal/escalated local snapshot is preserved.
      const serverSession = await apiResumeSession(snapshot.sessionId);
      const serverPhase = serverSession.phase;
      const keepLocal =
        isTerminal(snapshot.phase) ||
        !serverPhase ||
        phaseIndex(serverPhase) <= phaseIndex(snapshot.phase);
      const merged: FNOLClientSession = {
        ...snapshot,
        phase: keepLocal ? snapshot.phase : serverPhase,
        consentArtifacts: serverSession.consentArtifacts?.length
          ? serverSession.consentArtifacts
          : snapshot.consentArtifacts,
        evidenceItems: serverSession.evidenceItems?.length
          ? serverSession.evidenceItems
          : snapshot.evidenceItems,
      };
      dispatchSession({ type: 'RESUME', session: merged });
      sessionStorage.setItem(getSessionStorageKey(merged.personaId ?? null), merged.sessionId);
      await fnolStore.saveSnapshot(merged);
    } catch {
      // Server session gone — use local snapshot as-is
      dispatchSession({ type: 'RESUME', session: snapshot });
    }
  }, []);

  // ── Greeting ──────────────────────────────────────────────────────────────

  const sendGreeting = useCallback(async (sessionId: string, _currentSession: FNOLClientSession) => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    setIsLoading(true);
    try {
      const result = await sendTurn(sessionId, 'Hello', [], 0);
      const update: FNOLEvent = {
        type: 'AGENT_REPLY',
        content: result.response,
        confidence: result.confidence,
        escalateToHuman: result.escalateToHuman,
        phase: result.phase,
      };
      dispatchSession(update);

      // Auto-play greeting via TTS
      playTts(result.response);
    } catch (err) {
      console.error('Greeting failed', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── TTS playback ──────────────────────────────────────────────────────────

  const stopTts = useCallback(() => {
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
      ttsAudio.src = '';
      setTtsAudio(null);
    }
  }, [ttsAudio]);

  const enableVoiceOutput = useCallback(() => {
    voiceOutputRef.current = true;
    setVoiceOutput(true);
  }, []);

  const playTts = useCallback(async (text: string) => {
    if (!voiceOutputRef.current) return;
    try {
      stopTts();
      const result = await api.synthesizeVoice(text);
      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      setTtsAudio(audio);
      audio.oncanplaythrough = () => {
        audio.play().catch(() => { /* user gesture required — silently ignore */ });
      };
      audio.onended = () => setTtsAudio(null);
    } catch {
      // TTS failure is non-fatal — text is still shown
    }
  }, [stopTts]);

  useEffect(() => {
    if (!voiceOutput) {
      stopTts();
    }
  }, [voiceOutput, stopTts]);

  // ── Persist on every state change ────────────────────────────────────────

  useEffect(() => {
    if (!session) return;
    fnolStore.saveSnapshot(session).catch(() => {});
  }, [session]);

  // ── Escalation modal ─────────────────────────────────────────────────────

  useEffect(() => {
    if (session?.phase === 'ESCALATED') {
      setShowEscalationModal(true);
    }
  }, [session?.phase]);

  // ── Send user message ─────────────────────────────────────────────────────

  const handleSend = useCallback(async (text: string, rawTranscript?: string) => {
    if (!session || isLoading || isTerminal(session.phase)) return;
    stopTts();
    if (rawTranscript?.trim()) {
      enableVoiceOutput();
    }

    const seq = session.lastClientEventSeq + 1;

    dispatchSession({
      type: 'USER_MESSAGE',
      content: text,
      rawTranscript,
    });

    setIsLoading(true);
    setError(null);

    try {
      const history = conversationHistory(session.messages);
      const result = await sendTurn(session.sessionId, text, history, seq);

      const agentEvent: FNOLEvent = {
        type: 'AGENT_REPLY',
        content: result.response,
        confidence: result.confidence,
        escalateToHuman: result.escalateToHuman,
        phase: result.phase,
      };
      dispatchSession(agentEvent);

      // Auto-play agent reply
      playTts(result.response);
    } catch (err) {
      setError('Failed to get a response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [session, isLoading, stopTts, enableVoiceOutput, playTts]);

  const handleDeviceAccess = useCallback(async (granted: { dashcam: boolean; telematics: boolean }) => {
    if (!session) return;
    setDeviceAccessOffered(true);
    const types: ConsentArtifact['consentType'][] = [];
    if (granted.dashcam) types.push('dashcam_access');
    if (granted.telematics) types.push('telematics_access');
    for (const t of types) {
      dispatchSession({ type: 'GIVE_CONSENT', consentType: t });
      try { await recordConsent(session.sessionId, t, DEFAULT_CALLER); } catch { /* queued */ }
    }
    // Automatically send a turn to let Alex know the decision
    const decision = types.length
      ? `I've granted access to my ${types.map((t) => t === 'dashcam_access' ? 'dashcam' : 'telematics').join(' and ')}.`
      : "I'd prefer not to share connected device data for now.";
    await handleSend(decision);
  }, [session, handleSend]);

  // ── Gate handlers ─────────────────────────────────────────────────────────

  const handleConsent = useCallback(async (consentType: ConsentArtifact['consentType']) => {
    if (!session) return;
    dispatchSession({ type: 'GIVE_CONSENT', consentType });
    try {
      await recordConsent(session.sessionId, consentType, DEFAULT_CALLER);
    } catch {
      // Queued for offline replay
    }
  }, [session]);

  const handleEvidence = useCallback(async (item: Omit<EvidenceItem, 'id' | 'uploadedAt'>) => {
    if (!session) return;
    dispatchSession({ type: 'UPLOAD_EVIDENCE', item });
    try {
      await uploadEvidence(session.sessionId, {
        type: item.type,
        filename: item.filename,
        policeRef: item.policeRef,
        mimeType: item.mimeType,
        category: item.category,
      });
    } catch {
      // Queued for offline replay
    }
  }, [session]);

  const handleUploadFiles = useCallback(async (files: File[], category: string) => {
    if (!session) return;
    await uploadEvidenceFiles(session.sessionId, files, category as any);
    // Record in local state for each file
    for (const f of files) {
      dispatchSession({
        type: 'UPLOAD_EVIDENCE',
        item: {
          type: f.type.startsWith('image/') ? 'photo' : 'document',
          filename: f.name,
          mimeType: f.type,
          category: category as EvidenceItem['category'],
        },
      });
    }
  }, [session]);

  const handleCallbackScheduled = useCallback(() => {
    if (!session) return;
    dispatchSession({ type: 'SCHEDULE_CALLBACK' });
  }, [session]);

  const handleSummaryConfirm = useCallback(async () => {
    if (!session) return;
    dispatchSession({ type: 'CONFIRM_SUMMARY' });
    try {
      const result = await submitClaim(session.sessionId);
      dispatchSession({ type: 'SUBMIT' });
      sessionStorage.removeItem(getSessionStorageKey(session.personaId ?? null));
      setError(null);
      let adjusterName = 'Your Claims Handler';
      try {
        const activeClaim = await storeActiveClaim(result.claimId, 'Auto');
        adjusterName = activeClaim.adjuster?.name ?? adjusterName;
      } catch (err) {
        adjusterName = 'Assigned handler unavailable';
        setError(`Claim submitted, but dashboard sync failed: ${getErrorMessage(err)}`);
      }
      setClaimConfirmation({ claimId: result.claimId, adjusterName });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [session]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderGateCard = () => {
    if (!session) return null;
    const { phase, gates } = session;

    if (phase === 'CONSENT' && !gates.consentGiven) {
      return (
        <FNOLConsentCard
          consentType="data_processing"
          onConsent={handleConsent}
          disabled={isLoading}
        />
      );
    }
    if (phase === 'EVIDENCE') {
      // Show device access card first (if we have connected devices and haven't offered yet)
      if (connectedDevices && !deviceAccessOffered) {
        // Determine whether the incident vehicle (inferred from the conversation) has connected
        // devices. If the customer mentioned a vehicle whose reg is NOT registered with any
        // device, suppress the card — there is no data to share from that car.
        const shouldOfferDevices = (() => {
          if (policyVehicles.length === 0) return true; // no vehicle data — show by default
          // Scan assistant messages for vehicle make mentions
          const assistantText = session.messages
            .filter((m) => m.role === 'assistant')
            .map((m) => m.content)
            .join(' ')
            .toLowerCase();
          // Find policy vehicles mentioned in the conversation
          const mentioned = policyVehicles.filter((v) =>
            assistantText.includes(v.make.toLowerCase()) ||
            assistantText.includes(v.model.toLowerCase().split(' ')[0]) // first word of model
          );
          if (mentioned.length === 0) return true; // can't determine — default to show
          // If ANY mentioned vehicle has devices, show the card
          return mentioned.some((v) => v.hasDevices);
        })();

        if (shouldOfferDevices) {
          return (
            <FNOLDeviceAccessCard
              devices={connectedDevices}
              onGrant={handleDeviceAccess}
              disabled={isLoading}
            />
          );
        }
        // Skip device card — mark as offered so we don't loop
        setDeviceAccessOffered(true);
      }
      if (!gates.evidenceOffered) {
        return <FNOLEvidenceCard onUpload={handleEvidence} onUploadFiles={handleUploadFiles} disabled={isLoading} />;
      }
    }
    if (phase === 'CALLBACK_SCHEDULED') {
      return <FNOLCallbackCard onScheduled={handleCallbackScheduled} disabled={isLoading} />;
    }
    if (phase === 'SUMMARY' && !gates.summaryConfirmed) {
      const lastAssistant = [...(session.messages)].reverse().find((m) => m.role === 'assistant');
      return (
        <FNOLSummaryCard
          summary={lastAssistant?.content ?? 'Please review your claim details above.'}
          onConfirm={handleSummaryConfirm}
          onEdit={() => dispatchSession({ type: 'USER_MESSAGE', content: 'I need to make a correction.' })}
          disabled={isLoading}
        />
      );
    }
    return null;
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isMounting) {
    return (
      <div className="fnol-conversation-page fnol-conversation-page--loading">
        <Loading description="Starting session…" withOverlay={false} />
      </div>
    );
  }

  // ── Resume prompt ─────────────────────────────────────────────────────────

  if (showResumePrompt && pendingResume) {
    return (
      <div className="fnol-conversation-page fnol-conversation-page--resume">
        <div className="fnol-conversation-page__resume-card">
          <WarningAlt size={32} />
          <h2>Resume your claim?</h2>
          <p>You have an incomplete FNOL session in progress. Would you like to pick up where you left off?</p>
          <div className="fnol-conversation-page__resume-actions">
            <Button kind="primary" onClick={() => resumeExistingSession(pendingResume)}>
              Resume claim
            </Button>
            <Button kind="secondary" onClick={startNewSession}>
              Start new claim
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fnol-conversation-page" role="main" aria-label="FNOL Claim Intake">
      {/* Mobile app header */}
      <div className="fnol-mobile-header">
        <button
          className="fnol-mobile-header__back"
          onClick={() => navigate('/claims/dashboard')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="fnol-mobile-header__avatar" aria-hidden="true">A</div>
        <div className="fnol-mobile-header__info">
          <div className="fnol-mobile-header__name">Alex</div>
          <div className="fnol-mobile-header__status">Claims AI · Active</div>
        </div>
        <div className="fnol-mobile-header__voice">
          {ttsAudio && (
            <button
              className="fnol-mobile-header__voice-btn fnol-mobile-header__voice-btn--stop"
              onClick={stopTts}
              aria-label="Stop speaking"
              title="Stop speaking"
            >
              <StopFilledAlt size={18} />
            </button>
          )}
          <button
            className="fnol-mobile-header__voice-btn"
            onClick={() => {
              if (voiceOutputRef.current) {
                voiceOutputRef.current = false;
                setVoiceOutput(false);
                stopTts();
              } else {
                voiceOutputRef.current = true;
                setVoiceOutput(true);
              }
            }}
            aria-label={voiceOutput ? 'Mute voice replies' : 'Unmute voice replies'}
            title={voiceOutput ? 'Mute voice replies' : 'Unmute voice replies'}
          >
            {voiceOutput ? <VolumeUp size={18} /> : <VolumeMute size={18} />}
          </button>
        </div>
        <div className="fnol-mobile-header__brand" aria-hidden="true">
          <div className="fnol-mobile-header__brand-mark">B&amp;O</div>
          <div className="fnol-mobile-header__brand-text">
            <span>Bane &amp; Ox</span>
            <span>Insurance</span>
          </div>
        </div>
      </div>

      {/* Phase progress strip */}
      {session && <FNOLStatusStrip phase={session.phase} />}

      {/* Offline banner */}
      {!isOnline && (
        <InlineNotification
          kind="warning"
          title="You're offline"
          subtitle="Messages will be sent when your connection is restored."
          lowContrast
          hideCloseButton
        />
      )}

      {/* Error banner */}
      {error && (
        <InlineNotification
          kind="error"
          title={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
        />
      )}

      {/* Chat messages */}
      {session && (
        <FNOLChatSurface
          messages={session.messages}
          agentName="Alex"
          isLoading={isLoading}
          phase={session.phase}
        />
      )}

      {/* Gate cards — rendered below the last message */}
      {session && !isTerminal(session.phase) && (
        <div className="fnol-conversation-page__gate">
          {renderGateCard()}
        </div>
      )}

      {/* Composer */}
      {session && !isTerminal(session.phase) && (
        <FNOLComposer
          onSend={handleSend}
          onInteract={stopTts}
          disabled={isLoading || showEscalationModal || session.phase === 'SUMMARY'}
          voiceEnabled
          placeholder="Describe what happened…"
        />
      )}

      {/* Claim confirmation overlay */}
      {claimConfirmation && (
        <div className="fnol-confirmation-overlay" role="dialog" aria-label="Claim submitted">
          <div className="fnol-confirmation-card">
            <div className="fnol-confirmation-card__icon-wrap">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="24" fill="rgba(66,190,101,0.15)" />
                <path d="M14 24l7 7 13-14" stroke="#42be65" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="fnol-confirmation-card__title">Claim Submitted</h2>
            <p className="fnol-confirmation-card__ref">{claimConfirmation.claimId}</p>
            <p className="fnol-confirmation-card__body">
              Your claim has been registered with Bane &amp; Ox Insurance. You'll receive a confirmation email shortly.
            </p>
            <div className="fnol-confirmation-card__adjuster">
              <span className="fnol-confirmation-card__adjuster-label">Assigned handler</span>
              <span className="fnol-confirmation-card__adjuster-name">{claimConfirmation.adjusterName}</span>
            </div>
            <p className="fnol-confirmation-card__redirect">Returning to your dashboard…</p>
            <button
              className="fnol-confirmation-card__btn"
              onClick={() => navigate('/claims/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Submitted notification (fallback) */}
      {session?.phase === 'SUBMITTED' && !claimConfirmation && (
        <div className="fnol-conversation-page__submitted">
          <InlineNotification
            kind="success"
            title="Claim submitted"
            subtitle="Your claim has been registered. You will be redirected shortly."
            lowContrast
            hideCloseButton
          />
        </div>
      )}

      {/* Escalation modal */}
      <Modal
        open={showEscalationModal}
        modalHeading="Connect to a human agent"
        primaryButtonText="Connect now"
        secondaryButtonText="Continue with Alex"
        onRequestClose={() => setShowEscalationModal(false)}
        onRequestSubmit={() => {
          setShowEscalationModal(false);
          navigate('/claims/dashboard');
        }}
        onSecondarySubmit={() => setShowEscalationModal(false)}
        danger={false}
        size="sm"
      >
        <div className="fnol-conversation-page__escalation-body">
          <Phone size={32} />
          <p>
            Alex has identified that your situation may benefit from speaking directly with a human claims specialist.
            This is not a reflection on your claim — it is simply the best way to ensure you receive the right support.
          </p>
          <p>A handler will be available shortly.</p>
        </div>
      </Modal>
    </div>
  );
};
