import { useState } from 'react';
import { Tile, Tag, Button, InlineLoading, InlineNotification, Loading } from '@carbon/react';
import { Play } from '@carbon/icons-react';
import { subflowOrder, stepTypeToKind, prettyValue } from '../data/memberView';
import type { ModelNode } from '../data/claimsModel';
import type { WorkforceMemberKind } from '../data/claimsWorkforce.seed';
import { useClaimsModel } from '../hooks/useClaimsModel';
import { api } from '../services/api';
import './OrchestrationPanel.scss';

const kindTag: Record<WorkforceMemberKind, 'purple' | 'blue' | 'teal' | 'cyan' | 'gray' | 'green'> = {
  orchestrator: 'purple',
  agent: 'blue',
  human: 'teal',
  rules: 'cyan',
  system: 'gray',
  channel: 'green',
};

interface TraceStep {
  id: string;
  name: string;
  kind: WorkforceMemberKind;
  source: 'live' | 'simulated';
  status: 'running' | 'done' | 'error';
  input: string;
  output: string;
  confidence?: number;
  escalation?: string;
}

interface OrchestrationPanelProps {
  /** The workforce/model node this agent orchestrates (e.g. 'N2' for Web Intake). */
  nodeId: string;
  /** Canonical backend agent id, used for the one live Foundry step. */
  agentId?: string;
  /** Deployment id; when present the orchestrator step runs live against Foundry. */
  deploymentId?: string | null;
}

function deterministicConfidence(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000;
  return Math.round((0.78 + (h % 200) / 1000) * 100) / 100;
}

function describeInput(node: ModelNode): string {
  if (node.dataIn?.length) return node.dataIn.join(', ');
  return node.scope || node.purpose || 'Claim context from the previous step';
}

function describeOutput(node: ModelNode): string {
  if (node.dataOut?.length) return node.dataOut.join(', ');
  return node.capability ? `${node.capability} result` : 'Structured result + confidence';
}

