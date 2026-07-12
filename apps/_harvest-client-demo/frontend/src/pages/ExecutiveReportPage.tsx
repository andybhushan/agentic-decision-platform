import { useMemo, useState } from 'react';
import {
  Grid,
  Column,
  Heading,
  Tile,
  InlineNotification,
  Dropdown,
  Link,
  Tag,
  Loading,
  Button,
} from '@carbon/react';
import { Renew } from '@carbon/icons-react';
import { api } from '../services/api';
import type {
  ExecutiveBlocker,
  ExecutiveHealthStatus,
  ExecutiveMilestoneStatus,
  ExecutiveRisk,
  GitHubExecutiveReport,
} from '../types';
import './ExecutiveReportPage.scss';

const REPORTING_WINDOW_OPTIONS = [
  { id: '7', text: 'Last 7 days', value: 7 },
  { id: '14', text: 'Last 14 days', value: 14 },
  { id: '30', text: 'Last 30 days', value: 30 },
];

const getStatusTagType = (status: ExecutiveHealthStatus) => {
  switch (status) {
    case 'critical':
      return 'red';
    case 'at-risk':
      return 'magenta';
    case 'on-track':
    default:
      return 'green';
  }
};

const formatDate = (value?: string) => {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const PriorityList = ({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: Array<ExecutiveBlocker | ExecutiveRisk>;
  emptyMessage: string;
}) => (
  <Tile className="report-section priority-section">
    <div className="section-header">
      <Heading className="section-title">{title}</Heading>
    </div>

    {items.length === 0 ? (
      <p className="empty-copy">{emptyMessage}</p>
    ) : (
      <div className="priority-list">
        {items.map((item) => (
          <div key={item.id} className="priority-item">
            <div className="priority-item-header">
              <Link href={item.url} target="_blank" rel="noreferrer">
                {item.title}
              </Link>
              <Tag type={item.severity === 'high' ? 'red' : 'magenta'}>{item.severity}</Tag>
            </div>
            <p className="priority-summary">{item.summary}</p>
            <div className="priority-meta">
              <span>{item.repository}</span>
              {'ageInDays' in item ? <span>{item.ageInDays} days open</span> : null}
              {'owner' in item && item.owner ? <span>Owner: {item.owner}</span> : null}
            </div>
          </div>
        ))}
      </div>
    )}
  </Tile>
);

const MilestoneCard = ({ milestone }: { milestone: ExecutiveMilestoneStatus }) => (
  <div className="milestone-card">
    <div className="milestone-header">
      <div>
        <h4>{milestone.title}</h4>
        <p>{milestone.description || 'Tracked GitHub milestone'}</p>
      </div>
      <Tag type={getStatusTagType(milestone.status)}>
        {milestone.status === 'on-track'
          ? 'On track'
          : milestone.status === 'at-risk'
            ? 'At risk'
            : 'Critical'}
      </Tag>
    </div>
    <div className="milestone-progress">
      <div className="milestone-progress-bar">
        <div
          className={`milestone-progress-fill status-${milestone.status}`}
          style={{ width: `${milestone.completionPercentage}%` }}
        />
      </div>
      <span>{milestone.completionPercentage}% complete</span>
    </div>
    <div className="milestone-meta">
      <span>Due {formatDate(milestone.dueOn)}</span>
      <span>
        {milestone.closedIssues} closed / {milestone.openIssues} open
      </span>
    </div>
  </div>
);

export const ExecutiveReportPage = () => {
  const [report, setReport] = useState<GitHubExecutiveReport | null>(null);
  const [selectedWindow, setSelectedWindow] = useState(REPORTING_WINDOW_OPTIONS[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const repositories = useMemo(() => report?.context.repositories || [], [report]);

  const loadReport = async (reportingWindowDays: number) => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getExecutiveReport({ reportingWindowDays });
      setReport(data);
    } catch (loadError) {
      console.error('Failed to load executive report:', loadError);
      setError('Unable to load the GitHub executive report. Check backend GitHub configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleReportingWindowChange = async (
    nextWindow: (typeof REPORTING_WINDOW_OPTIONS)[number]
  ) => {
    setSelectedWindow(nextWindow);
    await loadReport(nextWindow.value);
  };

  return (
    <div className="executive-report-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <div className="report-hero">
            <div>
              <Heading className="report-title">Executive Status Report</Heading>
              <p className="report-subtitle">
                Leadership-ready project status generated from GitHub Project and repository activity.
              </p>
            </div>

            <div className="report-controls">
              <Dropdown
                id="reporting-window"
                titleText="Reporting period"
                label="Select reporting period"
                items={REPORTING_WINDOW_OPTIONS}
                itemToString={(item) => item?.text || ''}
                selectedItem={selectedWindow}
                onChange={({ selectedItem }) => {
                  if (selectedItem) {
                    void handleReportingWindowChange(selectedItem);
                  }
                }}
              />
              <Button
                kind="secondary"
                renderIcon={Renew}
                onClick={() => void loadReport(selectedWindow.value)}
              >
                Refresh report
              </Button>
            </div>
          </div>
        </Column>

        {!report && !loading && !error ? (
          <Column lg={16} md={8} sm={4}>
            <Tile className="report-section">
              <div className="section-header">
                <Heading className="section-title">Load executive report</Heading>
              </div>
              <p className="empty-copy">
                Generate the latest leadership-ready report directly from the connected GitHub Project.
              </p>
              <div style={{ marginTop: '1rem' }}>
                <Button renderIcon={Renew} onClick={() => void loadReport(selectedWindow.value)}>
                  Load report
                </Button>
              </div>
            </Tile>
          </Column>
        ) : null}

        {loading ? (
          <Column lg={16} md={8} sm={4}>
            <div className="loading-section">
              <Loading withOverlay={false} description="Loading executive report" />
            </div>
          </Column>
        ) : null}

        {!loading && error ? (
          <Column lg={16} md={8} sm={4}>
            <InlineNotification
              lowContrast
              kind="error"
              title="Report unavailable"
              subtitle={error}
              hideCloseButton
            />
          </Column>
        ) : null}

        {!loading && !error && report ? (
          <>
            <Column lg={16} md={8} sm={4}>
              <Tile className="report-summary">
                <div className="summary-header">
                  <div>
                    <p className="eyebrow">GitHub Project</p>
                    <Heading>{report.context.title}</Heading>
                    <p className="summary-copy">{report.health.summary}</p>
                  </div>
                  <div className="summary-status">
                    <Tag type={getStatusTagType(report.health.status)}>
                      {report.health.status === 'on-track'
                        ? 'On track'
                        : report.health.status === 'at-risk'
                          ? 'At risk'
                          : 'Critical'}
                    </Tag>
                    <p>{report.health.headline}</p>
                  </div>
                </div>
                <div className="summary-meta">
                  <span>Owner: {report.context.owner}</span>
                  <span>Project #{report.context.number}</span>
                  <span>{repositories.length} repositories in scope</span>
                  <span>Generated {formatDateTime(report.context.reportGeneratedAt)}</span>
                  <Link href={report.context.url} target="_blank" rel="noreferrer">
                    Open in GitHub
                  </Link>
                </div>
              </Tile>
            </Column>

            {report.metrics.map((metric) => (
              <Column key={metric.label} lg={4} md={4} sm={4}>
                <Tile className={`metric-card tone-${metric.tone || 'neutral'}`}>
                  <p className="metric-label">{metric.label}</p>
                  <h3>{metric.value}</h3>
                  <p className="metric-helper">{metric.helperText}</p>
                </Tile>
              </Column>
            ))}

            <Column lg={8} md={8} sm={4}>
              <PriorityList
                title="Top blockers"
                items={report.blockers}
                emptyMessage="No blockers are currently flagged from GitHub issue and label analysis."
              />
            </Column>

            <Column lg={8} md={8} sm={4}>
              <PriorityList
                title="Risks needing visibility"
                items={report.risks}
                emptyMessage="No material risks were inferred from the current project data."
              />
            </Column>

            <Column lg={10} md={8} sm={4}>
              <Tile className="report-section">
                <div className="section-header">
                  <Heading className="section-title">Milestone status</Heading>
                </div>
                {report.milestones.length === 0 ? (
                  <p className="empty-copy">No milestones are associated with the scoped GitHub items.</p>
                ) : (
                  <div className="milestone-list">
                    {report.milestones.map((milestone) => (
                      <MilestoneCard key={milestone.id} milestone={milestone} />
                    ))}
                  </div>
                )}
              </Tile>
            </Column>

            <Column lg={6} md={8} sm={4}>
              <Tile className="report-section">
                <div className="section-header">
                  <Heading className="section-title">Delivery signals</Heading>
                </div>
                <div className="signal-list">
                  {report.deliverySignals.map((signal) => (
                    <div key={signal.label} className="signal-item">
                      <div>
                        <p className="signal-label">{signal.label}</p>
                        <p className="signal-helper">{signal.helperText}</p>
                      </div>
                      <h3>{signal.value}</h3>
                    </div>
                  ))}
                </div>
              </Tile>
            </Column>

            <Column lg={16} md={8} sm={4}>
              <Tile className="report-section">
                <div className="section-header">
                  <Heading className="section-title">Recent notable changes</Heading>
                </div>
                {report.notableItems.length === 0 ? (
                  <p className="empty-copy">No recent GitHub activity is available for the selected scope.</p>
                ) : (
                  <div className="notable-list">
                    {report.notableItems.map((item) => (
                      <div key={item.id} className="notable-item">
                        <div className="notable-header">
                          <Link href={item.url} target="_blank" rel="noreferrer">
                            {item.title}
                          </Link>
                          <div className="notable-tags">
                            <Tag type="blue">{item.type === 'pull_request' ? 'Pull request' : 'Issue'}</Tag>
                            <Tag type={item.state === 'OPEN' ? 'teal' : 'green'}>{item.state}</Tag>
                          </div>
                        </div>
                        <p className="notable-summary">{item.summary}</p>
                        <div className="notable-meta">
                          <span>{item.repository}</span>
                          <span>Updated {formatDateTime(item.updatedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Tile>
            </Column>
          </>
        ) : null}
      </Grid>
    </div>
  );
};

export default ExecutiveReportPage;

// Made with Bob