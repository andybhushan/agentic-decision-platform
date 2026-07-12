import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Grid,
  Column,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Loading,
  InlineNotification,
  Tag,
  Tile,
  CodeSnippet,
  Modal,
} from '@carbon/react';
import { Rocket, Edit, Download, CheckmarkFilled, TrashCan, Chat, Close, DocumentAdd, Search, ChartBar, TaskComplete, DataAnalytics, UserMultiple, Hospital } from '@carbon/icons-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import type { Agent } from '../types';
import { AgentChatPanel } from '../components/AgentChatPanel';
import { AgentObservabilityTab } from '../components/AgentObservabilityTab';
import { AgentConfigureChat } from '../components/AgentConfigureChat';
import OrchestrationPanel from '../components/OrchestrationPanel';
import { nodeForCanonicalAgentId } from '../data/canonicalAgents';
import { useClaimsModel } from '../hooks/useClaimsModel';
import PageHeader from '../components/layout/PageHeader';
import './AgentDetailsPage.scss';

interface AgentAction {
  label: string;
  icon: React.ComponentType;
  onClick: (navigate: ReturnType<typeof useNavigate>) => void;
  kind?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
}

const AGENT_ACTIONS: Record<string, AgentAction> = {
  agent_claims_mobile_intake: {
    label: 'Start FNOL Session',
    icon: DocumentAdd,
    onClick: (nav) => nav('/claims/intake'),
    kind: 'secondary',
  },
  agent_claims_intake: {
    label: 'Open Web Intake',
    icon: DocumentAdd,
    onClick: (nav) => nav('/claims/intake'),
    kind: 'secondary',
  },
  agent_claims_fraud: {
    label: 'View Fraud Queue',
    icon: Search,
    onClick: (nav) => nav('/claims/dashboard'),
    kind: 'secondary',
  },
  agent_claims_settlement: {
    label: 'Settlement Queue',
    icon: ChartBar,
    onClick: (nav) => nav('/claims/queue'),
    kind: 'secondary',
  },
  agent_claims_policy_verification: {
    label: 'Adjuster Queue',
    icon: TaskComplete,
    onClick: (nav) => nav('/claims/queue'),
    kind: 'secondary',
  },
  agent_healthcare_intake: {
    label: 'Start Patient Intake',
    icon: Hospital,
    onClick: (nav) => nav('/claims/intake'),
    kind: 'secondary',
  },
  agent_healthcare_diagnosis_support: {
    label: 'View Cases',
    icon: DataAnalytics,
    onClick: (nav) => nav('/claims/dashboard'),
    kind: 'secondary',
  },
  agent_healthcare_treatment_planning: {
    label: 'View Treatment Plans',
    icon: DataAnalytics,
    onClick: (nav) => nav('/claims/dashboard'),
    kind: 'secondary',
  },
  agent_customer_routing: {
    label: 'View Ticket Queue',
    icon: UserMultiple,
    onClick: (nav) => nav('/claims/queue'),
    kind: 'secondary',
  },
  agent_customer_sentiment_analysis: {
    label: 'Sentiment Dashboard',
    icon: ChartBar,
    onClick: (nav) => nav('/claims/dashboard'),
    kind: 'secondary',
  },
  agent_customer_knowledge_base: {
    label: 'Search Knowledge',
    icon: Search,
    onClick: (nav) => nav('/claims/dashboard'),
    kind: 'secondary',
  },
};

