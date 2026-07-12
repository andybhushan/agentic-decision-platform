import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tile,
  TextInput,
  Button,
  Loading,
  Tag,
  InlineNotification,
} from '@carbon/react';
import { Send, CheckmarkFilled, WarningFilled, VolumeUp, Microphone, Phone } from '@carbon/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VoiceControls } from './VoiceControls';
import { api } from '../services/api';
import './AgentChatPanel.scss';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Raw transcript exactly as spoken — only set when the message came from voice input. */
  rawTranscript?: string;
  confidence?: number;
  timestamp: string;
}

interface AgentChatPanelProps {
  agentId: string;
  agentName: string;
  deploymentId?: string;
  /** When true, show voice input (mic / voice note / paste) and per-reply playback. */
  voiceEnabled?: boolean;
  onChat: (
    query: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    deploymentId?: string,
  ) => Promise<{
    response: string;
    confidence?: number;
    escalateToHuman?: boolean;
  }>;
}

/** Play audio from a base64 data URL. Returns a Promise that resolves when playback ends. */
function playAudioBase64(audioBase64: string, mimeType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.oncanplaythrough = () => {
      audio.play().catch(reject);
    };
    audio.onended = () => resolve();
    audio.onerror = (e) => reject(new Error(`Audio error: ${JSON.stringify(e)}`));
    // Set src last so events fire correctly in all browsers.
    audio.src = `data:${mimeType};base64,${audioBase64}`;
  });
}

export const AgentChatPanel = ({ agentName, deploymentId, voiceEnabled, onChat }: AgentChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [escalateToHuman, setEscalateToHuman] = useState(false);
  /**
   * Voice mode: once the user speaks, every subsequent agent reply is automatically
   * read aloud and the conversation stays in voice mode for that session.
   */
  const [voiceMode, setVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the bottom whenever messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const playReply = useCallback(async (index: number, text: string) => {
    setError(null);
    setSpeakingIndex(index);
    try {
      const result = await api.synthesizeVoice(text);
      await playAudioBase64(result.audioBase64, result.mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playback failed');
    } finally {
      setSpeakingIndex(null);
    }
  }, []);

  const sendText = async (text: string, rawTranscript?: string, autoPlay = false) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: trimmed,
      rawTranscript,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);
    setError(null);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await onChat(trimmed, history, deploymentId);

      const assistantMessage: Message = {
        role: 'assistant',
        content: result.response,
        confidence: result.confidence,
        timestamp: new Date().toISOString(),
      };

      // Capture the index before the state update.
      const replyIndex = messages.length + 1;
      setMessages(prev => [...prev, assistantMessage]);

      // Propagate escalation flag from the backend.
      if (result.escalateToHuman) setEscalateToHuman(true);

      // Auto-play when voice mode is active OR the caller requested it.
      // Note: voiceMode may be stale on the first voice turn (React state is async),
      // so the caller passes autoPlay=true explicitly from handleTranscript.
      if ((voiceMode || autoPlay) && result.response) {
        await playReply(replyIndex, result.response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendText(query);

  /** Called by VoiceControls with the raw transcript. Activates voice mode. */
  const handleTranscript = (rawText: string) => {
    setVoiceMode(true);
    sendText(rawText, rawText, true); // autoPlay=true bypasses stale voiceMode closure
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Tile className="agent-chat-panel">
      <div className="chat-header">
        <h4>Test Agent: {agentName}</h4>
        <div className="chat-header-tags">
          {deploymentId && (
            <Tag type="blue" size="sm">
              {deploymentId}
            </Tag>
          )}
          {voiceMode && (
            <Tag type="purple" size="sm" renderIcon={Microphone}>
              Voice mode
            </Tag>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {escalateToHuman && (
          <>
            <InlineNotification
              kind="warning"
              title="Human agent recommended"
              subtitle="The agent has detected that you may benefit from speaking with a human claims handler. Would you like to be connected?"
              onCloseButtonClick={() => setEscalateToHuman(false)}
            />
            <Button kind="ghost" size="sm" renderIcon={Phone}>
              Connect to agent
            </Button>
          </>
        )}
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Start a conversation with the agent to test its responses.</p>
            <p className="chat-hint">Try asking about its capabilities or a sample query.</p>
            <p className="chat-hint">
              Test Chat uses the <strong>deployed</strong> agent's instructions. After changing
              settings (e.g. Interaction Style), regenerate the spec and redeploy to see the change here.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`chat-message chat-message-${message.role}`}>
            <div className="message-header">
              <span className="message-role">
                {message.role === 'user' ? 'You' : agentName}
              </span>
              {message.rawTranscript && (
                <Tag type="purple" size="sm" renderIcon={Microphone}>
                  Voice
                </Tag>
              )}
              <span className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              {/* Always show the raw transcript — the user's actual words — even if we
                  later clean it up before sending to the agent. */}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.rawTranscript ?? message.content}
              </ReactMarkdown>
            </div>
            {message.confidence !== undefined && (
              <div className="message-footer">
                <Tag
                  type={message.confidence >= 0.8 ? 'green' : message.confidence >= 0.6 ? 'cyan' : 'red'}
                  size="sm"
                  renderIcon={message.confidence >= 0.8 ? CheckmarkFilled : WarningFilled}
                >
                  Confidence: {(message.confidence * 100).toFixed(0)}%
                </Tag>
              </div>
            )}
            {voiceEnabled && message.role === 'assistant' && (
              <div className="message-footer">
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={VolumeUp}
                  onClick={() => playReply(index, message.content)}
                  disabled={speakingIndex !== null}
                >
                  {speakingIndex === index ? 'Playing…' : 'Play reply'}
                </Button>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="chat-message chat-message-assistant">
            <div className="message-header">
              <span className="message-role">{agentName}</span>
            </div>
            <div className="message-loading">
              <Loading small withOverlay={false} />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <Tag type="red" size="sm" renderIcon={WarningFilled}>
              {error}
            </Tag>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        {voiceEnabled && (
          <VoiceControls onTranscript={handleTranscript} disabled={isLoading} />
        )}
        <div className="chat-input-row">
          <TextInput
            id="chat-query"
            labelText=""
            placeholder="Ask the agent a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <Button
            kind="primary"
            renderIcon={Send}
            onClick={handleSend}
            disabled={!query.trim() || isLoading}
          >
            Send
          </Button>
        </div>
      </div>
    </Tile>
  );
};

// Made with Bob
