export interface GitHubReportingFilters {
  owner?: string;
  projectNumber?: number;
  repository?: string;
  milestone?: string;
  reportingWindowDays?: number;
}

export type ExecutiveHealthStatus = 'on-track' | 'at-risk' | 'critical';

export interface GitHubProjectContext {
  owner: string;
  title: string;
  number: number;
  url: string;
  shortDescription?: string;
  public: boolean;
  closed: boolean;
  repositories: string[];
  reportGeneratedAt: string;
  reportingWindowDays: number;
}

export interface ExecutiveMetric {
  label: string;
  value: string;
  helperText?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'positive' | 'warning' | 'critical' | 'neutral';
}

export interface ExecutiveBlocker {
  id: string;
  title: string;
  url: string;
  repository: string;
  owner?: string;
  ageInDays: number;
  severity: 'low' | 'medium' | 'high';
  summary: string;
}

export interface ExecutiveRisk {
  id: string;
  title: string;
  url: string;
  repository: string;
  severity: 'medium' | 'high';
  summary: string;
}

export interface ExecutiveMilestoneStatus {
  id: string;
  title: string;
  description?: string;
  dueOn?: string;
  openIssues: number;
  closedIssues: number;
  completionPercentage: number;
  status: ExecutiveHealthStatus;
}

export interface ExecutiveDeliverySignal {
  label: string;
  value: number;
  helperText?: string;
}

export interface ExecutiveNotableItem {
  id: string;
  title: string;
  url: string;
  repository: string;
  state: string;
  type: 'issue' | 'pull_request';
  updatedAt: string;
  summary: string;
}

export interface GitHubExecutiveReport {
  context: GitHubProjectContext;
  health: {
    status: ExecutiveHealthStatus;
    headline: string;
    summary: string;
  };
  metrics: ExecutiveMetric[];
  blockers: ExecutiveBlocker[];
  risks: ExecutiveRisk[];
  milestones: ExecutiveMilestoneStatus[];
  deliverySignals: ExecutiveDeliverySignal[];
  notableItems: ExecutiveNotableItem[];
}

interface GitHubActor {
  login: string;
}

interface GitHubLabel {
  name: string;
}

interface GitHubMilestone {
  id: string;
  title: string;
  description?: string | null;
  dueOn?: string | null;
  progressPercentage?: number | null;
}

interface GitHubRepositoryRef {
  name: string;
  nameWithOwner: string;
  url: string;
}

export interface GitHubProjectFieldValueNode {
  __typename: string;
  name?: string;
  text?: string;
  number?: number;
  date?: string;
  iterationTitle?: string;
  optionId?: string;
  field?: {
    name?: string;
  };
}

export interface GitHubProjectItemNode {
  id: string;
  type: string;
  fieldValues?: {
    nodes: GitHubProjectFieldValueNode[];
  };
  content: null | {
    __typename: 'Issue' | 'PullRequest' | string;
    id: string;
    title: string;
    url: string;
    state: string;
    body?: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt?: string | null;
    number: number;
    repository: GitHubRepositoryRef;
    assignees?: {
      nodes: GitHubActor[];
    };
    labels?: {
      nodes: GitHubLabel[];
    };
    milestone?: GitHubMilestone | null;
    isDraft?: boolean;
    mergedAt?: string | null;
  };
}

export interface GitHubProjectApiResponse {
  organization?: {
    projectV2?: GitHubProjectApiProject | null;
  } | null;
  user?: {
    projectV2?: GitHubProjectApiProject | null;
  } | null;
}

export interface GitHubProjectApiProject {
  id: string;
  number: number;
  title: string;
  shortDescription?: string | null;
  url: string;
  public: boolean;
  closed: boolean;
  repositories: {
    nodes: GitHubRepositoryRef[];
  };
  items: {
    nodes: GitHubProjectItemNode[];
  };
}
// Made with Bob
