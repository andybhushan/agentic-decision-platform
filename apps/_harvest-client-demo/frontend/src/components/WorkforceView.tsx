import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tile, Tag, Button, Tooltip, Dropdown, Loading, InlineNotification } from '@carbon/react';
import {
  Play,
  Reset,
  ArrowRight,
  Bot,
  User,
  FlowData,
  Rule,
  DataBase,
  Devices,
  CheckmarkFilled,
  PlayFilledAlt,
  FlowConnection,
} from '@carbon/icons-react';
import { WorkforceFlowModal } from './WorkforceFlowModal';
import { useWorkforces } from '../hooks/useWorkforces';
import type { Workforce, WorkforceMember, WorkforceMemberKind, WorkforceStage } from '../data/claimsWorkforce.seed';
import {
  simulateClaim,
  outcomeTagType,
  stageStatusTagType,
  type ClaimOutcome,
  type ClaimSimulation,
} from '../data/claimSimulation';
import { api } from '../services/api';
import type { Claim } from '../types';
import './WorkforceView.scss';

type TagType = 'red' | 'magenta' | 'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'gray' | 'cool-gray' | 'warm-gray' | 'high-contrast' | 'outline';
type IconComponent = typeof Bot;

const kindMeta: Record<WorkforceMemberKind, { label: string; color: TagType; Icon: IconComponent }> = {
  orchestrator: { label: 'Digital Worker', color: 'purple', Icon: FlowData },
  agent: { label: 'Agent', color: 'blue', Icon: Bot },
  human: { label: 'Human', color: 'teal', Icon: User },
  rules: { label: 'Rules', color: 'cyan', Icon: Rule },
  system: { label: 'System', color: 'gray', Icon: DataBase },
  channel: { label: 'Channel', color: 'green', Icon: Devices },
};

const STEP_MS = 900;

