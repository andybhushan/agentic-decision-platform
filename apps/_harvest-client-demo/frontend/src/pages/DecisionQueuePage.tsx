import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Column,
  Heading,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Dropdown,
  Button,
  Tag,
  Loading,
  InlineNotification,
  ToastNotification,
  Tile,
  Tooltip,
  ProgressBar,
  Pagination,
  Checkbox,
} from '@carbon/react';
import { Add, Information, ChevronDown, ChevronUp, CheckmarkFilled, Bot, ArrowRight, ArrowUp, ArrowDown, StarFilled, Close } from '@carbon/icons-react';
import { api } from '../services/api';
import { StewardChatPanel } from '../components/steward/StewardChatPanel';
import { TierBadge, RepresentativeNote } from '../components/TierBadge';
import { ConfidencePopover } from '../components/ConfidencePopover';
import type { StewardPageContext } from '../services/stewardApi';
import type { Claim, ConfidenceLevel, Priority } from '../types';
import { completedAgentActions } from '../data/canonicalAgents';
import { confidenceScore, confidenceGapPts, estimatedEffortMins, sortByPickupOrder, pickupOrderScore, priorityScoreTone, isBatchApproveEligible } from '../data/confidence';
import { useAdjusterPersonaStore } from '../store/useAdjusterPersonaStore';
import './DecisionQueuePage.scss';

const raisingAgentFor = (claim: Claim): string => {
  const dt = (claim.pendingDecisionType || '').toLowerCase();
  if (dt.includes('fraud') || dt.includes('siu')) return 'SIU DW';
  if (dt.includes('liability') || dt.includes('subrog')) return 'AI Steward';
  if (dt.includes('coverage') || dt.includes('policy') || dt.includes('interpretation')) return 'Coverage DW';
  if (dt.includes('duplicate')) return 'Triage DW';
  return 'Damage DW';
};

const capitalizeStage = (stage?: string): string =>
  stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : '—';

const confidenceTagType = (level: ConfidenceLevel): string =>
  level === 'high' ? 'green' : level === 'medium' ? 'blue' : 'red';

const priorityTagType = (priority: Priority): string =>
  priority === 'urgent' ? 'red' : priority === 'high' ? 'magenta' : 'cool-gray';

const priorityScoreArrowIcon = (arrow: 'up' | 'flat' | 'down') =>
  arrow === 'up' ? ArrowUp : arrow === 'down' ? ArrowDown : ArrowRight;

const PriorityScoreBadge = ({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' }) => {
  if (score === null) {
    return (
      <span
        className={`decision-queue-page__priority-score decision-queue-page__priority-score--resolved decision-queue-page__priority-score--${size}`}
        title="Resolved — no further adjuster action needed, so it isn't ranked in the priority queue."
      >
        Resolved
      </span>
    );
  }
  const { tone, arrow } = priorityScoreTone(score);
  const ArrowIcon = priorityScoreArrowIcon(arrow);
  return (
    <span
      className={`decision-queue-page__priority-score decision-queue-page__priority-score--${tone} decision-queue-page__priority-score--${size}`}
      title={`Priority score ${score}% — this claim's position in the pickup order for the adjuster's own open queue (100% = work next; lower % = further down the list).`}
    >
      <ArrowIcon size={size === 'sm' ? 12 : 14} />
      {score}%
    </span>
  );
};

const headers = [
  { key: 'select', header: '' },
  { key: 'id', header: 'Claim ID' },
  { key: 'insured', header: 'Insured' },
  { key: 'type', header: 'Type' },
  { key: 'workingOn', header: 'Working On' },
  { key: 'stage', header: 'Stage' },
  { key: 'intake', header: 'Current Status' },
  { key: 'confidenceScore', header: 'Confidence Score' },
  { key: 'priorityScore', header: 'Priority' },
  { key: 'complexity', header: 'Complexity' },
  { key: 'lastActivity', header: 'Last Activity' },
  { key: 'actions', header: '' },
];

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } }).response;
    const nestedMessage = response?.data?.error?.message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage;
    const directMessage = response?.data?.message;
    if (typeof directMessage === 'string' && directMessage.trim()) return directMessage;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

const ADJUSTER_AVATAR_COLORS: Record<string, string> = {
  adj_patel:     '#8a3ffc',
  adj_whitfield: '#0f62fe',
  adj_pemberton: '#009d9a',
  adj_chen:      '#f1c21b',
  adj_blackwood: '#24a148',
  adj_ashworth:  '#6f6f6f',
};

function getAdjusterInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function getAssignmentMatchReason(claim: Claim, adjuster: AdjusterProfile): string {
  // Use stored signals first (set during live routing)
  if (claim.assignmentSignals && claim.assignmentSignals.length > 0) {
    const key = claim.assignmentSignals.find(s =>
      !s.includes('tie-break') && !s.includes('slots free')
    );
    if (key) return key;
  }
  if (claim.assignmentReason) return claim.assignmentReason;

  // Derive from claim characteristics
  const isFraud = claim.pendingDecisionType?.toLowerCase().includes('fraud') ||
    claim.pendingDecisionType?.toLowerCase().includes('siu') ||
    claim.blockerReason?.toLowerCase().includes('fraud');
  const specs = adjuster.specialisations.map(s => s.toLowerCase());

  if (isFraud && specs.some(s => s.includes('fraud') || s.includes('siu'))) {
    return 'Fraud/SIU signals matched specialist handling';
  }
  if (claim.injuryIndicated && specs.some(s => s.includes('injury') || s.includes('whiplash') || s.includes('rehab'))) {
    return 'Injury indicators matched injury-capable adjuster expertise';
  }
  const exposure = claim.recommendedAction?.financialImpact?.estimatedAmount || 0;
  if (exposure >= 15000 && adjuster.authorityLimit >= 100000) {
    return 'High-priority exposure favoured senior authority';
  }
  if (specs.some(s => s.includes('fast-track') || s.includes('portal'))) {
    return 'Low-complexity claim routed to fast-track motor queue';
  }
  if (specs.some(s => s.includes('fleet') || s.includes('prestige'))) {
    return 'Prestige or major-loss wording matched high-value authority';
  }
  return 'Standard auto loss routed to core motor queue';
}

