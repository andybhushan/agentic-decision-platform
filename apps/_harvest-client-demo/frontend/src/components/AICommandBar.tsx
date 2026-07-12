import { useState } from 'react';
import {
  Modal,
  TextInput,
  Button,
  Tag,
  Loading,
} from '@carbon/react';
import { Microphone, Send } from '@carbon/icons-react';
import type { Claim } from '../types';
import { api } from '../services/api';
import './AICommandBar.scss';

interface AICommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  claim: Claim;
  onActionSelected?: (action: string) => void;
}

interface AIResponse {
  type: 'thinking' | 'speaking' | 'complete';
  message: string;
  suggestedActions?: string[];
  confidence?: number;
  agentName?: string;
}

export const AICommandBar: React.FC<AICommandBarProps> = ({
  isOpen,
  onClose,
  claim,
  onActionSelected,
}) => {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  // Context surfaced to the user, derived from the real claim record
  const contextItems = [
    claim.claimantName,
    claim.pendingDecisionType.toLowerCase(),
  ];

  // Initial suggested actions derived from the real claim state (UI affordances)
  const getSuggestedActions = () => {
    const actions: string[] = [];
    
    if (claim.confidenceLevel === 'low') {
      actions.push('Explain the coverage ambiguity');
      actions.push('Request additional evidence');
    }
    
    if (claim.anomalySignals.length > 0) {
      actions.push('Analyze anomaly patterns');
      actions.push('Compare with similar claims');
    }
    
    if (claim.injuryIndicated) {
      actions.push('Request medical records');
      actions.push('Assess injury severity');
    }
    
    actions.push('Generate claimant update');
    actions.push('Escalate to senior adjuster');
    
    return actions;
  };

  const [suggestedActions] = useState(getSuggestedActions());

  // Serialize the relevant claim fields as grounding context for the AI
  const buildClaimContext = (): string =>
    JSON.stringify(
      {
        id: claim.id,
        claimantName: claim.claimantName,
        pendingDecisionType: claim.pendingDecisionType,
        confidenceLevel: claim.confidenceLevel,
        injuryIndicated: claim.injuryIndicated,
        recommendedAction: claim.recommendedAction,
        policyContext: claim.policyContext,
        anomalySignals: claim.anomalySignals,
        evidenceItems: claim.evidenceItems,
      },
      null,
      2
    );

  // Real AI call to Azure AI Foundry via the backend
  const processCommand = async (cmd: string) => {
    setIsProcessing(true);
    setResponse({ type: 'thinking', message: 'Analyzing claim...', agentName: 'AI Steward' });

    try {
      const result = await api.claimAssist(cmd, buildClaimContext());
      setResponse({
        type: 'complete',
        message: result.message,
        suggestedActions: result.suggestedActions,
        confidence: Math.round((result.confidence || 0) * 100),
        agentName: 'AI Steward',
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        'AI request failed. Please try again.';
      setResponse({
        type: 'complete',
        message,
        agentName: 'AI Steward',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = () => {
    if (command.trim()) {
      processCommand(command);
    }
  };

  const handleSuggestedAction = (action: string) => {
    setCommand(action);
    processCommand(action);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading="AI Command"
      passiveModal
      size="lg"
      className="ai-command-bar"
    >
      <div className="ai-command-bar__content">
        {/* Context Awareness */}
        <div className="ai-command-bar__context">
          <Tag type="blue" size="sm">AI SEES</Tag>
          {contextItems.map((item, idx) => (
            <Tag key={idx} type="outline" size="sm">{item}</Tag>
          ))}
        </div>

        {/* Command Input */}
        <div className="ai-command-bar__input-section">
          <TextInput
            id="ai-command-input"
            labelText="Ask AI or give a command"
            placeholder="e.g., 'Explain the coverage ambiguity' or 'Request medical records'"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isProcessing}
          />
          <div className="ai-command-bar__input-actions">
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Microphone}
              iconDescription="Voice input"
              hasIconOnly
              onClick={() => setIsVoiceMode(!isVoiceMode)}
              disabled={isProcessing}
            />
            <Button
              kind="primary"
              size="sm"
              renderIcon={Send}
              onClick={handleSubmit}
              disabled={!command.trim() || isProcessing}
            >
              Send
            </Button>
          </div>
        </div>

        {/* Suggested Actions */}
        {!response && (
          <div className="ai-command-bar__suggestions">
            <p className="ai-command-bar__suggestions-label">Suggested actions:</p>
            <div className="ai-command-bar__suggestions-list">
              {suggestedActions.map((action, idx) => (
                <Button
                  key={idx}
                  kind="ghost"
                  size="sm"
                  onClick={() => handleSuggestedAction(action)}
                  disabled={isProcessing}
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* AI Response */}
        {response && (
          <div className="ai-command-bar__response">
            <div className="ai-command-bar__response-header">
              {response.agentName && (
                <Tag type="purple" size="sm">{response.agentName}</Tag>
              )}
              {response.type === 'thinking' && (
                <Tag type="gray" size="sm">● ● ● Analyzing claim</Tag>
              )}
              {response.type === 'speaking' && (
                <Tag type="blue" size="sm">Generating response</Tag>
              )}
              {response.type === 'complete' && response.confidence && (
                <Tag type="green" size="sm">{response.confidence}% confidence</Tag>
              )}
            </div>

            {isProcessing && response.type !== 'complete' && (
              <Loading description="Processing..." withOverlay={false} small />
            )}

            {response.type === 'complete' && (
              <>
                <p className="ai-command-bar__response-message">{response.message}</p>
                
                {response.suggestedActions && response.suggestedActions.length > 0 && (
                  <div className="ai-command-bar__follow-up">
                    <p className="ai-command-bar__follow-up-label">Follow-up actions:</p>
                    {response.suggestedActions.map((action, idx) => (
                      <Button
                        key={idx}
                        kind="tertiary"
                        size="sm"
                        onClick={() => {
                          if (onActionSelected) {
                            onActionSelected(action);
                          }
                          onClose();
                        }}
                      >
                        {action}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

// Made with Bob
