import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Grid,
  Column,
  Button,
  Tag,
  Tile,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  InlineNotification,
  Loading,
} from '@carbon/react';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  User,
  FlowData,
  Rule,
  DataBase,
  Devices,
} from '@carbon/icons-react';
import {
  findMember,
  buildCoordinationTree,
  stageAgents,
  useWorkforces,
} from '../hooks/useWorkforces';
import type {
  Workforce,
  WorkforceMember,
  WorkforceMemberKind,
  CoordinatedWorker,
} from '../data/claimsWorkforce.seed';
import type { ModelNode, ModelControls, AgentMeta, Subflow } from '../data/claimsModel';
import { useClaimsModel } from '../hooks/useClaimsModel';
import { stepTypeToKind, prettyValue, subflowOrder, buildSubflowMermaid } from '../data/memberView';
import { getMemberConnections } from '../data/workforceFlow';
import type { FlowConnection } from '../data/workforceFlow';
import PageHeader from './layout/PageHeader';
import '../pages/AgentDetailsPage.scss';
import './WorkforceMemberDetailsPage.scss';

// Mermaid is loaded lazily so it only ships when a sub-process is opened.
let mermaid: typeof import('mermaid').default | null = null;

type TagColor =
  | 'purple'
  | 'blue'
  | 'teal'
  | 'cyan'
  | 'gray'
  | 'green'
  | 'red'
  | 'magenta';

const kindMeta: Record<
  WorkforceMemberKind,
  { label: string; color: TagColor; Icon: typeof Bot; noun: string }
> = {
  orchestrator: { label: 'Digital Worker', color: 'purple', Icon: FlowData, noun: 'Digital Worker' },
  agent: { label: 'Agent', color: 'blue', Icon: Bot, noun: 'agent' },
  human: { label: 'Human-in-the-loop', color: 'teal', Icon: User, noun: 'human step' },
  rules: { label: 'Rules engine', color: 'cyan', Icon: Rule, noun: 'rules engine' },
  system: { label: 'System of record', color: 'gray', Icon: DataBase, noun: 'system' },
  channel: { label: 'Intake channel', color: 'green', Icon: Devices, noun: 'channel' },
};

const assertionColor: Record<string, TagColor> = {
  authoritative: 'purple',
  advisory: 'blue',
  signal: 'teal',
};

const NOT_SPECIFIED = 'Not specified in the exported model.';

// ---------------------------------------------------------------------------
// Shared presentational helpers (pure — real model data only).
// ---------------------------------------------------------------------------

const NotFound = ({ subtitle, onBack }: { subtitle: string; onBack: () => void }) => (
  <div className="agent-details-error">
    <InlineNotification kind="error" title="Not found" subtitle={subtitle} hideCloseButton />
    <Button onClick={onBack}>Back to Workforce</Button>
  </div>
);

const ProfileRow = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div className="profile-row">
      <strong>{label}:</strong>
      <span>{value}</span>
    </div>
  ) : null;

const IoTile = ({
  title,
  items,
  tone,
  badge,
}: {
  title: string;
  items?: string[];
  tone: TagColor;
  badge: string;
}) => (
  <Tile className="info-tile">
    <h4>{title}</h4>
    {items && items.length > 0 ? (
      items.map((io, idx) => (
        <div key={idx} className="io-item">
          <div className="io-header">
            <strong>{io}</strong>
            <Tag type={tone} size="sm">
              {badge}
            </Tag>
          </div>
        </div>
      ))
    ) : (
      <p className="member-empty">{NOT_SPECIFIED}</p>
    )}
  </Tile>
);

