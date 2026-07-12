import { useEffect, useMemo, useState } from 'react';
import {
  Grid,
  Column,
  Tile,
  Dropdown,
  InlineNotification,
  Loading,
  Tag,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { Security, Collaborate, DataVis_1, Warning } from '@carbon/icons-react';
import PageHeader from '../components/layout/PageHeader';
import {
  api,
  type GovernanceAuditLogResponse,
  type GovernanceRiskMatrixResponse,
  type GovernanceSummary,
} from '../services/api';
import './GovernanceDashboardPage.scss';

const WINDOW_OPTIONS = [
  { id: '1', text: 'Last 24 hours', value: 1 },
  { id: '7', text: 'Last 7 days', value: 7 },
  { id: '30', text: 'Last 30 days', value: 30 },
];

const EVENT_LABELS: Record<GovernanceAuditLogResponse['events'][number]['eventType'], string> = {
  policy_violation: 'Policy Violation',
  governance_override: 'Governance Override',
  runtime_error: 'Runtime Error',
  human_escalation: 'Human Escalation',
  tool_failure: 'Tool Failure',
};

const EVENT_TAGS: Record<GovernanceAuditLogResponse['events'][number]['severity'], 'red' | 'magenta' | 'warm-gray'> = {
  critical: 'red',
  high: 'magenta',
  medium: 'warm-gray',
};

const fmtPct = (value: number | null) => (typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—');
const fmtNumber = (value: number | null) => (typeof value === 'number'
  ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
  : '—');
const fmtUsd = (value: number | null) => (typeof value === 'number'
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value)
  : '—');
const fmtDateTime = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

const MetricCard = ({ label, value, helper, tone = 'neutral' }: {
  label: string;
  value: string;
  helper: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
}) => (
  <Tile className={`governance-metric-card tone-${tone}`}>
    <p className="metric-label">{label}</p>
    <h3>{value}</h3>
    <p className="metric-helper">{helper}</p>
  </Tile>
);

export const GovernanceDashboardPage = () => {
  const [selectedWindow, setSelectedWindow] = useState(WINDOW_OPTIONS[2]);
  const [summary, setSummary] = useState<GovernanceSummary | null>(null);
  const [riskMatrix, setRiskMatrix] = useState<GovernanceRiskMatrixResponse | null>(null);
  const [auditLog, setAuditLog] = useState<GovernanceAuditLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoState, setDemoState] = useState<{
    enabled: boolean;
    consistencyPassed: boolean | null;
    issues: string[];
  }>({ enabled: false, consistencyPassed: null, issues: [] });
  const [error, setError] = useState('');

  const loadDashboard = async (windowDays: number) => {
    try {
      setLoading(true);
      setError('');
      const [summaryData, matrixData, auditData, statusData] = await Promise.all([
        api.getGovernanceSummary(windowDays),
        api.getGovernanceRiskMatrix(windowDays),
        api.getGovernanceAuditLog(windowDays, 60),
        api.getGovernanceDemoStatus(),
      ]);
      setSummary(summaryData);
      setRiskMatrix(matrixData);
      setAuditLog(auditData);
      setDemoState({
        enabled: statusData.enabled,
        consistencyPassed: statusData.consistency?.passed ?? null,
        issues: statusData.consistency?.issues ?? [],
      });
    } catch (loadError) {
      console.error('Failed to load governance dashboard:', loadError);
      setError('Unable to load governance telemetry. Confirm backend API and telemetry feeds are available.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard(selectedWindow.value);
  }, [selectedWindow.value]);

  const handleLoadDemo = async () => {
    try {
      setDemoBusy(true);
      await api.loadGovernanceDemoData({
        seed: 'governance-demo-seed',
        windowDays: 30,
        interactionsPerAgent: 140,
      });
      await loadDashboard(selectedWindow.value);
    } catch (loadError) {
      console.error('Failed to load governance demo data:', loadError);
      setError('Unable to generate deterministic demo dataset.');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      setDemoBusy(true);
      await api.resetGovernanceDemoData();
      await loadDashboard(selectedWindow.value);
    } catch (resetError) {
      console.error('Failed to reset governance demo data:', resetError);
      setError('Unable to reset governance demo dataset.');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleClearClaimsData = async () => {
    try {
      setDemoBusy(true);
      await api.clearClaimSuitesDemoData();
      await loadDashboard(selectedWindow.value);
    } catch (clearError) {
      console.error('Failed to clear claim suite data:', clearError);
      setError('Unable to clear claims demo data.');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleReimportClaimsData = async () => {
    try {
      setDemoBusy(true);
      await api.reimportClaimSuitesDemoData({
        count: 50,
        seed: 'claims-reimport-default',
        name: 'Claims re-import suite',
      });
      await loadDashboard(selectedWindow.value);
    } catch (reimportError) {
      console.error('Failed to re-import claim suite data:', reimportError);
      setError('Unable to re-import and run claims demo data.');
    } finally {
      setDemoBusy(false);
    }
  };

  const topRiskAgents = useMemo(
    () => (riskMatrix?.agents ?? []).slice(0, 8),
    [riskMatrix],
  );
  const signalIndicators = summary
    ? [
        { id: 'entra', label: 'Entra', connected: summary.externalSignals.entra.enabled, Icon: Security },
        { id: 'a365', label: 'A365', connected: summary.externalSignals.a365.enabled, Icon: Collaborate },
        { id: 'github', label: 'GitHub', connected: summary.externalSignals.github.enabled, Icon: DataVis_1 },
      ]
    : [];

  return (
    <div className="governance-dashboard-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <div className="governance-hero">
            <div className="governance-header-left">
              <PageHeader
                icon={<Security size={20} />}
                title="Governance Dashboard"
                subtitle="Cross-agent compliance, runtime risk, and human-oversight telemetry in one operational view."
              />
              {!!signalIndicators.length && (
                <div className="governance-signal-icons" aria-label="Connected signal sources">
                  {signalIndicators.map(({ id, label, connected, Icon }) => (
                    <span
                      key={id}
                      className={`governance-signal-icon ${connected ? 'is-connected' : 'is-disconnected'}`}
                      title={`${label}: ${connected ? 'connected' : 'not connected'}`}
                    >
                      <Icon size={16} />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="governance-controls">
              <div className="governance-demo-controls">
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={demoBusy}
                  onClick={() => void handleLoadDemo()}
                >
                  Load demo data
                </Button>
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={demoBusy}
                  onClick={() => void handleResetDemo()}
                >
                  Reset
                </Button>
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={demoBusy}
                  onClick={() => void handleClearClaimsData()}
                >
                  Clear claims data
                </Button>
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={demoBusy}
                  onClick={() => void handleReimportClaimsData()}
                >
                  Re-import & run all claims agents
                </Button>
              </div>
              <Dropdown
                id="governance-window"
                titleText="Reporting window"
                label="Select reporting window"
                items={WINDOW_OPTIONS}
                selectedItem={selectedWindow}
                itemToString={(item) => item?.text || ''}
                onChange={({ selectedItem }) => {
                  if (selectedItem) setSelectedWindow(selectedItem);
                }}
              />
            </div>
          </div>
        </Column>

        {!loading && demoState.enabled ? (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind={demoState.consistencyPassed === false ? 'warning' : 'success'}
              lowContrast
              title={demoState.consistencyPassed === false ? 'Demo data loaded with consistency warnings' : 'Deterministic demo data loaded'}
              subtitle={
                demoState.consistencyPassed === false
                  ? demoState.issues.join(' · ')
                  : 'All internal consistency checks passed.'
              }
              hideCloseButton
            />
          </Column>
        ) : null}

        {loading ? (
          <Column lg={16} md={8} sm={4}>
            <div className="governance-loading">
              <Loading withOverlay={false} description="Loading governance dashboard" />
            </div>
          </Column>
        ) : null}

        {!loading && error ? (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              kind="error"
              lowContrast
              title="Governance data unavailable"
              subtitle={error}
              hideCloseButton
            />
          </Column>
        ) : null}

        {!loading && !error && summary ? (
          <>
            <Column lg={4} md={4} sm={4}>
              <MetricCard
                label="Policy violation rate"
                value={fmtPct(summary.violationRate)}
                helper={`${summary.policyViolations} violations / ${summary.policyChecks} checks`}
                tone={summary.violationRate !== null && summary.violationRate > 0.05 ? 'critical' : 'positive'}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <MetricCard
                label="Governance override rate"
                value={fmtPct(summary.overrideRate)}
                helper={`${summary.governanceOverrides} overrides`}
                tone={summary.overrideRate !== null && summary.overrideRate > 0.03 ? 'warning' : 'neutral'}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <MetricCard
                label="Escalation rate"
                value={fmtPct(summary.escalationRate)}
                helper={`${summary.escalations} human escalations`}
                tone={summary.escalationRate !== null && summary.escalationRate > 0.1 ? 'warning' : 'neutral'}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <MetricCard
                label="Runtime error rate"
                value={fmtPct(summary.errorRate)}
                helper={`${summary.errorCount} runtime errors`}
                tone={summary.errorRate !== null && summary.errorRate > 0.05 ? 'critical' : 'neutral'}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <MetricCard
                label="Tool failure rate"
                value={fmtPct(summary.toolFailureRate)}
                helper={`${summary.toolFailures} failed calls / ${summary.toolCalls} total`}
                tone={summary.toolFailureRate !== null && summary.toolFailureRate > 0.05 ? 'warning' : 'neutral'}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <MetricCard
                label="Avg duration"
                value={summary.avgDurationMs !== null ? `${fmtNumber(summary.avgDurationMs)} ms` : '—'}
                helper={`${fmtNumber(summary.totalInteractions)} interactions observed`}
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <MetricCard
                label="Avg input/output tokens"
                value={
                  summary.avgInputTokens !== null || summary.avgOutputTokens !== null
                    ? `${fmtNumber(summary.avgInputTokens)} / ${fmtNumber(summary.avgOutputTokens)}`
                    : '—'
                }
                helper="Average tokens per interaction"
              />
            </Column>
            <Column lg={4} md={4} sm={4}>
              <MetricCard
                label="Avg cost per interaction"
                value={fmtUsd(summary.avgEstimatedCostUsd)}
                helper="Estimated model spend"
              />
            </Column>

            {/* Agent Operations Panel */}
            {summary && (
              <Column lg={16} md={8} sm={4}>
                <Tile className="governance-section governance-identity-section">
                  <div className="governance-identity-header">
                    <div className="governance-identity-title">
                      <Collaborate size={20} />
                      <h4>Agent Operations</h4>
                      <span className="governance-identity-org">Live — last {selectedWindow.value}d</span>
                    </div>
                    <Tag type="green">Live</Tag>
                  </div>
                  <div className="governance-identity-metrics">
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Active agents</p>
                      <p className="identity-metric-value">
                        {riskMatrix ? riskMatrix.agents.length : '—'}
                      </p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Interactions ({selectedWindow.value}d)</p>
                      <p className="identity-metric-value">{summary.totalInteractions.toLocaleString()}</p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Escalations</p>
                      <p className={`identity-metric-value ${summary.escalations > 0 ? 'is-warning' : ''}`}>
                        {summary.escalations}
                        {summary.escalations > 0 && <Warning size={16} className="identity-warning-icon" />}
                      </p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Avg response time</p>
                      <p className="identity-metric-value">
                        {summary.avgDurationMs ? `${(summary.avgDurationMs / 1000).toFixed(1)}s` : '—'}
                      </p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Tool calls</p>
                      <p className="identity-metric-value">{summary.toolCalls.toLocaleString()}</p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Policy violations</p>
                      <p className={`identity-metric-value ${summary.policyViolations > 0 ? 'is-warning' : ''}`}>
                        {summary.policyViolations}
                        {summary.policyViolations > 0 && <Warning size={16} className="identity-warning-icon" />}
                      </p>
                    </div>
                  </div>
                </Tile>
              </Column>
            )}

            {/* Agent Health & Risk Panel */}
            {summary && riskMatrix && (
              <Column lg={16} md={8} sm={4}>
                <Tile className="governance-section governance-a365-section">
                  <div className="governance-identity-header">
                    <div className="governance-identity-title">
                      <Security size={20} />
                      <h4>Agent Health &amp; Risk</h4>
                      <span className="governance-identity-org">Live — last {selectedWindow.value}d</span>
                    </div>
                    <Tag type={(summary.errorRate ?? 0) > 0.05 || summary.policyViolations > 0 ? 'red' : 'green'}>
                      {(summary.errorRate ?? 0) > 0.05 || summary.policyViolations > 0 ? 'Attention' : 'Healthy'}
                    </Tag>
                  </div>
                  <div className="governance-identity-metrics">
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Error rate</p>
                      <p className={`identity-metric-value ${(summary.errorRate ?? 0) > 0 ? 'is-warning' : ''}`}>
                        {summary.errorRate !== null ? `${(summary.errorRate * 100).toFixed(1)}%` : '—'}
                        {(summary.errorRate ?? 0) > 0 && <Warning size={16} className="identity-warning-icon" />}
                      </p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Tool failure rate</p>
                      <p className={`identity-metric-value ${(summary.toolFailureRate ?? 0) > 0 ? 'is-warning' : ''}`}>
                        {summary.toolFailureRate !== null ? `${(summary.toolFailureRate * 100).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Escalation rate</p>
                      <p className="identity-metric-value">
                        {summary.escalationRate !== null ? `${(summary.escalationRate * 100).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Highest risk agent</p>
                      <p className={`identity-metric-value ${riskMatrix.agents[0]?.riskScore > 10 ? 'is-warning' : ''}`}>
                        {riskMatrix.agents[0]
                          ? `${riskMatrix.agents[0].agentId.replace('agent_', '').replace(/_/g, ' ')} (${riskMatrix.agents[0].riskScore})`
                          : '—'}
                        {riskMatrix.agents[0]?.riskScore > 10 && <Warning size={16} className="identity-warning-icon" />}
                      </p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Avg input tokens</p>
                      <p className="identity-metric-value">
                        {summary.avgInputTokens ? Math.round(summary.avgInputTokens).toLocaleString() : '—'}
                      </p>
                    </div>
                    <div className="governance-identity-metric">
                      <p className="identity-metric-label">Est. cost ({selectedWindow.value}d)</p>
                      <p className="identity-metric-value">
                        {summary.avgEstimatedCostUsd
                          ? `$${(summary.avgEstimatedCostUsd * summary.totalInteractions).toFixed(2)}`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </Tile>
              </Column>
            )}

            <Column lg={16} md={8} sm={4}>
              <Tile className="governance-section governance-tabbed-section">
                <Tabs>
                  <TabList aria-label="Governance detail tabs" contained>
                    <Tab>Agent telemetry coverage</Tab>
                    <Tab>Audit trail</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <div className="governance-table-scroll">
                        <Table size="sm">
                          <TableHead>
                            <TableRow>
                              <TableHeader>Agent</TableHeader>
                              <TableHeader className="decision-mode-page__num">Interactions</TableHeader>
                              <TableHeader className="decision-mode-page__num">Last seen</TableHeader>
                              <TableHeader className="decision-mode-page__num">Risk</TableHeader>
                              <TableHeader className="decision-mode-page__num">Violations</TableHeader>
                              <TableHeader className="decision-mode-page__num">Error rate</TableHeader>
                              <TableHeader className="decision-mode-page__num">Escalation</TableHeader>
                              <TableHeader className="decision-mode-page__num">Token cost</TableHeader>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {topRiskAgents.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8}>No telemetry data in selected window.</TableCell>
                              </TableRow>
                            ) : (
                              topRiskAgents.map((row) => (
                                <TableRow key={row.agentId}>
                                  <TableCell>{row.agentId}</TableCell>
                                  <TableCell className="decision-mode-page__num">{fmtNumber(row.interactions)}</TableCell>
                                  <TableCell className="decision-mode-page__num">{fmtDateTime(row.latestTs)}</TableCell>
                                  <TableCell className="decision-mode-page__num">{row.riskScore.toFixed(2)}</TableCell>
                                  <TableCell className="decision-mode-page__num">{fmtPct(row.violationRate)}</TableCell>
                                  <TableCell className="decision-mode-page__num">{fmtPct(row.errorRate)}</TableCell>
                                  <TableCell className="decision-mode-page__num">{fmtPct(row.escalationRate)}</TableCell>
                                  <TableCell className="decision-mode-page__num">
                                    {row.totalTokenCostUsd != null ? `$${row.totalTokenCostUsd.toFixed(4)}` : '—'}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabPanel>
                    <TabPanel>
                      <div className="audit-list">
                        {(auditLog?.events ?? []).length === 0 ? (
                          <p className="empty-copy">No governance events captured in this window.</p>
                        ) : (
                          (auditLog?.events ?? []).map((event) => (
                            <div key={event.id} className="audit-item">
                              <div className="audit-item__top">
                                <p className="audit-item__title">{EVENT_LABELS[event.eventType]}</p>
                                <Tag type={EVENT_TAGS[event.severity]}>{event.severity}</Tag>
                              </div>
                              <p className="audit-item__message">{event.message}</p>
                              <p className="audit-item__meta">
                                {fmtDateTime(event.ts)} · Agent {event.agentId}
                                {event.claimId ? ` · Claim ${event.claimId}` : ''}
                                {event.actorId ? ` · Actor ${event.actorId}` : ''}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </Tile>
            </Column>
          </>
        ) : null}
      </Grid>
    </div>
  );
};
