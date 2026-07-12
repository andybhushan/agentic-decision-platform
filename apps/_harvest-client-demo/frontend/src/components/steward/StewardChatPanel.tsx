import { useState, useRef, useEffect, useCallback, Fragment, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { StewardBriefingCard } from './StewardBriefingCard';
import { DecisionBriefingCard } from './DecisionBriefingCard';
import {
  Button,
  TextInput,
  Tag,
  SkeletonText,
  IconButton,
} from '@carbon/react';
import { Send, Close, Minimize, Chat, Microphone, StopFilled, VolumeUp, VolumeMute } from '@carbon/icons-react';
import { useStewardStore } from '../../store/useStewardStore';
import type { StewardPageContext, DecisionBriefingData } from '../../services/stewardApi';
import { api } from '../../services/api';
import './StewardChatPanel.scss';

// Azure Speech STT reliably handles PCM WAV only, so we capture raw 16kHz mono
// PCM via AudioContext and encode a WAV ourselves (mirrors the FNOL composer).
const STT_SAMPLE_RATE = 16000;

// Rotating status labels shown beside the typing dots while the Steward thinks.
const THINKING_STATUSES = [
  'Reviewing your queue…',
  'Consulting the Digital Steward…',
  'Checking claim records…',
  'Synthesising guidance…',
  'Routing to SIU Fraud Investigator…',
];

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, samples[i] * 32768));
  }
  const dataLen = pcm.byteLength;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const le = true;
  v.setUint32(0, 0x52494646, false); // 'RIFF'
  v.setUint32(4, 36 + dataLen, le);
  v.setUint32(8, 0x57415645, false); // 'WAVE'
  v.setUint32(12, 0x666d7420, false); // 'fmt '
  v.setUint32(16, 16, le);
  v.setUint16(20, 1, le);
  v.setUint16(22, 1, le);
  v.setUint32(24, sampleRate, le);
  v.setUint32(28, sampleRate * 2, le);
  v.setUint16(32, 2, le);
  v.setUint16(34, 16, le);
  v.setUint32(36, 0x64617461, false); // 'data'
  v.setUint32(40, dataLen, le);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// The Steward renders markdown; strip the syntax so TTS reads clean prose.
function stripMarkdownForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')          // code fences
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // bold
    .replace(/\*([^*]+)\*/g, '$1')             // italics
    .replace(/_([^_]+)_/g, '$1')               // underscore italics
    .replace(/^#{1,6}\s+/gm, '')               // headings
    .replace(/^\s*[-*]\s+/gm, '')              // bullet markers
    .replace(/^\s*\d+\.\s+/gm, '')             // numbered markers
    .replace(/⚑/g, '')                          // flag glyph
    .replace(/\n{2,}/g, '. ')                  // paragraph breaks -> pause
    .replace(/\n/g, '. ')
    .replace(/\.\s*\.\s*/g, '. ')              // collapse double periods
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Inline tokens we promote to coloured badges / chips so every Steward reply —
// structured or free prose — shares one visual language (no more "style swapping").
//   [HIGH] / [MEDIUM] / [LOW] / [CRITICAL]  -> severity badge
//   ⚑ escalation required                    -> escalation badge
//   CLM-2026-AUTO-103                         -> claim-id chip
//   $18,400                                   -> currency chip
const STEWARD_TOKEN_RE =
  /(\[(?:critical|high|medium|low)\])|(⚑\s*escalation required)|(CLM-\d{4}-[A-Z]+-\d+)|(\$\d[\d,]*(?:\.\d+)?)/gi;

function decorateString(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(STEWARD_TOKEN_RE.source, 'gi');
  let lastIndex = 0;
  let i = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index));
    const [full, sev, esc, claim, amount] = match;
    const key = `${keyBase}-${i++}`;
    if (sev) {
      const level = sev.replace(/[[\]]/g, '').toLowerCase();
      out.push(<span key={key} className={`steward-badge steward-badge--${level}`}>{level.toUpperCase()}</span>);
    } else if (esc) {
      out.push(<span key={key} className="steward-badge steward-badge--escalation">⚑ Escalation</span>);
    } else if (claim) {
      out.push(<span key={key} className="steward-chip steward-chip--claim">{claim}</span>);
    } else if (amount) {
      out.push(<span key={key} className="steward-chip steward-chip--amount">{amount}</span>);
    } else {
      out.push(full);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

// Walk ReactMarkdown children and badge-ify any plain-string segments, leaving
// already-rendered child elements (e.g. nested <strong>) untouched.
function decorate(children: ReactNode, keyBase = 'd'): ReactNode {
  if (typeof children === 'string') return decorateString(children, keyBase);
  if (Array.isArray(children)) {
    return children.map((child, idx) =>
      typeof child === 'string'
        ? <Fragment key={`${keyBase}-${idx}`}>{decorateString(child, `${keyBase}-${idx}`)}</Fragment>
        : child,
    );
  }
  return children;
}

const STEWARD_MD_COMPONENTS = {
  h1: ({ children }: { children?: ReactNode }) => <div className="steward-md__section">{children}</div>,
  h2: ({ children }: { children?: ReactNode }) => <div className="steward-md__section">{children}</div>,
  h3: ({ children }: { children?: ReactNode }) => <div className="steward-md__section">{children}</div>,
  h4: ({ children }: { children?: ReactNode }) => <div className="steward-md__section">{children}</div>,
  p: ({ children }: { children?: ReactNode }) => <p className="steward-md__p">{decorate(children, 'p')}</p>,
  strong: ({ children }: { children?: ReactNode }) => <strong className="steward-md__strong">{decorate(children, 's')}</strong>,
  em: ({ children }: { children?: ReactNode }) => <em className="steward-md__em">{children}</em>,
  ul: ({ children }: { children?: ReactNode }) => <ul className="steward-md__list">{children}</ul>,
  ol: ({ children }: { children?: ReactNode }) => <ol className="steward-md__list steward-md__list--ordered">{children}</ol>,
  li: ({ children }: { children?: ReactNode }) => <li className="steward-md__item">{decorate(children, 'li')}</li>,
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a className="steward-md__link" href={href} target="_blank" rel="noreferrer">{children}</a>
  ),
  code: ({ children }: { children?: ReactNode }) => <code className="steward-md__code">{children}</code>,
};

interface StewardChatPanelProps {
  claimId?: string;
  claimantName?: string;
  pageContext?: StewardPageContext;
  topOffset?: number;
  bottomOffset?: number;
  /** Suppress the auto morning-briefing greeting and welcome placeholder (e.g. Decision Mode) */
  hideWelcome?: boolean;
  /** Deterministic single-claim briefing rendered as the opening Decision Mode overview. */
  decisionBriefing?: DecisionBriefingData;
}

/**
 * Fixed right-side chat panel for the Digital Steward.
 * Receives full page context so the AI knows every claim on screen.
 */
