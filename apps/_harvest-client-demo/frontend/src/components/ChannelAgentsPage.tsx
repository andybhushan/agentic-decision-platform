import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Grid, Column, InlineNotification, Loading } from '@carbon/react';
import { findMember, useWorkforces } from '../hooks/useWorkforces';
import { useClaimsModel } from '../hooks/useClaimsModel';
import { canonicalAgentIdForNode } from '../data/canonicalAgents';
import type { Agent } from '../types';
import { AgentCard } from './AgentCard';
import PageHeader from './layout/PageHeader';
import '../pages/AgentDetailsPage.scss';
import './ChannelAgentsPage.scss';

const ChannelAgentsPage = () => {
  const navigate = useNavigate();
  const { channelId } = useParams<{ channelId: string }>();
  const {
    workforces,
    loading: workforceLoading,
    error: workforceError,
    usingFallback: workforceUsingFallback,
  } = useWorkforces();
  const {
    getSubflow,
    loading: modelLoading,
    error: modelError,
    usingFallback: modelUsingFallback,
  } = useClaimsModel();

  const channelMember = channelId ? findMember(workforces, channelId) : undefined;
  const channelName = channelMember?.member.name || channelId || '';
  const channelAgents = useMemo(() => {
    if (!channelId) {
      return [];
    }

    const subflow = getSubflow(channelId);
    if (!subflow?.nodes) {
      return [];
    }

    return subflow.nodes
      .filter((node) => node.stepType === 'agent_task' || node.stepType === 'orchestrator')
      .map(
        (node) =>
          ({
            id: node.id,
            name: node.name,
            description: node.description || '',
            archetype: node.stepType === 'orchestrator' ? 'Orchestrator' : 'Agent',
            authorityLevel: 'Medium' as const,
            capabilities: [node.capability || node.purpose || 'Not specified'].filter(Boolean),
            workflowRole: node.architectureRole || undefined,
          }) as unknown as Agent,
      );
  }, [channelId, getSubflow]);

  if (!channelId) {
    return (
      <div className="channel-agents-page">
        <Grid>
          <Column lg={16} md={8} sm={4}>
            <PageHeader
              back={{ label: 'Back to Workforce', onClick: () => navigate('/agents?view=workforce') }}
              title="Channel not found"
            />
            <InlineNotification
              kind="error"
              title="Not found"
              subtitle="The requested channel could not be found."
              hideCloseButton
            />
          </Column>
        </Grid>
      </div>
    );
  }

  if ((workforceLoading && workforces.length === 0) || modelLoading) {
    return (
      <div className="channel-agents-page">
        <Grid>
          <Column lg={16} md={8} sm={4}>
            <PageHeader
              back={{ label: 'Back to Workforce', onClick: () => navigate('/agents?view=workforce') }}
              title="Loading channel"
            />
            <Loading
              description={workforceLoading && workforces.length === 0 ? 'Loading workforce...' : 'Loading process model...'}
              withOverlay={false}
            />
          </Column>
        </Grid>
      </div>
    );
  }

  if (channelAgents.length === 0) {
    return (
      <div className="channel-agents-page">
        <Grid>
          <Column lg={16} md={8} sm={4}>
            <PageHeader
              back={{ label: 'Back to Workforce', onClick: () => navigate('/agents?view=workforce') }}
              title={`Agents in: ${channelName}`}
              subtitle="No agents found for this channel. The channel may not have any sub-process agents defined."
            />
          </Column>

          {workforceUsingFallback && workforceError && (
            <Column lg={16} md={8} sm={4}>
              <InlineNotification
                kind="warning"
                lowContrast
                title="Showing archived workforce data"
                subtitle={workforceError}
                hideCloseButton
              />
            </Column>
          )}

          {modelUsingFallback && modelError && (
            <Column lg={16} md={8} sm={4}>
              <InlineNotification
                kind="warning"
                lowContrast
                title="Showing archived process model"
                subtitle={modelError}
                hideCloseButton
              />
            </Column>
          )}
        </Grid>
      </div>
    );
  }

  return (
    <div className="channel-agents-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <PageHeader
            back={{ label: 'Back to Workforce', onClick: () => navigate('/agents?view=workforce') }}
            title={`Agents in: ${channelName}`}
            subtitle={`${channelAgents.length} agent${
              channelAgents.length !== 1 ? 's' : ''
            } process claims from this channel. Click an agent to view its full profile.`}
          />
        </Column>

        {workforceUsingFallback && workforceError && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="warning"
              lowContrast
              title="Showing archived workforce data"
              subtitle={workforceError}
              hideCloseButton
            />
          </Column>
        )}

        {modelUsingFallback && modelError && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="warning"
              lowContrast
              title="Showing archived process model"
              subtitle={modelError}
              hideCloseButton
            />
          </Column>
        )}

        <Column lg={16} md={8} sm={4}>
          <div className="agent-cards-grid">
            {channelAgents.map((agent) => {
              const canonicalId =
                (agent.archetype as string) === 'Orchestrator' ? canonicalAgentIdForNode(channelId) : undefined;
              return (
                <AgentCard
                  key={agent.id}
                  name={agent.name}
                  description={agent.description}
                  archetype={agent.archetype}
                  workflowRole={agent.workflowRole}
                  capabilities={agent.capabilities}
                  onClick={() =>
                    navigate(canonicalId ? `/agents/${canonicalId}` : `/agents/workforce/${channelId}/step/${agent.id}`)
                  }
                />
              );
            })}
          </div>
        </Column>
      </Grid>
    </div>
  );
};

export default ChannelAgentsPage;
