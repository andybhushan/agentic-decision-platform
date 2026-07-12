import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Grid,
  Column,
  Button,
  Search,
  Dropdown,
  Tile,
  Tag,
  Loading,
  Modal,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@carbon/react';
import { Add, View, Edit, Download } from '@carbon/icons-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import type { Workflow } from '../types';
import PageHeader from '../components/layout/PageHeader';
import './WorkflowPage.scss';

// Mermaid will be loaded dynamically
let mermaid: typeof import('mermaid').default | null = null;

export const WorkflowPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    workflows,
    setWorkflows,
    agents,
    setAgents,
    verticals,
    setVerticals,
    loading,
    setLoading,
    setError,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mermaidReady, setMermaidReady] = useState(false);

  // Initialize Mermaid
  useEffect(() => {
    const initMermaid = async () => {
      try {
        const mermaidModule = await import('mermaid');
        mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
          },
        });
        setMermaidReady(true);
      } catch (error) {
        console.error('Failed to load Mermaid:', error);
      }
    };

    initMermaid();
  }, []);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load verticals if not already loaded
        if (verticals.length === 0) {
          const verticalsData = await api.getVerticals();
          setVerticals(verticalsData);
        }

        // Load agents if not already loaded
        if (agents.length === 0) {
          const agentsData = await api.getAgents();
          setAgents(agentsData);
        }

        // Get filters from URL or state
        const verticalId = searchParams.get('vertical') || selectedVertical;
        const filters = verticalId !== 'all' ? { verticalId } : undefined;

        const workflowsData = await api.getWorkflows(filters);
        setWorkflows(workflowsData);
      } catch (error) {
        console.error('Failed to load orchestrations:', error);
        setError('Failed to load orchestrations');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedVertical, searchParams, setWorkflows, setAgents, setVerticals, setLoading, setError, verticals.length, agents.length]);

  // Render Mermaid diagram
  useEffect(() => {
    if (selectedWorkflow && mermaidReady && isModalOpen) {
      const renderDiagram = async () => {
        try {
          const element = document.getElementById('mermaid-diagram');
          if (element && mermaid) {
            element.innerHTML = selectedWorkflow.mermaidDSL;
            await mermaid.run({
              nodes: [element],
            });
          }
        } catch (error) {
          console.error('Failed to render Mermaid diagram:', error);
        }
      };

      // Small delay to ensure DOM is ready
      setTimeout(renderDiagram, 100);
    }
  }, [selectedWorkflow, mermaidReady, isModalOpen]);

  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVertical = selectedVertical === 'all' || workflow.verticalId === selectedVertical;
    return matchesSearch && matchesVertical;
  });

  const handleViewWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setIsModalOpen(true);
  };

  const handleExportWorkflow = (workflow: Workflow, format: 'mermaid' | 'svg' | 'png') => {
    if (format === 'mermaid') {
      const blob = new Blob([workflow.mermaidDSL], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflow.name.replace(/\s+/g, '_')}.mmd`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // For SVG/PNG export, we'd need to capture the rendered diagram
      console.log(`Export to ${format} not yet implemented`);
    }
  };

  const getAgentName = (agentId: string): string => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || 'Unknown Agent';
  };

  if (loading && workflows.length === 0) {
    return (
      <div className="workflow-page-loading">
        <Loading description="Loading orchestrations..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div className="workflow-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <PageHeader
            title="Agentic Orchestrations"
            actions={
              <Button renderIcon={Add} onClick={() => navigate('/workflows/new')}>
                Create New Orchestration
              </Button>
            }
          />
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="filters-section">
            <Search
              size="lg"
              placeholder="Search orchestrations..."
              labelText="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm('')}
            />

            <Dropdown
              id="vertical-filter"
              titleText="Vertical"
              label="All Verticals"
              items={[
                { id: 'all', text: 'All Verticals' },
                ...verticals.map((v) => ({ id: v.id, text: v.name })),
              ]}
              itemToString={(item) => item?.text || ''}
              onChange={({ selectedItem }) => setSelectedVertical(selectedItem?.id || 'all')}
            />
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="workflows-count">
            <p>{filteredWorkflows.length} orchestrations found</p>
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="workflows-grid">
            {filteredWorkflows.map((workflow) => (
              <Tile key={workflow.id} className="workflow-card">
                <div className="workflow-card-header">
                  <h3>{workflow.name}</h3>
                  <Tag type="blue" size="sm">
                    {workflow.agents.length} agents
                  </Tag>
                </div>

                <p className="workflow-description">{workflow.description}</p>

                <div className="workflow-agents">
                  <strong>Agents in orchestration:</strong>
                  <div className="agent-tags">
                    {workflow.agents.slice(0, 5).map((wa) => (
                      <Tag key={wa.id} type="gray" size="sm">
                        {getAgentName(wa.agentId)}
                      </Tag>
                    ))}
                    {workflow.agents.length > 5 && (
                      <Tag type="gray" size="sm">
                        +{workflow.agents.length - 5} more
                      </Tag>
                    )}
                  </div>
                </div>

                <div className="workflow-card-footer">
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={View}
                    onClick={() => handleViewWorkflow(workflow)}
                  >
                    View Diagram
                  </Button>
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={Edit}
                    onClick={() => navigate(`/workflows/${workflow.id}/edit`)}
                  >
                    Edit
                  </Button>
                </div>
              </Tile>
            ))}
          </div>

          {filteredWorkflows.length === 0 && !loading && (
            <div className="no-workflows">
              <p>No orchestrations found matching your criteria.</p>
              <Button onClick={() => navigate('/workflows/new')}>
                Create Your First Orchestration
              </Button>
            </div>
          )}
        </Column>
      </Grid>

      {/* Orchestration Detail Modal */}
      <Modal
        open={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        modalHeading={selectedWorkflow?.name || 'Orchestration Details'}
        size="lg"
        passiveModal
      >
        {selectedWorkflow && (
          <div className="workflow-modal-content">
            <Tabs>
              <TabList aria-label="Orchestration tabs">
                <Tab>Diagram</Tab>
                <Tab>Details</Tab>
                <Tab>Agents</Tab>
              </TabList>

              <TabPanels>
                {/* Diagram Tab */}
                <TabPanel>
                  <div className="diagram-container">
                    <div className="diagram-actions">
                      <Button
                        kind="tertiary"
                        size="sm"
                        renderIcon={Download}
                        onClick={() => handleExportWorkflow(selectedWorkflow, 'mermaid')}
                      >
                        Export Mermaid
                      </Button>
                    </div>
                    <div id="mermaid-diagram" className="mermaid-diagram">
                      {!mermaidReady && <Loading description="Loading diagram..." />}
                    </div>
                  </div>
                </TabPanel>

                {/* Details Tab */}
                <TabPanel>
                  <div className="workflow-details">
                    <div className="detail-row">
                      <strong>Description:</strong>
                      <p>{selectedWorkflow.description}</p>
                    </div>
                    <div className="detail-row">
                      <strong>Vertical:</strong>
                      <p>{verticals.find((v) => v.id === selectedWorkflow.verticalId)?.name || 'Unknown'}</p>
                    </div>
                    <div className="detail-row">
                      <strong>Version:</strong>
                      <p>{selectedWorkflow.version}</p>
                    </div>
                    <div className="detail-row">
                      <strong>Agents:</strong>
                      <p>{selectedWorkflow.agents.length}</p>
                    </div>
                    <div className="detail-row">
                      <strong>Connections:</strong>
                      <p>{selectedWorkflow.connections.length}</p>
                    </div>
                    <div className="detail-row">
                      <strong>Created:</strong>
                      <p>{new Date(selectedWorkflow.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="detail-row">
                      <strong>Last Updated:</strong>
                      <p>{new Date(selectedWorkflow.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </TabPanel>

                {/* Agents Tab */}
                <TabPanel>
                  <div className="workflow-agents-list">
                    {selectedWorkflow.agents.map((wa) => {
                      const agent = agents.find((a) => a.id === wa.agentId);
                      return (
                        <Tile key={wa.id} className="agent-item">
                          <div className="agent-item-header">
                            <h4>{agent?.name || 'Unknown Agent'}</h4>
                            <Tag type="blue" size="sm">{agent?.archetype}</Tag>
                          </div>
                          <p>{agent?.description}</p>
                          {wa.config && (
                            <div className="agent-config">
                              <strong>Configuration:</strong>
                              <pre>{JSON.stringify(wa.config, null, 2)}</pre>
                            </div>
                          )}
                        </Tile>
                      );
                    })}
                  </div>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </div>
        )}
      </Modal>
    </div>
  );
};

// Made with Bob
