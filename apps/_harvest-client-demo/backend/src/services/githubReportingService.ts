import {
  ExecutiveBlocker,
  ExecutiveHealthStatus,
  ExecutiveMilestoneStatus,
  ExecutiveNotableItem,
  ExecutiveRisk,
  GitHubExecutiveReport,
  GitHubProjectApiProject,
  GitHubProjectApiResponse,
  GitHubProjectItemNode,
  GitHubReportingFilters,
} from '../types/githubReporting';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const DEFAULT_REPORTING_WINDOW_DAYS = 14;

const PROJECT_QUERY = `
  query ProjectExecutiveReport($owner: String!, $projectNumber: Int!) {
    organization(login: $owner) {
      projectV2(number: $projectNumber) {
        ...ProjectFields
      }
    }
    user(login: $owner) {
      projectV2(number: $projectNumber) {
        ...ProjectFields
      }
    }
  }

  fragment ProjectFields on ProjectV2 {
    id
    number
    title
    shortDescription
    url
    public
    closed
    repositories(first: 20) {
      nodes {
        name
        nameWithOwner
        url
      }
    }
    items(first: 100) {
      nodes {
        id
        type
        fieldValues(first: 20) {
          nodes {
            __typename
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
              optionId
              field {
                ... on ProjectV2SingleSelectField {
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldTextValue {
              text
              field {
                ... on ProjectV2FieldCommon {
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldNumberValue {
              number
              field {
                ... on ProjectV2FieldCommon {
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldDateValue {
              date
              field {
                ... on ProjectV2FieldCommon {
                  name
                }
              }
            }
            ... on ProjectV2ItemFieldIterationValue {
              title
              field {
                ... on ProjectV2IterationField {
                  name
                }
              }
            }
          }
        }
        content {
          __typename
          ... on Issue {
            id
            number
            title
            url
            body
            state
            createdAt
            updatedAt
            closedAt
            repository {
              name
              nameWithOwner
              url
            }
            assignees(first: 10) {
              nodes {
                login
              }
            }
            labels(first: 20) {
              nodes {
                name
              }
            }
            milestone {
              id
              title
              description
              dueOn
              progressPercentage
            }
          }
          ... on PullRequest {
            id
            number
            title
            url
            body
            state
            createdAt
            updatedAt
            closedAt
            isDraft
            mergedAt
            repository {
              name
              nameWithOwner
              url
            }
            assignees(first: 10) {
              nodes {
                login
              }
            }
            labels(first: 20) {
              nodes {
                name
              }
            }
            milestone {
              id
              title
              description
              dueOn
              progressPercentage
            }
          }
        }
      }
    }
  }
`;

export class GitHubReportingService {
  private readonly token: string | undefined;

  constructor() {
    this.token = process.env.GITHUB_TOKEN;
  }

  async getExecutiveReport(filters: GitHubReportingFilters): Promise<GitHubExecutiveReport> {
    if (!this.token) {
      const error = new Error('Missing GitHub token. Set GITHUB_TOKEN in the backend environment.');
      (error as Error & { status?: number; code?: string }).status = 500;
      (error as Error & { status?: number; code?: string }).code = 'GITHUB_TOKEN_MISSING';
      throw error;
    }

    const owner = filters.owner || process.env.GITHUB_PROJECT_OWNER || 'IBM-Project-Imagine';
    const projectNumber =
      filters.projectNumber ||
      Number.parseInt(process.env.GITHUB_PROJECT_NUMBER || '1', 10) ||
      1;
    const reportingWindowDays = filters.reportingWindowDays || DEFAULT_REPORTING_WINDOW_DAYS;
    const project = await this.fetchProject(owner, projectNumber);

    return this.buildExecutiveReport(project, {
      ...filters,
      owner,
      projectNumber,
      reportingWindowDays,
    });
  }

  private async fetchProject(owner: string, projectNumber: number): Promise<GitHubProjectApiProject> {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: PROJECT_QUERY,
        variables: {
          owner,
          projectNumber,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`GitHub API request failed: ${response.status} ${errorText}`);
      (error as Error & { status?: number; code?: string }).status = response.status;
      (error as Error & { status?: number; code?: string }).code = 'GITHUB_API_ERROR';
      throw error;
    }

    const payload = (await response.json()) as {
      data?: GitHubProjectApiResponse;
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      const error = new Error(payload.errors.map((entry) => entry.message).join('; '));
      (error as Error & { status?: number; code?: string }).status = 502;
      (error as Error & { status?: number; code?: string }).code = 'GITHUB_GRAPHQL_ERROR';
      throw error;
    }

