import { useEffect, useState } from 'react';
import {
  Tile,
  Loading,
  InlineNotification,
  Tag,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { Analytics, WarningFilled, CheckmarkFilled } from '@carbon/icons-react';
import { api } from '../services/api';
import './AgentObservabilityTab.scss';

interface RecentInteraction {
  id: string;
  ts: string;
  interactionType: string;
  phase: string | null;
  confidence: number | null;
  escalated: boolean;
  claimId: string | null;
  claimantName: string | null;
  handoffTarget: string | null;
  handoffReason: string | null;
  durationMs: number | null;
  summary: string | null;
  clientIssueFlags: string[];
  decisionPoints: string[];
}

interface InteractionSummary {
  agentId: string;
  total: number;
  avgConfidence: number | null;
  avgRoutingConfidence: number | null;
  avgDurationMs: number | null;
  escalationRate: number | null;
  escalated: number;
  errorCount: number;
  errorRate: number | null;
  avgInputTokens: number | null;
  avgOutputTokens: number | null;
  avgEstimatedCostUsd: number | null;
  policyChecks: number;
  policyViolations: number;
  policyViolationRate: number | null;
  governanceOverrides: number;
  overrideRate: number | null;
  toolCalls: number;
  toolFailures: number;
  toolFailureRate: number | null;
  byType: Record<string, number>;
  byPhase: Record<string, number>;
  latestHandoff: {
    targetName: string | null;
    reason: string | null;
    confidence: number | null;
  } | null;
  recent: RecentInteraction[];
}

interface AgentObservabilityTabProps {
  agentId: string;
}

const NUM_COLS = new Set(['ts', 'duration', 'confidence', 'escalated']);

const tableHeaders = [
  { key: 'ts', header: 'Timestamp' },
  { key: 'interactionType', header: 'Type' },
  { key: 'claim', header: 'Claim' },
  { key: 'handoff', header: 'Handoff' },
  { key: 'decision', header: 'Decision / Why' },
  { key: 'duration', header: 'Duration' },
  { key: 'flags', header: 'Flags' },
  { key: 'confidence', header: 'Confidence' },
  { key: 'escalated', header: 'Escalated' },
];

function pct(val: number | null): string {
  if (val === null) return '—';
  return `${(val * 100).toFixed(1)}%`;
}

function fmtConfidence(val: number | null): string {
  if (val === null) return '—';
  return `${(val * 100).toFixed(0)}%`;
}

function fmtTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return ts;
  }
}