export const OrchestrationPanel = ({ nodeId, agentId, deploymentId }: OrchestrationPanelProps) => {
  const { getSubflow, loading: modelLoading, error: modelError, usingFallback } = useClaimsModel();
  const subflow = getSubflow(nodeId);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  if (modelLoading) {
    return <Loading description="Loading process model..." withOverlay={false} />;
  }

  if (!subflow || !subflow.nodes?.length) {
    return null;
  }

  const ordered = subflowOrder(subflow);
  const root = ordered.find((n) => n.stepType === 'orchestrator') ?? ordered[0];
  const steps = ordered.filter((n) => n.id !== root.id);

  const runOrchestration = async () => {
    setRunning(true);
    setError(null);

    const seedQuery = 'A policyholder wants to start a new motor claim after a minor collision this morning.';
    const rootKind = stepTypeToKind(root.stepType);
    const orchestratorStep: TraceStep = {
      id: root.id,
      name: root.name,
      kind: rootKind,
      source: agentId && deploymentId ? 'live' : 'simulated',
      status: 'running',
      input: seedQuery,
      output: '',
      confidence: deterministicConfidence(root.id),
    };
    setTrace([orchestratorStep]);

    if (agentId && deploymentId) {
      try {
        const res = await api.chatWithAgent(agentId, seedQuery, [], deploymentId, {
          context: 'standalone',
        });
        orchestratorStep.output = res.response;
        orchestratorStep.status = 'done';
      } catch (err) {
        orchestratorStep.status = 'error';
        orchestratorStep.output = err instanceof Error ? err.message : 'Foundry call failed';
        setError('The live orchestrator step failed; showing simulated steps for the rest.');
      }
    } else {
      orchestratorStep.output =
        'Greets the policyholder and begins collecting claim details, then delegates the steps below.';
      orchestratorStep.status = 'done';
    }
    setTrace([{ ...orchestratorStep }]);

    const built: TraceStep[] = [{ ...orchestratorStep }];
    for (const node of steps) {
      const kind = stepTypeToKind(node.stepType);
      built.push({
        id: node.id,
        name: node.name,
        kind,
        source: 'simulated',
        status: 'done',
        input: describeInput(node),
        output: describeOutput(node),
        confidence: node.agent?.confidenceThreshold ?? deterministicConfidence(node.id),
        escalation: node.agent?.escalationPath,
      });
    }
    setTrace(built);
    setRunning(false);
  };

  return (
    <div className="orchestration-panel">
      {usingFallback && modelError && (
        <InlineNotification
          kind="warning"
          title="Showing archived process model"
          subtitle={modelError}
          lowContrast
          hideCloseButton
        />
      )}

      <Tile className="info-tile">
        <h4>Orchestrated workforce</h4>
        <p className="orchestration-intro">
          This is an <strong>orchestration agent</strong>: it coordinates the specialist sub-agents and steps below to
          deliver an end-to-end outcome, as opposed to a point agent that performs a single task.
        </p>
        <div className="orchestration-root">
          <Tag type={kindTag.orchestrator} size="sm">
            Orchestrator
          </Tag>
          <span className="orchestration-root-name">{root.name}</span>
        </div>

        <ol className="orchestration-steps">
          {steps.map((node, idx) => {
            const kind = stepTypeToKind(node.stepType);
            return (
              <li key={node.id} className="orchestration-step">
                <span className="orchestration-step-index">{idx + 1}</span>
                <div className="orchestration-step-body">
                  <div className="orchestration-step-header">
                    <span className="orchestration-step-name">{node.name}</span>
                    <Tag type={kindTag[kind]} size="sm">
                      {prettyValue(node.stepType)}
                    </Tag>
                  </div>
                  {(node.description || node.purpose || node.scope) && (
                    <p className="orchestration-step-desc">{node.description || node.purpose || node.scope}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Tile>

      <Tile className="info-tile orchestration-run">
        <div className="orchestration-run-header">
          <h4>Run orchestration (demo)</h4>
          {running ? (
            <InlineLoading description="Running orchestration..." />
          ) : (
            <Button size="sm" renderIcon={Play} onClick={runOrchestration}>
              Run orchestration
            </Button>
          )}
        </div>
        <p className="orchestration-intro">
          Steps the orchestrator through its sub-agents. The orchestrator step runs{' '}
          {agentId && deploymentId ? 'live against Azure AI Foundry' : 'as a simulated step (deploy to run it live)'};
          the remaining steps are simulated demo steps.
        </p>

        {error && (
          <InlineNotification kind="warning" title="Partial run" subtitle={error} lowContrast hideCloseButton />
        )}

        {trace.length > 0 && (
          <ol className="orchestration-trace">
            {trace.map((step, idx) => (
              <li key={`${step.id}-${idx}`} className={`orchestration-trace-step status-${step.status}`}>
                <span className="orchestration-step-index">{idx + 1}</span>
                <div className="orchestration-step-body">
                  <div className="orchestration-step-header">
                    <span className="orchestration-step-name">{step.name}</span>
                    <Tag type={step.source === 'live' ? 'green' : 'gray'} size="sm">
                      {step.source === 'live' ? 'Live Foundry' : 'Simulated'}
                    </Tag>
                    {typeof step.confidence === 'number' && (
                      <Tag type="blue" size="sm">
                        {Math.round(step.confidence * 100)}% confidence
                      </Tag>
                    )}
                    {step.status === 'running' && <InlineLoading description="..." />}
                  </div>
                  <p className="orchestration-trace-io">
                    <strong>In:</strong> {step.input}
                  </p>
                  <p className="orchestration-trace-io">
                    <strong>Out:</strong> {step.output || '...'}
                  </p>
                  {step.escalation && (
                    <p className="orchestration-trace-io">
                      <strong>Escalates to:</strong> {step.escalation}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Tile>
    </div>
  );
};

export default OrchestrationPanel;