const AgentTile = ({ agent }: { agent?: AgentMeta }) => {
  if (!agent) return null;
  return (
    <Tile className="info-tile">
      <h4>Agent governance</h4>
      <div className="governance-content">
        <ProfileRow label="Autonomy" value={prettyValue(agent.agentMode)} />
        <ProfileRow label="Assertion level" value={prettyValue(agent.assertionLevel)} />
        <ProfileRow label="Agent role" value={agent.agentRole} />
        <ProfileRow label="Scope" value={agent.scope} />
        <ProfileRow label="Runtime" value={agent.runtime} />
        <ProfileRow label="Tool invocation" value={agent.toolInvocation} />
        <ProfileRow label="Orchestrator" value={agent.orchestrator} />
        <ProfileRow label="Hosting" value={agent.hosting} />
        <ProfileRow label="Knowledge retrieval" value={prettyValue(agent.knowledgeRetrieval)} />
        <ProfileRow
          label="Confidence threshold"
          value={typeof agent.confidenceThreshold === 'number' ? agent.confidenceThreshold.toString() : undefined}
        />
        <ProfileRow label="Escalation path" value={agent.escalationPath} />
        <ProfileRow label="Memory scope" value={prettyValue(agent.memoryScope)} />
        <ProfileRow label="Decision boundary" value={agent.decisionBoundary} />
        {agent.narrative && <p className="member-stage-summary">{agent.narrative}</p>}
      </div>
    </Tile>
  );
};