function fmtDuration(durationMs: number | null): string {
  if (durationMs === null) return '—';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function fmtNumber(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

function fmtUsd(value: number | null): string {
  if (value === null) return '—';
  return `$${value.toFixed(4)}`;
}

export const AgentObservabilityTab = ({ agentId }: AgentObservabilityTabProps) => {
  const [summary, setSummary] = useState<InteractionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.getAgentInteractionsSummary(agentId)
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed to load interactions'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [agentId]);

  if (loading) {
    return (
      <div className="observability-loading">
        <Loading description="Loading interactions…" withOverlay={false} small />
      </div>
    );
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        title="Load failed"
        subtitle={error}
        lowContrast
      />
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <div className="observability-empty">
        <Analytics size={48} />
        <h4>No interactions yet</h4>
        <p>Use Test Chat or run a simulation to generate interaction data for this agent.</p>
      </div>
    );
  }

  const topType = Object.entries(summary.byType).sort((a, b) => b[1] - a[1])[0];

  const tableRows = summary.recent.map((i) => ({
    id: i.id,
    ts: fmtTs(i.ts),
    interactionType: i.interactionType,
    claim: i.claimId ?? i.claimantName ?? '—',
    handoff: i.handoffTarget ?? '—',
    decision: [i.handoffReason, i.summary, ...(i.decisionPoints ?? [])].filter(Boolean).slice(0, 2).join(' | ') || '—',
    duration: fmtDuration(i.durationMs),
    flags: i.clientIssueFlags.length ? i.clientIssueFlags.join(', ') : '—',
    confidence: fmtConfidence(i.confidence),
    escalated: i.escalated,
  }));

  return (
    <div className="observability-tab">
      {/* Stat tiles */}
      <div className="observability-stats">
        <Tile className="stat-tile">
          <p className="stat-label">Total Interactions</p>
          <p className="stat-value">{summary.total}</p>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Avg Turn Confidence</p>
          <p className="stat-value">{pct(summary.avgConfidence)}</p>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Avg Handoff Confidence</p>
          <p className="stat-value">{pct(summary.avgRoutingConfidence)}</p>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Avg Latency</p>
          <p className="stat-value">{fmtDuration(summary.avgDurationMs)}</p>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Escalation Rate</p>
          <p className={`stat-value ${summary.escalationRate !== null && summary.escalationRate > 0.1 ? 'stat-warn' : ''}`}>
            {pct(summary.escalationRate)}
          </p>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Policy Violation Rate</p>
          <p className={`stat-value ${summary.policyViolationRate !== null && summary.policyViolationRate > 0.05 ? 'stat-warn' : ''}`}>
            {pct(summary.policyViolationRate)}
          </p>
          <Tag type="gray" size="sm">{summary.policyViolations}/{summary.policyChecks} checks</Tag>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Governance Overrides</p>
          <p className="stat-value">{summary.governanceOverrides}</p>
          <Tag type="purple" size="sm">{pct(summary.overrideRate)} of turns</Tag>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Tool Failure Rate</p>
          <p className={`stat-value ${summary.toolFailureRate !== null && summary.toolFailureRate > 0.05 ? 'stat-warn' : ''}`}>
            {pct(summary.toolFailureRate)}
          </p>
          <Tag type="gray" size="sm">{summary.toolFailures}/{summary.toolCalls} calls</Tag>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Error Rate</p>
          <p className={`stat-value ${summary.errorRate !== null && summary.errorRate > 0.05 ? 'stat-warn' : ''}`}>
            {pct(summary.errorRate)}
          </p>
          <Tag type="gray" size="sm">{summary.errorCount} errors</Tag>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Avg Tokens (In/Out)</p>
          <p className="stat-value">{fmtNumber(summary.avgInputTokens)} / {fmtNumber(summary.avgOutputTokens)}</p>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Avg Cost / Turn</p>
          <p className="stat-value">{fmtUsd(summary.avgEstimatedCostUsd)}</p>
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Latest Handoff</p>
          <p className="stat-value stat-type">{summary.latestHandoff?.targetName ?? '—'}</p>
          {summary.latestHandoff?.reason && <Tag type="blue" size="sm">{summary.latestHandoff.reason}</Tag>}
        </Tile>
        <Tile className="stat-tile">
          <p className="stat-label">Most Common Type</p>
          <p className="stat-value stat-type">{topType ? topType[0] : '—'}</p>
          {topType && <Tag type="blue" size="sm">{topType[1]} calls</Tag>}
        </Tile>
      </div>

      {/* Type breakdown */}
      {Object.keys(summary.byType).length > 0 && (
        <Tile className="breakdown-tile">
          <h5>Interaction Types</h5>
          <div className="breakdown-tags">
            {Object.entries(summary.byType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <Tag key={type} type="gray" size="sm">{type}: {count}</Tag>
              ))}
          </div>
        </Tile>
      )}

      {/* Recent interactions table — no content, metadata only */}
      <Tile className="table-tile">
        <h5>Recent Interactions <span className="table-subtitle">(metadata only — no message content)</span></h5>
        <DataTable rows={tableRows} headers={tableHeaders}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer>
              <Table {...getTableProps()} size="sm">
                <TableHead>
                  <TableRow>
                    {headers.map((header) => {
                      const hProps = getHeaderProps({ header });
                      return (
                        <TableHeader
                          {...hProps}
                          key={header.key}
                          className={[hProps.className, NUM_COLS.has(header.key) ? 'obs-num-col' : ''].filter(Boolean).join(' ')}
                        >
                          {header.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    return (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={NUM_COLS.has(cell.info.header) ? 'obs-num-col' : undefined}
                          >
                            {cell.info.header === 'escalated'
                              ? (cell.value
                                ? <WarningFilled className="escalated-icon" />
                                : <CheckmarkFilled className="ok-icon" />)
                              : cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      </Tile>
    </div>
  );
};
