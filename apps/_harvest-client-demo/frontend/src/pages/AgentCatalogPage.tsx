import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Grid,
  Column,
  Button,
  Search,
  Dropdown,
  Loading,
  InlineNotification,
  Modal,
  ContentSwitcher,
  Switch,
  Checkbox,
} from '@carbon/react';
import { Add, View, Rocket, TrashCan } from '@carbon/icons-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import type { Agent } from '../types';
import { WorkforceView } from '../components/WorkforceView';
import { AgentCard } from '../components/AgentCard';
import PageHeader from '../components/layout/PageHeader';
import './AgentCatalogPage.scss';

export const AgentCatalogPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    agents,
    setAgents,
    verticals,
    setVerticals,
    agentFilters,
    setAgentFilters,
    loading,
    setLoading,
    setError,
    removeAgent,
  } = useStore();

  const [deployingAgent, setDeployingAgent] = useState<string | null>(null);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [agentToRevoke, setAgentToRevoke] = useState<Agent | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const catalogView: 'workers' | 'workforce' =
    searchParams.get('view') === 'workforce' ? 'workforce' : 'workers';
  const setCatalogView = (view: 'workers' | 'workforce') => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (view === 'workforce') {
          next.set('view', 'workforce');
        } else {
          next.delete('view');
        }
        return next;
      },
      { replace: true },
    );
  };

  const handleDeployToFoundry = async (agent: Agent) => {
    try {
      setDeployingAgent(agent.id);
      setDeployError(null);
      setDeploySuccess(null);

      const result = await api.deployAgentToFoundry(agent.id);
      setDeploySuccess(`${agent.name} deployed successfully! Deployment ID: ${result.deploymentId}`);
    } catch (error: unknown) {
      console.error('Failed to deploy agent:', error);
      const message = error instanceof Error ? error.message : 'Failed to deploy agent to Azure AI Foundry';
      setDeployError(message);
    } finally {
      setDeployingAgent(null);
    }
  };

  const handleRevokeAgent = async () => {
    if (!agentToRevoke) return;
    try {
      setRevoking(true);
      await api.revokeAgent(agentToRevoke.id);
      removeAgent(agentToRevoke.id);
      setAgentToRevoke(null);
    } catch (error) {
      console.error('Failed to revoke agent:', error);
      setDeployError('Failed to revoke agent');
    } finally {
      setRevoking(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load verticals if not already loaded
        if (verticals.length === 0) {
          const verticalsData = await api.getVerticals();
          setVerticals(verticalsData);
        }

        // Get filters from URL or state
        const verticalId = searchParams.get('vertical') || agentFilters.verticalId;
        const filters = {
          verticalId,
          archetype: agentFilters.archetype,
          authorityLevel: agentFilters.authorityLevel,
          search: agentFilters.search,
        };

        const agentsData = await api.getAgents(filters);
        setAgents([...agentsData].sort((a, b) => {
          if (a.verticalId !== b.verticalId) return a.verticalId.localeCompare(b.verticalId);
          return a.name.localeCompare(b.name);
        }));
      } catch (error) {
        console.error('Failed to load agents:', error);
        setError('Failed to load agents');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [agentFilters, searchParams, setAgents, setVerticals, setLoading, setError, verticals.length]);

  const handleSearch = (value: string) => {
    setAgentFilters({ search: value });
  };

  const handleArchetypeFilter = (value: string) => {
    setAgentFilters({ archetype: value === 'all' ? undefined : value });
  };

  const handleAuthorityFilter = (value: string) => {
    setAgentFilters({ authorityLevel: value === 'all' ? undefined : value });
  };

  const handleSelectAgent = (agentId: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
    setSelectAll(newSelected.size === agents.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedAgents(new Set());
      setSelectAll(false);
    } else {
      setSelectedAgents(new Set(agents.map((a) => a.id)));
      setSelectAll(true);
    }
  };

  const handleVerticalFilter = (value: string) => {
    setAgentFilters({ verticalId: value === 'all' ? undefined : value });
  };


  if (loading && agents.length === 0) {
    return (
      <div className="agent-catalog-loading">
        <Loading description="Loading agents..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div className="agent-catalog-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          {agentFilters.verticalId && verticals.length > 0 && (
            <p className="catalog-template-label">
              COMPOSED FROM INDUSTRY TEMPLATE
            </p>
          )}
          <PageHeader
            title="Agent Catalog"
            actions={
              <Button renderIcon={Add} onClick={() => navigate('/agents/new')}>
                Create New Agent
              </Button>
            }
          />
          <div className="catalog-view-switch">
            <ContentSwitcher
              selectedIndex={catalogView === 'workers' ? 0 : 1}
              onChange={({ index }) => setCatalogView(index === 0 ? 'workers' : 'workforce')}
              size="md"
            >
              <Switch name="workers" text="Individual Workers" />
              <Switch name="workforce" text="Workforce" />
            </ContentSwitcher>
            <p className="catalog-view-hint">
              {catalogView === 'workers'
                ? 'Individual agents that solve a single, focused task (point solutions).'
                : 'Bundled Digital Workers that collaborate to deliver an end-to-end business process.'}
            </p>
          </div>
        </Column>

        {catalogView === 'workforce' && (
          <Column lg={16} md={8} sm={4}>
            <WorkforceView />
          </Column>
        )}

        {catalogView === 'workers' && (
        <>
        <Column lg={16} md={8} sm={4}>
          <div className="filters-section">
            <Search
              size="lg"
              placeholder="Search agents..."
              labelText="Search"
              value={agentFilters.search}
              onChange={(e) => handleSearch(e.target.value)}
              onClear={() => handleSearch('')}
            />

            <div className="filter-dropdowns">
              <Dropdown
                id="vertical-filter"
                titleText="Vertical"
                label="All Verticals"
                items={[
                  { id: 'all', text: 'All Verticals' },
                  ...verticals.map((v) => ({ id: v.id, text: v.name })),
                ]}
                itemToString={(item) => item?.text || ''}
                onChange={({ selectedItem }) => handleVerticalFilter(selectedItem?.id || 'all')}
              />

              <Dropdown
                id="archetype-filter"
                titleText="Archetype"
                label="All Archetypes"
                items={[
                  { id: 'all', text: 'All Archetypes' },
                  { id: 'Analyst', text: 'Analyst' },
                  { id: 'Coordinator', text: 'Coordinator' },
                  { id: 'Specialist', text: 'Specialist' },
                  { id: 'Validator', text: 'Validator' },
                  { id: 'Communicator', text: 'Communicator' },
                  { id: 'Auditor', text: 'Auditor' },
                  { id: 'Optimizer', text: 'Optimizer' },
                ]}
                itemToString={(item) => item?.text || ''}
                onChange={({ selectedItem }) => handleArchetypeFilter(selectedItem?.id || 'all')}
              />

              <Dropdown
                id="authority-filter"
                titleText="Authority Level"
                label="All Levels"
                items={[
                  { id: 'all', text: 'All Levels' },
                  { id: 'Low', text: 'Low' },
                  { id: 'Medium', text: 'Medium' },
                  { id: 'High', text: 'High' },
                  { id: 'Critical', text: 'Critical' },
                ]}
                itemToString={(item) => item?.text || ''}
                onChange={({ selectedItem }) => handleAuthorityFilter(selectedItem?.id || 'all')}
              />

              <Dropdown
                id="workflow-role-filter"
                titleText="Workflow Role"
                label="All Roles"
                items={[
                  { id: 'all', text: 'All Roles' },
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
                onChange={() => {
                  // Filter by workflow role (client-side for now)
                  setAgentFilters({ search: agentFilters.search });
                }}
              />
            </div>
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="agents-count">
            <p>
              {selectedAgents.size > 0
                ? `${selectedAgents.size} of ${agents.length} agents selected`
                : `${agents.length} agents found`}
            </p>
          </div>
        </Column>

        {selectedAgents.size > 0 && (
          <Column lg={16} md={8} sm={4}>
            <div className="bulk-actions-toolbar">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onChange={handleSelectAll}
                labelText={`Select all (${agents.length})`}
              />
              <div className="bulk-actions">
                <Button kind="secondary" onClick={() => setSelectedAgents(new Set())}>
                  Clear Selection
                </Button>
                <Button
                  kind="primary"
                  renderIcon={Rocket}
                  onClick={() => {
                    // Bulk recruit all selected
                    selectedAgents.forEach((id) => {
                      const agent = agents.find((a) => a.id === id);
                      if (agent) {
                        handleDeployToFoundry(agent);
                      }
                    });
                  }}
                >
                  Recruit All ({selectedAgents.size})
                </Button>
              </div>
            </div>
          </Column>
        )}

        {deploySuccess && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="success"
              title="Deployment Successful"
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
              title="Deployment Failed"
              subtitle={deployError}
              onCloseButtonClick={() => setDeployError(null)}
              lowContrast
            />
          </Column>
        )}

        <Column lg={16} md={8} sm={4}>
          <div className="agent-cards-grid">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                name={agent.name}
                description={agent.description}
                archetype={agent.archetype}
                workflowRole={agent.workflowRole}
                capabilities={agent.capabilities}
                escalationCriteria={agent.escalationCriteria}
                active={activeCardId === agent.id}
                selectable
                selected={selectedAgents.has(agent.id)}
                onSelectChange={() => handleSelectAgent(agent.id)}
                onClick={() => setActiveCardId(activeCardId === agent.id ? null : agent.id)}
                actions={
                  <>
                    <Button kind="ghost" size="sm" style={{ flex: 1 }} renderIcon={View}
                      onClick={() => navigate(`/agents/${agent.id}`)}>View</Button>
                    <Button kind="primary" size="sm" style={{ flex: 1 }} renderIcon={Rocket}
                      onClick={() => handleDeployToFoundry(agent)}
                      disabled={deployingAgent === agent.id}>
                      {deployingAgent === agent.id ? 'Recruiting...' : 'Recruit'}
                    </Button>
                    <Button kind="danger--ghost" size="sm" renderIcon={TrashCan}
                      onClick={() => setAgentToRevoke(agent)}>Revoke</Button>
                  </>
                }
              />
            ))}
          </div>

          {agents.length === 0 && !loading && (
            <div className="no-agents">
              <p>No agents found matching your criteria.</p>
              <Button onClick={() => navigate('/agents/new')}>
                Create Your First Agent
              </Button>
            </div>
          )}
        </Column>
        </>
        )}
      </Grid>

      <Modal
        open={!!agentToRevoke}
        danger
        modalHeading="Revoke Agent"
        modalLabel="Confirm Action"
        primaryButtonText={revoking ? 'Revoking...' : 'Revoke Agent'}
        secondaryButtonText="Cancel"
        onRequestClose={() => setAgentToRevoke(null)}
        onRequestSubmit={handleRevokeAgent}
        primaryButtonDisabled={revoking}
      >
        <p>
          Are you sure you want to revoke <strong>{agentToRevoke?.name}</strong>? This action cannot be undone and will remove the agent from all workflows.
        </p>
      </Modal>
    </div>
  );
};

// Made with Bob