export const AgentDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { loading, setLoading, setError, removeAgent } = useStore();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [deployingAgent, setDeployingAgent] = useState(false);
  const [generatingSpec, setGeneratingSpec] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string>('Success');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [agentSpec, setAgentSpec] = useState<string | null>(null);
  const [foundryPrompt, setFoundryPrompt] = useState<string | null>(null);
  const [specReviewerSummary, setSpecReviewerSummary] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [deployStale, setDeployStale] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const {
    getSubflow,
    loading: modelLoading,
    error: modelError,
    usingFallback: modelUsingFallback,
  } = useClaimsModel();

  useEffect(() => {
    const loadAgent = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const agentData = await api.getAgent(id);
        setAgent(agentData);
        setAgentSpec(agentData.generatedSpec || null);
        setFoundryPrompt(agentData.foundryPrompt || null);
        setSpecReviewerSummary(agentData.specReviewerSummary || null);
        
        // Load deployment ID if agent is already deployed
        if (agentData.deploymentId) {
          setDeploymentId(agentData.deploymentId);
        }
      } catch (error) {
        console.error('Failed to load agent:', error);
        setError('Failed to load agent');
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [id, setLoading, setError]);

  const handleDeployToFoundry = async () => {
    if (!agent) return;

    try {
      setDeployingAgent(true);
      setDeployError(null);
      setDeploySuccess(null);

      const result = await api.deployAgentToFoundry(agent.id);
      setDeploymentId(result.deploymentId);
      setDeployStale(false);
      setSuccessTitle(deployStale ? 'Deployment Updated' : 'Deployment Successful');
      setDeploySuccess(`${agent.name} deployed successfully! Deployment ID: ${result.deploymentId}`);
    } catch (error: unknown) {
      console.error('Failed to deploy agent:', error);
      const message = error instanceof Error ? error.message : 'Failed to deploy agent to Azure AI Foundry';
      setDeployError(message);
    } finally {
      setDeployingAgent(false);
    }
  };

  const handleChat = async (
    query: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    deploymentIdOverride?: string,
  ) => {
    if (!agent) throw new Error('Agent not loaded');

    const result = await api.chatWithAgent(
      agent.id,
      query,
      history,
      deploymentIdOverride || deploymentId || undefined
    );
    
    return {
      response: result.response,
      confidence: result.confidence,
    };
  };

  const handleGenerateSpec = async () => {
    if (!agent) return;

    try {
      setGeneratingSpec(true);
      setDeployError(null);
      const result = await api.generateAgentSpec(agent.id);
      setAgentSpec(result.specification);
      setFoundryPrompt(result.foundryPrompt);
      setSpecReviewerSummary(result.reviewerSummary);
      setSuccessTitle('Specification Generated');
      setDeploySuccess(`Specification and Foundry prompt generated for ${agent.name}. This did not deploy the agent.`);
      // The generated spec differs from any previously deployed version, so allow re-deploy.
      if (deploymentId) {
        setDeployStale(true);
      }
      
      // Reload agent to get updated data with saved spec
      const updatedAgent = await api.getAgent(agent.id);
      setAgent(updatedAgent);
    } catch (error: unknown) {
      console.error('Failed to generate spec:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate agent specification';
      setDeployError(message);
    } finally {
      setGeneratingSpec(false);
    }
  };

  const handleRevokeAgent = async () => {
    if (!agent) return;

    try {
      setRevoking(true);
      setDeployError(null);
      await api.revokeAgent(agent.id);
      removeAgent(agent.id);
      setShowRevokeModal(false);
      navigate('/agents');
    } catch (error: unknown) {
      console.error('Failed to revoke agent:', error);
      const message = error instanceof Error ? error.message : 'Failed to revoke agent';
      setDeployError(message);
      setShowRevokeModal(false);
    } finally {
      setRevoking(false);
    }
  };

  const getAuthorityColor = (level: string) => {
    switch (level) {
      case 'Low':
        return 'green';
      case 'Medium':
        return 'cyan';
      case 'High':
        return 'purple';
      case 'Critical':
        return 'red';
      default:
        return 'gray';
    }
  };

  if ((loading && !agent) || modelLoading) {
    return (
      <div className="agent-details-loading">
        <Loading description={loading && !agent ? 'Loading agent...' : 'Loading process model...'} withOverlay={false} />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="agent-details-error">
        <InlineNotification
          kind="error"
          title="Agent Not Found"
          subtitle="The requested agent could not be found."
        />
        <Button onClick={() => navigate('/agents')}>Back to Catalog</Button>
      </div>
    );
  }

  return (
    (() => {
      const orchestrationNodeId = nodeForCanonicalAgentId(agent.id);
      const hasOrchestration = !!(orchestrationNodeId && getSubflow(orchestrationNodeId));
      return (
    <div className="agent-details-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <PageHeader
            back={{ label: 'Back to Catalog', onClick: () => navigate('/agents') }}
            title={agent.name}
            subtitle={agent.description}
            tags={
              <>
                <Tag type={hasOrchestration ? 'purple' : 'teal'} size="md">
                  {hasOrchestration ? 'Orchestration agent' : 'Point agent'}
                </Tag>
                <Tag type="blue" size="md">
                  {agent.archetype}
                </Tag>
                <Tag type={getAuthorityColor(agent.authorityLevel)} size="md">
                  {agent.authorityLevel}
                </Tag>
                {agent.workflowRole && (
                  <Tag type="cyan" size="md">
                    {agent.workflowRole}
                  </Tag>
                )}
                {deploymentId && (
                  <Tag type="green" size="md" renderIcon={CheckmarkFilled}>
                    Deployed: {deploymentId.substring(0, 20)}...
                  </Tag>
                )}
              </>
            }
            actions={
              <>
                {AGENT_ACTIONS[agent.id] && (() => {
                  const action = AGENT_ACTIONS[agent.id];
                  const ActionIcon = action.icon as React.ComponentType;
                  return (
                    <Button
                      kind={action.kind || 'secondary'}
                      renderIcon={ActionIcon}
                      onClick={() => action.onClick(navigate)}
                    >
                      {action.label}
                    </Button>
                  );
                })()}
                <Button
                  kind="tertiary"
                  renderIcon={Edit}
                  onClick={() => navigate(`/agents/${agent.id}/edit`)}
                >
                  Edit Agent
                </Button>
                <Button
                  kind="secondary"
                  renderIcon={Download}
                  onClick={handleGenerateSpec}
                  disabled={generatingSpec}
                >
                  {generatingSpec ? 'Generating...' : 'Generate Spec'}
                </Button>
                <Button
                  kind="primary"
                  renderIcon={Rocket}
                  onClick={handleDeployToFoundry}
                  disabled={deployingAgent || (!!deploymentId && !deployStale)}
                >
                  {deployingAgent
                    ? 'Deploying...'
                    : deploymentId
                    ? deployStale
                      ? 'Update'
                      : 'Already Deployed'
                    : 'Recruit'}
                </Button>
                <Button
                  kind="danger--tertiary"
                  renderIcon={TrashCan}
                  onClick={() => setShowRevokeModal(true)}
                  disabled={revoking}
                >
                  Revoke
                </Button>
              </>
            }
          />
        </Column>

        {deploySuccess && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="success"
              title={successTitle}
              subtitle={deploySuccess}
              onCloseButtonClick={() => setDeploySuccess(null)}
              lowContrast
            />
          </Column>
        )}

        {deployError && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={deployError}
              onCloseButtonClick={() => setDeployError(null)}
              lowContrast
            />
          </Column>
        )}

        {modelUsingFallback && modelError && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="warning"
              title="Showing archived process model"
              subtitle={modelError}
              lowContrast
              hideCloseButton
            />
          </Column>
        )}
 
        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Agent details tabs">
              <Tab>Overview</Tab>
              {hasOrchestration && <Tab>Orchestration</Tab>}
              <Tab>Inputs & Outputs</Tab>
              <Tab>Governance</Tab>
              <Tab>Foundry Prompt</Tab>
              <Tab>Specification</Tab>
              <Tab>Test Chat</Tab>
              <Tab>Observability</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <div className="tab-content">
                  <Tile className="info-tile">
                    <h4>Capabilities</h4>
                    <ul>
                      {agent.capabilities.map((cap, idx) => (
                        <li key={idx}>{cap}</li>
                      ))}
                    </ul>
                  </Tile>

                  <Tile className="info-tile">
                    <h4>Limitations</h4>
                    <ul>
                      {agent.limitations?.map((lim, idx) => (
                        <li key={idx}>{lim}</li>
                      ))}
                    </ul>
                  </Tile>

                  {agent.escalationCriteria && agent.escalationCriteria.length > 0 && (
                    <Tile className="info-tile">
                      <h4>Escalation Criteria</h4>
                      <ul>
                        {agent.escalationCriteria.map((crit, idx) => (
                          <li key={idx}>{crit}</li>
                        ))}
                      </ul>
                    </Tile>
                  )}
                </div>
              </TabPanel>

              {hasOrchestration && (
                <TabPanel>
                  <div className="tab-content">
                    <OrchestrationPanel
                      nodeId={orchestrationNodeId!}
                      agentId={agent.id}
                      deploymentId={deploymentId}
                    />
                  </div>
                </TabPanel>
              )}

              <TabPanel>
                <div className="tab-content">
                  <Tile className="info-tile">
                    <h4>Inputs</h4>
                    {agent.inputs.map((input, idx) => (
                      <div key={idx} className="io-item">
                        <div className="io-header">
                          <strong>{input.name}</strong>
                          <Tag type="blue" size="sm">{input.type}</Tag>
                          {input.required && <Tag type="red" size="sm">Required</Tag>}
                        </div>
                        <p>{input.description}</p>
                      </div>
                    ))}
                  </Tile>

                  <Tile className="info-tile">
                    <h4>Outputs</h4>
                    {agent.outputs.map((output, idx) => (
                      <div key={idx} className="io-item">
                        <div className="io-header">
                          <strong>{output.name}</strong>
                          <Tag type="green" size="sm">{output.type}</Tag>
                        </div>
                        <p>{output.description}</p>
                      </div>
                    ))}
                  </Tile>
                </div>
              </TabPanel>

              <TabPanel>
                <div className="tab-content">
                  {agent.governanceProfile && (
                    <Tile className="info-tile">
                      <h4>Governance Profile</h4>
                      <div className="governance-content">
                        <div className="profile-row">
                          <strong>Authority Level:</strong>
                          <Tag type="purple" size="sm">
                            {agent.governanceProfile.authorityLevel}
                          </Tag>
                        </div>

                        {agent.governanceProfile.escalationPath && (
                          <div className="profile-row">
                            <strong>Escalation Path:</strong>
                            <p>{agent.governanceProfile.escalationPath}</p>
                          </div>
                        )}

                        {agent.governanceProfile.autonomyDescription && (
                          <div className="profile-row">
                            <strong>Autonomy:</strong>
                            <p>{agent.governanceProfile.autonomyDescription}</p>
                          </div>
                        )}

                        {agent.governanceProfile.boundaries && agent.governanceProfile.boundaries.length > 0 && (
                          <div className="profile-row">
                            <strong>Boundaries:</strong>
                            <ul>
                              {agent.governanceProfile.boundaries.map((boundary, idx) => (
                                <li key={idx}>{boundary}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {agent.governanceProfile.humanInTheLoop && agent.governanceProfile.humanInTheLoop.length > 0 && (
                          <div className="profile-row">
                            <strong>Human-in-the-Loop Requirements:</strong>
                            <ul>
                              {agent.governanceProfile.humanInTheLoop.map((req, idx) => (
                                <li key={idx}>{req}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {agent.governanceProfile.confidenceThresholds && (
                          <div className="profile-row">
                            <strong>Confidence Thresholds:</strong>
                            <div className="thresholds">
                              {agent.governanceProfile.confidenceThresholds.minimum !== undefined && (
                                <Tag type="gray" size="sm">
                                  Minimum: {(agent.governanceProfile.confidenceThresholds.minimum * 100).toFixed(0)}%
                                </Tag>
                              )}
                              {agent.governanceProfile.confidenceThresholds.reviewRequired !== undefined && (
                                <Tag type="cyan" size="sm">
                                  Review Required: {(agent.governanceProfile.confidenceThresholds.reviewRequired * 100).toFixed(0)}%
                                </Tag>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </Tile>
                  )}
                </div>
              </TabPanel>

              <TabPanel>
                <div className="tab-content">
                  <Tile className="info-tile">
                    <h4>Azure AI Foundry Prompt</h4>
                    <p className="spec-description">
                      {foundryPrompt || agent.foundryPrompt
                        ? 'Enhanced system prompt with governance controls for Azure AI Foundry deployment.'
                        : 'Base system prompt. Click "Generate Spec" to create an enhanced Foundry prompt with governance controls.'}
                    </p>
                    <CodeSnippet type="multi" feedback="Copied to clipboard">
                      {foundryPrompt || agent.foundryPrompt || agent.systemPrompt || 'No system prompt defined'}
                    </CodeSnippet>
                    {(specReviewerSummary || agent.specReviewerSummary) && (
                      <p className="spec-description" style={{ marginTop: '1rem' }}>
                        <strong>AI Review Summary:</strong> {specReviewerSummary || agent.specReviewerSummary}
                      </p>
                    )}
                  </Tile>
                </div>
              </TabPanel>

              <TabPanel>
                <div className="tab-content">
                  <Tile className="info-tile">
                    <h4>Agent Specification</h4>
                    <p className="spec-description">
                      {agentSpec || agent.generatedSpec
                        ? 'Full agent specification document for deployment and documentation purposes.'
                        : 'Click "Generate Spec" to create a comprehensive specification document.'}
                    </p>
                    {(agentSpec || agent.generatedSpec) ? (
                      <CodeSnippet type="multi" feedback="Copied to clipboard">
                        {agentSpec || agent.generatedSpec}
                      </CodeSnippet>
                    ) : (
                      <p style={{ fontStyle: 'italic', color: '#8d8d8d' }}>
                        No specification generated yet. Use the "Generate Spec" button above to create one.
                      </p>
                    )}
                  </Tile>
                </div>
              </TabPanel>

              <TabPanel>
                <div className="tab-content">
                  {deploymentId ? (
                    <AgentChatPanel
                      agentId={agent.id}
                      agentName={agent.name}
                      deploymentId={deploymentId}
                      voiceEnabled={hasOrchestration}
                      onChat={handleChat}
                    />
                  ) : (
                    <Tile className="info-tile">
                      <h4>Test Chat</h4>
                      <p style={{ fontStyle: 'italic', color: '#8d8d8d' }}>
                        Deploy the agent to Azure AI Foundry first using the "Deploy to Foundry" button above.
                        Once deployed, you can test the agent here.
                      </p>
                    </Tile>
                  )}
                </div>
              </TabPanel>

              {/* Observability */}
              <TabPanel>
                <div className="tab-content">
                  <AgentObservabilityTab agentId={agent.id} />
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>

      <Modal
        open={showRevokeModal}
        danger
        modalHeading="Revoke Agent"
        primaryButtonText={revoking ? 'Revoking...' : 'Revoke Agent'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={revoking}
        onRequestClose={() => setShowRevokeModal(false)}
        onRequestSubmit={handleRevokeAgent}
        onSecondarySubmit={() => setShowRevokeModal(false)}
      >
        <p>
          Are you sure you want to revoke <strong>{agent.name}</strong>? This permanently removes
          the agent from the catalog and cannot be undone.
        </p>
      </Modal>

      {/* Floating configure chat widget */}
      <div className="configure-widget">
        {showConfigureModal && (
          <div className="configure-widget__panel">
            <div className="configure-widget__header">
              <span>Configure Agent</span>
              <button
                className="configure-widget__close"
                onClick={() => setShowConfigureModal(false)}
                aria-label="Close configure chat"
              >
                <Close size={16} />
              </button>
            </div>
            <div className="configure-widget__body">
              <AgentConfigureChat
                agent={agent}
                onAgentUpdated={(updated) => setAgent(updated)}
              />
            </div>
          </div>
        )}
        <button
          className={`configure-widget__fab${showConfigureModal ? ' configure-widget__fab--active' : ''}`}
          onClick={() => setShowConfigureModal((v) => !v)}
          aria-label="Configure agent with AI"
          title="Configure agent"
        >
          {showConfigureModal ? <Close size={20} /> : <Chat size={20} />}
          <span>Configure</span>
        </button>
      </div>
    </div>
      );
    })()
  );
};