import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Column,
  Grid,
  Heading,
  InlineNotification,
  Loading,
  Modal,
  Tag,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  TextArea,
  TextInput,
} from '@carbon/react';
import { CheckmarkFilled, WarningAlt, Information, User, Policy, Warning, Calendar, Location, Time, DocumentTasks, View, ArrowRight, FlagFilled, Activity } from '@carbon/icons-react';
import { api } from '../services/api';
import { LiveAgentActivity } from '../components/LiveAgentActivity';
import { TierBadge, RepresentativeNote } from '../components/TierBadge';
import { buildDecisionIntelligence } from '../data/decisionIntelligence';
import { StewardChatPanel } from '../components/steward/StewardChatPanel';
import type { StewardPageContext } from '../services/stewardApi';
import type { Claim } from '../types';
import './ActionPreviewPage.scss';

const fmtCurrency = (amount: number, currency = 'USD'): string => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
};

// Canonical governed-action taxonomy labels (kept in sync with the backend).
const CANONICAL_CATEGORY_LABELS: Record<string, string> = {
  approve: 'Approve',
  'route-to-adjuster': 'Route to adjuster',
  'request-info': 'Request info',
  'recommend-deny-for-human-review': 'Recommend deny — human review',
};

// Classify a recommended next step as agent-automatable or human-only. Steps that
// require judgement, authorisation or escalation are reserved for a human; the
// rest are carried out by the agent on execution.
const HUMAN_STEP_PATTERNS = [
  'human review',
  'authoris',
  'authoriz',
  'escalate',
  'senior',
  'managing agent',
  'do not',
  'maintain the reserve',
  'sign-off',
  'sign off',
];
const isHumanStep = (step: string): boolean => {
  const s = step.toLowerCase();
  return HUMAN_STEP_PATTERNS.some((p) => s.includes(p));
};

const ActionPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approverName, setApproverName] = useState('');
  const [approverRole, setApproverRole] = useState('Senior Adjuster');
  const [submitting, setSubmitting] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const submittedRef = useRef(false);
  const [panelTop, setPanelTop] = useState<number | undefined>(undefined);

  // Align the Steward panel top with the context strip — same pattern as DecisionModePage.
  const contextStripRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setPanelTop(node.getBoundingClientRect().top);
  }, []);

  const requiresApproval = claim ? buildDecisionIntelligence(claim).governance.requiresApproval : false;
  // Mirror the backend hard-block so a never-approvable action can't collect an
  // approver or report success: excluded coverage, or fraud + high anomalies.
  const hardBlocked = claim
    ? claim.policyContext?.coverageApplicability === 'excluded' ||
      (claim.pendingDecisionType === 'Fraud Investigation' &&
        (claim.anomalySignals ?? []).filter((a) => a.severity === 'high').length > 0)
    : false;

  useEffect(() => {
    const loadClaim = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await api.getClaim(id);
        setClaim(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load claim');
      } finally {
        setLoading(false);
      }
    };

    loadClaim();
  }, [id]);

  const handleConfirmAction = async () => {
    if (!claim || !id) return;

    setIsConfirmModalOpen(false);
    setIsExecuting(true);
  };

  const handleExecutionComplete = async () => {
    if (!claim || !id) return;
    if (submittedRef.current) return;
    submittedRef.current = true;

    try {
      setSubmitting(true);
      const updated = await api.submitDecision(id, {
        claimId: id,
        decision: 'approved',
        rationale: claim.recommendedAction.rationale,
        timestamp: new Date().toISOString(),
        userId: 'adjuster-demo-user',
        settlementAmount: claim.recommendedAction.financialImpact?.estimatedAmount,
        approverName: requiresApproval ? approverName.trim() || undefined : undefined,
        approverRole: requiresApproval ? approverRole : undefined,
      });

      const verdict = updated.governanceDecision;
      if (verdict?.blocked) {
        // Governance blocked the approval — do not report success.
        navigate(`/claims/${id}/decision`, {
          state: {
            notification: {
              kind: 'error',
              title: 'Action blocked by governance',
              subtitle: verdict.reasons[0] ?? `This action cannot be auto-executed for claim ${claim.id}.`,
            },
          },
        });
        return;
      }

      const approvedWithSignoff = verdict?.requiresApproval;
      navigate('/claims/queue', {
        state: {
          notification: {
            kind: 'success',
            title: approvedWithSignoff ? 'Action executed with senior sign-off' : 'Action Executed',
            subtitle: approvedWithSignoff
              ? `${claim.recommendedAction.actionType} executed for claim ${claim.id}, approved by ${approverName.trim() || approverRole}.`
              : `${claim.recommendedAction.actionType} has been executed successfully for claim ${claim.id}`,
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision');
      setSubmitting(false);
      setIsExecuting(false);
      submittedRef.current = false;
    }
  };

  const handleRejectAction = async () => {
    if (!claim || !id || !rejectionReason.trim()) return;

    try {
      setSubmitting(true);
      await api.submitDecision(id, {
        claimId: id,
        decision: 'rejected',
        rationale: rejectionReason,
        timestamp: new Date().toISOString(),
        userId: 'adjuster-demo-user',
      });

      setIsRejectModalOpen(false);
      navigate('/claims/queue', {
        state: {
          notification: {
            kind: 'info',
            title: 'Action Rejected',
            subtitle: `Recommended action for claim ${claim.id} has been rejected and returned to the queue`,
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading description="Loading action preview..." withOverlay />;
  }

  if (error || !claim) {
    return (
      <div className="action-preview-page">
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error || 'Claim not found'}
          onClose={() => navigate('/claims/queue')}
        />
      </div>
    );
  }

  const { recommendedAction } = claim;
  const impactLevel = recommendedAction.confidence === 'high' ? 'low' :
                      recommendedAction.confidence === 'medium' ? 'medium' : 'high';
  const tone = hardBlocked ? 'critical' : requiresApproval ? 'caution' : 'positive';
  const intel = buildDecisionIntelligence(claim);
  const stpEligible = intel.governance.straightThroughEligible === true;

  // The canonical category the recommended (approve) action would map to, mirroring
  // the backend taxonomy so the audit surface reads the same pre- and post-decision.
  const projectedCategory: string = hardBlocked
    ? 'recommend-deny-for-human-review'
    : requiresApproval
    ? 'route-to-adjuster'
    : 'approve';

  // Split the recommended next steps into what the agent will execute vs what a
  // human must do (used in the confirm dialog).
  const stepRows = (recommendedAction.recommendedSteps ?? []).map((text) => ({
    text,
    human: isHumanStep(text),
  }));
  const agentSteps = stepRows.filter((s) => !s.human);
  const humanSteps = stepRows.filter((s) => s.human);

  const stewardPageContext: StewardPageContext = {
    pageName: `Governed Action Preview: ${claim.id}`,
    focusedClaimId: claim.id,
    allClaims: [],
    focusedClaimRecord: {
      id: claim.id,
      claimantName: claim.claimantName,
      incidentType: claim.incidentType,
      incidentDate: claim.incidentDate,
      incidentLocation: claim.incidentLocation,
      incidentDescription: claim.incidentDescription ?? '',
      injuryIndicated: claim.injuryIndicated,
      immediateNeeds: claim.immediateNeeds ?? [],
      policyRef: claim.policyRef,
      policyContext: claim.policyContext,
      claimStage: claim.claimStage ?? '',
      pendingDecisionType: claim.pendingDecisionType ?? '',
      blockerReason: claim.blockerReason ?? '',
      confidenceLevel: claim.confidenceLevel ?? '',
      lastAgentAction: claim.lastAgentAction ?? '',
      timeInQueue: claim.timeInQueue ?? '',
      priority: claim.priority ?? '',
      evidenceItems: claim.evidenceItems ?? [],
      recommendedAction: {
        actionType: recommendedAction.actionType,
        description: recommendedAction.description,
        rationale: recommendedAction.rationale,
        estimatedAmount: recommendedAction.financialImpact?.estimatedAmount,
      },
    },
  };

  return (
    <div className="action-preview-page">
      <Grid fullWidth>
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <Column lg={16}>
          <div className="action-preview-page__header">
            <div className="action-preview-page__header-main">
              <Heading>Governed Action Preview: {claim.id}</Heading>
            </div>
            <div className="action-preview-page__header-tags">
              <Tag type={hardBlocked ? 'red' : requiresApproval ? 'magenta' : 'green'}>
                {hardBlocked ? 'BLOCKED' : requiresApproval ? 'APPROVAL REQUIRED' : stpEligible ? 'WITHIN AUTHORITY · STP' : 'WITHIN AUTHORITY'}
              </Tag>
              <Tag
                type={recommendedAction.confidence === 'high' ? 'green' : recommendedAction.confidence === 'medium' ? 'cyan' : 'red'}
              >
                {recommendedAction.confidence.toUpperCase()} CONFIDENCE
              </Tag>
              <Tag type={impactLevel === 'low' ? 'green' : impactLevel === 'medium' ? 'cyan' : 'red'}>
                {impactLevel.toUpperCase()} RISK
              </Tag>
              {claim.clientServiceTier && <TierBadge tier={claim.clientServiceTier} />}
            </div>
          </div>
        </Column>

        {/* ── Context strip + metrics (same Column, same as Decision Mode) ── */}
        <Column lg={16}>
          <div className="action-preview-page__context-strip" ref={contextStripRef}>
            <div className="action-preview-page__context-item">
              <User size={14} />
              <span className="action-preview-page__context-label">Claimant</span>
              <span className="action-preview-page__context-value">{claim.claimantName}</span>
            </div>
            <div className="action-preview-page__context-item">
              <Policy size={14} />
              <span className="action-preview-page__context-label">Policy</span>
              <span className="action-preview-page__context-value">{claim.policyRef}</span>
            </div>
            <div className="action-preview-page__context-item">
              <Warning size={14} />
              <span className="action-preview-page__context-label">Incident</span>
              <span className="action-preview-page__context-value">{claim.incidentType}</span>
            </div>
            <div className="action-preview-page__context-item">
              <Calendar size={14} />
              <span className="action-preview-page__context-label">Date</span>
              <span className="action-preview-page__context-value">
                {new Date(claim.incidentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="action-preview-page__context-item">
              <Location size={14} />
              <span className="action-preview-page__context-label">Location</span>
              <span className="action-preview-page__context-value">{claim.incidentLocation}</span>
            </div>
            <div className={`action-preview-page__context-item action-preview-page__context-item--sla${claim.priority === 'urgent' ? ' is-urgent' : claim.priority === 'high' ? ' is-high' : ''}`}>
              <Time size={14} />
              <span className="action-preview-page__context-label">In queue</span>
              <span className="action-preview-page__context-value">{claim.timeInQueue}</span>
            </div>
            {claim.assignedAdjusterName && (
              <div className="action-preview-page__context-item">
                <User size={14} />
                <span className="action-preview-page__context-label">Assigned to</span>
                <span className="action-preview-page__context-value">{claim.assignedAdjusterName}</span>
              </div>
            )}
            {claim.claimantPhone && (
              <div className="action-preview-page__context-item">
                <span className="action-preview-page__context-label">Contact</span>
                <span className="action-preview-page__context-value">{claim.preferredContactChannel} · {claim.claimantPhone}</span>
              </div>
            )}
          </div>
          {claim.appointedRepresentative && (
            <RepresentativeNote representative={claim.appointedRepresentative} />
          )}

          <div className="action-preview-page__metrics">
            {intel.metrics.map((m) => (
              <div
                key={m.id}
                className={`action-preview-page__metric action-preview-page__tone--${m.tone}`}
              >
                <span className="action-preview-page__metric-label">{m.label}</span>
                <span className="action-preview-page__metric-value">{m.value}</span>
                {m.progress != null && (
                  <div className="action-preview-page__metric-bar">
                    <span style={{ width: `${m.progress}%` }} />
                  </div>
                )}
                <span className="action-preview-page__metric-detail">{m.detail}</span>
              </div>
            ))}
          </div>
        </Column>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Column lg={16}>
          <Tabs>
            <TabList aria-label="Governed action workspace">
              <Tab>Governed Action</Tab>
              <Tab>Audit &amp; Compliance</Tab>
              <Tab>Claimant Message</Tab>
            </TabList>
            <TabPanels>

              {/* ─── TAB 1: Governed Action — dominant hierarchy ─────────── */}
              <TabPanel className="action-preview-page__subpanel">
                <div className="action-preview-page__needed-layout">

                  {/* Main column — dominant decision box */}
                  <div className="action-preview-page__needed-main">
                    <section className={`action-preview-page__decision-box action-preview-page__tone--${tone}`}>

                      {/* Decision head */}
                      <div className="action-preview-page__decision-head">
                        <div className="action-preview-page__panel-head">
                          <DocumentTasks size={24} />
                          <h2>{claim.pendingDecisionType ?? 'Action Decision'}</h2>
                        </div>
                        <Tag
                          type={hardBlocked ? 'red' : requiresApproval ? 'magenta' : 'green'}
                          renderIcon={hardBlocked || requiresApproval ? WarningAlt : CheckmarkFilled}
                        >
                          {hardBlocked ? 'BLOCKED BY GOVERNANCE' : requiresApproval ? 'APPROVAL REQUIRED' : stpEligible ? 'WITHIN AUTHORITY · STRAIGHT-THROUGH' : 'WITHIN AUTHORITY'}
                        </Tag>
                      </div>

                      <p className="action-preview-page__decision-summary">
                        {hardBlocked
                          ? 'This action cannot be executed — coverage is excluded or an open fraud investigation is unresolved.'
                          : requiresApproval
                          ? 'This action falls outside delegated authority. Senior sign-off must be captured before execution.'
                          : intel.governance.summary}
                      </p>

                      {/* Policy bar */}
                      <div className="action-preview-page__policy-bar">
                        {claim.policyContext?.coverageType && (
                          <div className="action-preview-page__policy-bar-item">
                            <Policy size={14} />
                            <span className="action-preview-page__policy-bar-label">Coverage type</span>
                            <span className="action-preview-page__policy-bar-value">{claim.policyContext.coverageType}</span>
                          </div>
                        )}
                        {claim.policyContext?.coverageApplicability && (
                          <div className="action-preview-page__policy-bar-item">
                            <span className="action-preview-page__policy-bar-label">Coverage status</span>
                            <Tag
                              size="sm"
                              type={claim.policyContext.coverageApplicability === 'covered' ? 'green' : claim.policyContext.coverageApplicability === 'excluded' ? 'red' : 'cyan'}
                            >
                              {claim.policyContext.coverageApplicability.toUpperCase()}
                            </Tag>
                          </div>
                        )}
                        {claim.handlingMode && (
                          <div className="action-preview-page__policy-bar-item">
                            <span className="action-preview-page__policy-bar-label">Handling mode</span>
                            <Tag size="sm" type="blue">
                              {claim.handlingMode === 'ai' ? 'AI' : claim.handlingMode === 'ai_oversight' ? 'AI + Oversight' : 'Human'}
                            </Tag>
                          </div>
                        )}
                      </div>

                      {/* Anomaly signals */}
                      {(claim.anomalySignals ?? []).length > 0 && (
                        <div className="action-preview-page__anomaly-bar">
                          <div className="action-preview-page__panel-head">
                            <FlagFilled size={24} />
                            <h2>Risk &amp; anomaly signals</h2>
                            {(claim.anomalySignals ?? []).some(s => s.severity === 'high') && (
                              <Tag type="red" size="sm">HIGH RISK</Tag>
                            )}
                          </div>
                          <div className="action-preview-page__anomaly-pills">
                            {(claim.anomalySignals ?? []).map((sig) => (
                              <span
                                key={sig.id}
                                className={`action-preview-page__anomaly-pill action-preview-page__anomaly-pill--${sig.severity}`}
                                title={sig.explanation}
                              >
                                <span className="action-preview-page__anomaly-pill-dot" />
                                {sig.type}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Governance reasons */}
                      {intel.governance.reasons.length > 0 && (
                        <ul className="action-preview-page__governance-reasons">
                          {intel.governance.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}

                      {/* ── Highlighted recommended action ── */}
                      <div className="action-preview-page__decision-action">
                        <div className="action-preview-page__decision-action-info">
                          <div className="action-preview-page__panel-head">
                            <CheckmarkFilled size={24} />
                            <h2>Recommended action</h2>
                          </div>
                          <div className="action-preview-page__recommendation-head">
                            <h3>{recommendedAction.actionType}</h3>
                            <Tag
                              type={recommendedAction.confidence === 'high' ? 'green' : recommendedAction.confidence === 'medium' ? 'cyan' : 'red'}
                              size="sm"
                            >
                              {recommendedAction.confidence.toUpperCase()} CONFIDENCE
                            </Tag>
                          </div>
                          <p className="action-preview-page__recommendation-desc">{recommendedAction.description}</p>
                          <p className="action-preview-page__recommendation-rationale">{recommendedAction.rationale}</p>
                          {recommendedAction.financialImpact?.estimatedAmount != null && (
                            <p className="action-preview-page__recommendation-amount">
                              Estimated settlement:{' '}
                              <strong>
                                {fmtCurrency(
                                  recommendedAction.financialImpact.estimatedAmount,
                                  recommendedAction.financialImpact.currency ?? 'USD',
                                )}
                              </strong>
                            </p>
                          )}
                          {recommendedAction.recommendedSteps && recommendedAction.recommendedSteps.length > 0 && (
                            <div className="action-preview-page__recommendation-steps">
                              <div className="action-preview-page__recommendation-steps-label">Recommended next steps</div>
                              <ol className="action-preview-page__steps">
                                {recommendedAction.recommendedSteps.map((step, i) => (
                                  <li key={i} className="action-preview-page__step">
                                    <span className="action-preview-page__step-num">{i + 1}</span>
                                    <span className="action-preview-page__step-text">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* ── Decomposed confidence (governance legibility) ── */}
                    <section className="action-preview-page__confidence-breakdown">
                      <div className="action-preview-page__panel-head">
                        <Activity size={20} />
                        <h2>Confidence breakdown</h2>
                        <Tag size="sm" type={recommendedAction.confidence === 'high' ? 'green' : recommendedAction.confidence === 'medium' ? 'cyan' : 'red'}>
                          {recommendedAction.confidence.toUpperCase()} OVERALL
                        </Tag>
                      </div>
                      <p className="action-preview-page__confidence-intro">
                        How the overall confidence decomposes across the governance-relevant dimensions — each grounded in the claim record.
                      </p>
                      <div className="action-preview-page__confidence-rows">
                        {intel.confidenceBreakdown.map((c) => (
                          <div key={c.id} className="action-preview-page__confidence-row">
                            <div className="action-preview-page__confidence-row-head">
                              <span className="action-preview-page__confidence-label">{c.label}</span>
                              <span className={`action-preview-page__confidence-score action-preview-page__tone--${c.tone}`}>{c.score}%</span>
                            </div>
                            <div className="action-preview-page__confidence-meter">
                              <span
                                className={`action-preview-page__confidence-meter-fill action-preview-page__meter--${c.tone}`}
                                style={{ width: `${c.score}%` }}
                              />
                            </div>
                            <p className="action-preview-page__confidence-basis">{c.basis}</p>
                            {c.evidenceRefs && c.evidenceRefs.length > 0 && (
                              <p className="action-preview-page__confidence-refs">
                                Evidence: {c.evidenceRefs.slice(0, 3).join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Sidebar — agent details + data operations */}
                  <div className="action-preview-page__needed-sidebar">
                    <section className="action-preview-page__sidebar-card">
                      <div className="action-preview-page__panel-head">
                        <Activity size={20} />
                        <h2>Executing agent</h2>
                      </div>
                      <div className="action-preview-page__field">
                        <label>Agent</label>
                        <p className="action-preview-page__value">{recommendedAction.agentName ?? 'Claims Processing Agent v2.1'}</p>
                      </div>
                      <div className="action-preview-page__field">
                        <label>Capabilities</label>
                        <ul className="action-preview-page__list">
                          <li>Policy verification</li>
                          <li>Evidence analysis</li>
                          <li>Settlement calculation</li>
                          <li>Claimant communication</li>
                        </ul>
                      </div>
                      <div className="action-preview-page__field">
                        <label>Governance profile</label>
                        <p className="action-preview-page__value">Standard Claims Adjudication</p>
                      </div>
                    </section>

                    <section className="action-preview-page__sidebar-card">
                      <div className="action-preview-page__panel-head">
                        <View size={20} />
                        <h2>Data operations</h2>
                      </div>
                      <div className="action-preview-page__field">
                        <label>Reads</label>
                        <ul className="action-preview-page__list">
                          <li>Claim #{claim.id}</li>
                          <li>Policy {claim.policyRef}</li>
                          <li>{claim.evidenceItems.length} evidence items</li>
                          <li>Claimant profile</li>
                        </ul>
                      </div>
                      <div className="action-preview-page__field">
                        <label>Writes</label>
                        <ul className="action-preview-page__list">
                          <li>Update claim status</li>
                          <li>Log decision outcome</li>
                          <li>Create audit trail entry</li>
                          <li>Generate claimant notification</li>
                        </ul>
                      </div>
                      <div className="action-preview-page__field">
                        <label>External integrations</label>
                        <p className="action-preview-page__value">
                          {recommendedAction.actionType.includes('Settlement')
                            ? 'Payment processing, Email notification'
                            : 'Email notification'}
                        </p>
                      </div>
                    </section>
                  </div>
                </div>
              </TabPanel>

              {/* ─── TAB 2: Audit & Compliance ───────────────────────────── */}
              <TabPanel className="action-preview-page__subpanel">
                <section className="action-preview-page__sidebar-card">
                  <div className="action-preview-page__panel-head">
                    <CheckmarkFilled size={24} />
                    <h2>Compliance checks</h2>
                  </div>
                  <div className="action-preview-page__compliance-checks">
                    <div className="action-preview-page__check">
                      <CheckmarkFilled size={16} className="action-preview-page__check-icon--pass" />
                      <span>Regulatory requirements met</span>
                    </div>
                    <div className="action-preview-page__check">
                      <CheckmarkFilled size={16} className="action-preview-page__check-icon--pass" />
                      <span>Policy terms verified</span>
                    </div>
                    <div className="action-preview-page__check">
                      <CheckmarkFilled size={16} className="action-preview-page__check-icon--pass" />
                      <span>Evidence sufficiency confirmed</span>
                    </div>
                    <div className="action-preview-page__check">
                      {claim.injuryIndicated ? (
                        <>
                          <WarningAlt size={16} className="action-preview-page__check-icon--warning" />
                          <span>Injury claim — enhanced review applied</span>
                        </>
                      ) : (
                        <>
                          <CheckmarkFilled size={16} className="action-preview-page__check-icon--pass" />
                          <span>Standard review process</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="action-preview-page__field" style={{ marginTop: '1.5rem' }}>
                    <label>Audit trail</label>
                    <p className="action-preview-page__value">
                      All actions are logged with timestamp, user ID, rationale, and system state.
                    </p>
                  </div>
                  <div className="action-preview-page__field">
                    <label>Estimated impact</label>
                    <Tag type={impactLevel === 'low' ? 'green' : impactLevel === 'medium' ? 'cyan' : 'red'}>
                      {impactLevel.toUpperCase()} RISK
                    </Tag>
                  </div>
                </section>

                {/* Governed decision record — canonical category + tamper-evidence */}
                <section className="action-preview-page__sidebar-card">
                  <div className="action-preview-page__panel-head">
                    <DocumentTasks size={24} />
                    <h2>Governed decision record</h2>
                  </div>
                  <div className="action-preview-page__field">
                    <label>Decision category</label>
                    <Tag size="sm" type={projectedCategory === 'approve' ? 'green' : projectedCategory === 'route-to-adjuster' ? 'magenta' : projectedCategory === 'request-info' ? 'cyan' : 'red'}>
                      {(CANONICAL_CATEGORY_LABELS[claim.governanceDecision?.canonicalCategory ?? projectedCategory] ?? projectedCategory).toUpperCase()}
                    </Tag>
                  </div>
                  {claim.governanceDecision ? (
                    <>
                      <div className="action-preview-page__field">
                        <label>Verdict</label>
                        <p className="action-preview-page__value">
                          {claim.governanceDecision.status.replace(/_/g, ' ')}
                          {claim.governanceDecision.straightThroughEligible ? ' · straight-through' : ''}
                        </p>
                      </div>
                      {claim.governanceDecision.retentionClass && (
                        <div className="action-preview-page__field">
                          <label>Retention class</label>
                          <p className="action-preview-page__value">{claim.governanceDecision.retentionClass}</p>
                        </div>
                      )}
                      {claim.governanceDecision.recordHash && (
                        <div className="action-preview-page__field">
                          <label>Tamper-evident hash (SHA-256)</label>
                          <p className="action-preview-page__value action-preview-page__hash" title={claim.governanceDecision.recordHash}>
                            {claim.governanceDecision.recordHash.slice(0, 16)}…{claim.governanceDecision.recordHash.slice(-8)}
                          </p>
                          <p className="action-preview-page__value action-preview-page__hash-prev">
                            chained to: {claim.governanceDecision.previousHash ? `${claim.governanceDecision.previousHash.slice(0, 12)}…` : 'genesis (first record)'}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="action-preview-page__field">
                      <label>On execution</label>
                      <p className="action-preview-page__value">
                        A tamper-evident, hash-chained decision record will be written and retained under the applicable
                        compliance retention class.
                      </p>
                    </div>
                  )}
                </section>
                {claim.auditTrail && claim.auditTrail.length > 0 && (
                  <section className="action-preview-page__sidebar-card">
                    <div className="action-preview-page__panel-head">
                      <Activity size={24} />
                      <h2>Recent activity</h2>
                    </div>
                    <ol className="action-preview-page__trail-list">
                      {claim.auditTrail.slice(-5).reverse().map((entry, i) => (
                        <li key={i} className="action-preview-page__trail-item">
                          <span className="action-preview-page__trail-ts">
                            {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="action-preview-page__trail-actor">{entry.userId}</span>
                          <span className="action-preview-page__trail-action">{entry.action}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </TabPanel>

              {/* ─── TAB 3: Claimant Message ─────────────────────────────── */}
              <TabPanel className="action-preview-page__subpanel">
                <section className="action-preview-page__sidebar-card action-preview-page__message-preview">
                  <div className="action-preview-page__panel-head">
                    <Information size={24} />
                    <h2>Claimant-facing message preview</h2>
                  </div>
                  <div className="action-preview-page__message-box">
                    <p><strong>Subject:</strong> Update on Your Claim #{claim.id}</p>
                    <p><strong>Dear {claim.claimantName},</strong></p>
                    <p>
                      We have completed our review of your {claim.incidentType.toLowerCase()} claim
                      submitted on {new Date(claim.incidentDate).toLocaleDateString()}.
                    </p>
                    {recommendedAction.actionType.includes('Approve') && (
                      <p>
                        We are pleased to inform you that your claim has been approved.
                        {recommendedAction.actionType.includes('Settlement') &&
                          ' Settlement details will be processed and communicated to you within 2–3 business days.'}
                      </p>
                    )}
                    {recommendedAction.actionType.includes('Request') && (
                      <p>
                        To continue processing your claim, we need some additional information.
                        Our team will contact you shortly with specific details about what we need.
                      </p>
                    )}
                    <p>
                      If you have any questions, please don't hesitate to contact us at 1-800-CLAIMS-1
                      or reply to this message.
                    </p>
                    <p><strong>Sincerely,</strong><br />Claims Department</p>
                  </div>
                  <InlineNotification
                    kind="info"
                    title="Safe wording"
                    subtitle="This message has been reviewed for regulatory compliance and appropriate tone"
                    lowContrast
                    hideCloseButton
                  />
                </section>
              </TabPanel>

            </TabPanels>
          </Tabs>
        </Column>

        {/* Live Agent Activity */}
        {isExecuting && (
          <Column lg={16}>
            <LiveAgentActivity
              actionType={recommendedAction.actionType}
              isExecuting={isExecuting}
              onComplete={handleExecutionComplete}
            />
          </Column>
        )}
      </Grid>

      {/* Sticky action bar */}
      {!isExecuting && (
        <div className="action-preview-page__sticky-actions">
          <div className="action-preview-page__sticky-label">
            {hardBlocked ? (
              <Warning size={20} className="action-preview-page__sticky-icon--blocked" />
            ) : (
              <CheckmarkFilled size={20} className="action-preview-page__sticky-icon--ok" />
            )}
            <span className="action-preview-page__sticky-label-text">
              Recommended: <strong>{recommendedAction.actionType}</strong>
            </span>
            <Tag
              type={recommendedAction.confidence === 'high' ? 'green' : recommendedAction.confidence === 'medium' ? 'cyan' : 'red'}
              size="sm"
            >
              {recommendedAction.confidence.toUpperCase()} CONFIDENCE
            </Tag>
          </div>
          <div className="action-preview-page__sticky-buttons">
            <Button kind="ghost" size="sm" onClick={() => navigate(`/claims/${id}/decision`)}>
              Back to Decision
            </Button>
            <Button kind="danger--tertiary" size="sm" onClick={() => setIsRejectModalOpen(true)}>
              Reject Action
            </Button>
            <Button
              kind="primary"
              size="sm"
              renderIcon={ArrowRight}
              disabled={hardBlocked}
              onClick={() => setIsConfirmModalOpen(true)}
            >
              Confirm and Execute
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <Modal
        open={isConfirmModalOpen}
        onRequestClose={() => !submitting && setIsConfirmModalOpen(false)}
        modalHeading="Confirm Action Execution"
        primaryButtonText={submitting ? 'Executing...' : 'Confirm'}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleConfirmAction}
        onSecondarySubmit={() => setIsConfirmModalOpen(false)}
        primaryButtonDisabled={submitting || hardBlocked || (requiresApproval && !approverName.trim())}
        preventCloseOnClickOutside={submitting}
      >
        <p>
          On confirmation, <strong>{recommendedAction.actionType}</strong> is executed. The agent will carry out the
          steps below automatically; any step needing human judgement is left for an adjuster.
        </p>

        {agentSteps.length > 0 && (
          <div className="action-preview-page__confirm-steps" style={{ marginTop: '1rem' }}>
            <div className="action-preview-page__confirm-steps-label">Agent will perform automatically</div>
            <ol className="action-preview-page__confirm-step-list">
              {agentSteps.map((s, i) => (
                <li key={`a-${i}`} className="action-preview-page__confirm-step action-preview-page__confirm-step--agent">
                  <Tag size="sm" type="blue">AGENT</Tag>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {humanSteps.length > 0 && (
          <div className="action-preview-page__confirm-steps" style={{ marginTop: '1rem' }}>
            <div className="action-preview-page__confirm-steps-label">Requires a human</div>
            <ol className="action-preview-page__confirm-step-list">
              {humanSteps.map((s, i) => (
                <li key={`h-${i}`} className="action-preview-page__confirm-step action-preview-page__confirm-step--human">
                  <Tag size="sm" type="magenta">HUMAN</Tag>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p style={{ marginTop: '1rem' }}>This will also:</p>
        <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
          <li>Update the claim status</li>
          <li>Write a tamper-evident, hash-chained decision record</li>
          <li>Send notification to the claimant</li>
          <li>Log your approval with timestamp and rationale</li>
        </ul>
        {requiresApproval && (
          <div style={{ marginTop: '1.5rem' }}>
            <InlineNotification
              kind="warning"
              title="Senior sign-off required"
              subtitle="This decision exceeds delegated authority. Record the approving senior adjuster."
              lowContrast
              hideCloseButton
            />
            <div style={{ marginTop: '1rem' }}>
              <TextInput
                id="approver-name"
                labelText="Approving senior adjuster"
                placeholder="e.g. Michael Chen"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                invalid={!approverName.trim()}
                invalidText="An approver is required to proceed."
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <TextInput
                id="approver-role"
                labelText="Approver role"
                value={approverRole}
                onChange={(e) => setApproverRole(e.target.value)}
              />
            </div>
          </div>
        )}
        <p style={{ marginTop: '1rem' }}>
          This action cannot be undone without creating a new decision record.
        </p>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={isRejectModalOpen}
        onRequestClose={() => !submitting && setIsRejectModalOpen(false)}
        modalHeading="Reject Recommended Action"
        primaryButtonText={submitting ? 'Submitting...' : 'Reject'}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleRejectAction}
        onSecondarySubmit={() => setIsRejectModalOpen(false)}
        primaryButtonDisabled={submitting || !rejectionReason.trim()}
        danger
        preventCloseOnClickOutside={submitting}
      >
        <p style={{ marginBottom: '1rem' }}>
          Please provide a reason for rejecting this recommended action. 
          The claim will be returned to the decision queue for further review.
        </p>
        <TextArea
          labelText="Rejection Reason"
          placeholder="Explain why this action should not be executed..."
          value={rejectionReason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value)}
          rows={4}
          disabled={submitting}
        />
      </Modal>

      <StewardChatPanel pageContext={stewardPageContext} topOffset={panelTop} bottomOffset={84} hideWelcome />
    </div>
  );
};

export default ActionPreviewPage;

// Made with Bob