export const WorkforceView = () => {
  const navigate = useNavigate();
  const { workforces, loading: workforceLoading, error: workforceError, usingFallback } = useWorkforces();
  const [selectedId, setSelectedId] = useState<string>('');
  const resolvedSelectedId = workforces.some((w) => w.id === selectedId)
    ? selectedId
    : workforces[0]?.id ?? '';
  const workforce: Workforce | undefined =
    workforces.find((w) => w.id === resolvedSelectedId) ?? workforces[0];

  // Real claim records to push through the mock process.
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');

  // End-to-end flow diagram modal.
  const [flowOpen, setFlowOpen] = useState(false);

  // Simulation state.
  const [mode, setMode] = useState<'idle' | 'single' | 'batch'>('idle');
  const [activeStage, setActiveStage] = useState<number>(-1);
  const [running, setRunning] = useState(false);
  const [singleSim, setSingleSim] = useState<ClaimSimulation | null>(null);
  const [batchRows, setBatchRows] = useState<ClaimSimulation[]>([]);
  const [batchRevealed, setBatchRevealed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getClaims()
      .then((data) => {
        if (cancelled) return;
        setClaims(data);
        setSelectedClaimId((prev) => prev || data[0]?.id || '');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setClaimsError(err instanceof Error ? err.message : 'Failed to load claims');
      })
      .finally(() => {
        if (!cancelled) setClaimsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClaim = useMemo(
    () => claims.find((c) => c.id === selectedClaimId),
    [claims, selectedClaimId],
  );

  const resetSimulation = () => {
    setRunning(false);
    setMode('idle');
    setActiveStage(-1);
    setSingleSim(null);
    setBatchRows([]);
    setBatchRevealed(0);
  };

  // Push the selected claim through the process, revealing one stage at a time.
  const runSingle = () => {
    if (!workforce || !selectedClaim || running) return;
    const sim = simulateClaim(selectedClaim, workforce);
    setSingleSim(sim);
    setBatchRows([]);
    setMode('single');
    setRunning(true);
    setActiveStage(-1);

    let i = 0;
    const tick = () => {
      setActiveStage(i);
      i += 1;
      if (i < workforce.stages.length) {
        window.setTimeout(tick, STEP_MS);
      } else {
        window.setTimeout(() => setRunning(false), STEP_MS);
      }
    };
    tick();
  };

  // Push all claims through and reveal the results table row by row.
  const runBatch = () => {
    if (!workforce || !claims.length || running) return;
    const sims = claims.map((claim) => simulateClaim(claim, workforce));
    setBatchRows(sims);
    setSingleSim(null);
    setActiveStage(-1);
    setMode('batch');
    setRunning(true);
    setBatchRevealed(0);

    let i = 0;
    const tick = () => {
      i += 1;
      setBatchRevealed(i);
      if (i < sims.length) {
        window.setTimeout(tick, 220);
      } else {
        setRunning(false);
      }
    };
    tick();
  };

  if (workforceLoading && workforces.length === 0) {
    return (
      <Tile className="workforce-empty">
        <Loading small withOverlay={false} description="Loading workforces" />
      </Tile>
    );
  }

  if (!workforce) {
    return (
      <Tile className="workforce-empty">
        <p>No workforces are defined yet.</p>
      </Tile>
    );
  }

  const completedCount =
    mode === 'single' && (running || activeStage >= 0) ? activeStage + 1 : 0;

  const batchSummary: Record<string, number> = {};
  batchRows.slice(0, batchRevealed).forEach((row) => {
    batchSummary[row.outcome] = (batchSummary[row.outcome] ?? 0) + 1;
  });

  // Two-level layout: stages coordinated by another are shown in a sub-row
  // under their orchestrator, not as peers in the flat chain.
  const coordinatedIds = new Set(workforce.stages.flatMap(s => s.coordinates ?? []));
  const stageIndexMap = new Map<string, number>(workforce.stages.map((s, i) => [s.id, i]));
  const topStages = workforce.stages.filter(s => !coordinatedIds.has(s.id));
  const orchestratedGroups = workforce.stages
    .filter(s => (s.coordinates ?? []).length > 0)
    .map(s => ({
      orchestrator: s,
      orchestratorIdx: stageIndexMap.get(s.id) ?? 0,
      children: (s.coordinates ?? [])
        .map(id => workforce.stages.find(st => st.id === id))
        .filter((x): x is WorkforceStage => !!x),
    }));

  const renderStage = (stage: WorkforceStage, idx: number) => {
    const isActive = mode === 'single' && running && activeStage === idx;
    const isDone = mode === 'single' && activeStage >= idx;
    const orchestrator = stage.members.find(m => m.kind === 'orchestrator');
    const members = stage.members.filter(m => m.kind !== 'orchestrator');
    const result =
      mode === 'single' && singleSim && activeStage >= idx
        ? singleSim.stageResults.find(r => r.stageId === stage.id)
        : undefined;

    return (
      <div key={stage.id} className="workforce-stage-wrap">
        <Tile
          className={`workforce-stage${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
        >
          <div className="stage-header">
            <span className="stage-index">{idx + 1}</span>
            {orchestrator ? (
              <button
                type="button"
                className="stage-title-button"
                onClick={() => navigate(`/agents/workforce/${orchestrator.id}`)}
                title={`View ${orchestrator.name}`}
              >
                <FlowData size={18} />
                <h4>{stage.name}</h4>
              </button>
            ) : (
              <>
                <FlowData size={18} />
                <h4>{stage.name}</h4>
              </>
            )}
            {isDone && <CheckmarkFilled size={16} className="stage-done-icon" />}
            {orchestrator?.capability && (
              <Tag type="purple" size="sm">
                {orchestrator.capability}
              </Tag>
            )}
          </div>

          <p className="stage-summary">{stage.summary}</p>

          {result && (
            <div className={`stage-result status-${result.status}`}>
              <Tag type={stageStatusTagType(result.status) as TagType} size="sm">
                {result.headline}
              </Tag>
              <span className="stage-result-detail">{result.detail}</span>
            </div>
          )}

          {(stage.coordinates?.length ?? 0) > 0 && (
            <div className="stage-manages-hint">
              <FlowConnection size={14} />
              <span>Manages {stage.coordinates!.length} Digital Workers below</span>
            </div>
          )}

          <div className="stage-members">
            {members.map((m: WorkforceMember) => {
              const meta = kindMeta[m.kind];
              const Icon = meta.Icon;
              const handleClick = () => {
                if (m.kind === 'channel') {
                  navigate(`/agents/workforce/channel/${m.id}`);
                } else {
                  navigate(`/agents/workforce/${m.id}`);
                }
              };
              return (
                <Tooltip key={m.id} label={m.role} align="bottom-end">
                  <button
                    className={`member-chip member-${m.kind}`}
                    type="button"
                    onClick={handleClick}
                  >
                    <Icon size={14} />
                    <span>{m.name}</span>
                    <Tag type={meta.color} size="sm">
                      {meta.label}
                    </Tag>
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div className="stage-handoff">
            <ArrowRight size={14} />
            <span>{stage.handoff}</span>
          </div>
        </Tile>
      </div>
    );
  };

  const renderConnector = (isDone: boolean) => (
    <div className={`stage-connector${isDone ? ' is-done' : ''}`}>
      <ArrowRight size={20} />
    </div>
  );

  const renderEnd = (isDone: boolean) => (
    <div className={`workforce-end${isDone ? ' is-done' : ''}`} title="End of process">
      <span className="end-line" />
      <span className="end-node" />
      <span className="end-label">End</span>
    </div>
  );

  return (
    <div className="workforce-view">
      <div className="workforce-toolbar">
        <div className="workforce-select">
          {workforces.map((w) => (
            <Button
              key={w.id}
              size="sm"
              kind={w.id === workforce.id ? 'primary' : 'tertiary'}
              onClick={() => {
                setSelectedId(w.id);
                resetSimulation();
              }}
            >
              {w.name}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          kind="tertiary"
          renderIcon={FlowConnection}
          onClick={() => setFlowOpen(true)}
        >
          View end-to-end flow
        </Button>
      </div>

      <WorkforceFlowModal
        open={flowOpen}
        onClose={() => setFlowOpen(false)}
        title={`${workforce.name} — End-to-end flow`}
        outcome={workforce.outcome}
        workforce={workforce}
      />

      <Tile className="workforce-summary">
        <div className="workforce-summary-head">
          <h3>{workforce.name}</h3>
          <Tag type="purple" size="sm">
            {workforce.vertical}
          </Tag>
          <Tag type="blue" size="sm">
            {workforce.stages.length} Digital Workers
          </Tag>
        </div>
        <p className="workforce-description">{workforce.description}</p>
        <p className="workforce-outcome">
          <strong>End-to-end outcome:</strong> {workforce.outcome}
        </p>

        {usingFallback && workforceError && (
          <InlineNotification
            kind="warning"
            lowContrast
            title="Showing archived workforce data"
            subtitle={workforceError}
            hideCloseButton
          />
        )}

        {claimsError && (
          <InlineNotification
            kind="error"
            lowContrast
            title="Could not load claims"
            subtitle={claimsError}
            hideCloseButton
          />
        )}

        {/* Drive the process with real claim records. */}
        <div className="workforce-controls">
          {claimsLoading ? (
            <Loading small withOverlay={false} description="Loading claims" />
          ) : (
            <>
              <Dropdown
                id="claim-picker"
                className="claim-picker"
                size="sm"
                titleText="Claim to process"
                label="Select a claim"
                items={claims}
                selectedItem={selectedClaim ?? null}
                itemToString={(c: Claim | null) =>
                  c ? `${c.id} — ${c.claimantName} (${c.incidentType})` : ''
                }
                onChange={({ selectedItem }: { selectedItem: Claim | null }) =>
                  selectedItem && setSelectedClaimId(selectedItem.id)
                }
                disabled={running}
              />
              <div className="workforce-actions">
                <Button
                  size="sm"
                  kind="primary"
                  renderIcon={Play}
                  onClick={runSingle}
                  disabled={running || !selectedClaim}
                >
                  {running && mode === 'single' ? 'Running…' : 'Run claim'}
                </Button>
                <Button
                  size="sm"
                  kind="tertiary"
                  renderIcon={PlayFilledAlt}
                  onClick={runBatch}
                  disabled={running || !claims.length}
                >
                  {running && mode === 'batch'
                    ? 'Running…'
                    : `Run all ${claims.length}`}
                </Button>
                <Button
                  size="sm"
                  kind="ghost"
                  renderIcon={Reset}
                  onClick={resetSimulation}
                  disabled={mode === 'idle' && !running}
                >
                  Reset
                </Button>
              </div>
            </>
          )}
        </div>

        {mode === 'single' && singleSim && (
          <p className="workforce-progress">
            {singleSim.claimId} • processed through {completedCount} of {workforce.stages.length}{' '}
            stages
            {completedCount === workforce.stages.length ? (
              <>
                {' '}— outcome:{' '}
                <Tag type={outcomeTagType(singleSim.outcome) as TagType} size="sm">
                  {singleSim.outcome}
                </Tag>
                {singleSim.amount ? ` (${singleSim.amount})` : ''}
              </>
            ) : (
              '…'
            )}
          </p>
        )}

        {mode === 'batch' && batchRows.length > 0 && (
          <p className="workforce-progress">
            Processed {batchRevealed} of {batchRows.length} claims —{' '}
            {Object.entries(batchSummary).map(([k, v]) => (
              <Tag key={k} type={outcomeTagType(k as ClaimOutcome) as TagType} size="sm">
                {v} {k}
              </Tag>
            ))}
          </p>
        )}
      </Tile>

      {/* Batch results table. */}
      {mode === 'batch' && batchRows.length > 0 && (
        <Tile className="workforce-batch">
          <table className="batch-table">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Claimant</th>
                <th>Type</th>
                {workforce.stages.map((s) => (
                  <th key={s.id} className="stage-col">
                    {s.name.replace(' Digital Worker', '').replace(' Agent', '')}
                  </th>
                ))}
                <th>Outcome</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {batchRows.slice(0, batchRevealed).map((row) => (
                <tr key={row.claimId}>
                  <td className="mono">{row.claimId}</td>
                  <td>{row.claimantName}</td>
                  <td>{row.incidentType}</td>
                  {row.stageResults.map((sr) => (
                    <td key={sr.stageId} className="stage-col">
                      <Tooltip label={`${sr.stageName}: ${sr.headline}`} align="top">
                        <span className={`status-dot status-${sr.status}`} aria-label={sr.status} />
                      </Tooltip>
                    </td>
                  ))}
                  <td>
                    <Tag type={outcomeTagType(row.outcome) as TagType} size="sm">
                      {row.outcome}
                    </Tag>
                  </td>
                  <td className="mono">{row.amount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
      )}

      <div className="workforce-flow">
        {/* Top row: stages not coordinated by any other stage (Intake + CDW) */}
        <div className="workforce-main-row">
          {topStages.map((stage, rowIdx) => {
            const idx = stageIndexMap.get(stage.id) ?? 0;
            const showConnector = rowIdx < topStages.length - 1;
            const isDone = mode === 'single' && activeStage >= idx;
            return (
              <Fragment key={stage.id}>
                {renderStage(stage, idx)}
                {showConnector && renderConnector(isDone)}
              </Fragment>
            );
          })}
          {orchestratedGroups.length === 0 && (() => {
            const last = topStages[topStages.length - 1];
            const lastIdx = last ? (stageIndexMap.get(last.id) ?? 0) : 0;
            return renderEnd(mode === 'single' && activeStage >= lastIdx);
          })()}
        </div>

        {/* Orchestrated sub-rows: shown below the orchestrating stage */}
        {orchestratedGroups.map(group => {
          const orchIsDone = mode === 'single' && activeStage >= group.orchestratorIdx;
          const lastChild = group.children[group.children.length - 1];
          const lastChildIdx = lastChild ? (stageIndexMap.get(lastChild.id) ?? 0) : 0;
          const allDone = mode === 'single' && activeStage >= lastChildIdx;
          return (
            <div key={group.orchestrator.id} className="workforce-orchestrated">
              <div className={`workforce-orchestrated-header${orchIsDone ? ' is-done' : ''}`}>
                <FlowConnection size={14} />
                <span>
                  Orchestrated by <strong>{group.orchestrator.name}</strong>
                </span>
              </div>
              <div className="workforce-orchestrated-row">
                {group.children.map((stage, rowIdx) => {
                  const idx = stageIndexMap.get(stage.id) ?? 0;
                  const isLast = rowIdx === group.children.length - 1;
                  const isDone = mode === 'single' && activeStage >= idx;
                  return (
                    <Fragment key={stage.id}>
                      {renderStage(stage, idx)}
                      {!isLast && renderConnector(isDone)}
                    </Fragment>
                  );
                })}
                {renderEnd(allDone)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Made with Bob
