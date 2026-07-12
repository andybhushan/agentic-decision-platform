import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Grid,
  Column,
  Heading,
  Tag,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Button,
  Loading,
  InlineNotification,
  Breadcrumb,
  BreadcrumbItem,
  Modal,
  TextArea,
} from '@carbon/react';
import {
  View,
  WarningAltFilled,
  ArrowRight,
  CheckmarkFilled,
  Idea,
  User,
  Location,
  Calendar,
  Policy,
  Time,
  FlagFilled,
  Activity,
  DocumentTasks,
  Warning,
} from '@carbon/icons-react';
import { api } from '../services/api';
import { buildDecisionIntelligence } from '../data/decisionIntelligence';
import { buildDecisionBriefing } from '../data/decisionBriefing';
import type { Claim, DecisionTone } from '../types';
import { ClaimDocket } from '../components/ClaimDocket';
import { EvidenceIntelligenceModal } from '../components/EvidenceIntelligenceModal';
import { StewardChatPanel } from '../components/steward/StewardChatPanel';
import type { StewardPageContext } from '../services/stewardApi';
import { useAdjusterPersonaStore } from '../store/useAdjusterPersonaStore';
import { SOURCE_SYSTEMS, policySourceSystem, anomalySignalSourceSystem, paymentSourceSystem } from '../data/sourceSystems';
import { ConfidencePopover } from '../components/ConfidencePopover';
import './DecisionModePage.scss';

const toneClass = (tone: DecisionTone): string => `decision-mode-page__tone--${tone}`;

const fmtCurrency = (amount: number, currency = 'USD'): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
};

const VENDOR_TYPE_LABEL: Record<string, string> = {
  body_shop: 'Body Shop',
  mechanic: 'Mechanic',
  oem_dealer: 'OEM Dealer',
  tow_service: 'Tow / Storage',
};

const QUOTE_STATUS_COLOR: Record<string, 'green' | 'cyan' | 'red' | 'gray'> = {
  accepted: 'green',
  pending_review: 'cyan',
  rejected: 'red',
  superceded: 'gray',
};

