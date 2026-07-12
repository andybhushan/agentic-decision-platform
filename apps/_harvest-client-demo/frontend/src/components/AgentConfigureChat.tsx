import { useCallback, useRef, useState } from 'react';
import {
  TextInput,
  Button,
  Loading,
  InlineNotification,
  Tag,
} from '@carbon/react';
import { Send, Checkmark, Close, Edit } from '@carbon/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../services/api';
import type { Agent } from '../types';
import './AgentConfigureChat.scss';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  proposedChanges?: ProposedChange[] | null;
  timestamp: string;
}

interface ProposedChange {
  field: string;
  currentValue: unknown;
  newValue: unknown;
  reason: string;
}

interface AgentConfigureChatProps {
  agent: Agent;
  onAgentUpdated: (updated: Agent) => void;
}

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return '(none)';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

export const AgentConfigureChat = ({ agent, onAgentUpdated }: AgentConfigureChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I can configure **${agent.name}** using plain English. I can update:\n\n- **Capabilities & Limitations** — what the agent can and cannot do\n- **Escalation criteria** — when it hands off to a human\n- **Governance profile** — authority level, boundaries, human-in-the-loop rules, confidence thresholds\n- **System prompt** — the core LLM instruction\n\nTry something like: *"Require human approval for claims over £25,000"* or *"Lower the minimum confidence threshold to 75%"*.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<ProposedChange[] | null>(null);
  const [pendingMsgIdx, setPendingMsgIdx] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: new Date().toISOString() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    setApplyError(null);
    scrollToBottom();

    const historyForApi = updatedMessages
      .filter((m) => !m.proposedChanges)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const result = await api.proposeAgentConfigure(agent.id, trimmed, historyForApi.slice(-10));

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.response,
        proposedChanges: result.proposedChanges,
        timestamp: new Date().toISOString(),
      };
      const withReply = [...updatedMessages, assistantMsg];
      setMessages(withReply);

      if (result.proposedChanges?.length) {
        setPendingChanges(result.proposedChanges);
        setPendingMsgIdx(withReply.length - 1);
      }
      scrollToBottom();
    } catch (err: any) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err?.message ?? 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, agent.id, scrollToBottom]);

  const handleApply = useCallback(async () => {
    if (!pendingChanges?.length) return;
    setApplying(true);
    setApplyError(null);

    // Build a safe patch from allowlisted fields only
    const patch: Partial<Agent> = {};
    for (const change of pendingChanges) {
      (patch as Record<string, unknown>)[change.field] = change.newValue;
    }

    try {
      const updated = await api.updateAgent(agent.id, patch);
      onAgentUpdated(updated);
      setPendingChanges(null);
      setPendingMsgIdx(null);

      const confirmMsg: ChatMessage = {
        role: 'assistant',
        content: '✅ Changes applied successfully. The agent configuration has been updated.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, confirmMsg]);
      scrollToBottom();
    } catch (err: any) {
      setApplyError(err?.message ?? 'Failed to apply changes');
    } finally {
      setApplying(false);
    }
  }, [pendingChanges, agent.id, onAgentUpdated, scrollToBottom]);

  const handleDismiss = useCallback(() => {
    setPendingChanges(null);
    setPendingMsgIdx(null);
    const dismissMsg: ChatMessage = {
      role: 'assistant',
      content: 'Changes dismissed. Let me know if you\'d like to try something different.',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, dismissMsg]);
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <div className="configure-chat">
      <div className="configure-chat__messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message chat-message--${msg.role}`}>
            <div className="chat-bubble">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
            {/* Proposed changes diff card */}
            {msg.proposedChanges?.length && idx === pendingMsgIdx && (
              <div className="diff-card">
                <div className="diff-card__header">
                  <Edit size={16} />
                  <span>Proposed Changes ({msg.proposedChanges.length} field{msg.proposedChanges.length !== 1 ? 's' : ''})</span>
                  <Tag type="blue" size="sm">Pending confirmation</Tag>
                </div>
                <div className="diff-card__changes">
                  {msg.proposedChanges.map((change, ci) => (
                    <div key={ci} className="diff-change">
                      <div className="diff-change__field">
                        <strong>{change.field}</strong>
                        {change.reason && <span className="diff-change__reason"> — {change.reason}</span>}
                      </div>
                      <div className="diff-change__values">
                        <div className="diff-value diff-value--old">
                          <span className="diff-label">Before</span>
                          <code>{renderValue(change.currentValue)}</code>
                        </div>
                        <div className="diff-value diff-value--new">
                          <span className="diff-label">After</span>
                          <code>{renderValue(change.newValue)}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {applyError && (
                  <InlineNotification kind="error" title="Apply failed" subtitle={applyError} lowContrast hideCloseButton />
                )}
                <div className="diff-card__actions">
                  <Button
                    kind="primary"
                    size="sm"
                    renderIcon={Checkmark}
                    onClick={handleApply}
                    disabled={applying}
                  >
                    {applying ? 'Applying…' : 'Apply Changes'}
                  </Button>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Close}
                    onClick={handleDismiss}
                    disabled={applying}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="chat-message chat-message--assistant">
            <div className="chat-bubble chat-bubble--loading">
              <Loading description="Thinking…" withOverlay={false} small />
              <span>Thinking…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="configure-chat__composer">
        <TextInput
          id="configure-chat-input"
          labelText=""
          placeholder={pendingChanges ? 'Apply or dismiss the proposed changes first…' : 'Ask me to configure this agent…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={isLoading || !!pendingChanges}
        />
        <Button
          kind="primary"
          renderIcon={Send}
          iconDescription="Send"
          onClick={handleSend}
          disabled={isLoading || !input.trim() || !!pendingChanges}
        >
          Send
        </Button>
      </div>
    </div>
  );
};