const ControlsTile = ({ controls }: { controls?: ModelControls }) => {
  if (!controls) return null;
  const tags = controls.regulatoryTags ?? [];
  return (
    <Tile className="info-tile">
      <h4>Controls</h4>
      <div className="governance-content">
        <ProfileRow label="Authentication required" value={controls.authRequired ? 'Yes' : undefined} />
        <ProfileRow label="Data sensitivity" value={prettyValue(controls.dataSensitivity)} />
        <ProfileRow label="Audit logging" value={controls.auditLogging ? 'Enabled' : undefined} />
        {tags.length > 0 && (
          <div className="profile-row">
            <strong>Regulatory tags:</strong>
            <div className="member-chip-row">
              {tags.map((t) => (
                <Tag key={t} type="cyan" size="sm">
                  {t}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </Tile>
  );
};

const DetailsTile = ({ node }: { node?: ModelNode }) => {
  if (!node) return null;
  const rows = [
    ['Purpose', node.purpose],
    ['Capability', node.capability],
    ['Scope', node.scope],
    ['Primary actor', node.primaryActor],
    ['Architecture role', prettyValue(node.architectureRole)],
    ['Channel type', prettyValue(node.channelType)],
    ['Business pillar', node.pillar],
    ['Customer impact', node.customerImpact],
    ['Constraints & assumptions', node.constraintsAssumptions],
  ].filter(([, v]) => v) as [string, string][];
  if (rows.length === 0) return null;
  return (
    <Tile className="info-tile">
      <h4>Details</h4>
      <div className="governance-content">
        {rows.map(([label, value]) => (
          <ProfileRow key={label} label={label} value={value} />
        ))}
      </div>
    </Tile>
  );
};

const TechTile = ({ node }: { node?: ModelNode }) => {
  if (!node) return null;
  const groups: [string, string[] | undefined][] = [
    ['Technologies', node.technologies],
    ['Referenced technologies', node.referencedTechnologies],
    ['Supporting systems', node.supportingSystems],
    ['Integrations', node.integrations],
  ];
  const present = groups.filter(([, v]) => v && v.length > 0);
  if (present.length === 0) {
    return (
      <Tile className="info-tile">
        <h4>Technology &amp; integrations</h4>
        <p className="member-empty">{NOT_SPECIFIED}</p>
      </Tile>
    );
  }
  return (
    <Tile className="info-tile">
      <h4>Technology &amp; integrations</h4>
      <div className="governance-content">
        {present.map(([label, values]) => (
          <div key={label} className="profile-row">
            <strong>{label}:</strong>
            <div className="member-chip-row">
              {values!.map((v) => (
                <Tag key={v} type="gray" size="sm">
                  {v}
                </Tag>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Tile>
  );
};

// Renders a sub-flow as a Mermaid diagram. mermaid.render works against a
// detached container, so it does not depend on this panel being visible.
const SubflowDiagram = ({ dsl }: { dsl: string }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        if (!mermaid) {
          const mod = await import('mermaid');
          mermaid = mod.default;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
          });
        }
        const id = 'subflow-' + Math.random().toString(36).slice(2);
        const out = await mermaid.render(id, dsl);
        if (!cancelled) setSvg(out.svg);
      } catch (err) {
        console.error('Failed to render sub-process diagram:', err);
        if (!cancelled) setError(true);
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [dsl]);

  if (error) {
    return <p className="member-empty">Could not render the sub-process diagram.</p>;
  }
  if (!svg) {
    return <Loading description="Loading diagram..." withOverlay={false} />;
  }
  return <div className="subflow-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
};

// ---------------------------------------------------------------------------
// Top-level member detail.
// ---------------------------------------------------------------------------

const MemberDetail = ({
  memberId,
  workforces,
  workforceWarning,
  modelWarning,
  getModelNode,
  getSubflow,
}: {
  memberId: string;
  workforces: Workforce[];
  workforceWarning?: string | null;
  modelWarning?: string | null;
  getModelNode: (id: string) => ModelNode | undefined;
  getSubflow: (id: string) => Subflow | undefined;
}) => {
  const navigate = useNavigate();
  const found = findMember(workforces, memberId);
  const model = getModelNode(memberId);
  const subflow = getSubflow(memberId);

  const backToWorkforce = () => navigate('/agents?view=workforce');
  const goToMember = (id: string) => navigate(`/agents/workforce/${id}`);
  const goToStep = (stepId: string) => navigate(`/agents/workforce/${memberId}/step/${stepId}`);

  if (!found && !model) {
    return (
      <NotFound
        subtitle="The requested Digital Workforce member could not be found."
        onBack={backToWorkforce}
      />
    );
  }

  const kind: WorkforceMemberKind = model ? stepTypeToKind(model.stepType) : found!.member.kind;
  const meta = kindMeta[kind];
  const MetaIcon = meta.Icon;
  const name = model?.name || found!.member.name;
  const description = model?.description || found?.member.description || '';
  const capability = model?.capability || found?.member.capability;
  const assertion = model?.agent?.assertionLevel;

  const isOrchestrator = kind === 'orchestrator';
  const coordinated: CoordinatedWorker[] =
    isOrchestrator && found ? buildCoordinationTree(workforces, found.stage) : [];
  const directAgents: WorkforceMember[] = isOrchestrator && found ? stageAgents(found.stage) : [];
  const { upstream, downstream } = getMemberConnections(memberId, workforces[0]);
  const workforceName = found?.workforce.name || 'Claims Processing Workforce';

  const renderMemberChip = (m: WorkforceMember) => {
    const cm = kindMeta[m.kind];
    const CIcon = cm.Icon;
    return (
      <button key={m.id} type="button" className="member-link-chip" onClick={() => goToMember(m.id)}>
        <CIcon size={14} />
        <span>{m.name}</span>
        <Tag type={cm.color} size="sm">
          {cm.label}
        </Tag>
        <ArrowUpRight size={14} />
      </button>
    );
  };

  const renderWorkerTree = (nodes: CoordinatedWorker[]) => (
    <div className="wf-tree">
      {nodes.map((node) => (
        <div className="wf-tree-worker" key={node.stage.id}>
          <button
            type="button"
            className="member-link-chip wf-worker-head"
            onClick={() => goToMember(node.orchestrator.id)}
          >
            <FlowData size={16} />
            <span>{node.orchestrator.name}</span>
            <Tag type="purple" size="sm">
              Digital Worker
            </Tag>
            <ArrowUpRight size={14} />
          </button>
          <p className="wf-tree-summary">{node.stage.summary}</p>
          {node.agents.length > 0 && (
            <div className="member-chip-row wf-tree-agents">{node.agents.map(renderMemberChip)}</div>
          )}
          {node.children.length > 0 && renderWorkerTree(node.children)}
        </div>
      ))}
    </div>
  );

  const renderConnections = (items: FlowConnection[], empty: string) => {
    if (items.length === 0) {
      return <p className="member-empty">{empty}</p>;
    }
    return (
      <div className="member-chip-row">
        {items.map((c) =>
          c.isMember ? (
            <button
              key={c.id}
              type="button"
              className="member-link-chip"
              onClick={() => goToMember(c.id)}
            >
              <span>{c.name}</span>
              <ArrowUpRight size={14} />
            </button>
          ) : (
            <span key={c.id} className="member-link-chip is-static">
              {c.name}
            </span>
          ),
        )}
      </div>
    );
  };

  const subSteps = subflow ? subflowOrder(subflow) : [];

  return (
    <div className="agent-details-page workforce-member-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <PageHeader
            back={{ label: 'Back to Workforce', onClick: backToWorkforce }}
            eyebrow={
              <>
                {workforceName}
                {found && (
                  <>
                    {' '}
                    <span aria-hidden="true">/</span> {found.stage.name}
                  </>
                )}
              </>
            }
            icon={<MetaIcon size={28} />}
            title={name}
            subtitle={description || undefined}
            tags={
              <>
                <Tag type={meta.color} size="md">
                  {meta.label}
                </Tag>
                {capability && (
                  <Tag type="magenta" size="md">
                    {capability}
                  </Tag>
                )}
                {assertion && (
                  <Tag type={assertionColor[assertion] || 'gray'} size="md">
                    {prettyValue(assertion)}
                  </Tag>
                )}
              </>
            }
          />
        </Column>

        {workforceWarning && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="Showing archived workforce data"
              subtitle={workforceWarning}
            />
          </Column>
        )}

        {modelWarning && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="Showing archived process model"
              subtitle={modelWarning}
            />
          </Column>
        )}
 
        <Column lg={16} md={8} sm={4}>
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title="Process blueprint"
            subtitle="Profile derived from the exported claims process model. This is a design blueprint, not a live deployment."
          />
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Member details tabs">
              <Tab>Overview</Tab>
              <Tab>Inputs &amp; Outputs</Tab>
              <Tab>Governance</Tab>
              {subflow && <Tab>Sub-process</Tab>}
              <Tab>Process connections</Tab>
            </TabList>
            <TabPanels>
              {/* Overview */}
              <TabPanel>
                <div className="tab-content">
                  {coordinated.length > 0 && (
                    <Tile className="info-tile">
                      <h4>Coordinated Digital Workers</h4>
                      <p className="member-stage-summary">
                        {name} orchestrates the following Digital Workers, each running its own
                        specialist agents and human steps.
                      </p>
                      {renderWorkerTree(coordinated)}
                    </Tile>
                  )}

                  {directAgents.length > 0 && (
                    <Tile className="info-tile">
                      <h4>
                        {coordinated.length > 0
                          ? 'Runs directly in this stage'
                          : 'Agents in this Digital Worker'}
                      </h4>
                      <div className="member-chip-row">{directAgents.map(renderMemberChip)}</div>
                    </Tile>
                  )}

                  <DetailsTile node={model} />

                  {found && (
                    <Tile className="info-tile">
                      <h4>Role in the process</h4>
                      <p className="member-stage-summary">
                        <strong>{found.stage.name}</strong> — {found.stage.summary}
                      </p>
                      <p className="member-stage-summary">
                        <strong>Hands off:</strong> {found.stage.handoff}
                      </p>
                    </Tile>
                  )}
                </div>
              </TabPanel>

              {/* Inputs & Outputs */}
              <TabPanel>
                <div className="tab-content">
                  <IoTile title="Inputs" items={model?.dataIn} tone="blue" badge="in" />
                  <IoTile title="Outputs" items={model?.dataOut} tone="green" badge="out" />
                </div>
              </TabPanel>

              {/* Governance */}
              <TabPanel>
                <div className="tab-content">
                  {model?.agent || model?.controls ? (
                    <>
                      <AgentTile agent={model?.agent} />
                      <ControlsTile controls={model?.controls} />
                    </>
                  ) : (
                    <Tile className="info-tile">
                      <h4>Governance</h4>
                      <p className="member-empty">
                        No agent governance or controls are defined for this step in the exported
                        model.
                      </p>
                    </Tile>
                  )}
                </div>
              </TabPanel>

              {/* Sub-process */}
              {subflow && (
                <TabPanel>
                  <div className="tab-content">
                    <Tile className="info-tile">
                      <h4>Sub-process flow</h4>
                      <p className="member-stage-summary">
                        {name} expands into a coordinated sub-process. Select any step to inspect its
                        agent metadata, inputs and controls.
                      </p>
                      <SubflowDiagram dsl={buildSubflowMermaid(subflow)} />
                    </Tile>

                    <Tile className="info-tile">
                      <h4>Steps ({subSteps.length})</h4>
                      <div className="member-chip-row">
                        {subSteps.map((s) => {
                          const sk = kindMeta[stepTypeToKind(s.stepType)];
                          const SIcon = sk.Icon;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              className="member-link-chip"
                              onClick={() => goToStep(s.id)}
                            >
                              <SIcon size={14} />
                              <span>{s.name}</span>
                              <Tag type={sk.color} size="sm">
                                {sk.label}
                              </Tag>
                              <ArrowUpRight size={14} />
                            </button>
                          );
                        })}
                      </div>
                    </Tile>
                  </div>
                </TabPanel>
              )}

              {/* Process connections */}
              <TabPanel>
                <div className="tab-content">
                  <Tile className="info-tile">
                    <h4>
                      <ArrowRight size={16} /> Receives from
                    </h4>
                    {renderConnections(upstream, 'Entry point — this member starts its part of the flow.')}
                  </Tile>

                  <Tile className="info-tile">
                    <h4>
                      <ArrowRight size={16} /> Hands off to
                    </h4>
                    {renderConnections(downstream, 'Terminal step — this member does not hand off further.')}
                  </Tile>
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-step detail (a node inside a sub-process). Purely model-driven.
// ---------------------------------------------------------------------------

const SubStepDetail = ({
  parentId,
  stepId,
  workforces,
  workforceWarning,
  modelWarning,
  getModelNode,
  getSubflow,
  getSubflowNode,
}: {
  parentId: string;
  stepId: string;
  workforces: Workforce[];
  workforceWarning?: string | null;
  modelWarning?: string | null;
  getModelNode: (id: string) => ModelNode | undefined;
  getSubflow: (id: string) => Subflow | undefined;
  getSubflowNode: (subflowId: string, nodeId: string) => ModelNode | undefined;
}) => {
  const navigate = useNavigate();
  const subflow: Subflow | undefined = getSubflow(parentId);
  const step = getSubflowNode(parentId, stepId);
  const parentNode = getModelNode(parentId);
  const parentMember = findMember(workforces, parentId);
  const parentName = parentNode?.name || parentMember?.member.name || parentId;

  const backToWorkforce = () => navigate('/agents?view=workforce');
  const backToParent = () => navigate(`/agents/workforce/${parentId}`);

  if (!subflow || !step) {
    return (
      <NotFound
        subtitle="The requested sub-process step could not be found."
        onBack={backToWorkforce}
      />
    );
  }

  const kind = stepTypeToKind(step.stepType);
  const meta = kindMeta[kind];
  const MetaIcon = meta.Icon;
  const assertion = step.agent?.assertionLevel;

  return (
    <div className="agent-details-page workforce-member-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <PageHeader
            back={{ label: `Back to ${parentName}`, onClick: backToParent }}
            eyebrow={
              <>
                <button type="button" className="breadcrumb-link" onClick={backToWorkforce}>
                  Workforce
                </button>{' '}
                <span aria-hidden="true">/</span>{' '}
                <button type="button" className="breadcrumb-link" onClick={backToParent}>
                  {parentName}
                </button>{' '}
                <span aria-hidden="true">/</span> {step.name}
              </>
            }
            icon={<MetaIcon size={28} />}
            title={step.name}
            subtitle={step.description || undefined}
            tags={
              <>
                <Tag type={meta.color} size="md">
                  {meta.label}
                </Tag>
                {step.capability && (
                  <Tag type="magenta" size="md">
                    {step.capability}
                  </Tag>
                )}
                {assertion && (
                  <Tag type={assertionColor[assertion] || 'gray'} size="md">
                    {prettyValue(assertion)}
                  </Tag>
                )}
              </>
            }
          />
        </Column>

        {workforceWarning && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="Showing archived workforce data"
              subtitle={workforceWarning}
            />
          </Column>
        )}

        {modelWarning && (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title="Showing archived process model"
              subtitle={modelWarning}
            />
          </Column>
        )}
 
        <Column lg={16} md={8} sm={4}>
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={`Step within ${parentName}`}
            subtitle="Sub-process step derived from the exported claims process model."
          />
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Step details tabs">
              <Tab>Overview</Tab>
              {step.agent && <Tab>Agent</Tab>}
              <Tab>Inputs &amp; Outputs</Tab>
              <Tab>Technology</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <div className="tab-content">
                  <DetailsTile node={step} />
                  <ControlsTile controls={step.controls} />
                  {!step.description &&
                    !step.purpose &&
                    !step.scope &&
                    !step.capability &&
                    !step.primaryActor &&
                    !step.controls && (
                      <Tile className="info-tile">
                        <h4>Overview</h4>
                        <p className="member-empty">{NOT_SPECIFIED}</p>
                      </Tile>
                    )}
                </div>
              </TabPanel>

              {step.agent && (
                <TabPanel>
                  <div className="tab-content">
                    <AgentTile agent={step.agent} />
                  </div>
                </TabPanel>
              )}

              <TabPanel>
                <div className="tab-content">
                  <IoTile title="Inputs" items={step.dataIn} tone="blue" badge="in" />
                  <IoTile title="Outputs" items={step.dataOut} tone="green" badge="out" />
                </div>
              </TabPanel>

              <TabPanel>
                <div className="tab-content">
                  <TechTile node={step} />
                </div>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
};

export const WorkforceMemberDetailsPage = () => {
  const { memberId, stepId } = useParams<{ memberId: string; stepId: string }>();
  const { workforces, loading, error, usingFallback } = useWorkforces();
  const {
    getModelNode,
    getSubflow,
    getSubflowNode,
    loading: modelLoading,
    error: modelError,
    usingFallback: modelUsingFallback,
  } = useClaimsModel();
  const workforceWarning = usingFallback ? error : null;
  const modelWarning = modelUsingFallback ? modelError : null;

  if (!memberId) {
    return null;
  }

  if ((loading && workforces.length === 0) || modelLoading) {
    return (
      <Loading
        description={loading && workforces.length === 0 ? 'Loading workforce...' : 'Loading process model...'}
        withOverlay={false}
      />
    );
  }

  if (stepId) {
    return (
      <SubStepDetail
        parentId={memberId}
        stepId={stepId}
        workforces={workforces}
        workforceWarning={workforceWarning}
        modelWarning={modelWarning}
        getModelNode={getModelNode}
        getSubflow={getSubflow}
        getSubflowNode={getSubflowNode}
      />
    );
  }
  return (
    <MemberDetail
      memberId={memberId}
      workforces={workforces}
      workforceWarning={workforceWarning}
      modelWarning={modelWarning}
      getModelNode={getModelNode}
      getSubflow={getSubflow}
    />
  );
};