function getMatchingSpecs(claim: Claim, adjuster: AdjusterProfile): string[] {
  const isFraud = claim.pendingDecisionType?.toLowerCase().includes('fraud') ||
    claim.pendingDecisionType?.toLowerCase().includes('siu');
  const scored = adjuster.specialisations.map(spec => {
    const s = spec.toLowerCase();
    let score = 0;
    if (isFraud && (s.includes('fraud') || s.includes('siu'))) score += 10;
    if (claim.injuryIndicated && (s.includes('injury') || s.includes('whiplash') || s.includes('rehab'))) score += 10;
    if (s.includes('motor')) score += 2;
    if (s.includes('liability')) score += 1;
    return { spec, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.spec);
}

export const DecisionQueuePage = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filteredClaims, setFilteredClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [decisionTypeFilter, setDecisionTypeFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [showLiveOps, setShowLiveOps] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);
  const [liveOpsTop, setLiveOpsTop] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [batchApproving, setBatchApproving] = useState(false);
  const [batchResult, setBatchResult] = useState<{ approved: number; blocked: number } | null>(null);
  const { adjusters, activeAdjusterId, setAdjusters } = useAdjusterPersonaStore();

  const liveOpsRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setLiveOpsTop(node.getBoundingClientRect().top);
    }
  }, []);

  const loadClaims = async () => {
    try {
      setLoading(true);
      const [claimsData, adjusterData] = await Promise.all([api.getClaims(), api.getAdjusters()]);
      setClaims(claimsData);
      setAdjusters(adjusterData);
    } catch (err) {
      console.error('Failed to load claims:', err);
      setError('Failed to load claims. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filterClaims = () => {
    let filtered = [...claims];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (claim) =>
          claim.id.toLowerCase().includes(searchLower) ||
          claim.claimantName.toLowerCase().includes(searchLower)
      );
    }

    // Decision type filter
    if (decisionTypeFilter !== 'all') {
      filtered = filtered.filter((claim) => claim.pendingDecisionType === decisionTypeFilter);
    }

    // Confidence filter
    if (confidenceFilter !== 'all') {
      filtered = filtered.filter((claim) => claim.confidenceLevel === confidenceFilter);
    }

    if (activeAdjusterId) {
      filtered = filtered.filter((claim) => claim.assignedAdjusterId === activeAdjusterId);
    }

    // Settled/closed claims need no further adjuster judgment call, so they
    // don't belong in the working queue itself — they're tracked separately
    // as a "resolved this week" throughput stat instead (see
    // adjusterScopedClaims below).
    filtered = filtered.filter((claim) => claim.claimStage !== 'settlement' && claim.claimStage !== 'closed');

    setFilteredClaims(filtered);
  };

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    loadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    filterClaims();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims, searchTerm, decisionTypeFilter, confidenceFilter, activeAdjusterId]);

  const handleClaimSelect = (claimId: string) => {
    setSelectedClaimId(prev => prev === claimId ? null : claimId);
  };

  const handleClaimOpen = (claimId: string) => {
    navigate(`/claims/${claimId}/decision`);
  };

  const handleNewClaim = () => {
    navigate('/claims/intake');
  };

  const handleDeleteClaim = async (claim: Claim) => {
    const confirmed = window.confirm(`Delete claim ${claim.id} for ${claim.claimantName}?`);
    if (!confirmed) return;

    setDeletingClaimId(claim.id);
    setError('');
    try {
      await api.deleteClaim(claim.id);
      await loadClaims();
      if (selectedClaimId === claim.id) {
        setSelectedClaimId(null);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, `Unable to delete claim ${claim.id}.`));
    } finally {
      setDeletingClaimId(null);
    }
  };

  const activeAdjusterProfile = activeAdjusterId
    ? adjusters.find((adjuster) => adjuster.id === activeAdjusterId) ?? null
    : null;

  const toggleBatchSelect = (claimId: string, eligible: boolean) => {
    if (!eligible) return;
    setSelectedForBatch((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) next.delete(claimId);
      else next.add(claimId);
      return next;
    });
  };

  const handleBatchApprove = async () => {
    if (selectedForBatch.size === 0) return;
    setBatchApproving(true);
    setError('');
    setBatchResult(null);
    try {
      const claimIds = Array.from(selectedForBatch);
      const result = await api.batchApproveClaims(
        claimIds,
        activeAdjusterProfile?.name || 'Adjuster',
        'Batch approved — high confidence, no blockers, within delegated authority.',
      );
      setBatchResult({ approved: result.approvedCount, blocked: result.blockedCount });
      setSelectedForBatch(new Set());
      await loadClaims();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to batch approve the selected claims.'));
    } finally {
      setBatchApproving(false);
    }
  };

  // Get recommended claims for the cards section — up to 3, diverse decision types
  const getPriorityCards = () => {
    // Resolved decisions (advanced to settlement or closed) no longer need a
    // judgment call, so they drop out of the ranked "decide next" cards.
    const needsDecision = filteredClaims.filter(
      (c) => c.claimStage !== 'settlement' && c.claimStage !== 'closed',
    );
    // Pickup order — kept in one place (data/confidence.ts) so the Rank
    // numbers here and the Priority Score badges everywhere else can never
    // disagree with each other.
    const sorted = sortByPickupOrder(needsDecision);

    // Enforce variety: at most 1 fraud/SIU card in the top 3
    const isFraud = (c: Claim) =>
      c.pendingDecisionType?.toLowerCase().includes('fraud') ||
      c.pendingDecisionType?.toLowerCase().includes('siu');

    const selected: Claim[] = [];
    let fraudCount = 0;
    for (const claim of sorted) {
      if (selected.length >= 3) break;
      if (isFraud(claim)) {
        if (fraudCount < 1) { selected.push(claim); fraudCount++; }
      } else {
        selected.push(claim);
      }
    }
    // If we couldn't fill 3 with variety, top up with remaining sorted claims
    if (selected.length < 3) {
      for (const claim of sorted) {
        if (selected.length >= 3) break;
        if (!selected.includes(claim)) selected.push(claim);
      }
    }
    return selected;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDecisionBadgeColor = (decisionType: string) => {
    const colors: Record<string, string> = {
      'Coverage Verification': 'green',
      'Anomaly Review': 'red',
      'Settlement Approval': 'purple',
      'Policy Interpretation': 'cyan',
      'Fraud Investigation': 'red',
      'Duplicate Claim Review': 'magenta',
    };
    return colors[decisionType] || 'gray';
  };

  const decisionTypeItems = [
    { id: 'all', text: 'All Decision Types' },
    { id: 'Coverage Verification', text: 'Coverage Verification' },
    { id: 'Anomaly Review', text: 'Anomaly Review' },
    { id: 'Settlement Approval', text: 'Settlement Approval' },
    { id: 'Policy Interpretation', text: 'Policy Interpretation' },
    { id: 'Fraud Investigation', text: 'Fraud Investigation' },
    { id: 'Duplicate Claim Review', text: 'Duplicate Claim Review' },
  ];

  const confidenceItems = [
    { id: 'all', text: 'All Confidence Levels' },
    { id: 'high', text: 'High Confidence' },
    { id: 'medium', text: 'Medium Confidence' },
    { id: 'low', text: 'Low Confidence' },
  ];

  // The pool of claims this adjuster (or the organisation, if no adjuster
  // persona is selected) can actually see AND still needs to act on. Claims
  // already at 'settlement' (paid, awaiting disbursement) or 'closed' are
  // resolved — they don't need a next action, so they're excluded from the
  // scoring pool entirely and never get a "next to work" priority score.
  // Priority score is ranked ONLY against this pool — never against claims
  // outside the adjuster's/org's visibility — and deliberately ignores the
  // search/decision-type/confidence UI filters below so a claim's score
  // doesn't reshuffle just because the adjuster is narrowing their own view.
  const visibleScopeClaims = useMemo(() => {
    const scoped = activeAdjusterId ? claims.filter((c) => c.assignedAdjusterId === activeAdjusterId) : claims;
    return scoped.filter((c) => c.claimStage !== 'settlement' && c.claimStage !== 'closed');
  }, [claims, activeAdjusterId]);

  // Adjuster/org scoped, but unlike filteredClaims this keeps settlement/
  // closed claims — used only for "resolved this week" style throughput
  // reporting, never for the working queue table or cards.
  const adjusterScopedClaims = useMemo(() => {
    return activeAdjusterId ? claims.filter((c) => c.assignedAdjusterId === activeAdjusterId) : claims;
  }, [claims, activeAdjusterId]);

  const priorityScoreById = useMemo(() => {
    const map = new Map<string, number>();
    visibleScopeClaims.forEach((c) => {
      map.set(c.id, pickupOrderScore(c, visibleScopeClaims));
    });
    return map;
  }, [visibleScopeClaims]);

  // Returns null for resolved claims (settlement/closed) — there is no "next
  // action" ordering for them, so no score should ever be shown.
  const getPriorityScoreFor = (claim: Claim): number | null => {
    if (claim.claimStage === 'settlement' || claim.claimStage === 'closed') return null;
    return priorityScoreById.get(claim.id) ?? pickupOrderScore(claim, visibleScopeClaims);
  };

  const rows = filteredClaims.map((claim) => {
    // Get stage tag
    const getStageTag = (stage: string) => {
      const stageMap: Record<string, { label: string; type: string }> = {
        intake: { label: 'Stage 1', type: 'blue' },
        investigation: { label: 'Stage 2', type: 'cyan' },
        evaluation: { label: 'Stage 3', type: 'teal' },
        settlement: { label: 'Stage 4', type: 'green' },
        closed: { label: 'Closed', type: 'gray' },
      };
      const config = stageMap[stage] || { label: stage, type: 'gray' };
      return <Tag type={config.type as any}>{config.label}</Tag>;
    };

    // Get working on tag
    const getWorkingOnTag = (workingOn: string) => {
      return <Tag type="blue">{workingOn}</Tag>;
    };

    // Get current status description (what the claim needs NOW)
    const getCurrentStatus = () => {
      const stage = claim.claimStage;
      const decision = claim.pendingDecisionType || '';

      // Closed and settled claims have no pending actions — show final outcome.
      if (stage === 'closed') {
        return claim.outcome === 'denied' ? 'Claim closed — denied' : 'Claim closed — payment issued';
      }
      // Settlement stage = negotiation done, payment being processed.
      if (stage === 'settlement') return 'Settlement in progress — payment processing';

      // Blocker takes priority over decision-type labels for open claims.
      if (claim.blockerReason) {
        const short = claim.blockerReason.length > 60
          ? claim.blockerReason.slice(0, 57) + '…'
          : claim.blockerReason;
        return short;
      }

      // Stage + decision type → meaningful current state
      if (decision.toLowerCase().includes('fraud') || decision.toLowerCase().includes('siu')) {
        return 'SIU investigation in progress';
      }
      if (decision.toLowerCase().includes('settlement')) {
        return 'Awaiting settlement approval';
      }
      if (decision.toLowerCase().includes('coverage')) {
        return 'Coverage verification pending';
      }
      if (decision.toLowerCase().includes('duplicate')) {
        return 'Duplicate claim review in progress';
      }
      if (decision.toLowerCase().includes('anomaly')) {
        return 'Anomaly review required';
      }
      if (stage === 'intake') return 'FNOL intake — initial triage';
      if (stage === 'investigation') return 'Active investigation underway';
      if (stage === 'evaluation') return 'Evaluation — adjuster review required';
      return claim.lastAgentAction || '—';
    };

    // Complexity tag — driven by the claim's seeded complexity (low/medium/high),
    // not by priority, so it is coherent with the SLA and effort figures.
    const getComplexityTag = () => {
      const c = claim.complexity;
      const type = c === 'high' ? 'red' : c === 'medium' ? 'cyan' : 'green';
      const label = c.charAt(0).toUpperCase() + c.slice(1);
      return <Tag type={type}>{label}</Tag>;
    };

    const eligible = isBatchApproveEligible(claim, activeAdjusterProfile?.authorityLimit);

    return {
      id: claim.id,
      select: (
        <Tooltip
          align="right"
          label={
            eligible
              ? 'Ready to auto-approve — high confidence, no blockers, within your authority.'
              : 'Not eligible for batch approve (confidence below threshold, blocked, or exceeds your authority).'
          }
        >
          <span>
            <Checkbox
              id={`batch-select-${claim.id}`}
              labelText=""
              hideLabel
              checked={selectedForBatch.has(claim.id)}
              disabled={!eligible}
              onClick={(event) => event.stopPropagation()}
              onChange={() => toggleBatchSelect(claim.id, eligible)}
            />
          </span>
        </Tooltip>
      ),
      insured: (
        <div className="decision-queue-page__insured">
          <span className="decision-queue-page__insured-name">
            {claim.claimantName}
            <TierBadge tier={claim.clientServiceTier} />
          </span>
          <RepresentativeNote representative={claim.appointedRepresentative} />
        </div>
      ),
      type: claim.injuryIndicated ? 'Injury' : 'Damage',
      workingOn: getWorkingOnTag(claim.workingOn || 'AGENT'),
      stage: getStageTag(claim.claimStage),
      intake: getCurrentStatus(),
      confidenceScore: <ConfidencePopover claim={claim} align="right" />,
      priorityScore: <PriorityScoreBadge score={getPriorityScoreFor(claim)} size="sm" />,
      complexity: getComplexityTag(),
      lastActivity: claim.timeInQueue,
      actions: (
        <button
          type="button"
          className="decision-queue-page__delete-button decision-queue-page__delete-button--table"
          disabled={deletingClaimId === claim.id}
          title="Delete claim"
          aria-label="Delete claim"
          onClick={(event) => {
            event.stopPropagation();
            void handleDeleteClaim(claim);
          }}
        >
          <Close size={16} />
        </button>
      ),
    };
  });

  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <Grid className="decision-queue-page" fullWidth>
        <Column lg={16} className="decision-queue-page__loading">
          <Loading description="Loading claims..." withOverlay={false} />
        </Column>
      </Grid>
    );
  }

  const priorityCards = getPriorityCards();
  const topClaim = priorityCards[0];
  const displayClaims = filteredClaims;
  const selectedClaim = selectedClaimId ? displayClaims.find(c => c.id === selectedClaimId) ?? claims.find(c => c.id === selectedClaimId) ?? null : null;
  const selectedAdjuster = activeAdjusterProfile;

  const stewardPageContext: StewardPageContext = {
    pageName: 'Adjuster Queue',
    focusedClaimId: selectedClaimId ?? undefined,
    priorityClaim: (selectedClaim || topClaim) ? {
      id: (selectedClaim || topClaim)!.id,
      claimantName: (selectedClaim || topClaim)!.claimantName,
      incidentType: (selectedClaim || topClaim)!.incidentType,
      stage: (selectedClaim || topClaim)!.claimStage,
      priority: (selectedClaim || topClaim)!.priority,
      confidenceLevel: (selectedClaim || topClaim)!.confidenceLevel,
      blockerReason: (selectedClaim || topClaim)!.blockerReason,
      timeInQueue: (selectedClaim || topClaim)!.timeInQueue,
      estimatedExposure: (selectedClaim || topClaim)!.recommendedAction?.financialImpact?.estimatedAmount,
      workingOn: (selectedClaim || topClaim)!.workingOn,
      completedActions: completedAgentActions((selectedClaim || topClaim)!.auditTrail),
    } : undefined,
    priorityReason: selectedClaim
      ? `Adjuster has focused on this claim.`
      : topClaim
        ? `Ranked #1 for urgency and decision-readiness. ${topClaim.blockerReason || ''} ${topClaim.confidenceLevel === 'high' ? 'High confidence score.' : ''} Requires immediate adjuster action.`.trim()
        : undefined,
    activeAdjuster: selectedAdjuster ? {
      id: selectedAdjuster.id,
      name: selectedAdjuster.name,
      team: selectedAdjuster.team,
      seniority: selectedAdjuster.seniority,
      yearsExperience: selectedAdjuster.yearsExperience,
      specialisations: selectedAdjuster.specialisations,
      currentWorkload: selectedAdjuster.currentWorkload,
      maxCapacity: selectedAdjuster.maxCapacity,
      authorityLimit: selectedAdjuster.authorityLimit,
    } : undefined,
    allClaims: displayClaims.map(c => ({
      id: c.id,
      claimantName: c.claimantName,
      incidentType: c.incidentType,
      stage: c.claimStage,
      priority: c.priority,
      confidenceLevel: c.confidenceLevel,
      blockerReason: c.blockerReason,
      timeInQueue: c.timeInQueue,
      estimatedExposure: c.recommendedAction?.financialImpact?.estimatedAmount,
      workingOn: c.workingOn,
    })),
    recommendedRanking: priorityCards.map((c, index) => ({
      rank: index + 1,
      id: c.id,
      claimantName: c.claimantName,
      incidentType: c.incidentType,
      priority: c.priority,
      confidenceLevel: c.confidenceLevel,
      timeInQueue: c.timeInQueue,
      estimatedExposure: c.recommendedAction?.financialImpact?.estimatedAmount,
      pendingDecisionType: c.pendingDecisionType,
      rationale: `${c.priority.toUpperCase()} priority · ${c.pendingDecisionType} · queued ${c.timeInQueue}`,
    })),
  };

  // Calculate live operations metrics
  const totalClaims = adjusterScopedClaims.length;
  const openDecisions = adjusterScopedClaims.filter(c => c.claimStage !== 'closed').length;
  const highUrgency = displayClaims.filter(c => c.priority === 'urgent' || c.priority === 'high').length;
  const totalExposure = displayClaims.reduce((sum, c) => sum + (c.recommendedAction.financialImpact?.estimatedAmount || 0), 0);
  
  // Settlement handoff metrics
  const resolvedDecisions = adjusterScopedClaims.filter(c => c.claimStage === 'settlement' || c.claimStage === 'closed').length;
  const blockedClaims = displayClaims.filter(c => c.blockerReason).length;
  const avgHandoffTime = '12m';
  
  // Intake metrics
  const newFNOL = displayClaims.filter(c => c.claimStage === 'intake').length;
  const triaged = displayClaims.filter(c => c.claimStage === 'investigation').length;
  const humanReview = displayClaims.filter(c => c.confidenceLevel === 'low').length;
  
  // Queue metrics
  const highPriority = displayClaims.filter(c => c.priority === 'urgent' || c.priority === 'high').length;
  const openDecisionsQueue = displayClaims.filter(c => c.claimStage !== 'closed' && c.claimStage !== 'settlement').length;
  const blockedQueue = displayClaims.filter(c => c.blockerReason && c.claimStage !== 'closed').length;
  const quickApprovals = displayClaims.filter(c => c.confidenceLevel === 'high' && c.claimStage !== 'closed').length;
  
  // Workers metrics
  const activeTasks = displayClaims.filter(c => c.claimStage !== 'closed').length;
  const blockedTasks = displayClaims.filter(c => c.blockerReason).length;
  const queuedTasks = displayClaims.filter(c => c.claimStage === 'intake').length;
  
  // Operations metrics
  const throughputVsMonth = '+18%';
  const automationTouches = '72%';
  const cycleTime = '-31%';

  // ── Business-value KPIs (from the Progressive transcript feedback) ────────
  // STP rate and LAE minutes-saved are computed live from the same eligibility
  // rule as "clear the greens" batch approve — no separate definition to drift
  // out of sync. Combined-ratio and cost-per-PIF are demo-framing statics and
  // are clearly labelled as such (they are underwriting-level metrics no
  // per-adjuster queue view can compute live).
  const openQueueClaims = adjusterScopedClaims.filter(c => c.claimStage !== 'closed' && c.claimStage !== 'settlement');
  const stpEligibleClaims = openQueueClaims.filter(c => isBatchApproveEligible(c, activeAdjusterProfile?.authorityLimit));
  const stpRate = openQueueClaims.length > 0
    ? Math.round((stpEligibleClaims.length / openQueueClaims.length) * 100)
    : 0;
  const laeMinutesSaved = stpEligibleClaims.reduce((sum, c) => sum + estimatedEffortMins(c), 0);
  const combinedRatioDemo = '94.8%';
  const costPerPifDemo = '$142';

  return (
    <>
      <Grid className="decision-queue-page" fullWidth>
        <Column lg={16}>
        <div className="decision-queue-page__header">
          <div className="decision-queue-page__header-content">
            <div>
              <Heading>Decision Queue</Heading>
              <p className="decision-queue-page__description">
                Select your next case
              </p>
            </div>
          </div>
        </div>

        {error && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={error}
            onClose={() => setError('')}
            lowContrast
          />
        )}

        {batchResult && (
          <ToastNotification
            kind={batchResult.blocked > 0 ? 'warning' : 'success'}
            title="Batch approve complete"
            subtitle={
              batchResult.blocked > 0
                ? `${batchResult.approved} approved, ${batchResult.blocked} blocked by governance (still needs review — no bypass).`
                : `${batchResult.approved} claim${batchResult.approved === 1 ? '' : 's'} approved.`
            }
            onClose={() => setBatchResult(null)}
            lowContrast
            className="decision-queue-page__batch-toast"
          />
        )}

        {/* Live Operations Dashboard */}
        <div className="decision-queue-page__live-ops" ref={liveOpsRefCallback}>
          <button
            className="decision-queue-page__live-ops-toggle"
            onClick={() => setShowLiveOps(!showLiveOps)}
            type="button"
          >
            <div className="decision-queue-page__live-ops-header">
              <div className="decision-queue-page__live-ops-status">
                <CheckmarkFilled size={16} className="decision-queue-page__live-ops-icon" />
                <span className="decision-queue-page__live-ops-title">LIVE OPERATIONS</span>
                <Tag type="green" size="sm">On track</Tag>
                <span className="decision-queue-page__live-ops-time">
                  Stable � -  0 downtime in 24h � -  Apr 30, 2026, 11:39 AM
                </span>
              </div>
              {showLiveOps ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {showLiveOps && (
            <div className="decision-queue-page__live-ops-content">
              <Grid narrow>
                {/* Settlement Handoff */}
                <Column lg={4} md={4} sm={4}>
                  <Tile className="decision-queue-page__ops-tile">
                    <h4 className="decision-queue-page__ops-tile-title">SETTLEMENT HANDOFF</h4>
                    <p className="decision-queue-page__ops-tile-subtitle">Throughput</p>
                    <p className="decision-queue-page__ops-tile-description">
                      Resolved decisions becoming settlement-ready packages.
                    </p>
                    <div className="decision-queue-page__ops-metrics">
                      <div className="decision-queue-page__ops-metric">
                        <span className="decision-queue-page__ops-metric-value">{resolvedDecisions}</span>
                        <span className="decision-queue-page__ops-metric-label">this week</span>
                      </div>
                      <div className="decision-queue-page__ops-metric">
                        <span className="decision-queue-page__ops-metric-value">{blockedClaims}</span>
                        <span className="decision-queue-page__ops-metric-label">held judgment</span>
                      </div>
                      <div className="decision-queue-page__ops-metric">
                        <span className="decision-queue-page__ops-metric-value">{avgHandoffTime}</span>
                        <span className="decision-queue-page__ops-metric-label">handoff</span>
                      </div>
                    </div>
                    <div className="decision-queue-page__ops-latest">
                      <span className="decision-queue-page__ops-latest-label">LATEST READY</span>
                      <span className="decision-queue-page__ops-latest-value">
                        Robert Chang � -  CLM-2026-1015
                      </span>
                      <p className="decision-queue-page__ops-latest-description">
                        Settlement package complete. No active human decision blocker remains.
                      </p>
                      <Button kind="primary" size="sm">Review handoff</Button>
                    </div>
                  </Tile>
                </Column>

                {/* Performance */}
                <Column lg={4} md={4} sm={4}>
                  <Tile className="decision-queue-page__ops-tile">
                    <h4 className="decision-queue-page__ops-tile-title">PERFORMANCE</h4>
                    <p className="decision-queue-page__ops-tile-subtitle">Progress over time</p>
                    <p className="decision-queue-page__ops-tile-description">
                      Current handoff trend across operating windows.
                    </p>
                    <div className="decision-queue-page__ops-progress-section">
                      <div className="decision-queue-page__ops-progress-item">
                        <div className="decision-queue-page__ops-progress-header">
                          <span className="decision-queue-page__ops-progress-label">TODAY</span>
                          <span className="decision-queue-page__ops-progress-metric">Throughput pace</span>
                          <span className="decision-queue-page__ops-progress-impact">{throughputVsMonth}</span>
                          <span className="decision-queue-page__ops-progress-vs">vs morning</span>
                        </div>
                        <ProgressBar value={85} label="" />
                      </div>
                      <div className="decision-queue-page__ops-progress-item">
                        <div className="decision-queue-page__ops-progress-header">
                          <span className="decision-queue-page__ops-progress-label">WEEK</span>
                          <span className="decision-queue-page__ops-progress-metric">Touches avoided</span>
                          <span className="decision-queue-page__ops-progress-impact">{automationTouches}</span>
                          <span className="decision-queue-page__ops-progress-vs">no rework</span>
                        </div>
                        <ProgressBar value={72} label="" />
                      </div>
                      <div className="decision-queue-page__ops-progress-item">
                        <div className="decision-queue-page__ops-progress-header">
                          <span className="decision-queue-page__ops-progress-label">MONTH</span>
                          <span className="decision-queue-page__ops-progress-metric">Prep time</span>
                          <span className="decision-queue-page__ops-progress-impact">{cycleTime}</span>
                          <span className="decision-queue-page__ops-progress-vs">faster package</span>
                        </div>
                        <ProgressBar value={31} label="" />
                      </div>
                    </div>
                  </Tile>
                </Column>

                {/* Intake, Queue, Workers, Operations Grid */}
                <Column lg={8} md={8} sm={4}>
                  <Grid narrow className="decision-queue-page__ops-grid">
                    <Column lg={8} md={4} sm={4}>
                      <Tile className="decision-queue-page__ops-small-tile">
                        <h4 className="decision-queue-page__ops-small-title">Intake</h4>
                        <p className="decision-queue-page__ops-small-description">
                          New claims are being captured and sorted before they reach the queue.
                        </p>
                        <div className="decision-queue-page__ops-small-metrics">
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">New FNOL</span>
                            <span className="decision-queue-page__ops-small-value">{newFNOL}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Triaged<br/>ready for routing</span>
                            <span className="decision-queue-page__ops-small-value">{triaged}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Human review<br/>coverage or injury signal</span>
                            <span className="decision-queue-page__ops-small-value">{humanReview}</span>
                          </div>
                        </div>
                      </Tile>
                    </Column>

                    <Column lg={8} md={4} sm={4}>
                      <Tile className="decision-queue-page__ops-small-tile">
                        <h4 className="decision-queue-page__ops-small-title">Queue</h4>
                        <p className="decision-queue-page__ops-small-description">
                          The adjuster queue is organized around judgment calls, not claim ownership.
                        </p>
                        <div className="decision-queue-page__ops-small-metrics">
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">High priority<br/>ranked by exposure</span>
                            <span className="decision-queue-page__ops-small-value">{highPriority}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Open decisions<br/>847 claims</span>
                            <span className="decision-queue-page__ops-small-value">{openDecisionsQueue}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Blocked<br/>needs direction</span>
                            <span className="decision-queue-page__ops-small-value">{blockedQueue}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">{'<2 min'}<br/>quick approvals</span>
                            <span className="decision-queue-page__ops-small-value">{quickApprovals}</span>
                          </div>
                        </div>
                      </Tile>
                    </Column>

                    <Column lg={8} md={4} sm={4}>
                      <Tile className="decision-queue-page__ops-small-tile">
                        <h4 className="decision-queue-page__ops-small-title">Workers</h4>
                        <p className="decision-queue-page__ops-small-description">
                          Digital Workers are active, with a few waiting on human judgment.
                        </p>
                        <div className="decision-queue-page__ops-small-metrics">
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Active tasks<br/>24 workers</span>
                            <span className="decision-queue-page__ops-small-value">{activeTasks}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Blocked tasks<br/>4 worker lanes</span>
                            <span className="decision-queue-page__ops-small-value">{blockedTasks}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Queued tasks<br/>6 capacity pools</span>
                            <span className="decision-queue-page__ops-small-value">{queuedTasks}</span>
                          </div>
                        </div>
                      </Tile>
                    </Column>

                    <Column lg={8} md={4} sm={4}>
                      <Tile className="decision-queue-page__ops-small-tile">
                        <h4 className="decision-queue-page__ops-small-title">Operations</h4>
                        <p className="decision-queue-page__ops-small-description">
                          The operation is moving faster, but unresolved risk still needs attention.
                        </p>
                        <div className="decision-queue-page__ops-small-metrics">
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Throughput<br/>vs. moving pace</span>
                            <span className="decision-queue-page__ops-small-value decision-queue-page__ops-small-value--positive">{throughputVsMonth}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Automation<br/>touches avoided</span>
                            <span className="decision-queue-page__ops-small-value decision-queue-page__ops-small-value--positive">{automationTouches}</span>
                          </div>
                          <div className="decision-queue-page__ops-small-metric">
                            <span className="decision-queue-page__ops-small-label">Cycle time<br/>decision package prep</span>
                            <span className="decision-queue-page__ops-small-value decision-queue-page__ops-small-value--negative">{cycleTime}</span>
                          </div>
                        </div>
                      </Tile>
                    </Column>
                  </Grid>
                </Column>

                {/* Business Impact — STP rate & LAE minutes computed live from the
                    queue; combined-ratio and cost-per-PIF are clearly-labelled demo
                    statics (underwriting-level figures, not per-adjuster-queue data). */}
                <Column lg={16} md={8} sm={4}>
                  <Tile className="decision-queue-page__ops-tile decision-queue-page__business-impact-tile">
                    <h4 className="decision-queue-page__ops-tile-title">BUSINESS IMPACT</h4>
                    <p className="decision-queue-page__ops-tile-subtitle">
                      What this queue's automation is worth to the business
                    </p>
                    <div className="decision-queue-page__business-impact-grid">
                      <div className="decision-queue-page__business-impact-metric">
                        <span className="decision-queue-page__business-impact-value">{stpRate}%</span>
                        <span className="decision-queue-page__business-impact-label">
                          Straight-through eligible
                        </span>
                        <span className="decision-queue-page__business-impact-note">
                          Live — {stpEligibleClaims.length} of {openQueueClaims.length} open claims
                        </span>
                      </div>
                      <div className="decision-queue-page__business-impact-metric">
                        <span className="decision-queue-page__business-impact-value">{laeMinutesSaved}m</span>
                        <span className="decision-queue-page__business-impact-label">
                          Adjuster minutes saved
                        </span>
                        <span className="decision-queue-page__business-impact-note">
                          Live — sum of effort on auto-approvable claims
                        </span>
                      </div>
                      <div className="decision-queue-page__business-impact-metric">
                        <span className="decision-queue-page__business-impact-value">{combinedRatioDemo}</span>
                        <span className="decision-queue-page__business-impact-label">
                          Combined ratio contribution
                        </span>
                        <span className="decision-queue-page__business-impact-note">
                          Demo static — supports &lt;96% target
                        </span>
                      </div>
                      <div className="decision-queue-page__business-impact-metric">
                        <span className="decision-queue-page__business-impact-value">{costPerPifDemo}</span>
                        <span className="decision-queue-page__business-impact-label">
                          Cost per policy-in-force
                        </span>
                        <span className="decision-queue-page__business-impact-note">
                          Demo static — illustrative trend
                        </span>
                      </div>
                    </div>
                  </Tile>
                </Column>
              </Grid>

              {/* Bottom Summary Bar */}
              <div className="decision-queue-page__ops-summary">
                <div className="decision-queue-page__ops-summary-item">
                  <span className="decision-queue-page__ops-summary-label">OPEN DECISIONS</span>
                  <span className="decision-queue-page__ops-summary-value">{openDecisions}</span>
                </div>
                <div className="decision-queue-page__ops-summary-item">
                  <span className="decision-queue-page__ops-summary-label">HIGH URGENCY</span>
                  <span className="decision-queue-page__ops-summary-value">{highUrgency}</span>
                </div>
                <div className="decision-queue-page__ops-summary-item">
                  <span className="decision-queue-page__ops-summary-label">TOTAL CLAIMS</span>
                  <span className="decision-queue-page__ops-summary-value">{totalClaims}</span>
                </div>
                <div className="decision-queue-page__ops-summary-item">
                  <span className="decision-queue-page__ops-summary-label">OPEN EXPOSURE</span>
                  <span className="decision-queue-page__ops-summary-value">{formatCurrency(totalExposure)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Priority Decisions Cards - Separate Container */}
        {priorityCards.length > 0 && (
          <div className="decision-queue-page__priority-section">
            <Heading className="decision-queue-page__section-heading">Highest Priority Decisions</Heading>
            <p className="decision-queue-page__priority-subheading">Ranked in pickup order. Start with Rank #1.</p>
            <div className="decision-queue-page__priority-cards">
              {priorityCards.map((claim, index) => {
                const isHighlighted = index === 0;
                return (
                  <Tile
                    key={claim.id}
                    className={`decision-queue-page__priority-card ${
                      isHighlighted ? 'decision-queue-page__priority-card--highlighted' : ''
                    }${selectedClaimId === claim.id ? ' decision-queue-page__priority-card--selected' : ''}`}
                    onClick={() => handleClaimSelect(claim.id)}
                    onDoubleClick={() => handleClaimOpen(claim.id)}
                  >
                    <div className="decision-queue-page__card-flag">
                      {isHighlighted && (
                        <div className="decision-queue-page__next-pill">
                          <StarFilled size={12} />
                          Pick this next
                        </div>
                      )}
                    </div>
                    {isHighlighted && (
                      <div className="decision-queue-page__priority-indicator">
                        <Tooltip
                          align="top"
                          label="Prioritized: Ranked #1 for this adjuster using priority, confidence, queue age, and exposure."
                        >
                          <button className="decision-queue-page__priority-icon" type="button">
                            <Information size={16} />
                          </button>
                        </Tooltip>
                      </div>
                    )}
                    <div className="decision-queue-page__card-header">
                      <div className="decision-queue-page__card-id-row">
                        <span className="decision-queue-page__card-id">{claim.id}</span>
                        <Tag type={isHighlighted ? 'blue' : 'cool-gray'} size="sm">{`Rank #${index + 1}`}</Tag>
                        <PriorityScoreBadge score={getPriorityScoreFor(claim)} />
                      </div>
                      <Tag
                        type={confidenceTagType(claim.confidenceLevel) as any}
                        size="sm"
                      >
                        {capitalizeStage(claim.confidenceLevel)} Confidence
                      </Tag>
                    </div>
                    <h4 className="decision-queue-page__card-name">
                      {claim.claimantName}
                      <TierBadge tier={claim.clientServiceTier} />
                    </h4>
                    <RepresentativeNote representative={claim.appointedRepresentative} />
                    <div className="decision-queue-page__metric-grid">
                      <div className="decision-queue-page__metric-tile">
                        <span className="decision-queue-page__metric-value">
                          <ConfidencePopover claim={claim} align="bottom" />
                        </span>
                        <span className="decision-queue-page__metric-label">
                          Confidence{claim.blockerReason ? ' · needs input' : ''}
                        </span>
                        <div className="decision-queue-page__confidence-segments" aria-hidden="true">
                          {[0, 1, 2, 3, 4].map((i) => {
                            const filled =
                              i < Math.round(confidenceScore(claim) / 20);
                            return (
                              <span
                                key={i}
                                className={`decision-queue-page__confidence-segment${
                                  filled
                                    ? ` decision-queue-page__confidence-segment--on decision-queue-page__confidence-segment--${claim.confidenceLevel}`
                                    : ''
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div className="decision-queue-page__metric-tile">
                        {confidenceGapPts(claim) > 0 ? (
                          <>
                            <span className="decision-queue-page__metric-value decision-queue-page__metric-value--gap">
                              ↓ {confidenceGapPts(claim)} pts
                            </span>
                            <span className="decision-queue-page__metric-label">Gap to threshold</span>
                          </>
                        ) : (
                          <>
                            <span className="decision-queue-page__metric-value decision-queue-page__metric-value--ok">
                              ✓ Eligible
                            </span>
                            <span className="decision-queue-page__metric-label">Auto-approve</span>
                          </>
                        )}
                      </div>
                      <div className="decision-queue-page__metric-tile">
                        <span className="decision-queue-page__metric-value">
                          {estimatedEffortMins(claim)} min
                        </span>
                        <span className="decision-queue-page__metric-label">Estimated effort</span>
                      </div>
                      <div className="decision-queue-page__metric-tile">
                        <span className="decision-queue-page__metric-value">
                          {capitalizeStage(claim.claimStage)}
                        </span>
                        <span className="decision-queue-page__metric-label">Claim stage</span>
                      </div>
                    </div>
                    <div className="decision-queue-page__card-footer">
                      <Tag type={getDecisionBadgeColor(claim.pendingDecisionType) as any} size="sm">
                        {claim.pendingDecisionType.toUpperCase()}
                      </Tag>
                      <Tag type={priorityTagType(claim.priority) as any} size="sm">
                        {claim.priority.toUpperCase()}
                      </Tag>
                      <span className="decision-queue-page__card-raisedby">
                        <Bot size={14} /> Raised by {raisingAgentFor(claim)}
                      </span>
                    </div>
                    <div className="decision-queue-page__card-action">
                      <button
                        type="button"
                        className="decision-queue-page__card-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaimOpen(claim.id);
                        }}
                      >
                        Open {claim.claimantName.split(' ')[0]}&rsquo;s file
                        <ArrowRight size={16} className="decision-queue-page__card-link-arrow" />
                      </button>
                    </div>
                  </Tile>
                );
              })}
            </div>
          </div>
        )}

        {/* Other Open Decisions Table */}
        <div className="decision-queue-page__table-section">
          <Heading className="decision-queue-page__table-heading">Other Open Decisions</Heading>
          {selectedForBatch.size > 0 && (
            <div className="decision-queue-page__batch-bar">
              <span className="decision-queue-page__batch-bar-count">
                {selectedForBatch.size} ready claim{selectedForBatch.size === 1 ? '' : 's'} selected
              </span>
              <Button
                kind="primary"
                size="sm"
                renderIcon={CheckmarkFilled}
                disabled={batchApproving}
                onClick={() => void handleBatchApprove()}
              >
                {batchApproving ? 'Approving…' : `Approve ${selectedForBatch.size} ready claim${selectedForBatch.size === 1 ? '' : 's'}`}
              </Button>
              <Button kind="ghost" size="sm" disabled={batchApproving} onClick={() => setSelectedForBatch(new Set())}>
                Clear selection
              </Button>
            </div>
          )}
        </div>

        <DataTable rows={pagedRows} headers={headers}>
          {({
            rows,
            headers,
            getHeaderProps,
            getRowProps,
            getTableProps,
            getTableContainerProps,
          }) => (
            <TableContainer
              {...getTableContainerProps()}
              className="decision-queue-page__table-container"
            >
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch
                    placeholder="Search by Claim ID or Claimant Name"
                    onChange={(_event, value) => setSearchTerm(value || '')}
                  />
                  <Dropdown
                    id="decision-type-filter"
                    titleText=""
                    label="Filter by decision type"
                    items={decisionTypeItems}
                    itemToString={(item) => item?.text || ''}
                    selectedItem={decisionTypeItems.find((item) => item.id === decisionTypeFilter) || decisionTypeItems[0]}
                    onChange={({ selectedItem }) => setDecisionTypeFilter(selectedItem?.id || 'all')}
                    size="sm"
                  />
                  <Dropdown
                    id="confidence-filter"
                    titleText=""
                    label="Filter by confidence"
                    items={confidenceItems}
                    itemToString={(item) => item?.text || ''}
                    selectedItem={confidenceItems.find((item) => item.id === confidenceFilter) || confidenceItems[0]}
                    onChange={({ selectedItem }) => setConfidenceFilter(selectedItem?.id || 'all')}
                    size="sm"
                  />
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      {...getRowProps({ row })}
                      key={row.id}
                      onClick={() => handleClaimSelect(row.id)}
                      onDoubleClick={() => handleClaimOpen(row.id)}
                      className={`decision-queue-page__row${selectedClaimId === row.id ? ' decision-queue-page__row--selected' : ''}`}
                    >
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>

        {rows.length > 0 && (
          <Pagination
            totalItems={rows.length}
            pageSize={pageSize}
            pageSizes={[10, 20, 50]}
            page={currentPage}
            onChange={({ page, pageSize: newSize }) => {
              setCurrentPage(page);
              setPageSize(newSize);
            }}
            className="decision-queue-page__pagination"
          />
        )}
        {filteredClaims.length === 0 && !loading && (
          <div className="decision-queue-page__empty">
            <Heading>No claims found</Heading>
            <p>
              {searchTerm || decisionTypeFilter !== 'all' || confidenceFilter !== 'all'
                || !!activeAdjusterId
                ? 'Try adjusting your filters or search term.'
                : 'There are no pending decisions at this time.'}
            </p>
            <Button kind="primary" renderIcon={Add} onClick={handleNewClaim}>
              Create New Claim
            </Button>
          </div>
        )}

        {/* Chat Bubble - replaced by Digital Steward panel */}
      </Column>
      </Grid>
      <StewardChatPanel pageContext={stewardPageContext} topOffset={liveOpsTop} />
    </>
  );
};

// Made with Bob


