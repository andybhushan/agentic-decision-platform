import { useEffect, useRef, useState } from 'react';
import { Tag } from '@carbon/react';
import { Microphone } from '@carbon/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FNOLMessage, FNOLPhase } from '../../domain/fnol/types';
import './FNOLChatSurface.scss';

interface Props {
  messages: FNOLMessage[];
  agentName?: string;
  isLoading?: boolean;
  phase?: FNOLPhase;
}

// Contextual status labels shown next to the typing dots
const PHASE_STATUS: Partial<Record<FNOLPhase, string[]>> = {
  GREETING:         ['Verifying your identity…', 'Checking policy record…'],
  POLICY_VERIFY:    ['Consulting Policy Agent…', 'Retrieving coverage details…', 'Validating policy…'],
  INCIDENT_CAPTURE: ['Recording incident details…', 'Processing your statement…'],
  DETAILS:          ['Assessing claim details…', 'Cross-referencing incident data…', 'Consulting Claims Agent…'],
  EVIDENCE:         ['Preparing evidence request…', 'Logging evidence requirements…'],
  CONSENT:          ['Processing consent…', 'Recording data permissions…'],
  SUMMARY:          ['Compiling claim summary…', 'Finalising claim record…'],
};

export const FNOLChatSurface = ({ messages, agentName = 'Alex', isLoading, phase }: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const [statusTick, setStatusTick] = useState(0);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // Cycle through status labels while loading
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setStatusTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, [isLoading]);

  const statusOptions = (phase ? PHASE_STATUS[phase] : undefined) ?? ['Alex is thinking…'];
  const statusLabel = statusOptions[statusTick % statusOptions.length];

  return (
    <div className="fnol-chat-surface" role="log" aria-label="Claim conversation">
      {/* Live region announces new agent messages to screen readers */}
      <div
        ref={liveRef}
        aria-live="polite"
        aria-atomic="false"
        className="fnol-chat-surface__live-region"
      >
        {messages.length > 0 && messages[messages.length - 1].role === 'assistant'
          ? messages[messages.length - 1].content
          : ''}
      </div>

      {messages.length === 0 && !isLoading && (
        <div className="fnol-chat-surface__empty">
          <p>Alex will guide you through reporting your claim.</p>
          <p className="hint">Speak or type to begin.</p>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`fnol-chat-surface__message fnol-chat-surface__message--${msg.role}`}
          role="article"
          aria-label={`${msg.role === 'user' ? 'You' : agentName}: ${msg.content}`}
        >
          <div className="fnol-chat-surface__message-header">
            <span className="fnol-chat-surface__message-role">
              {msg.role === 'user' ? 'You' : agentName}
            </span>
            {msg.rawTranscript && (
              <Tag type="purple" size="sm" renderIcon={Microphone}>
                Voice
              </Tag>
            )}
            <span className="fnol-chat-surface__message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="fnol-chat-surface__message-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.rawTranscript ?? msg.content}
            </ReactMarkdown>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="fnol-chat-surface__message fnol-chat-surface__message--assistant fnol-chat-surface__message--loading">
          <div className="fnol-chat-surface__message-header">
            <span className="fnol-chat-surface__message-role">{agentName}</span>
          </div>
          <div className="fnol-chat-surface__typing-row">
            <div className="fnol-chat-surface__typing">
              <span /><span /><span />
            </div>
            <span className="fnol-chat-surface__typing-status" aria-live="polite">
              {statusLabel}
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