interface BreakdownTableProps {
  breakdown: NonNullable<NonNullable<Claim['recommendedAction']['financialImpact']>['breakdown']>;
  currency: string;
}
const BreakdownTable = ({ breakdown, currency }: BreakdownTableProps) => {
  const netTotal = breakdown.reduce((s, b) => s + b.amount, 0);
  return (
    <table className="decision-mode-page__mini-breakdown">
      <colgroup>
        <col style={{ width: '28%' }} />
        <col />
        <col style={{ width: '14%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>Category</th>
          <th>Detail</th>
          <th className="decision-mode-page__num">Amount</th>
        </tr>
      </thead>
      <tbody>
        {breakdown.map((b, i) => (
          <tr
            key={i}
            className={
              b.isDeduction
                ? 'decision-mode-page__mini-breakdown-deduction'
                : b.isSubtotal
                ? 'decision-mode-page__mini-breakdown-subtotal'
                : ''
            }
          >
            <td className="decision-mode-page__mini-breakdown-cat">{b.category}</td>
            <td className="decision-mode-page__mini-breakdown-desc">{b.description}</td>
            <td className="decision-mode-page__mini-breakdown-amt">
              {b.isDeduction
                ? `(${fmtCurrency(Math.abs(b.amount), currency)})`
                : fmtCurrency(b.amount, currency)}
            </td>
          </tr>
        ))}
        <tr className="decision-mode-page__mini-breakdown-total">
          <td colSpan={2}>Net settlement (after deductible)</td>
          <td className="decision-mode-page__mini-breakdown-amt">
            {fmtCurrency(netTotal, currency)}
          </td>
        </tr>
      </tbody>
    </table>
  );
};

interface RepairQuotesPanelProps {
  quotes: NonNullable<NonNullable<Claim['recommendedAction']['financialImpact']>['repairQuotes']>;
  currency: string;
}
const RepairQuotesPanel = ({ quotes, currency }: RepairQuotesPanelProps) => (
  <div className="decision-mode-page__repair-quotes">
    <h5 className="decision-mode-page__repair-quotes-title">
      Linked repair quotes
      <span className="decision-mode-page__source-tag">via {SOURCE_SYSTEMS.REPAIR}</span>
    </h5>
    <table className="decision-mode-page__mini-breakdown decision-mode-page__mini-breakdown--quotes">
      <colgroup>
        <col style={{ width: '30%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '10%' }} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Vendor</th>
          <th>Type</th>
          <th className="decision-mode-page__num">Quote</th>
          <th>Received</th>
          <th>Status</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {quotes.map((q) => (
          <tr key={q.id}>
            <td className="decision-mode-page__mini-breakdown-cat">{q.vendor}</td>
            <td className="decision-mode-page__mini-breakdown-desc">{VENDOR_TYPE_LABEL[q.vendorType] ?? q.vendorType}</td>
            <td className="decision-mode-page__mini-breakdown-amt">{fmtCurrency(q.amount, currency)}</td>
            <td className="decision-mode-page__mini-breakdown-desc">{q.receivedDate}</td>
            <td className="decision-mode-page__quote-status">
              <Tag type={QUOTE_STATUS_COLOR[q.status] ?? 'gray'} size="sm">
                {q.status.replace('_', ' ')}
              </Tag>
            </td>
            <td className="decision-mode-page__quote-note-cell">
              {q.notes && <span className="decision-mode-page__quote-note">{q.notes}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const DecisionModePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { adjusters, activeAdjusterId } = useAdjusterPersonaStore();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [modalEvidenceId, setModalEvidenceId] = useState<string | null>(null);
  const [panelTop, setPanelTop] = useState<number | undefined>(undefined);
  const [tabContentTop, setTabContentTop] = useState<number | undefined>(undefined);
  const [focusedEntry, setFocusedEntry] = useState<{ key: string; label: string; detail?: string } | null>(null);
  const [evidenceRequestOpen, setEvidenceRequestOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ kind: 'success' | 'info'; title: string; subtitle: string } | null>(null);

  const toggleEntry = (key: string, label: string, detail?: string) => {
    setFocusedEntry((prev) => (prev?.key === key ? null : { key, label, detail }));
  };

  // Align the Steward panel top with the top of the persistent claim-details /
  // metrics section, so it sits alongside the cards and claim context rather
  // than starting partway down at the decision box.
  const claimContextRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setPanelTop(node.getBoundingClientRect().top);
    }
  }, []);

  // Measure where the outer TabPanels content starts so we can constrain the
  // tab area to stop 20px above the sticky action bar.
  const tabContentRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setTabContentTop(node.getBoundingClientRect().top);
    }
  }, []);

  const STICKY_CLEARANCE = 84; // 64px bar + 20px gap
  const tabContentMaxHeight = tabContentTop != null
    ? window.innerHeight - tabContentTop - STICKY_CLEARANCE
    : undefined;

  useEffect(() => {
    const loadClaim = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await api.getClaim(id);
        setClaim(data);
      } catch (err) {
        console.error('Failed to load claim:', err);
        setError('Failed to load claim. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadClaim();
  }, [id]);

  const handleApproveAction = () => {
    if (claim) {
      navigate(`/claims/${claim.id}/preview-action`);
    }
  };

  const handleRequestEvidence = () => {
    setActionReason('');
    setEvidenceRequestOpen(true);
  };

  const handleRedirect = () => {
    setActionReason('');
    setReassignOpen(true);
  };

  const submitEvidenceRequest = async () => {
    if (!claim || !id || !actionReason.trim()) return;
    try {
      setActionSubmitting(true);
      const updated = await api.submitDecision(id, {
        claimId: id,
        decision: 'more_info_needed',
        rationale: actionReason.trim(),
        timestamp: new Date().toISOString(),
        userId: 'adjuster-demo-user',
        nextAction: 'Additional evidence requested from claimant',
      });
      setClaim(updated);
      setEvidenceRequestOpen(false);
      setActionNotice({
        kind: 'info',
        title: 'More evidence requested',
        subtitle: `Claim ${id} is now awaiting additional evidence.`,
      });
    } catch (err) {
      console.error('Failed to request evidence:', err);
      setError('Failed to request more evidence. Please try again.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const submitReassign = async () => {
    if (!claim || !id || !actionReason.trim()) return;
    try {
      setActionSubmitting(true);
      const updated = await api.submitDecision(id, {
        claimId: id,
        decision: 'escalated',
        rationale: actionReason.trim(),
        timestamp: new Date().toISOString(),
        userId: 'adjuster-demo-user',
        nextAction: 'Redirected for reassignment / senior review',
      });
      setClaim(updated);
      setReassignOpen(false);
      setActionNotice({
        kind: 'success',
        title: 'Claim redirected',
        subtitle: `Claim ${id} has been escalated for reassignment.`,
      });
    } catch (err) {
      console.error('Failed to redirect claim:', err);
      setError('Failed to redirect/reassign. Please try again.');
    } finally {
      setActionSubmitting(false);
    }
  };

  const goToEvidence = (evParam?: string) => {
    if (!claim) return;
    const items = claim.evidenceItems ?? [];
    setModalEvidenceId(evParam ?? items[0]?.id ?? null);
    setEvidenceModalOpen(true);
  };

  if (loading) {
    return (
      <div className="decision-mode-page">
        <div className="decision-mode-page__loading">
          <Loading description="Loading claim..." withOverlay={false} />
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="decision-mode-page">
        <Grid fullWidth>
          <Column lg={16}>
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={error || 'Claim not found'}
              lowContrast
            />
            <Button onClick={() => navigate('/claims/queue')}>Back to Queue</Button>
          </Column>
        </Grid>
      </div>
    );
  }

  const intel = buildDecisionIntelligence(claim);
  const decisionBriefing = buildDecisionBriefing(claim, intel);
  const ra = claim.recommendedAction;

  // Governance gating for the sticky action bar:
  //  • needsSenior — the decision is outside this adjuster's authority (over limit,
  //    low confidence, ambiguous/excluded coverage, injury, anomalies, or a
  //    senior-routed decision type). The governed path is to redirect, never to
  //    self-approve, so the primary CTA becomes "Redirect to senior".
  //  • specialistReferral — per SOP-001's two independent escalation axes, Fraud
  //    Investigation / Policy Interpretation route DIRECTLY to SIU/Legal and
  //    bypass supervisor/senior sign-off entirely. "Redirect to senior" is not a
  //    valid unblock here regardless of the requesting adjuster's own seniority
  //    (a Principal adjuster has no "senior" above them, and even if they did,
  //    seniority doesn't substitute for the specialist's findings). No redirect
  //    button is shown for these — only evidence-gathering remains available
  //    while the specialist referral is pending.
  //  • blocked — excluded-coverage declinations that a senior CAN still review
  //    (redirect remains the valid action for this case).
  const needsSenior = intel.governance.requiresApproval;
  const specialistReferral = intel.governance.specialistReferralRequired === true;
  const routeLabel = specialistReferral
    ? claim.pendingDecisionType === 'Fraud Investigation'
      ? 'SIU referral'
      : 'Legal referral'
    : 'Senior adjuster queue';
  const blocked = claim.policyContext?.coverageApplicability === 'excluded';

  const stewardClaimSummary = {
    id: claim.id,
    claimantName: claim.claimantName,
    incidentType: claim.incidentType,
    stage: claim.claimStage,
    priority: claim.priority,
    confidenceLevel: claim.confidenceLevel,
    blockerReason: claim.blockerReason,
    timeInQueue: claim.timeInQueue,
    estimatedExposure: claim.recommendedAction?.financialImpact?.estimatedAmount,
    workingOn: claim.workingOn,
  };
  const activeAdjuster = activeAdjusterId
    ? adjusters.find((adjuster) => adjuster.id === activeAdjusterId) ?? null
    : null;

  const stewardPageContext: StewardPageContext = {
    pageName: `Decision Mode: ${claim.id}`,
    focusedClaimId: claim.id,
    focusedClaimRecord: {
      id: claim.id,
      claimantName: claim.claimantName,
      incidentType: claim.incidentType,
      incidentDate: claim.incidentDate,
      incidentLocation: claim.incidentLocation,
      incidentDescription: claim.incidentDescription,
      injuryIndicated: claim.injuryIndicated,
      policeReportRef: claim.policeReportRef,
      immediateNeeds: claim.immediateNeeds,
      policyRef: claim.policyRef,
      policyContext: claim.policyContext,
      claimStage: claim.claimStage,
      pendingDecisionType: claim.pendingDecisionType,
      blockerReason: claim.blockerReason,
      confidenceLevel: claim.confidenceLevel,
      lastAgentAction: claim.lastAgentAction,
      timeInQueue: claim.timeInQueue,
      priority: claim.priority,
      workingOn: claim.workingOn,
      evidenceItems: claim.evidenceItems ?? [],
      recommendedAction: {
        actionType: claim.recommendedAction.actionType,
        description: claim.recommendedAction.description,
        rationale: claim.recommendedAction.rationale,
        estimatedAmount: claim.recommendedAction.financialImpact?.estimatedAmount,
      },
    },
    priorityClaim: stewardClaimSummary,
    priorityReason: `Adjuster is reviewing this claim in Decision Mode. ${claim.blockerReason || ''}`.trim(),
    focusedEntry: focusedEntry ? { label: focusedEntry.label, detail: focusedEntry.detail } : undefined,
    activeAdjuster: activeAdjuster ? {
      id: activeAdjuster.id,
      name: activeAdjuster.name,
      team: activeAdjuster.team,
      seniority: activeAdjuster.seniority,
      yearsExperience: activeAdjuster.yearsExperience,
      specialisations: activeAdjuster.specialisations,
      currentWorkload: activeAdjuster.currentWorkload,
      maxCapacity: activeAdjuster.maxCapacity,
      authorityLimit: activeAdjuster.authorityLimit,
    } : undefined,
    allClaims: [stewardClaimSummary],
  };

  return (
    <div className="decision-mode-page">
      <Grid fullWidth>
        <Column lg={16}>
          <Breadcrumb noTrailingSlash className="decision-mode-page__breadcrumb">
            <BreadcrumbItem onClick={() => navigate('/claims/queue')}>
              Decision Queue
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>{claim.id}</BreadcrumbItem>
          </Breadcrumb>
          {actionNotice && (
            <InlineNotification
              kind={actionNotice.kind}
              title={actionNotice.title}
              subtitle={actionNotice.subtitle}
              onClose={() => setActionNotice(null)}
              lowContrast
            />
          )}
          <div className="decision-mode-page__header">
            <Heading>Decision Mode: {claim.id}</Heading>
            <div className="decision-mode-page__header-tags">
              <Tag type={claim.confidenceLevel === 'high' ? 'green' : claim.confidenceLevel === 'medium' ? 'cyan' : 'red'}>
                {claim.confidenceLevel.toUpperCase()} CONFIDENCE
              </Tag>
              <ConfidencePopover claim={claim} align="bottom" />
              <Tag type={claim.priority === 'urgent' ? 'red' : claim.priority === 'high' ? 'magenta' : 'blue'}>
                {claim.priority.toUpperCase()} PRIORITY
              </Tag>
            </div>
          </div>
        </Column>

        {/* -- Persistent claim context + metrics (visible across all tabs) -- */}
        <Column lg={16}>
          <div className="decision-mode-page__context-strip" ref={claimContextRefCallback}>
            <div className="decision-mode-page__context-item">
              <User size={14} />
              <span className="decision-mode-page__context-label">Claimant</span>
              <span className="decision-mode-page__context-value">{claim.claimantName}</span>
            </div>
            <div className="decision-mode-page__context-item">
              <Policy size={14} />
              <span className="decision-mode-page__context-label">Policy</span>
              <span className="decision-mode-page__context-value">{claim.policyRef}</span>
            </div>
            <div className="decision-mode-page__context-item">
              <Warning size={14} />
              <span className="decision-mode-page__context-label">Incident</span>
              <span className="decision-mode-page__context-value">{claim.incidentType}</span>
            </div>
            <div className="decision-mode-page__context-item">
              <Calendar size={14} />
              <span className="decision-mode-page__context-label">Date</span>
              <span className="decision-mode-page__context-value">
                {new Date(claim.incidentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="decision-mode-page__context-item">
              <Location size={14} />
              <span className="decision-mode-page__context-label">Location</span>
              <span className="decision-mode-page__context-value">{claim.incidentLocation}</span>
            </div>
            <div className={`decision-mode-page__context-item decision-mode-page__context-item--sla${claim.priority === 'urgent' ? ' is-urgent' : claim.priority === 'high' ? ' is-high' : ''}`}>
              <Time size={14} />
              <span className="decision-mode-page__context-label">In queue</span>
              <span className="decision-mode-page__context-value">{claim.timeInQueue}</span>
            </div>
            {claim.assignedAdjusterName && (
              <div className="decision-mode-page__context-item">
                <User size={14} />
                <span className="decision-mode-page__context-label">Assigned to</span>
                <span className="decision-mode-page__context-value">{claim.assignedAdjusterName}</span>
              </div>
            )}
            {claim.claimantPhone && (
              <div className="decision-mode-page__context-item">
                <span className="decision-mode-page__context-label">Contact</span>
                <span className="decision-mode-page__context-value">{claim.preferredContactChannel} � {claim.claimantPhone}</span>
              </div>
            )}
          </div>

          <div className="decision-mode-page__metrics">
            {intel.metrics.map((m) => (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                className={`decision-mode-page__metric decision-mode-page__entry ${toneClass(m.tone)}${focusedEntry?.key === `metric-${m.id}` ? ' is-selected' : ''}`}
                onClick={() => toggleEntry(`metric-${m.id}`, `${m.label}: ${m.value}`, m.detail)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEntry(`metric-${m.id}`, `${m.label}: ${m.value}`, m.detail); } }}
              >
                <span className="decision-mode-page__metric-label">{m.label}</span>
                <span className="decision-mode-page__metric-value">{m.value}</span>
                {m.progress != null && (
                  <div className="decision-mode-page__metric-bar">
                    <span style={{ width: `${m.progress}%` }} />
                  </div>
                )}
                <span className="decision-mode-page__metric-detail">{m.detail}</span>
              </div>
            ))}
          </div>
        </Column>

        <Column lg={16}>
          <Tabs>
            <TabList aria-label="Claim workspace">
              <Tab>Decision Mode</Tab>
              <Tab>Full Claim</Tab>
              <Tab>Settlement Hand Off</Tab>
            </TabList>
            <div
              ref={tabContentRefCallback}
              className="decision-mode-page__tabs-scroll-area"
              style={tabContentMaxHeight != null ? { maxHeight: `${tabContentMaxHeight}px`, overflowY: 'auto' } : undefined}
            >
            <TabPanels>
              {/* ─── DECISION MODE ─────────────────────────────────────────── */}
              <TabPanel>
                <Tabs>
                  <TabList aria-label="Decision detail" contained>
                    <Tab>Decision Needed</Tab>
                    <Tab>Decision Related Evidence</Tab>
                    <Tab>Outstanding Items</Tab>
                    <Tab>Agent Activity</Tab>
                  </TabList>
                  <TabPanels>
                    {/* Decision Needed */}
                    <TabPanel className="decision-mode-page__subpanel">
                      <div className="decision-mode-page__needed-layout">
                        <div className="decision-mode-page__needed-main">
                {/* Decision needed box */}
                <section
                  className={`decision-mode-page__decision-box ${toneClass(intel.governance.tone)}`}
                >
                  <div className="decision-mode-page__decision-head">
                    <div className="decision-mode-page__panel-head">
                      <DocumentTasks size={24} />
                      <h2>{claim.pendingDecisionType}</h2>
                    </div>
                    <Tag
                      type={
                        intel.governance.requiresApproval
                          ? intel.governance.tone === 'critical'
                            ? 'red'
                            : 'magenta'
                          : 'green'
                      }
                      renderIcon={
                        intel.governance.requiresApproval ? WarningAltFilled : CheckmarkFilled
                      }
                    >
                      {intel.governance.requiresApproval ? 'APPROVAL REQUIRED' : 'WITHIN AUTHORITY'}
                    </Tag>
                  </div>

                  <p className="decision-mode-page__decision-summary">
                    {intel.governance.summary}
                  </p>

                  {/* Policy coverage + approval chain */}
                  <div className="decision-mode-page__policy-bar">
                    <div className="decision-mode-page__policy-bar-item">
                      <Policy size={14} />
                      <span className="decision-mode-page__policy-bar-label">Coverage type</span>
                      <span className="decision-mode-page__policy-bar-value">{claim.policyContext.coverageType}</span>
                      <span className="decision-mode-page__source-tag">via {policySourceSystem()}</span>
                    </div>
                    <div className="decision-mode-page__policy-bar-item">
                      <span className="decision-mode-page__policy-bar-label">Coverage status</span>
                      <Tag
                        size="sm"
                        type={
                          claim.policyContext.coverageApplicability === 'covered'
                            ? 'green'
                            : claim.policyContext.coverageApplicability === 'excluded'
                            ? 'red'
                            : 'cyan'
                        }
                      >
                        {claim.policyContext.coverageApplicability.toUpperCase()}
                      </Tag>
                    </div>
                    {intel.governance.requiresApproval && (
                      <div className="decision-mode-page__policy-bar-item">
                        <WarningAltFilled size={14} style={{ fill: 'var(--cds-support-warning)' }} />
                        <span className="decision-mode-page__policy-bar-label">Routes to</span>
                        <span className="decision-mode-page__policy-bar-value">{routeLabel}</span>
                      </div>
                    )}
                    {claim.handlingMode && (
                      <div className="decision-mode-page__policy-bar-item">
                        <span className="decision-mode-page__policy-bar-label">Handling mode</span>
                        <Tag size="sm" type="blue">
                          {claim.handlingMode === 'ai' ? 'AI' : claim.handlingMode === 'ai_oversight' ? 'AI + Oversight' : 'Human'}
                        </Tag>
                      </div>
                    )}
                  </div>

                  {/* Fraud / anomaly signals */}
                  {claim.anomalySignals && claim.anomalySignals.length > 0 && (
                    <div className="decision-mode-page__anomaly-bar">
                      <div className="decision-mode-page__panel-head">
                        <FlagFilled size={24} />
                        <h2>Risk &amp; anomaly signals</h2>
                        <span className="decision-mode-page__source-tag">via {anomalySignalSourceSystem()}</span>
                        {claim.anomalySignals.some(s => s.severity === 'high') && (
                          <Tag type="red" size="sm">HIGH RISK</Tag>
                        )}
                      </div>
                      <div className="decision-mode-page__anomaly-pills">
                        {claim.anomalySignals.map((sig) => (
                          <button
                            key={sig.id}
                            type="button"
                            className={`decision-mode-page__anomaly-pill decision-mode-page__anomaly-pill--${sig.severity} decision-mode-page__entry${focusedEntry?.key === `anomaly-${sig.id}` ? ' is-selected' : ''}`}
                            onClick={() => toggleEntry(`anomaly-${sig.id}`, sig.description, sig.explanation)}
                            title={sig.explanation}
                          >
                            <span className="decision-mode-page__anomaly-pill-dot" />
                            <span>{sig.type}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {intel.governance.reasons.length > 0 && (
                    <ul className="decision-mode-page__governance-reasons">
                      {intel.governance.reasons.map((r, i) => (
                        <li
                          key={i}
                          role="button"
                          tabIndex={0}
                          className={`decision-mode-page__entry${focusedEntry?.key === `reason-${i}` ? ' is-selected' : ''}`}
                          onClick={() => toggleEntry(`reason-${i}`, r)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEntry(`reason-${i}`, r); } }}
                        >{r}</li>
                      ))}
                    </ul>
                  )}

                  {/* Recommended action + buttons */}
                  {ra && (
                    <div className="decision-mode-page__decision-action">
                      <div className="decision-mode-page__decision-action-info">
                        <div className="decision-mode-page__panel-head">
                          <CheckmarkFilled size={24} />
                          <h2>Recommended action</h2>
                        </div>
                        <div className="decision-mode-page__recommendation-head">
                          <h3>{ra.actionType}</h3>
                          <Tag
                            type={
                              ra.confidence === 'high'
                                ? 'green'
                                : ra.confidence === 'medium'
                                ? 'cyan'
                                : 'red'
                            }
                            size="sm"
                          >
                            {ra.confidence.toUpperCase()} CONFIDENCE
                          </Tag>
                        </div>
                        <p className="decision-mode-page__recommendation-desc">{ra.description}</p>
                        {ra.financialImpact?.estimatedAmount != null && (
                          <p className="decision-mode-page__recommendation-amount">
                            Estimated settlement:{' '}
                            <strong>
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: ra.financialImpact.currency ?? 'USD',
                                maximumFractionDigits: 0,
                              }).format(ra.financialImpact.estimatedAmount)}
                            </strong>
                          </p>
                        )}
                        {ra.financialImpact?.breakdown && ra.financialImpact.breakdown.length > 0 && (
                          <>
                            <BreakdownTable
                              breakdown={ra.financialImpact.breakdown}
                              currency={ra.financialImpact.currency ?? 'USD'}
                            />
                            {ra.financialImpact.repairQuotes && ra.financialImpact.repairQuotes.length > 0 && (
                              <RepairQuotesPanel
                                quotes={ra.financialImpact.repairQuotes}
                                currency={ra.financialImpact.currency ?? 'USD'}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </section>
                        </div>{/* /__needed-main */}

                        <div className="decision-mode-page__needed-sidebar">
                {/* Things to consider */}
                <section className="decision-mode-page__consider">
                  <div className="decision-mode-page__panel-head">
                    <Idea size={24} />
                    <h2>Things to consider</h2>
                  </div>
                  <ul className="decision-mode-page__consider-list">
                    {intel.insights.map((ins) => (
                      <li
                        key={ins.id}
                        role="button"
                        tabIndex={0}
                        className={`decision-mode-page__consider-item decision-mode-page__entry decision-mode-page__sev--${ins.severity}${focusedEntry?.key === `insight-${ins.id}` ? ' is-selected' : ''}`}
                        onClick={() => toggleEntry(`insight-${ins.id}`, ins.title, ins.detail)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEntry(`insight-${ins.id}`, ins.title, ins.detail); } }}
                      >
                        <span className="decision-mode-page__consider-title">{ins.title}</span>
                        <span className="decision-mode-page__consider-detail">{ins.detail}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                        </div>{/* /__needed-sidebar */}
                      </div>{/* /__needed-layout */}
                    </TabPanel>

                    {/* Decision Related Evidence */}
                    <TabPanel className="decision-mode-page__subpanel">
                {/* Decision-relevant evidence */}
                <section className="decision-mode-page__relevant">
                  <div className="decision-mode-page__panel-head">
                    <View size={24} />
                    <h2>Decision-relevant evidence</h2>
                  </div>
                  <ul className="decision-mode-page__relevant-list">
                    {intel.relevantEvidence.map((re) => (
                      <li key={re.item.id}>
                        <button
                          type="button"
                          className={`decision-mode-page__relevant-item ${toneClass(re.tone)}`}
                          onClick={() => goToEvidence(re.deepLinkParam)}
                        >
                          <div className="decision-mode-page__relevant-head">
                            <span className="decision-mode-page__relevant-type">{re.item.type}</span>
                            <Tag
                              type={
                                re.item.status === 'verified'
                                  ? 'green'
                                  : re.item.status === 'disputed'
                                  ? 'red'
                                  : 'cyan'
                              }
                              size="sm"
                            >
                              {re.item.status.charAt(0).toUpperCase() + re.item.status.slice(1)}
                            </Tag>
                          </div>
                          <span className="decision-mode-page__relevant-why">{re.relevance}</span>
                          <span className="decision-mode-page__relevant-cta">
                            Trace the truth <ArrowRight size={14} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={ArrowRight}
                    onClick={() => goToEvidence()}
                  >
                    Open Evidence Intelligence
                  </Button>
                </section>

                {/* -- Related claims ---------------------------------- */}
                {claim.relatedClaims && claim.relatedClaims.length > 0 && (
                  <section className="decision-mode-page__related">
                    <div className="decision-mode-page__panel-head">
                      <DocumentTasks size={24} />
                      <h2>Related claims</h2>
                    </div>
                    <ul className="decision-mode-page__related-list">
                      {claim.relatedClaims.map((rc) => (
                        <li key={rc.claimId} className="decision-mode-page__related-item">
                          <span className="decision-mode-page__related-id">{rc.claimId}</span>
                          <span className="decision-mode-page__related-name">{rc.claimantName}</span>
                          <span className="decision-mode-page__related-date">
                            {new Date(rc.incidentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="decision-mode-page__related-reason">{rc.matchReason}</span>
                          <Tag size="sm" type={rc.matchScore > 0.8 ? 'red' : rc.matchScore > 0.5 ? 'magenta' : 'blue'}>
                            {Math.round(rc.matchScore * 100)}% match
                          </Tag>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                    </TabPanel>

                    {/* Outstanding Items */}
                    <TabPanel className="decision-mode-page__subpanel">
                {/* -- Outstanding blockers ----------------------------- */}
                {(claim.blockerReason || claim.workingOn || (claim.evidenceItems ?? []).some(e => e.status !== 'verified')) && (
                  <section className="decision-mode-page__blockers">
                    <div className="decision-mode-page__panel-head">
                      <DocumentTasks size={24} />
                      <h2>Outstanding items</h2>
                    </div>
                    <ul className="decision-mode-page__blockers-list">
                      {claim.blockerReason && (
                        <li className="decision-mode-page__blocker-item decision-mode-page__blocker-item--critical">
                          <WarningAltFilled size={16} />
                          <div>
                            <strong>Blocker</strong>
                            <p>{claim.blockerReason}</p>
                          </div>
                        </li>
                      )}
                      {claim.workingOn && (
                        <li className="decision-mode-page__blocker-item decision-mode-page__blocker-item--info">
                          <Activity size={24} />
                          <div>
                            <strong>In progress</strong>
                            <p>{claim.workingOn}</p>
                          </div>
                        </li>
                      )}
                      {(claim.evidenceItems ?? []).filter(e => e.status !== 'verified').map(e => (
                        <li key={e.id} className={`decision-mode-page__blocker-item decision-mode-page__blocker-item--${e.status === 'disputed' ? 'critical' : 'caution'}`}>
                          <View size={24} />
                          <div>
                            <strong>{e.type} � {e.status.toUpperCase()}</strong>
                            {e.description && <p>{e.description}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {!(claim.blockerReason || claim.workingOn || (claim.evidenceItems ?? []).some(e => e.status !== 'verified')) && (
                  <div className="decision-mode-page__empty">
                    <CheckmarkFilled size={20} />
                    <p>No outstanding items. All evidence is verified and nothing is blocking this decision.</p>
                  </div>
                )}
                    </TabPanel>

                    {/* Agent Activity */}
                    <TabPanel className="decision-mode-page__subpanel">
                {/* -- Agent activity trail ----------------------------- */}
                {(claim.lastAgentAction || claim.auditTrail?.length > 0) && (
                  <section className="decision-mode-page__agent-trail">
                    <div className="decision-mode-page__panel-head">
                      <Activity size={24} />
                      <h2>Agent activity</h2>
                    </div>
                    {claim.governanceDecision && (
                      <div
                        className={`decision-mode-page__gov-verdict decision-mode-page__gov-verdict--${claim.governanceDecision.status}`}
                      >
                        <Tag
                          type={
                            claim.governanceDecision.status === 'blocked'
                              ? 'red'
                              : claim.governanceDecision.status === 'requires_senior_approval'
                              ? 'magenta'
                              : 'green'
                          }
                          size="sm"
                        >
                          {claim.governanceDecision.status === 'blocked'
                            ? 'Blocked'
                            : claim.governanceDecision.status === 'requires_senior_approval'
                            ? 'Senior approval'
                            : 'Within authority'}
                        </Tag>
                        <span className="decision-mode-page__gov-verdict-text">
                          Last decision: {claim.governanceDecision.decision.replace(/_/g, ' ')}
                          {claim.governanceDecision.approver?.name &&
                            ` � approved by ${claim.governanceDecision.approver.name}`}
                          {claim.governanceDecision.reasons.length > 0 &&
                            ` � ${claim.governanceDecision.reasons[0]}`}
                        </span>
                      </div>
                    )}
                    {claim.lastAgentAction && (
                      <p className="decision-mode-page__agent-last">{claim.lastAgentAction}</p>
                    )}
                    {claim.auditTrail && claim.auditTrail.length > 0 && (
                      <ol className="decision-mode-page__trail-list">
                        {claim.auditTrail.slice(-5).reverse().map((entry, i) => (
                          <li key={i} className="decision-mode-page__trail-item">
                            <span className="decision-mode-page__trail-ts">
                              {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="decision-mode-page__trail-actor">{entry.userId}</span>
                            <span className="decision-mode-page__trail-action">{entry.action}</span>
                            {entry.outcome && (
                              <span className="decision-mode-page__trail-outcome">{entry.outcome}</span>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                )}
                {!(claim.lastAgentAction || claim.auditTrail?.length > 0) && (
                  <div className="decision-mode-page__empty">
                    <Activity size={20} />
                    <p>No agent activity has been recorded for this claim yet.</p>
                  </div>
                )}
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </TabPanel>

              {/* --- FULL CLAIM (Evidence / Policy / Consent) ---------------- */}
              <TabPanel>
                <div className="decision-mode-page__full-claim">
                  <ClaimDocket claim={claim} />
                </div>
              </TabPanel>

              {/* ─── SETTLEMENT HAND OFF ───────────────────────────────────── */}
              <TabPanel>
                <Grid className="decision-mode-page__handoff" condensed>
                  <Column lg={16}>
                    <section className="decision-mode-page__handoff-box">
                      <div className="decision-mode-page__panel-head">
                        <ArrowRight size={24} />
                        <h2>Settlement hand-off</h2>
                      </div>

                      <InlineNotification
                        kind={intel.governance.requiresApproval ? 'warning' : 'success'}
                        title={
                          intel.governance.requiresApproval
                            ? 'Not yet ready to hand off'
                            : 'Ready to hand off'
                        }
                        subtitle={
                          intel.governance.requiresApproval
                            ? specialistReferral
                              ? `This claim is blocked pending ${routeLabel} findings before it can be packaged for settlement.`
                              : 'Senior approval is required before this settlement can be packaged for payment.'
                            : 'This claim is within delegated authority and can be packaged for settlement.'
                        }
                        hideCloseButton
                        lowContrast
                      />

                      {ra && (
                        <div className="decision-mode-page__handoff-meta">
                          <div>
                            <span className="decision-mode-page__eyebrow">Action</span>
                            <p>{ra.actionType}</p>
                          </div>
                          <div>
                            <span className="decision-mode-page__eyebrow">Estimated settlement</span>
                            <p>
                              {ra.financialImpact?.estimatedAmount != null
                                ? fmtCurrency(
                                    ra.financialImpact.estimatedAmount,
                                    ra.financialImpact.currency ?? 'USD',
                                  )
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <span className="decision-mode-page__eyebrow">Routes to</span>
                            <p>
                              {intel.governance.requiresApproval
                                ? routeLabel
                                : 'Payments processing'}
                            </p>
                          </div>
                          <div>
                            <span className="decision-mode-page__eyebrow">Current owner</span>
                            <p>{claim.owner ?? 'Unassigned'}</p>
                          </div>
                        </div>
                      )}

                      {ra?.financialImpact?.breakdown &&
                        ra.financialImpact.breakdown.length > 0 && (
                          <>
                            <BreakdownTable
                              breakdown={ra.financialImpact.breakdown}
                              currency={ra.financialImpact.currency ?? 'USD'}
                            />
                            {ra.financialImpact.repairQuotes && ra.financialImpact.repairQuotes.length > 0 && (
                              <RepairQuotesPanel
                                quotes={ra.financialImpact.repairQuotes}
                                currency={ra.financialImpact.currency ?? 'USD'}
                              />
                            )}
                          </>
                        )}

                      {/* Governed execution — which agent acts, which systems it reads
                          from / writes to, and what the claimant is told. This is the
                          orchestration story: one agent, several systems of record,
                          nothing hidden from the adjuster before they approve. */}
                      <div className="decision-mode-page__governed-execution">
                        <h5 className="decision-mode-page__repair-quotes-title">Governed execution</h5>
                        <div className="decision-mode-page__governed-execution-grid">
                          <div className="decision-mode-page__governed-execution-item">
                            <span className="decision-mode-page__eyebrow">Acting agent</span>
                            <p>{ra?.agentName || ra?.agentId || 'Digital Steward'}</p>
                          </div>
                          <div className="decision-mode-page__governed-execution-item">
                            <span className="decision-mode-page__eyebrow">Reads from</span>
                            <p>{policySourceSystem()}, {SOURCE_SYSTEMS.EVIDENCE}</p>
                          </div>
                          <div className="decision-mode-page__governed-execution-item">
                            <span className="decision-mode-page__eyebrow">Writes to</span>
                            <p>{paymentSourceSystem()}, {policySourceSystem()} (reserve update)</p>
                          </div>
                          <div className="decision-mode-page__governed-execution-item">
                            <span className="decision-mode-page__eyebrow">Client communication</span>
                            <p>{ra?.claimantMessage || 'No claimant message drafted for this action.'}</p>
                          </div>
                        </div>
                      </div>

                      <p className="decision-mode-page__handoff-note">
                        Hand-off packaging is illustrative in this demo — no payment instruction is
                        generated.
                      </p>
                    </section>
                  </Column>
                </Grid>
              </TabPanel>
            </TabPanels>
            </div>
          </Tabs>
        </Column>
      </Grid>

      {/* Sticky action bar */}
      {ra && (
        <div className="decision-mode-page__sticky-actions">
          <div className="decision-mode-page__sticky-label">
            <span className="decision-mode-page__sticky-label-text">
              Recommended: <strong>{ra.actionType}</strong>
            </span>
            <Tag
              type={ra.confidence === 'high' ? 'green' : ra.confidence === 'medium' ? 'cyan' : 'red'}
              size="sm"
            >
              {ra.confidence.toUpperCase()} CONFIDENCE
            </Tag>
            {blocked && (
              <Tag type="red" size="sm">
                APPROVAL BLOCKED — REDIRECT REQUIRED
              </Tag>
            )}
            {specialistReferral && (
              <Tag type="red" size="sm">
                BLOCKED — {routeLabel.toUpperCase()} REQUIRED
              </Tag>
            )}
          </div>
          <div className="decision-mode-page__sticky-buttons">
            {specialistReferral ? (
              <>
                <Button kind="tertiary" size="sm" onClick={handleRequestEvidence}>
                  Request more evidence
                </Button>
                <Button kind="ghost" size="sm" disabled>
                  Cannot approve — pending {routeLabel}
                </Button>
              </>
            ) : needsSenior ? (
              <>
                <Button kind="tertiary" size="sm" onClick={handleRequestEvidence}>
                  Request more evidence
                </Button>
                <Button size="sm" renderIcon={ArrowRight} onClick={handleRedirect}>
                  Redirect to senior
                </Button>
              </>
            ) : (
              <>
                <Button kind="ghost" size="sm" onClick={handleRedirect}>
                  Redirect / reassign
                </Button>
                <Button kind="tertiary" size="sm" onClick={handleRequestEvidence}>
                  Request more evidence
                </Button>
                <Button size="sm" renderIcon={ArrowRight} onClick={handleApproveAction}>
                  Approve action
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <EvidenceIntelligenceModal
        open={evidenceModalOpen}
        claim={claim}
        evidenceId={modalEvidenceId}
        onClose={() => setEvidenceModalOpen(false)}
      />

      <Modal
        open={evidenceRequestOpen}
        modalHeading="Request more evidence"
        primaryButtonText={actionSubmitting ? 'Requesting�' : 'Request evidence'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={actionSubmitting || !actionReason.trim()}
        onRequestSubmit={submitEvidenceRequest}
        onRequestClose={() => !actionSubmitting && setEvidenceRequestOpen(false)}
        onSecondarySubmit={() => setEvidenceRequestOpen(false)}
        preventCloseOnClickOutside={actionSubmitting}
      >
        <p style={{ marginBottom: '1rem' }}>
          Describe what is missing. The claim will be marked as awaiting evidence and the
          request logged to the audit trail.
        </p>
        <TextArea
          id="evidence-request-reason"
          labelText="What evidence is needed?"
          placeholder="e.g. Itemised repair estimate from an approved garage."
          value={actionReason}
          onChange={(e) => setActionReason(e.target.value)}
          rows={3}
        />
      </Modal>

      <Modal
        open={reassignOpen}
        modalHeading="Redirect / reassign"
        primaryButtonText={actionSubmitting ? 'Redirecting�' : 'Redirect claim'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={actionSubmitting || !actionReason.trim()}
        onRequestSubmit={submitReassign}
        onRequestClose={() => !actionSubmitting && setReassignOpen(false)}
        onSecondarySubmit={() => setReassignOpen(false)}
        preventCloseOnClickOutside={actionSubmitting}
      >
        <p style={{ marginBottom: '1rem' }}>
          Escalate this claim for reassignment or senior review. The reason is recorded on the
          audit trail and the claim is raised to urgent priority.
        </p>
        <TextArea
          id="reassign-reason"
          labelText="Reason for redirect / reassignment"
          placeholder="e.g. Requires specialist injury adjuster � outside my delegated authority."
          value={actionReason}
          onChange={(e) => setActionReason(e.target.value)}
          rows={3}
        />
      </Modal>

      <StewardChatPanel pageContext={stewardPageContext} topOffset={panelTop} bottomOffset={ra ? 84 : undefined} hideWelcome decisionBriefing={decisionBriefing} />
    </div>
  );
};

// Made with Bob
