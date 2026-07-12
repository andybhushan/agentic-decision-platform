import { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  Button,
  Dropdown,
  TextArea,
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
} from '@carbon/react';
import { Play, Reset } from '@carbon/icons-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import type { Agent, AISimulateResponse, GovernanceCheckResult } from '../types';
import PageHeader from '../components/layout/PageHeader';
import './SimulatorPage.scss';

export const SimulatorPage = () => {
  const { agents, setAgents, verticals, setVerticals, loading, setLoading, setError } = useStore();

  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [inputJson, setInputJson] = useState('{\n  \n}');
  const [contextJson, setContextJson] = useState('{\n  \n}');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [simulationResult, setSimulationResult] = useState<AISimulateResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [simulationError, setSimulationError] = useState('');

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        if (verticals.length === 0) {
          const verticalsData = await api.getVerticals();
          setVerticals(verticalsData);
        }

        if (agents.length === 0) {
          const agentsData = await api.getAgents();
          setAgents(agentsData);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setAgents, setVerticals, setLoading, setError, verticals.length, agents.length]);

  // Update input template when agent changes
  useEffect(() => {
    if (selectedAgent) {
      const inputTemplate: Record<string, string> = {};
      selectedAgent.inputs.forEach((input) => {
        inputTemplate[input.name] = input.example || `<${input.type}>`;
      });
      setInputJson(JSON.stringify(inputTemplate, null, 2));
      setSimulationResult(null);
      setGeneratedPrompt('');
      setSystemPrompt('');
      setValidationError('');
      setSimulationError('');
    }
  }, [selectedAgent]);

  const validateJson = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      setValidationError('');
      return true;
    } catch {
      setValidationError('Invalid JSON format');
      return false;
    }
  };

  const handleGeneratePrompt = async () => {
    if (!selectedAgent) return;

    if (!validateJson(inputJson)) return;

    try {
      setIsGeneratingPrompt(true);
      const input = JSON.parse(inputJson);
      const context = contextJson.trim() ? JSON.parse(contextJson) : undefined;

      const response = await api.generatePrompt({
        agentId: selectedAgent.id,
        input,
        context,
      });

      setGeneratedPrompt(response.prompt);
      setSystemPrompt(response.systemPrompt);
    } catch (error) {
      console.error('Failed to generate prompt:', error);
      setSimulationError('Failed to generate prompt');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleSimulate = async () => {
    if (!selectedAgent) return;

    if (!validateJson(inputJson)) return;

    try {
      setIsSimulating(true);
      setSimulationError('');
      const input = JSON.parse(inputJson);
      const context = contextJson.trim() ? JSON.parse(contextJson) : undefined;

      const response = await api.simulate({
        agentId: selectedAgent.id,
        input,
        context,
      });

      setSimulationResult(response);
    } catch (error) {
      console.error('Failed to simulate:', error);
      setSimulationError('Failed to run simulation. Please check your input and try again.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleReset = () => {
    if (selectedAgent) {
      const inputTemplate: Record<string, string> = {};
      selectedAgent.inputs.forEach((input) => {
        inputTemplate[input.name] = input.example || `<${input.type}>`;
      });
      setInputJson(JSON.stringify(inputTemplate, null, 2));
    }
    setContextJson('{\n  \n}');
    setSimulationResult(null);
    setGeneratedPrompt('');
    setSystemPrompt('');
    setValidationError('');
    setSimulationError('');
  };

  const getGovernanceStatusColor = (passed: boolean): 'green' | 'red' => {
    return passed ? 'green' : 'red';
  };

  if (loading && agents.length === 0) {
    return (
      <div className="simulator-page-loading">
        <Loading description="Loading agents..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div className="simulator-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <PageHeader title="Agent Simulator" />
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="agent-selector">
            <Dropdown
              id="agent-select"
              titleText="Select Agent to Simulate"
              label="Choose an agent"
              items={agents.map((a) => ({ id: a.id, text: a.name, agent: a }))}
              itemToString={(item) => item?.text || ''}
              onChange={({ selectedItem }) => {
                if (selectedItem) {
                  setSelectedAgent(selectedItem.agent);
                }
              }}
              size="lg"
            />
          </div>
        </Column>

        {selectedAgent && (
          <>
            <Column lg={16} md={8} sm={4}>
              <Tile className="agent-info">
                <div className="agent-info-header">
                  <h3>{selectedAgent.name}</h3>
                  <div className="agent-tags">
                    <Tag type="blue" size="sm">{selectedAgent.archetype}</Tag>
                    <Tag type="purple" size="sm">{selectedAgent.authorityLevel}</Tag>
                    {selectedAgent.workflowRole && (
                      <Tag type="cyan" size="sm">{selectedAgent.workflowRole}</Tag>
                    )}
                  </div>
                </div>
                <p>{selectedAgent.description}</p>
                
                <div className="agent-io-summary">
                  <div className="io-group">
                    <strong>Expected Inputs ({selectedAgent.inputs.length}):</strong>
                    <div className="io-tags">
                      {selectedAgent.inputs.map((input, idx) => (
                        <Tag key={idx} type="blue" size="sm" title={input.description}>
                          {input.name}: {input.type}
                          {input.required && ' *'}
                        </Tag>
                      ))}
                    </div>
                  </div>
                  <div className="io-group">
                    <strong>Expected Outputs ({selectedAgent.outputs.length}):</strong>
                    <div className="io-tags">
                      {selectedAgent.outputs.map((output, idx) => (
                        <Tag key={idx} type="green" size="sm" title={output.description}>
                          {output.name}: {output.type}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </div>
              </Tile>
            </Column>

            <Column lg={16} md={8} sm={4}>
              <Tabs>
                <TabList aria-label="Simulator tabs">
                  <Tab>Input</Tab>
                  <Tab>Prompt</Tab>
                  <Tab>Output</Tab>
                  <Tab>Governance</Tab>
                </TabList>

                <TabPanels>
                  {/* Input Tab */}
                  <TabPanel>
                    <div className="input-section">
                      <div className="input-fields">
                        <h4>Test Input</h4>
                        <p className="helper-text">
                          Provide input data matching the agent's expected schema
                        </p>
                        <TextArea
                          id="input-json"
                          labelText="Input JSON"
                          placeholder="Enter input data as JSON"
                          value={inputJson}
                          onChange={(e) => {
                            setInputJson(e.target.value);
                            validateJson(e.target.value);
                          }}
                          rows={12}
                          invalid={!!validationError}
                          invalidText={validationError}
                        />

                        <h4>Context (Optional)</h4>
                        <p className="helper-text">
                          Additional context for the simulation
                        </p>
                        <TextArea
                          id="context-json"
                          labelText="Context JSON"
                          placeholder="Enter context data as JSON (optional)"
                          value={contextJson}
                          onChange={(e) => setContextJson(e.target.value)}
                          rows={6}
                        />
                      </div>

                      <div className="input-actions">
                        <Button
                          kind="secondary"
                          renderIcon={Reset}
                          onClick={handleReset}
                        >
                          Reset
                        </Button>
                        <Button
                          renderIcon={Play}
                          onClick={handleSimulate}
                          disabled={isSimulating || !!validationError}
                        >
                          {isSimulating ? 'Simulating...' : 'Run Simulation'}
                        </Button>
                      </div>

                      {simulationError && (
                        <InlineNotification
                          kind="error"
                          title="Simulation Error"
                          subtitle={simulationError}
                          onCloseButtonClick={() => setSimulationError('')}
                        />
                      )}
                    </div>
                  </TabPanel>

                  {/* Prompt Tab */}
                  <TabPanel>
                    <div className="prompt-section">
                      <div className="prompt-actions">
                        <Button
                          kind="tertiary"
                          onClick={handleGeneratePrompt}
                          disabled={isGeneratingPrompt || !!validationError}
                        >
                          {isGeneratingPrompt ? 'Generating...' : 'Generate Prompt'}
                        </Button>
                      </div>

                      {systemPrompt && (
                        <div className="prompt-display">
                          <h4>System Prompt</h4>
                          <CodeSnippet type="multi" feedback="Copied to clipboard">
                            {systemPrompt}
                          </CodeSnippet>
                        </div>
                      )}

                      {generatedPrompt && (
                        <div className="prompt-display">
                          <h4>User Prompt</h4>
                          <CodeSnippet type="multi" feedback="Copied to clipboard">
                            {generatedPrompt}
                          </CodeSnippet>
                        </div>
                      )}

                      {!generatedPrompt && !systemPrompt && (
                        <div className="empty-state">
                          <p>Click "Generate Prompt" to see the AI prompt that will be used</p>
                        </div>
                      )}
                    </div>
                  </TabPanel>

                  {/* Output Tab */}
                  <TabPanel>
                    <div className="output-section">
                      {simulationResult ? (
                        <>
                          <div className="result-summary">
                            <Tile>
                              <div className="summary-row">
                                <strong>Confidence:</strong>
                                <Tag type={simulationResult.confidence >= 0.75 ? 'green' : 'warm-gray'}>
                                  {(simulationResult.confidence * 100).toFixed(1)}%
                                </Tag>
                              </div>
                              <div className="summary-row">
                                <strong>Execution Time:</strong>
                                <span>{simulationResult.executionTime}ms</span>
                              </div>
                              <div className="summary-row">
                                <strong>Tokens Used:</strong>
                                <span>{simulationResult.tokensUsed}</span>
                              </div>
                              {simulationResult.escalated && (
                                <div className="summary-row">
                                  <strong>Status:</strong>
                                  <Tag type="red">Escalated</Tag>
                                </div>
                              )}
                            </Tile>
                          </div>

                          {simulationResult.escalated && simulationResult.escalationReason && (
                            <InlineNotification
                              kind="warning"
                              title="Escalation Required"
                              subtitle={simulationResult.escalationReason}
                              lowContrast
                            />
                          )}

                          <div className="result-output">
                            <h4>Output</h4>
                            <CodeSnippet type="multi" feedback="Copied to clipboard">
                              {JSON.stringify(simulationResult.output, null, 2)}
                            </CodeSnippet>
                          </div>
                        </>
                      ) : (
                        <div className="empty-state">
                          <p>Run a simulation to see the output</p>
                        </div>
                      )}
                    </div>
                  </TabPanel>

                  {/* Governance Tab */}
                  <TabPanel>
                    <div className="governance-section">
                      {simulationResult?.governanceChecks ? (
                        <>
                          <h4>Governance Checks</h4>
                          <div className="governance-checks">
                            {simulationResult.governanceChecks.map((check: GovernanceCheckResult, index: number) => (
                              <Tile key={index} className="governance-check">
                                <div className="check-header">
                                  <strong>{check.controlType.replace(/_/g, ' ').toUpperCase()}</strong>
                                  <Tag type={getGovernanceStatusColor(check.passed)} size="sm">
                                    {check.passed ? 'PASSED' : 'FAILED'}
                                  </Tag>
                                </div>
                                <p>{check.message}</p>
                                {check.details && (
                                  <CodeSnippet type="single" feedback="Copied">
                                    {JSON.stringify(check.details)}
                                  </CodeSnippet>
                                )}
                              </Tile>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="empty-state">
                          <p>Run a simulation to see governance checks</p>
                        </div>
                      )}
                    </div>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Column>
          </>
        )}

        {!selectedAgent && agents.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <div className="empty-state">
              <p>Select an agent to start simulation</p>
            </div>
          </Column>
        )}
      </Grid>
    </div>
  );
};

// Made with Bob
