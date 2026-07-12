import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Grid,
  Column,
  Button,
  TextInput,
  TextArea,
  Dropdown,
  Form,
  FormGroup,
  Stack,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Toggle,
  InlineNotification,
  Loading,
  Tag,
} from '@carbon/react';
import { Save, Close, Add, TrashCan } from '@carbon/icons-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import type { Agent, AgentInput, AgentOutput, GovernanceControl, AgentArchetype, AuthorityLevel, WorkflowRole, GovernanceProfile } from '../types';
import { GovernanceProfileSection } from '../components/GovernanceProfileSection';
import { DSLPreview } from '../components/DSLPreview';
import PageHeader from '../components/layout/PageHeader';
import './AgentBuilderPage.scss';

export const AgentBuilderPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const { verticals, setVerticals, loading, setLoading, setError } = useStore();

  const [formData, setFormData] = useState<Partial<Agent>>({
    name: '',
    description: '',
    verticalId: '',
    archetype: 'Analyst',
    authorityLevel: 'Low',
    workflowRole: undefined,
    interactionStyle: 'transactional',
    operatingModes: ['standalone'],
    governanceProfile: {
      authorityLevel: 'advisory',
      boundaries: [],
      humanInTheLoop: [],
    },
    inputs: [],
    outputs: [],
    governanceControls: [],
    capabilities: [],
    limitations: [],
    escalationCriteria: [],
    systemPrompt: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load verticals and agent data if editing
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load verticals if not already loaded
        if (verticals.length === 0) {
          const verticalsData = await api.getVerticals();
          setVerticals(verticalsData);
        }

        // Load agent data if editing
        if (isEditMode && id) {
          const agent = await api.getAgent(id);
          setFormData(agent);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, isEditMode, setLoading, setError, setVerticals, verticals.length]);

  const archetypes: AgentArchetype[] = [
    'Analyst',
    'Coordinator',
    'Specialist',
    'Validator',
    'Communicator',
    'Auditor',
    'Optimizer',
  ];

  const authorityLevels: AuthorityLevel[] = ['Low', 'Medium', 'High', 'Critical'];

  const governanceControlTypes = [
    { id: 'human_review', text: 'Human Review' },
    { id: 'confidence_threshold', text: 'Confidence Threshold' },
    { id: 'data_validation', text: 'Data Validation' },
    { id: 'compliance_check', text: 'Compliance Check' },
    { id: 'escalation_rule', text: 'Escalation Rule' },
    { id: 'audit_logging', text: 'Audit Logging' },
    { id: 'rate_limiting', text: 'Rate Limiting' },
    { id: 'access_control', text: 'Access Control' },
  ];

  const dataTypes = ['string', 'number', 'boolean', 'object', 'array'];

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'Agent name is required';
    }

    if (!formData.description?.trim()) {
      errors.description = 'Description is required';
    }

    if (!formData.verticalId) {
      errors.verticalId = 'Vertical is required';
    }

    if (!formData.inputs || formData.inputs.length === 0) {
      errors.inputs = 'At least one input is required';
    }

    if (!formData.outputs || formData.outputs.length === 0) {
      errors.outputs = 'At least one output is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    setSaveError('');
    setSaveSuccess(false);

    if (!validateForm()) {
      setSaveError('Please fix validation errors before saving');
      return;
    }

    try {
      setLoading(true);

      if (isEditMode && id) {
        await api.updateAgent(id, formData as Agent);
      } else {
        const agentData = { ...formData, version: '1.0.0' } as Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>;
        await api.createAgent(agentData);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/agents');
      }, 1500);
    } catch (error) {
      console.error('Failed to save agent:', error);
      setSaveError('Failed to save agent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/agents');
  };

  // Input/Output management
  const addInput = () => {
    setFormData({
      ...formData,
      inputs: [
        ...(formData.inputs || []),
        { name: '', type: 'string', description: '', required: true },
      ],
    });
  };

  const removeInput = (index: number) => {
    const newInputs = [...(formData.inputs || [])];
    newInputs.splice(index, 1);
    setFormData({ ...formData, inputs: newInputs });
  };

  const updateInput = (index: number, field: keyof AgentInput, value: string | boolean) => {
    const newInputs = [...(formData.inputs || [])];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setFormData({ ...formData, inputs: newInputs });
  };

  const addOutput = () => {
    setFormData({
      ...formData,
      outputs: [
        ...(formData.outputs || []),
        { name: '', type: 'string', description: '' },
      ],
    });
  };

  const removeOutput = (index: number) => {
    const newOutputs = [...(formData.outputs || [])];
    newOutputs.splice(index, 1);
    setFormData({ ...formData, outputs: newOutputs });
  };

  const updateOutput = (index: number, field: keyof AgentOutput, value: string) => {
    const newOutputs = [...(formData.outputs || [])];
    newOutputs[index] = { ...newOutputs[index], [field]: value };
    setFormData({ ...formData, outputs: newOutputs });
  };

  // Governance control management
  const addGovernanceControl = () => {
    setFormData({
      ...formData,
      governanceControls: [
        ...(formData.governanceControls || []),
        { type: 'human_review', description: '', enabled: true },
      ],
    });
  };

  const removeGovernanceControl = (index: number) => {
    const newControls = [...(formData.governanceControls || [])];
    newControls.splice(index, 1);
    setFormData({ ...formData, governanceControls: newControls });
  };

  const updateGovernanceControl = (index: number, field: keyof GovernanceControl, value: string | boolean) => {
    const newControls = [...(formData.governanceControls || [])];
    newControls[index] = { ...newControls[index], [field]: value };
    setFormData({ ...formData, governanceControls: newControls });
  };

  // List management (capabilities, limitations, escalation criteria)
  const addListItem = (field: 'capabilities' | 'limitations' | 'escalationCriteria') => {
    setFormData({
      ...formData,
      [field]: [...(formData[field] || []), ''],
    });
  };

  const removeListItem = (field: 'capabilities' | 'limitations' | 'escalationCriteria', index: number) => {
    const newList = [...(formData[field] || [])];
    newList.splice(index, 1);
    setFormData({ ...formData, [field]: newList });
  };

  const updateListItem = (field: 'capabilities' | 'limitations' | 'escalationCriteria', index: number, value: string) => {
    const newList = [...(formData[field] || [])];
    newList[index] = value;
    setFormData({ ...formData, [field]: newList });
  };

  if (loading && isEditMode) {
    return (
      <div className="agent-builder-loading">
        <Loading description="Loading agent..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div className="agent-builder-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <PageHeader
            title={isEditMode ? 'Edit Agent' : 'Create New Agent'}
            actions={
              <>
                <Button kind="secondary" renderIcon={Close} onClick={handleCancel}>
                  Cancel
                </Button>
                <Button renderIcon={Save} onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Agent'}
                </Button>
              </>
            }
          />
        </Column>

        {saveSuccess && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="success"
              title="Success"
              subtitle={`Agent ${isEditMode ? 'updated' : 'created'} successfully`}
              onCloseButtonClick={() => setSaveSuccess(false)}
            />
          </Column>
        )}

        {saveError && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={saveError}
              onCloseButtonClick={() => setSaveError('')}
            />
          </Column>
        )}

        <Column lg={16} md={8} sm={4}>
          <Form>
            <Tabs>
              <TabList aria-label="Agent configuration tabs">
                <Tab>Basic Info</Tab>
                <Tab>Inputs & Outputs</Tab>
                <Tab>Governance</Tab>
                <Tab>DSL Preview</Tab>
                <Tab>Advanced</Tab>
              </TabList>

              <TabPanels>
                {/* Basic Info Tab */}
                <TabPanel>
                  <Stack gap={6}>
                    <TextInput
                      id="agent-name"
                      labelText="Agent Name"
                      placeholder="Enter agent name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      invalid={!!validationErrors.name}
                      invalidText={validationErrors.name}
                    />

                    <TextArea
                      id="agent-description"
                      labelText="Description"
                      placeholder="Describe what this agent does"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      invalid={!!validationErrors.description}
                      invalidText={validationErrors.description}
                    />

                    <Dropdown
                      id="vertical-select"
                      titleText="Vertical"
                      label="Select vertical"
                      items={verticals.map((v) => ({ id: v.id, text: v.name }))}
                      itemToString={(item) => item?.text || ''}
                      selectedItem={verticals.find((v) => v.id === formData.verticalId) ? { id: formData.verticalId, text: verticals.find((v) => v.id === formData.verticalId)?.name || '' } : null}
                      onChange={({ selectedItem }) => setFormData({ ...formData, verticalId: selectedItem?.id || '' })}
                      invalid={!!validationErrors.verticalId}
                      invalidText={validationErrors.verticalId}
                    />

                    <Dropdown
                      id="archetype-select"
                      titleText="Archetype"
                      label="Select archetype"
                      items={archetypes.map((a) => ({ id: a, text: a }))}
                      itemToString={(item) => item?.text || ''}
                      selectedItem={{ id: formData.archetype || 'Analyst', text: formData.archetype || 'Analyst' }}
                      onChange={({ selectedItem }) => setFormData({ ...formData, archetype: selectedItem?.id as AgentArchetype })}
                    />

                    <Dropdown
                      id="workflow-role-select"
                      titleText="Workflow Role"
                      label="Select workflow role (optional)"
                      items={[
                        { id: 'none', text: 'None' },
                        { id: 'Intake', text: 'Intake' },
                        { id: 'Evidence', text: 'Evidence' },
                        { id: 'Fraud', text: 'Fraud' },
                        { id: 'Policy', text: 'Policy' },
                        { id: 'Settlement', text: 'Settlement' },
                        { id: 'Supervision', text: 'Supervision' },
                        { id: 'Compliance', text: 'Compliance' },
                        { id: 'Generic', text: 'Generic' },
                      ]}
                      itemToString={(item) => item?.text || ''}
                      selectedItem={formData.workflowRole ? { id: formData.workflowRole, text: formData.workflowRole } : { id: 'none', text: 'None' }}
                      onChange={({ selectedItem }) => setFormData({ ...formData, workflowRole: selectedItem?.id === 'none' ? undefined : selectedItem?.id as WorkflowRole })}
                    />

                    <Dropdown
                      id="authority-select"
                      titleText="Authority Level"
                      label="Select authority level"
                      items={authorityLevels.map((a) => ({ id: a, text: a }))}
                      itemToString={(item) => item?.text || ''}
                      selectedItem={{ id: formData.authorityLevel || 'Low', text: formData.authorityLevel || 'Low' }}
                      onChange={({ selectedItem }) => setFormData({ ...formData, authorityLevel: selectedItem?.id as AuthorityLevel })}
                    />

                    <Dropdown
                      id="interaction-style-select"
                      titleText="Interaction Style"
                      helperText="Conversational agents interview the user one question at a time; transactional agents process a request in a single shot; hybrid agents ingest a manifest of data and attachments in one pass, then hold a targeted clarification conversation for any gaps."
                      label="Select interaction style"
                      items={[
                        { id: 'transactional', text: 'Transactional (single-shot)' },
                        { id: 'conversational', text: 'Conversational (step-by-step interview)' },
                        { id: 'hybrid', text: 'Hybrid (manifest + clarification conversation)' },
                      ]}
                      itemToString={(item) => item?.text || ''}
                      selectedItem={
                        formData.interactionStyle === 'conversational'
                          ? { id: 'conversational', text: 'Conversational (step-by-step interview)' }
                          : formData.interactionStyle === 'hybrid'
                            ? { id: 'hybrid', text: 'Hybrid (manifest + clarification conversation)' }
                            : { id: 'transactional', text: 'Transactional (single-shot)' }
                      }
                      onChange={({ selectedItem }) =>
                        setFormData({
                          ...formData,
                          interactionStyle:
                            selectedItem?.id === 'conversational'
                              ? 'conversational'
                              : selectedItem?.id === 'hybrid'
                                ? 'hybrid'
                                : 'transactional',
                        })
                      }
                    />

                    <Dropdown
                      id="operating-context-select"
                      titleText="Operating Context"
                      helperText="Standalone agents own the user interaction; orchestrated agents are invoked by a parent orchestrator with a structured task. Dual-context agents detect which applies at runtime."
                      label="Select operating context"
                      items={[
                        { id: 'standalone', text: 'Standalone only' },
                        { id: 'orchestrated', text: 'Orchestrated only' },
                        { id: 'both', text: 'Both (standalone + orchestrated)' },
                      ]}
                      itemToString={(item) => item?.text || ''}
                      selectedItem={(() => {
                        const modes = formData.operatingModes || ['standalone'];
                        const hasS = modes.includes('standalone');
                        const hasO = modes.includes('orchestrated');
                        if (hasS && hasO) return { id: 'both', text: 'Both (standalone + orchestrated)' };
                        if (hasO) return { id: 'orchestrated', text: 'Orchestrated only' };
                        return { id: 'standalone', text: 'Standalone only' };
                      })()}
                      onChange={({ selectedItem }) =>
                        setFormData({
                          ...formData,
                          operatingModes:
                            selectedItem?.id === 'both'
                              ? ['standalone', 'orchestrated']
                              : selectedItem?.id === 'orchestrated'
                                ? ['orchestrated']
                                : ['standalone'],
                        })
                      }
                    />

                    <FormGroup legendText="Capabilities">
                      {(formData.capabilities || []).map((capability, index) => (
                        <div key={index} className="list-item">
                          <TextInput
                            id={`capability-${index}`}
                            labelText=""
                            placeholder="Enter capability"
                            value={capability}
                            onChange={(e) => updateListItem('capabilities', index, e.target.value)}
                          />
                          <Button
                            kind="danger--ghost"
                            size="sm"
                            renderIcon={TrashCan}
                            iconDescription="Remove"
                            hasIconOnly
                            onClick={() => removeListItem('capabilities', index)}
                          />
                        </div>
                      ))}
                      <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => addListItem('capabilities')}>
                        Add Capability
                      </Button>
                    </FormGroup>

                    <FormGroup legendText="Limitations">
                      {(formData.limitations || []).map((limitation, index) => (
                        <div key={index} className="list-item">
                          <TextInput
                            id={`limitation-${index}`}
                            labelText=""
                            placeholder="Enter limitation"
                            value={limitation}
                            onChange={(e) => updateListItem('limitations', index, e.target.value)}
                          />
                          <Button
                            kind="danger--ghost"
                            size="sm"
                            renderIcon={TrashCan}
                            iconDescription="Remove"
                            hasIconOnly
                            onClick={() => removeListItem('limitations', index)}
                          />
                        </div>
                      ))}
                      <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => addListItem('limitations')}>
                        Add Limitation
                      </Button>
                    </FormGroup>
                  </Stack>
                </TabPanel>

                {/* Inputs & Outputs Tab */}
                <TabPanel>
                  <Stack gap={6}>
                    <FormGroup legendText="Inputs">
                      {validationErrors.inputs && (
                        <InlineNotification
                          kind="error"
                          title="Error"
                          subtitle={validationErrors.inputs}
                          lowContrast
                        />
                      )}
                      {(formData.inputs || []).map((input, index) => (
                        <div key={index} className="io-item">
                          <div className="io-item-header">
                            <Tag type="blue" size="sm">Input {index + 1}</Tag>
                            <Button
                              kind="danger--ghost"
                              size="sm"
                              renderIcon={TrashCan}
                              iconDescription="Remove"
                              hasIconOnly
                              onClick={() => removeInput(index)}
                            />
                          </div>
                          <TextInput
                            id={`input-name-${index}`}
                            labelText="Name"
                            placeholder="Input name"
                            value={input.name}
                            onChange={(e) => updateInput(index, 'name', e.target.value)}
                          />
                          <Dropdown
                            id={`input-type-${index}`}
                            titleText="Type"
                            label="Select type"
                            items={dataTypes.map((t) => ({ id: t, text: t }))}
                            itemToString={(item) => item?.text || ''}
                            selectedItem={{ id: input.type, text: input.type }}
                            onChange={({ selectedItem }) =>
                              updateInput(index, 'type', selectedItem?.id ?? input.type)
                            }
                          />
                          <TextArea
                            id={`input-description-${index}`}
                            labelText="Description"
                            placeholder="Describe this input"
                            value={input.description}
                            onChange={(e) => updateInput(index, 'description', e.target.value)}
                            rows={2}
                          />
                          <Toggle
                            id={`input-required-${index}`}
                            labelText="Required"
                            toggled={input.required}
                            onToggle={(checked) => updateInput(index, 'required', checked)}
                          />
                        </div>
                      ))}
                      <Button kind="tertiary" renderIcon={Add} onClick={addInput}>
                        Add Input
                      </Button>
                    </FormGroup>

                    <FormGroup legendText="Outputs">
                      {validationErrors.outputs && (
                        <InlineNotification
                          kind="error"
                          title="Error"
                          subtitle={validationErrors.outputs}
                          lowContrast
                        />
                      )}
                      {(formData.outputs || []).map((output, index) => (
                        <div key={index} className="io-item">
                          <div className="io-item-header">
                            <Tag type="green" size="sm">Output {index + 1}</Tag>
                            <Button
                              kind="danger--ghost"
                              size="sm"
                              renderIcon={TrashCan}
                              iconDescription="Remove"
                              hasIconOnly
                              onClick={() => removeOutput(index)}
                            />
                          </div>
                          <TextInput
                            id={`output-name-${index}`}
                            labelText="Name"
                            placeholder="Output name"
                            value={output.name}
                            onChange={(e) => updateOutput(index, 'name', e.target.value)}
                          />
                          <Dropdown
                            id={`output-type-${index}`}
                            titleText="Type"
                            label="Select type"
                            items={dataTypes.map((t) => ({ id: t, text: t }))}
                            itemToString={(item) => item?.text || ''}
                            selectedItem={{ id: output.type, text: output.type }}
                            onChange={({ selectedItem }) =>
                              updateOutput(index, 'type', selectedItem?.id ?? output.type)
                            }
                          />
                          <TextArea
                            id={`output-description-${index}`}
                            labelText="Description"
                            placeholder="Describe this output"
                            value={output.description}
                            onChange={(e) => updateOutput(index, 'description', e.target.value)}
                            rows={2}
                          />
                        </div>
                      ))}
                      <Button kind="tertiary" renderIcon={Add} onClick={addOutput}>
                        Add Output
                      </Button>
                    </FormGroup>
                  </Stack>
                </TabPanel>

                {/* Governance Tab */}
                <TabPanel>
                  <Stack gap={6}>
                    <GovernanceProfileSection
                      profile={formData.governanceProfile}
                      onChange={(profile: GovernanceProfile) => setFormData({ ...formData, governanceProfile: profile })}
                    />

                    <FormGroup legendText="Governance Controls">
                      {(formData.governanceControls || []).map((control, index) => (
                        <div key={index} className="governance-item">
                          <div className="governance-item-header">
                            <Tag type="purple" size="sm">Control {index + 1}</Tag>
                            <Button
                              kind="danger--ghost"
                              size="sm"
                              renderIcon={TrashCan}
                              iconDescription="Remove"
                              hasIconOnly
                              onClick={() => removeGovernanceControl(index)}
                            />
                          </div>
                          <Dropdown
                            id={`control-type-${index}`}
                            titleText="Control Type"
                            label="Select control type"
                            items={governanceControlTypes}
                            itemToString={(item) => item?.text || ''}
                            selectedItem={governanceControlTypes.find((t) => t.id === control.type)}
                            onChange={({ selectedItem }) =>
                              updateGovernanceControl(index, 'type', selectedItem?.id ?? control.type)
                            }
                          />
                          <TextArea
                            id={`control-description-${index}`}
                            labelText="Description"
                            placeholder="Describe this control"
                            value={control.description}
                            onChange={(e) => updateGovernanceControl(index, 'description', e.target.value)}
                            rows={2}
                          />
                          <Toggle
                            id={`control-enabled-${index}`}
                            labelText="Enabled"
                            toggled={control.enabled}
                            onToggle={(checked) => updateGovernanceControl(index, 'enabled', checked)}
                          />
                        </div>
                      ))}
                      <Button kind="tertiary" renderIcon={Add} onClick={addGovernanceControl}>
                        Add Governance Control
                      </Button>
                    </FormGroup>

                    <FormGroup legendText="Escalation Criteria">
                      {(formData.escalationCriteria || []).map((criterion, index) => (
                        <div key={index} className="list-item">
                          <TextInput
                            id={`escalation-${index}`}
                            labelText=""
                            placeholder="Enter escalation criterion"
                            value={criterion}
                            onChange={(e) => updateListItem('escalationCriteria', index, e.target.value)}
                          />
                          <Button
                            kind="danger--ghost"
                            size="sm"
                            renderIcon={TrashCan}
                            iconDescription="Remove"
                            hasIconOnly
                            onClick={() => removeListItem('escalationCriteria', index)}
                          />
                        </div>
                      ))}
                      <Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => addListItem('escalationCriteria')}>
                        Add Escalation Criterion
                      </Button>
                    </FormGroup>
                  </Stack>
                </TabPanel>

                {/* DSL Preview Tab */}
                <TabPanel>
                  <div className="dsl-preview-tab">
                    <p className="helper-text">
                      Preview the DSL representation of your agent configuration. This is automatically generated from your inputs.
                    </p>
                    {formData.name && formData.inputs && formData.outputs ? (
                      <DSLPreview agent={formData as Agent} variant="all" />
                    ) : (
                      <InlineNotification
                        kind="info"
                        title="Incomplete Configuration"
                        subtitle="Fill in the basic info, inputs, and outputs to see the DSL preview"
                        lowContrast
                      />
                    )}
                  </div>
                </TabPanel>

                {/* Advanced Tab */}
                <TabPanel>
                  <Stack gap={6}>
                    <TextArea
                      id="system-prompt"
                      labelText="System Prompt"
                      placeholder="Enter custom system prompt (optional)"
                      value={formData.systemPrompt || ''}
                      onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                      rows={10}
                      helperText="This will be used as the base prompt for the AI agent. Leave empty to use auto-generated prompt."
                    />
                  </Stack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Form>
        </Column>
      </Grid>
    </div>
  );
};

// Made with Bob