export function StewardChatPanel({ claimId, claimantName, pageContext, topOffset, bottomOffset, hideWelcome, decisionBriefing }: StewardChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false); // open by default — Priya's first screen
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [statusTick, setStatusTick] = useState(0);
  const [voiceOutput, setVoiceOutput] = useState(false); // speak Steward replies aloud
  const [speaking, setSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const proactiveBriefedClaimRef = useRef<string | null>(null);
  const voiceOutputRef = useRef(voiceOutput);
  voiceOutputRef.current = voiceOutput;

  const {
    messages,
    isLoading,
    error,
    lastWarnings,
    sendMessage,
    sendGreeting,
    setDecisionBriefing,
    startNewConversation,
    triggerIndexing,
    clearError,
  } = useStewardStore();

  // In hideWelcome mode (e.g. Decision Mode) suppress the persisted morning-briefing
  // card so the panel starts clean even if the queue already populated the shared store.
  const visibleMessages = hideWelcome ? messages.filter(m => !m.briefingData) : messages;

  // Trigger indexing once on mount
  useEffect(() => {
    triggerIndexing();
  }, []);

  // When entering Decision Mode (hideWelcome=true), flush any queue-page
  // conversation so the claim-specific briefing fires on a clean slate.
  useEffect(() => {
    if (hideWelcome) {
      proactiveBriefedClaimRef.current = null;
      startNewConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideWelcome]);

  // Fire morning briefing as soon as page context is available
  useEffect(() => {
    if (!hideWelcome && pageContext && pageContext.allClaims.length > 0) {
      sendGreeting(pageContext);
    }
  }, [pageContext?.allClaims.length, hideWelcome]);

  // Decision Mode opens with a deterministic, claim-specific briefing card (same
  // chrome as the queue briefing). Built client-side, so it's instant and can't
  // time out — and renders exactly once per focused claim.
  useEffect(() => {
    if (!hideWelcome || !decisionBriefing || isLoading || visibleMessages.length > 0) return;
    if (proactiveBriefedClaimRef.current === decisionBriefing.claimId) return;
    proactiveBriefedClaimRef.current = decisionBriefing.claimId;
    setDecisionBriefing(decisionBriefing);
  }, [hideWelcome, decisionBriefing, isLoading, visibleMessages.length, setDecisionBriefing]);

  // Keep the latest turn in view as the conversation grows, but on first load
  // (just the proactive briefing) pin to the TOP so the headline facts are not
  // scrolled past — the most important context sits at the top of the briefing.
  useEffect(() => {
    if (visibleMessages.length <= 1) {
      messagesContainerRef.current?.scrollTo({ top: 0 });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, visibleMessages.length]);

  // Reserve right-hand space on docked pages only while the panel is open, so
  // page content never slides underneath the fixed steward.
  useEffect(() => {
    document.body.classList.toggle('steward-docked', !isMinimized);
    return () => document.body.classList.remove('steward-docked');
  }, [isMinimized]);

  // Cycle the "thinking" status label while a response is in flight.
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setStatusTick(t => t + 1), 2200);
    return () => clearInterval(id);
  }, [isLoading]);

  const stopTts = useCallback(() => {
    const audio = ttsAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      ttsAudioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const playTts = useCallback(async (text: string) => {
    if (!voiceOutputRef.current) return;
    const clean = stripMarkdownForSpeech(text);
    if (!clean) return;
    stopTts();
    try {
      const result = await api.synthesizeVoice(clean);
      const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
      ttsAudioRef.current = audio;
      audio.oncanplaythrough = () => {
        audio.play().then(() => setSpeaking(true)).catch(() => { /* needs user gesture — ignore */ });
      };
      audio.onended = () => { ttsAudioRef.current = null; setSpeaking(false); };
      audio.onerror = () => { ttsAudioRef.current = null; setSpeaking(false); };
    } catch {
      // TTS failure is non-fatal — the reply is still shown as text.
      setSpeaking(false);
    }
  }, [stopTts]);

  // Speak the newest assistant reply aloud (skips the briefing card, which has no text).
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant' || !last.content?.trim() || last.briefingData) return;
    if (lastSpokenIdRef.current === last.id) return;
    lastSpokenIdRef.current = last.id;
    void playTts(last.content);
  }, [messages, playTts]);

  // Stop any playback when the panel unmounts.
  useEffect(() => stopTts, [stopTts]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    const msg = inputValue.trim();
    setInputValue('');
    stopTts();
    await sendMessage(msg, pageContext);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    setMicError(null);
    stopTts();
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      pcmChunksRef.current = [];

      const ctx = new AudioContext({ sampleRate: STT_SAMPLE_RATE });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        pcmChunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(ctx.destination);

      audioCtxRef.current = ctx;
      processorRef.current = processor;
      setRecording(true);
    } catch (err) {
      setMicError(err instanceof Error ? `Microphone access denied: ${err.message}` : 'Microphone access denied');
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    setTranscribing(true);

    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current = null;
    processorRef.current = null;
    streamRef.current = null;

    const chunks = pcmChunksRef.current;
    pcmChunksRef.current = [];
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }

    try {
      if (merged.length < STT_SAMPLE_RATE * 0.3) {
        setMicError('Recording was too short — speak for at least a second.');
        return;
      }
      const wav = encodeWav(merged, STT_SAMPLE_RATE);
      const audioBase64 = await blobToBase64(wav);
      const result = await api.transcribeVoice(audioBase64, 'audio/wav');
      if (result.text?.trim()) {
        await sendMessage(result.text.trim(), pageContext);
        inputRef.current?.focus();
      } else {
        setMicError('No speech detected — please try again or type your message.');
      }
    } catch {
      setMicError('Transcription failed — please type your message.');
    } finally {
      setTranscribing(false);
    }
  };

  const statusLabel = THINKING_STATUSES[statusTick % THINKING_STATUSES.length];

  if (isMinimized) {
    return (
      <button
        className="steward-panel__minimized"
        onClick={() => setIsMinimized(false)}
        aria-label="Open Digital Steward"
        type="button"
      >
        <Chat size={20} />
        <span>Digital Steward</span>
      </button>
    );
  }

  return (
    <>
      <aside className="steward-panel" style={{
        ...(topOffset !== undefined ? { top: `${topOffset}px` } : {}),
        ...(bottomOffset !== undefined ? { bottom: `${bottomOffset}px` } : {}),
      }}>
        {/* Header */}
        <div className="steward-panel__header">
          <div className="steward-panel__header-title">
            <span className="steward-panel__header-icon">🧭</span>
            <div>
              <h4>Digital Steward</h4>
              <span className="steward-panel__header-subtitle">Claims Navigator</span>
            </div>
          </div>
          <div className="steward-panel__header-actions">
            <IconButton
              label={voiceOutput ? 'Mute voice replies' : 'Speak voice replies'}
              kind="ghost"
              size="sm"
              onClick={() => { if (voiceOutput) stopTts(); setVoiceOutput(v => !v); }}
            >
              {voiceOutput ? <VolumeUp size={16} /> : <VolumeMute size={16} />}
            </IconButton>
            <IconButton label="Minimize" kind="ghost" size="sm" onClick={() => setIsMinimized(true)}>
              <Minimize size={16} />
            </IconButton>
          </div>
        </div>

        {/* Context Badge */}
        {claimId && (
          <div className="steward-panel__context">
            <Tag type="blue" size="sm">Viewing: {claimId}</Tag>
            {claimantName && <Tag type="cool-gray" size="sm">{claimantName}</Tag>}
          </div>
        )}

        {/* Messages */}
        <div className="steward-panel__messages" ref={messagesContainerRef}>
          {hideWelcome && visibleMessages.length === 0 && isLoading && (
            <div className="steward-panel__welcome">
              <p className="steward-panel__greeting-loading">Preparing guidance for this claim…</p>
              <SkeletonText paragraph lineCount={4} />
            </div>
          )}

          {!hideWelcome && messages.length === 0 && isLoading && (
            <div className="steward-panel__welcome">
              <p className="steward-panel__greeting-loading">Preparing your morning briefing…</p>
              <SkeletonText paragraph lineCount={4} />
            </div>
          )}

          {!hideWelcome && messages.length === 0 && !isLoading && (
            <div className="steward-panel__welcome">
              <p>Ask me anything about your queue — use names, claim IDs, or just describe what you need.</p>
              <div className="steward-panel__suggestions">
                <Button kind="ghost" size="sm" onClick={() => { sendMessage('Why is Patricia O\'Connor\'s claim the top priority?', pageContext); }}>
                  Why Patricia #1?
                </Button>
                <Button kind="ghost" size="sm" onClick={() => { sendMessage('What is the total exposure on this queue?', pageContext); }}>
                  Total exposure
                </Button>
                <Button kind="ghost" size="sm" onClick={() => { sendMessage('Any claims flagged for fraud?', pageContext); }}>
                  Fraud flags
                </Button>
              </div>
            </div>
          )}

          {visibleMessages.map(msg => (
            <div key={msg.id} className={`steward-panel__message steward-panel__message--${msg.role}`}>
              <div className={`steward-panel__message-bubble${(msg.briefingData || msg.decisionBriefing) ? ' steward-panel__message-bubble--briefing' : ''}`}>
                {msg.briefingData
                 ? <StewardBriefingCard data={msg.briefingData} adjusterName={pageContext?.activeAdjuster?.name} />
                 : msg.decisionBriefing
                 ? <DecisionBriefingCard data={msg.decisionBriefing} adjusterName={pageContext?.activeAdjuster?.name} />
                 : <div className="steward-md">
                     <ReactMarkdown components={STEWARD_MD_COMPONENTS}>{msg.content}</ReactMarkdown>
                   </div>
                }
                {msg.action && (
                  <div className={`steward-panel__action-card steward-panel__action-card--${msg.action.status}`}>
                    <div className="steward-panel__action-card-header">
                      <span className="steward-panel__action-card-icon">
                        {msg.action.status === 'executed' ? '⚡' : '⚠'}
                      </span>
                      <span className="steward-panel__action-card-title">
                        {msg.action.status === 'executed' ? 'Action Executed' : 'Action Failed'}
                      </span>
                      <Tag
                        type={msg.action.status === 'executed' ? 'green' : 'red'}
                        size="sm"
                      >
                        {msg.action.status === 'executed' ? 'SIU Escalated' : 'Failed'}
                      </Tag>
                    </div>
                    <div className="steward-panel__action-card-body">
                      <div className="steward-panel__action-card-claim">
                        <span>Claim</span>
                        <strong>{msg.action.claimId}</strong>
                      </div>
                      <p className="steward-panel__action-card-summary">{msg.action.summary}</p>
                      <span className="steward-panel__action-card-time">
                        {new Date(msg.action.executedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && visibleMessages.length > 0 && (
            <div className="steward-panel__message steward-panel__message--assistant">
              <div className="steward-panel__typing-row">
                <div className="steward-panel__typing">
                  <span /><span /><span />
                </div>
                <span className="steward-panel__typing-status" aria-live="polite">
                  {statusLabel}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Speaking indicator + stop control */}
        {speaking && (
          <div className="steward-panel__speaking">
            <span className="steward-panel__speaking-label">
              <VolumeUp size={14} /> Speaking…
            </span>
            <Button kind="danger--tertiary" size="sm" renderIcon={StopFilled} onClick={stopTts}>
              Stop
            </Button>
          </div>
        )}

        {/* Warnings */}
        {lastWarnings.length > 0 && (
          <div className="steward-panel__warnings">
            {lastWarnings.map((w, i) => (
              <Tag key={i} type="warm-gray" size="sm">{w}</Tag>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="steward-panel__error">
            <Tag type="red" size="sm">{error}</Tag>
            <IconButton label="Dismiss" kind="ghost" size="sm" onClick={clearError}>
              <Close size={14} />
            </IconButton>
          </div>
        )}

        {/* Mic error */}
        {micError && (
          <div className="steward-panel__error">
            <Tag type="warm-gray" size="sm">{micError}</Tag>
            <IconButton label="Dismiss" kind="ghost" size="sm" onClick={() => setMicError(null)}>
              <Close size={14} />
            </IconButton>
          </div>
        )}

        {/* Input */}
        <div className="steward-panel__input">
          <TextInput
            id="steward-panel-input"
            labelText=""
            hideLabel
            placeholder={recording ? 'Listening…' : transcribing ? 'Transcribing…' : 'Ask about claims...'}
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { if (speaking) stopTts(); setInputValue(e.target.value); }}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            disabled={isLoading || recording || transcribing}
            size="sm"
          />
          <Button
            kind={recording ? 'danger' : 'ghost'}
            size="sm"
            renderIcon={recording ? StopFilled : Microphone}
            iconDescription={recording ? 'Stop & transcribe' : 'Voice input'}
            hasIconOnly
            onClick={recording ? stopRecording : startRecording}
            disabled={isLoading || transcribing}
          />
          <Button
            kind="primary"
            size="sm"
            renderIcon={Send}
            iconDescription="Send"
            hasIconOnly
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || recording || transcribing}
          />
        </div>
      </aside>
    </>
  );
}
