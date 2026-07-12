import { Accordion, AccordionItem } from '@carbon/react';
import { ArrowRight, Connect } from '@carbon/icons-react';
import type { Agent, RelatedAgents } from '../types';
import { AgentCard } from './AgentCard';
import './RelatedAgentsSection.scss';

interface RelatedAgentsSectionProps {
  agent: Agent;
  allAgents: Agent[];
  relatedAgents?: RelatedAgents;
}

export const RelatedAgentsSection = ({
  agent,
  allAgents,
  relatedAgents,
}: RelatedAgentsSectionProps) => {
  const getAgentById = (id: string): Agent | undefined => {
    return allAgents.find((a) => a.id === id);
  };

  const renderAgentList = (agentIds: string[] | undefined, emptyMessage: string) => {
    if (!agentIds || agentIds.length === 0) {
      return <p className="empty-message">{emptyMessage}</p>;
    }

    return (
      <div className="agent-list">
        {agentIds.map((id) => {
          const relatedAgent = getAgentById(id);
          if (!relatedAgent) return null;
          return (
            <AgentCard
              key={id}
              name={relatedAgent.name}
              description={relatedAgent.description}
              archetype={relatedAgent.archetype}
              workflowRole={relatedAgent.workflowRole}
              capabilities={relatedAgent.capabilities}
            />
          );
        })}
      </div>
    );
  };

  const hasRelationships =
    (relatedAgents?.dependsOn && relatedAgents.dependsOn.length > 0) ||
    (relatedAgents?.supports && relatedAgents.supports.length > 0) ||
    (relatedAgents?.oftenUsedWith && relatedAgents.oftenUsedWith.length > 0);

  if (!hasRelationships) {
    return (
      <div className="related-agents-section">
        <Accordion>
          <AccordionItem title="Related Agents">
            <div className="empty-state">
              <Connect size={32} />
              <p>No related agents identified yet.</p>
              <p className="helper-text">
                Relationships are automatically inferred based on workflow roles and vertical context.
              </p>
            </div>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  return (
    <div className="related-agents-section">
      <Accordion>
        <AccordionItem title="Related Agents" open>
          <div className="relationships-content">
            {relatedAgents?.dependsOn && relatedAgents.dependsOn.length > 0 && (
              <div className="relationship-group">
                <div className="group-header">
                  <ArrowRight size={20} />
                  <h4>Depends On</h4>
                </div>
                <p className="group-description">
                  {agent.name} requires output from these agents to function properly.
                </p>
                {renderAgentList(relatedAgents.dependsOn, 'No dependencies')}
              </div>
            )}

            {relatedAgents?.supports && relatedAgents.supports.length > 0 && (
              <div className="relationship-group">
                <div className="group-header">
                  <ArrowRight size={20} />
                  <h4>Supports</h4>
                </div>
                <p className="group-description">
                  {agent.name} provides input or services to these agents.
                </p>
                {renderAgentList(relatedAgents.supports, 'No supported agents')}
              </div>
            )}

            {relatedAgents?.oftenUsedWith && relatedAgents.oftenUsedWith.length > 0 && (
              <div className="relationship-group">
                <div className="group-header">
                  <Connect size={20} />
                  <h4>Often Used With</h4>
                </div>
                <p className="group-description">
                  These agents are frequently used together in workflows.
                </p>
                {renderAgentList(relatedAgents.oftenUsedWith, 'No common usage patterns')}
              </div>
            )}
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

// Made with Bob