    const project = payload.data?.organization?.projectV2 || payload.data?.user?.projectV2;

    if (!project) {
      const error = new Error(`GitHub Project ${owner}#${projectNumber} was not found.`);
      (error as Error & { status?: number; code?: string }).status = 404;
      (error as Error & { status?: number; code?: string }).code = 'GITHUB_PROJECT_NOT_FOUND';
      throw error;
    }

    return project;
  }

  private buildExecutiveReport(
    project: GitHubProjectApiProject,
    filters: Required<Pick<GitHubReportingFilters, 'owner' | 'projectNumber' | 'reportingWindowDays'>> &
      GitHubReportingFilters
  ): GitHubExecutiveReport {
    const repositoryFilter = filters.repository?.toLowerCase();
    const milestoneFilter = filters.milestone?.toLowerCase();
    const now = new Date();
    const reportingWindowStart = new Date(
      now.getTime() - filters.reportingWindowDays * 24 * 60 * 60 * 1000
    );

    const items = project.items.nodes.filter((item) => {
      const content = item.content;
      if (!content) {
        return false;
      }

      const matchesRepository = repositoryFilter
        ? content.repository.nameWithOwner.toLowerCase() === repositoryFilter ||
          content.repository.name.toLowerCase() === repositoryFilter
        : true;

      const matchesMilestone = milestoneFilter
        ? content.milestone?.title?.toLowerCase() === milestoneFilter
        : true;

      return matchesRepository && matchesMilestone;
    });

    const issueItems = items.filter((item) => item.content?.__typename === 'Issue');
    const pullRequestItems = items.filter((item) => item.content?.__typename === 'PullRequest');

    const blockers = this.extractBlockers(issueItems, now);
    const risks = this.extractRisks(issueItems, now);
    const milestones = this.extractMilestones(items, now);
    const deliverySignals = this.buildDeliverySignals(issueItems, pullRequestItems, reportingWindowStart);
    const notableItems = this.extractNotableItems(items);

    const openIssues = issueItems.filter((item) => item.content?.state === 'OPEN').length;
    const closedIssues = issueItems.length - openIssues;
    const openBlockers = blockers.length;
    const activeRisks = risks.length;
    const mergedRecently = pullRequestItems.filter((item) => {
      const mergedAt = item.content?.mergedAt;
      return mergedAt ? new Date(mergedAt) >= reportingWindowStart : false;
    }).length;

    const healthStatus = this.calculateHealthStatus({
      openBlockers,
      activeRisks,
      overdueMilestones: milestones.filter(
        (milestone) => milestone.dueOn && new Date(milestone.dueOn) < now && milestone.completionPercentage < 100
      ).length,
    });

    return {
      context: {
        owner: filters.owner,
        title: project.title,
        number: project.number,
        url: project.url,
        shortDescription: project.shortDescription || undefined,
        public: project.public,
        closed: project.closed,
        repositories: project.repositories.nodes.map((repository) => repository.nameWithOwner),
        reportGeneratedAt: now.toISOString(),
        reportingWindowDays: filters.reportingWindowDays,
      },
      health: {
        status: healthStatus,
        headline: this.buildHeadline(healthStatus, blockers.length, risks.length),
        summary: this.buildSummary({
          openIssues,
          closedIssues,
          blockers,
          risks,
          milestones,
          mergedRecently,
        }),
      },
      metrics: [
        {
          label: 'Overall health',
          value: this.formatHealthStatus(healthStatus),
          helperText: `${blockers.length} blocker${blockers.length === 1 ? '' : 's'} requiring attention`,
          tone: this.mapHealthToTone(healthStatus),
        },
        {
          label: 'Open work items',
          value: `${openIssues}`,
          helperText: `${closedIssues} completed items tracked in the current scope`,
          tone: 'neutral',
        },
        {
          label: 'Active blockers',
          value: `${blockers.length}`,
          helperText: blockers[0]?.title || 'No blocking issues identified',
          tone: blockers.length > 0 ? 'critical' : 'positive',
        },
        {
          label: 'Merged in last period',
          value: `${mergedRecently}`,
          helperText: `${filters.reportingWindowDays}-day delivery signal`,
          tone: mergedRecently > 0 ? 'positive' : 'warning',
        },
      ],
      blockers,
      risks,
      milestones,
      deliverySignals,
      notableItems,
    };
  }

  private extractBlockers(items: GitHubProjectItemNode[], now: Date): ExecutiveBlocker[] {
    return items
      .filter((item) => {
        const content = item.content;
        if (!content || content.state !== 'OPEN') {
          return false;
        }

        const labels = content.labels?.nodes.map((label) => label.name.toLowerCase()) || [];
        const text = `${content.title} ${content.body || ''}`.toLowerCase();

        return (
          labels.some((label) => ['blocker', 'blocked', 'critical'].includes(label)) ||
          text.includes('blocked') ||
          text.includes('blocker')
        );
      })
      .slice(0, 6)
      .map((item) => {
        const content = item.content!;
        const ageInDays = this.calculateAgeInDays(content.createdAt, now);
        return {
          id: content.id,
          title: content.title,
          url: content.url,
          repository: content.repository.nameWithOwner,
          owner: content.assignees?.nodes[0]?.login,
          ageInDays,
          severity: ageInDays > 14 ? 'high' : ageInDays > 7 ? 'medium' : 'low',
          summary: this.summarizeText(content.body, 'Pending unblock action'),
        };
      });
  }

  private extractRisks(items: GitHubProjectItemNode[], now: Date): ExecutiveRisk[] {
    return items
      .filter((item) => {
        const content = item.content;
        if (!content || content.state !== 'OPEN') {
          return false;
        }

        const labels = content.labels?.nodes.map((label) => label.name.toLowerCase()) || [];
        const text = `${content.title} ${content.body || ''}`.toLowerCase();
        const ageInDays = this.calculateAgeInDays(content.updatedAt, now);

        return (
          labels.some((label) => ['risk', 'at-risk', 'dependency'].includes(label)) ||
          text.includes('risk') ||
          text.includes('dependency') ||
          ageInDays > 21
        );
      })
      .slice(0, 6)
      .map((item) => {
        const content = item.content!;
        const text = `${content.title} ${content.body || ''}`.toLowerCase();
        return {
          id: content.id,
          title: content.title,
          url: content.url,
          repository: content.repository.nameWithOwner,
          severity: text.includes('critical') || text.includes('high') ? 'high' : 'medium',
          summary: this.summarizeText(content.body, 'Requires leadership visibility'),
        };
      });
  }

  private extractMilestones(items: GitHubProjectItemNode[], now: Date): ExecutiveMilestoneStatus[] {
    const milestoneMap = new Map<string, ExecutiveMilestoneStatus>();

    items.forEach((item) => {
      const content = item.content;
      if (!content?.milestone) {
        return;
      }

      const milestone = content.milestone;
      const existing = milestoneMap.get(milestone.id);

      if (!existing) {
        milestoneMap.set(milestone.id, {
          id: milestone.id,
          title: milestone.title,
          description: milestone.description || undefined,
          dueOn: milestone.dueOn || undefined,
          openIssues: content.state === 'OPEN' ? 1 : 0,
          closedIssues: content.state === 'OPEN' ? 0 : 1,
          completionPercentage: milestone.progressPercentage ?? (content.state === 'OPEN' ? 0 : 100),
          status: 'on-track',
        });
        return;
      }

      if (content.state === 'OPEN') {
        existing.openIssues += 1;
      } else {
        existing.closedIssues += 1;
      }
    });

    return Array.from(milestoneMap.values())
      .map((milestone) => {
        const total = milestone.openIssues + milestone.closedIssues;
        const computedCompletion = total > 0 ? Math.round((milestone.closedIssues / total) * 100) : 0;
        const completionPercentage =
          milestone.completionPercentage && milestone.completionPercentage > 0
            ? milestone.completionPercentage
            : computedCompletion;
        const isOverdue =
          Boolean(milestone.dueOn) &&
          new Date(milestone.dueOn as string) < now &&
          completionPercentage < 100;

        const status: ExecutiveHealthStatus = isOverdue
          ? 'critical'
          : completionPercentage >= 70
            ? 'on-track'
            : 'at-risk';

        return {
          ...milestone,
          completionPercentage,
          status,
        };
      })
      .sort((a, b) => (a.dueOn || '').localeCompare(b.dueOn || ''));
  }

  private buildDeliverySignals(
    issues: GitHubProjectItemNode[],
    pullRequests: GitHubProjectItemNode[],
    reportingWindowStart: Date
  ) {
    const issuesClosedRecently = issues.filter((item) => {
      const closedAt = item.content?.closedAt;
      return closedAt ? new Date(closedAt) >= reportingWindowStart : false;
    }).length;

    const pullRequestsMergedRecently = pullRequests.filter((item) => {
      const mergedAt = item.content?.mergedAt;
      return mergedAt ? new Date(mergedAt) >= reportingWindowStart : false;
    }).length;

    const issuesOpenedRecently = issues.filter(
      (item) => new Date(item.content?.createdAt || 0) >= reportingWindowStart
    ).length;

    return [
      {
        label: 'Issues closed',
        value: issuesClosedRecently,
        helperText: 'Resolution throughput in the reporting window',
      },
      {
        label: 'Pull requests merged',
        value: pullRequestsMergedRecently,
        helperText: 'Delivered engineering changes in the reporting window',
      },
      {
        label: 'New issues opened',
        value: issuesOpenedRecently,
        helperText: 'Incoming demand and scope pressure',
      },
    ];
  }

  private extractNotableItems(items: GitHubProjectItemNode[]): ExecutiveNotableItem[] {
    return items
      .filter((item) => item.content)
      .sort((a, b) => {
        const aDate = new Date(a.content?.updatedAt || 0).getTime();
        const bDate = new Date(b.content?.updatedAt || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 8)
      .map((item) => {
        const content = item.content!;
        return {
          id: content.id,
          title: content.title,
          url: content.url,
          repository: content.repository.nameWithOwner,
          state: content.state,
          type: content.__typename === 'PullRequest' ? 'pull_request' : 'issue',
          updatedAt: content.updatedAt,
          summary: this.summarizeText(content.body, 'Recently updated work item'),
        };
      });
  }

  private calculateHealthStatus({
    openBlockers,
    activeRisks,
    overdueMilestones,
  }: {
    openBlockers: number;
    activeRisks: number;
    overdueMilestones: number;
  }): ExecutiveHealthStatus {
    if (openBlockers >= 3 || overdueMilestones >= 2) {
      return 'critical';
    }

    if (openBlockers > 0 || activeRisks > 2 || overdueMilestones > 0) {
      return 'at-risk';
    }

    return 'on-track';
  }

  private buildHeadline(
    status: ExecutiveHealthStatus,
    blockerCount: number,
    riskCount: number
  ): string {
    if (status === 'critical') {
      return `Delivery is under pressure with ${blockerCount} critical blocker${blockerCount === 1 ? '' : 's'}.`;
    }

    if (status === 'at-risk') {
      return `Delivery remains achievable, but ${riskCount} active risk${riskCount === 1 ? '' : 's'} need attention.`;
    }

    return 'Delivery is progressing with manageable risk and no critical blockers.';
  }

  private buildSummary({
    openIssues,
    closedIssues,
    blockers,
    risks,
    milestones,
    mergedRecently,
  }: {
    openIssues: number;
    closedIssues: number;
    blockers: ExecutiveBlocker[];
    risks: ExecutiveRisk[];
    milestones: ExecutiveMilestoneStatus[];
    mergedRecently: number;
  }): string {
    const milestoneSummary =
      milestones.length > 0
        ? `${milestones.filter((milestone) => milestone.status === 'on-track').length} milestone${milestones.length === 1 ? '' : 's'} on track`
        : 'milestone tracking is not yet populated';

    return `${closedIssues} tracked items have completed against ${openIssues} still open. ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} and ${risks.length} active risk${risks.length === 1 ? '' : 's'} are visible. ${mergedRecently} pull request${mergedRecently === 1 ? '' : 's'} merged in the current reporting window, and ${milestoneSummary}.`;
  }

  private formatHealthStatus(status: ExecutiveHealthStatus): string {
    switch (status) {
      case 'critical':
        return 'Critical';
      case 'at-risk':
        return 'At risk';
      case 'on-track':
      default:
        return 'On track';
    }
  }

  private mapHealthToTone(
    status: ExecutiveHealthStatus
  ): 'positive' | 'warning' | 'critical' | 'neutral' {
    switch (status) {
      case 'critical':
        return 'critical';
      case 'at-risk':
        return 'warning';
      case 'on-track':
      default:
        return 'positive';
    }
  }

  private summarizeText(text: string | null | undefined, fallback: string): string {
    if (!text) {
      return fallback;
    }

    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return fallback;
    }

    return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
  }

  private calculateAgeInDays(dateString: string, now: Date): number {
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  }
}

export const githubReportingService = new GitHubReportingService();

// Made with Bob
