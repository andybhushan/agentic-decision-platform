import { useState, useEffect } from 'react';
import {
  Modal,
  Tag,
  Button,
  InlineNotification,
  Loading,
  Tooltip,
  SelectableTile,
  Tile,
  AILabel,
  StructuredListWrapper,
  StructuredListBody,
  StructuredListRow,
  StructuredListCell,
  UnorderedList,
  ListItem,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
} from '@carbon/react';
import {
  Ai,
  WarningAlt,
} from '@carbon/icons-react';
import type { Claim, EvidenceItem, EvidenceReview, EvidenceTrustLevel } from '../types';
import { buildEvidenceIntelligence, TRUST_LABELS, formatEvidenceCurrency } from '../data/evidenceIntelligence';
import { api } from '../services/api';
import './EvidenceIntelligence.scss';

function formatUsDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/** Render **bold** markers in DS narrative text as <strong> inline elements. */
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="evidence-intel__steward-bold">{part.slice(2, -2)}</strong>
      : part
  );
}

const CLAIM_STAGE_LABEL: Record<string, string> = {
  intake: 'Intake',
  investigation: 'Under Investigation',
  evaluation: 'Under Evaluation',
  settlement: 'Settlement',
  closed: 'Closed',
};

const CLAIM_STAGE_TAG: Record<string, 'gray' | 'blue' | 'cyan' | 'purple' | 'green' | 'teal'> = {
  intake: 'gray',
  investigation: 'blue',
  evaluation: 'cyan',
  settlement: 'teal',
  closed: 'green',
};

const TRUST_TAG_COLOR: Record<EvidenceTrustLevel, 'green' | 'blue' | 'cyan' | 'red'> = {
  corroborated: 'green',
  usable: 'blue',
  'source-limited': 'cyan',
  disputed: 'red',
};

const statusTagColor: Record<string, 'green' | 'cyan' | 'red'> = {
  verified: 'green',
  pending: 'cyan',
  disputed: 'red',
};

interface EvidenceIntelligenceModalProps {
  open: boolean;
  claim: Claim | null;
  evidenceId: string | null;
  onClose: () => void;
}

export const EvidenceIntelligenceModal = ({
  open,
  claim,
  evidenceId,
  onClose,
}: EvidenceIntelligenceModalProps) => {
  const evidenceItems = claim?.evidenceItems ?? [];
  const [activeId, setActiveId] = useState<string | null>(evidenceId);
  const [activeTab, setActiveTab] = useState(0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [review, setReview] = useState<EvidenceReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const valid = evidenceId && evidenceItems.some((e) => e.id === evidenceId);
    setActiveId(valid ? evidenceId : evidenceItems[0]?.id ?? null);
    setActiveTab(0);
    setActionNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, evidenceId]);

  useEffect(() => {
    if (!open || !claim || !activeId) {
      setReview(null);
      setReviewError(null);
      return;
    }

    let cancelled = false;
    setReviewLoading(true);
    setReviewError(null);

    api.getClaimEvidenceReview(claim.id, activeId)
      .then((data) => {
        if (!cancelled) setReview(data);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load evidence review:', error);
          setReview(null);
          const backendMessage = (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
          setReviewError(backendMessage || 'Unable to load the Evidence Review Agent output right now.');
        }
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, claim, activeId]);

  const runDemoAction = (label: string) => {
    setActionNotice(`${label} — demo action only, no backend request was made.`);
  };

  const handleClose = () => {
    setActionNotice(null);
    setReview(null);
    setReviewError(null);
    onClose();
  };

  const selected = evidenceItems.find((e) => e.id === activeId) ?? null;
  const intel = selected && claim ? buildEvidenceIntelligence(selected, claim) : null;
  const totalRange = review
    ? `${formatEvidenceCurrency(review.repairEstimate.totalMin, review.repairEstimate.currency)} - ${formatEvidenceCurrency(review.repairEstimate.totalMax, review.repairEstimate.currency)}`
    : null;
  const supportSignals = review?.evidenceValidity.corroboratingSignals.slice(0, 4) ?? [];
  const supportOverflow = Math.max(0, (review?.evidenceValidity.corroboratingSignals.length ?? 0) - supportSignals.length);
  // Artifact-level only (not claim-level) — claim-level concerns live in the DS card
  const concernsAndGaps = review
    ? review.evidenceValidity.concerns.slice(0, 6)
    : [];
  const concernsOverflow = review
    ? Math.max(0, review.evidenceValidity.concerns.length - concernsAndGaps.length)
    : 0;
  // Banner only surfaces artifact discrepancies
  const artifactDiscrepancies = review?.discrepancies.length ?? 0;
  const reviewStatusTone = reviewError
    ? 'error'
    : artifactDiscrepancies > 0
      ? 'attention'
      : 'ok';
  const reviewStatusTitle = reviewError
    ? 'Review issue'
    : artifactDiscrepancies > 0
      ? 'Artifact discrepancy flagged'
      : 'Artifact review passed';
  const reviewStatusSummary = reviewError
    ? reviewError
    : artifactDiscrepancies > 0
      ? `${artifactDiscrepancies} discrepancy check(s) flagged for this artifact — see the Analysis tab for details.`
      : 'No material discrepancy was flagged for this artifact in the first-pass review.';

  return (
    <Modal
      open={open}
      onRequestClose={handleClose}
      passiveModal
      size="xl"
      className="evidence-modal"
      modalLabel={`${evidenceItems.length} artifact${evidenceItems.length !== 1 ? 's' : ''} on file`}
      modalHeading="Evidence Intelligence"
    >
      {actionNotice && (
        <InlineNotification
          kind="info"
          title="Demo action"
          subtitle={actionNotice}
          onClose={() => setActionNotice(null)}
          lowContrast
          className="evidence-intel__notice"
        />
      )}

      {evidenceItems.length === 0 ? (
        <InlineNotification
          kind="info"
          title="No evidence on file"
          subtitle="No evidence artifacts have been attached to this claim yet."
          hideCloseButton
          lowContrast
        />
      ) : (
        <>
          {/* ── Digital Steward — Chain Assessment ───────────────────────── */}
          <Tile className="evidence-intel__steward-summary">
            <div className="evidence-intel__agent-header">
              <Ai size={20} className="evidence-intel__agent-icon" />
              <span className="evidence-intel__agent-title">Digital Steward — Evidence Chain Assessment</span>
              {claim?.stage && (
                <Tag
                  type={CLAIM_STAGE_TAG[claim.stage] ?? 'gray'}
                  size="sm"
                  className="evidence-intel__steward-stage-tag"
                >
                  {CLAIM_STAGE_LABEL[claim.stage] ?? claim.stage}
                </Tag>
              )}
              <AILabel kind="inline" />
            </div>
            {review ? (
              <div className="evidence-intel__steward-cols">
                {/* Left: narrative + gaps */}
                <div className="evidence-intel__steward-left">
                  <p className="evidence-intel__steward-intro">{renderBold(review.claimWideAssessment.summary)}</p>
                  {review.claimWideAssessment.missingEvidence.length > 0 && (
                    <>
                      <span className="evidence-intel__steward-section-label">
                        <WarningAlt size={12} /> Evidence gaps
                      </span>
                      <UnorderedList className="evidence-intel__steward-gaps">
                        {review.claimWideAssessment.missingEvidence.map((gap, i) => (
                          <ListItem key={i}>{gap}</ListItem>
                        ))}
                      </UnorderedList>
                    </>
                  )}
                </div>
                {/* Right: recommendations */}
                {review.claimWideAssessment.recommendations && review.claimWideAssessment.recommendations.length > 0 && (
                  <div className="evidence-intel__steward-right">
                    <span className="evidence-intel__steward-section-label">Recommended actions</span>
                    <ol className="evidence-intel__steward-steps">
                      {review.claimWideAssessment.recommendations.map((rec, i) => (
                        <li key={i} className="evidence-intel__steward-step">
                          <span className="evidence-intel__steward-step-num">{i + 1}</span>
                          <span className="evidence-intel__steward-step-text">{renderBold(rec)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : reviewLoading ? (
              <div className="evidence-intel__steward-loading">
                <Loading description="Compiling chain assessment…" withOverlay={false} small />
                <span>Digital Steward is reviewing the evidence chain…</span>
              </div>
            ) : (
              <p className="evidence-intel__steward-intro evidence-intel__steward-intro--muted">
                Select an evidence artifact to trigger the chain assessment.
              </p>
            )}
          </Tile>

          <div className="evidence-intel">

          {/* ── Left sidebar — Artifact list ─────────────────────────────── */}
          <aside className="evidence-intel__rail">
            <h3 className="evidence-intel__rail-title">Artifacts ({evidenceItems.length})</h3>
            <div className="evidence-intel__list">
              {evidenceItems.map((evidence: EvidenceItem) => {
                const isActive = evidence.id === activeId;
                return (
                  <SelectableTile
                    key={evidence.id}
                    id={evidence.id}
                    value={evidence.id}
                    selected={isActive}
                    onChange={() => setActiveId(evidence.id)}
                    className={`evidence-intel__item${isActive ? ' evidence-intel__item--active' : ''}`}
                  >
                    <div className="evidence-intel__item-head">
                      <span className="evidence-intel__item-type">{evidence.type}</span>
                      <Tag type={statusTagColor[evidence.status] || 'gray'} size="sm">
                        {evidence.status.charAt(0).toUpperCase() + evidence.status.slice(1)}
                      </Tag>
                    </div>
                    <span className="evidence-intel__item-source">{evidence.source}</span>
                    <span className="evidence-intel__item-id">
                      {evidence.id} · {evidence.provenance}
                    </span>
                    {(evidence.status === 'pending' || evidence.status === 'disputed') && (
                      <span className={`evidence-intel__item-warning evidence-intel__item-warning--${evidence.status}`}>
                        <WarningAlt size={12} />
                        {evidence.status === 'pending' ? 'Awaiting verification' : 'Disputed — review required'}
                      </span>
                    )}
                  </SelectableTile>
                );
              })}
            </div>
          </aside>

          {/* ── Right content area ────────────────────────────────────────── */}
          {intel && (
            <section className="evidence-intel__detail">

              {/* 1. Full-width header panel */}
              <div className="evidence-intel__header-panel">
                <div className="evidence-intel__header-meta">
                  <h2 className="evidence-intel__title">{intel.title}</h2>
                  <p className="evidence-intel__summary">{intel.summary}</p>
                  <div className="evidence-intel__chips">
                    <Tag type={TRUST_TAG_COLOR[intel.trustLevel]} size="sm">
                      {TRUST_LABELS[intel.trustLevel]}
                    </Tag>
                    <Tag type="gray" size="sm">{intel.evidenceId}</Tag>
                    <Tag type="gray" size="sm">{intel.category}</Tag>
                    <Tag type="gray" size="sm">via {intel.lineage.collectedBy}</Tag>
                    {review && (
                      <Tag type="gray" size="sm">Evidence Review Agent · AI-assisted</Tag>
                    )}
                  </div>
                </div>
              </div>

              {/* Attention banner */}
              {(review || reviewError) && (
                <InlineNotification
                  kind={reviewStatusTone === 'error' ? 'error' : reviewStatusTone === 'attention' ? 'warning' : 'info'}
                  title={reviewStatusTitle}
                  subtitle={reviewStatusSummary}
                  lowContrast
                  hideCloseButton
                  className="evidence-intel__notice"
                />
              )}

              {/* 2. Large image / media panel */}
              <div className="evidence-intel__media-panel">
                {reviewLoading ? (
                  <div className="evidence-intel__media-loading">
                    <Loading description="Loading evidence…" withOverlay={false} small />
                    <span>Analysing evidence artifact…</span>
                  </div>
                ) : review?.imageUrl ? (
                  <div className="evidence-intel__media">
                    <img src={review.imageUrl} alt={review.filename} className="evidence-intel__media-image" />
                    {review.reviewKind === 'damage_photo' && review.damageHighlights.map((highlight) => (
                      <div
                        key={highlight.id}
                        className="evidence-intel__marker-anchor"
                        style={{ left: `${highlight.point.x * 100}%`, top: `${highlight.point.y * 100}%` }}
                      >
                        <Tooltip
                          align="top"
                          label={`${highlight.label}: ${highlight.rationale} (${Math.round(highlight.confidence * 100)}% confidence)`}
                        >
                          <button
                            type="button"
                            className={`evidence-intel__marker evidence-intel__marker--${highlight.severity}`}
                            aria-label={`${highlight.label}: ${highlight.rationale}`}
                          />
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                ) : selected?.content ? (
                  <div className="evidence-intel__media-text">
                    <pre className="evidence-intel__media-text-body">{selected.content}</pre>
                  </div>
                ) : (
                  <div className="evidence-intel__media-empty">
                    <span className="evidence-intel__media-empty-icon">🖼</span>
                    <p>No renderable image available for this evidence item.</p>
                    {intel.artifact?.vendor && (
                      <p className="evidence-intel__media-empty-sub">{intel.artifact.vendor}{intel.artifact.headline ? ` · ${intel.artifact.headline}` : ''}</p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Tabbed sections */}
              <Tabs selectedIndex={activeTab} onChange={({ selectedIndex }: { selectedIndex: number }) => setActiveTab(selectedIndex)}>
                <TabList aria-label="Evidence sections" contained>
                  <Tab>AI Review</Tab>
                  <Tab>Analysis</Tab>
                  <Tab>Evidence Status</Tab>
                  <Tab>Source Lineage</Tab>
                  <Tab>Metadata</Tab>
                </TabList>
                <TabPanels>

                  {/* AI Review */}
                  <TabPanel className="evidence-intel__tab-panel">
                    {reviewLoading && (
                      <div className="evidence-intel__review-loading">
                        <Loading description="Reviewing evidence..." withOverlay={false} small />
                      </div>
                    )}
                    {reviewError && (
                      <InlineNotification kind="error" title="Evidence review unavailable" subtitle={reviewError} hideCloseButton lowContrast />
                    )}
                    {review ? (
                      <Tile className="evidence-intel__agent-tile">
                        <div className="evidence-intel__agent-header">
                          <Ai size={20} className="evidence-intel__agent-icon" />
                          <span className="evidence-intel__agent-title">Evidence Review Agent</span>
                          <AILabel kind="inline" />
                        </div>
                        <p className="evidence-intel__agent-summary">{review.selectedEvidenceReview.summary}</p>
                        <UnorderedList className="evidence-intel__review-bullets">
                          {review.selectedEvidenceReview.findings.map((finding, index) => (
                            <ListItem key={`${finding}-${index}`}>{finding}</ListItem>
                          ))}
                        </UnorderedList>

                        {review.discrepancies.length > 0 && (
                          <>
                            <h6 className="evidence-intel__block-subtitle" style={{ marginTop: '1rem' }}>
                              <WarningAlt size={14} /> Discrepancies and checks
                            </h6>
                            <UnorderedList>
                              {review.discrepancies.map((item, index) => (
                                <ListItem key={`${item}-${index}`}>{item}</ListItem>
                              ))}
                            </UnorderedList>
                          </>
                        )}

                        {review.reviewKind === 'damage_photo' && review.damageHighlights.length > 0 && (
                          <>
                            <h6 className="evidence-intel__block-subtitle" style={{ marginTop: '1rem' }}>Damage callouts</h6>
                            <UnorderedList>
                              {review.damageHighlights.map((item) => (
                                <ListItem key={item.id}>
                                  {item.label} — {item.rationale} ({Math.round(item.confidence * 100)}% confidence)
                                </ListItem>
                              ))}
                            </UnorderedList>
                          </>
                        )}
                      </Tile>
                    ) : !reviewLoading && !reviewError ? (
                      <p className="evidence-intel__tab-empty">No AI review available for this artifact.</p>
                    ) : null}
                  </TabPanel>

                  {/* Analysis */}
                  <TabPanel className="evidence-intel__tab-panel">
                    <Tile className="evidence-intel__insight-tile">
                      <h5 className="evidence-intel__block-title">What this artifact says</h5>
                      <UnorderedList>
                        {intel.whatThisSays.map((s, i) => <ListItem key={i}>{s}</ListItem>)}
                      </UnorderedList>
                    </Tile>

                    <Tile className="evidence-intel__insight-tile">
                      <h5 className="evidence-intel__block-title">Why this matters</h5>
                      <p className="evidence-intel__block-body">{intel.whyThisMatters}</p>
                    </Tile>

                    <Tile className="evidence-intel__insight-tile">
                      <h5 className="evidence-intel__block-title">
                        <WarningAlt size={14} className="evidence-intel__warn-icon" /> What this does not prove
                      </h5>
                      <UnorderedList>
                        {intel.whatThisDoesNotProve.map((s, i) => <ListItem key={i}>{s}</ListItem>)}
                      </UnorderedList>
                    </Tile>

                    {/* Damage repair estimate */}
                    {review?.reviewKind === 'damage_photo' && review.repairEstimate.lineItems.length > 0 && (
                      <div className="evidence-intel__lineitems">
                        <h5 className="evidence-intel__block-title">
                          <ChangeCatalog size={14} /> Estimated repair range
                          {totalRange && <span className="evidence-intel__artifact-amount">{totalRange}</span>}
                        </h5>
                        <table className="evidence-intel__lineitems-table">
                          <thead>
                            <tr>
                              <th>Repair operation</th>
                              <th>Reason</th>
                              <th className="evidence-intel__num">Estimated range</th>
                            </tr>
                          </thead>
                          <tbody>
                            {review.repairEstimate.lineItems.map((item) => (
                              <tr key={item.label}>
                                <td>{item.label}</td>
                                <td>{item.reason}</td>
                                <td className="evidence-intel__num">
                                  {formatEvidenceCurrency(item.minAmount, review.repairEstimate.currency)} — {formatEvidenceCurrency(item.maxAmount, review.repairEstimate.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {review.repairEstimate.assumptions.length > 0 && (
                          <p className="evidence-intel__lineitems-note">{review.repairEstimate.assumptions.join(' ')}</p>
                        )}
                      </div>
                    )}

                    {/* Financial line items */}
                    {intel.artifact?.lineItems && intel.artifact.lineItems.length > 0 && (
                      <div className="evidence-intel__lineitems">
                        <table className="evidence-intel__lineitems-table">
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Basis</th>
                              <th className="evidence-intel__num">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {intel.artifact.lineItems.map((li, i) => (
                              <tr key={i}>
                                <td>{li.description}</td>
                                <td>{li.basis}</td>
                                <td className="evidence-intel__num">
                                  {li.amount != null ? formatEvidenceCurrency(li.amount, li.currency) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {intel.artifact.lineItemsLabel && (
                          <p className="evidence-intel__lineitems-note">{intel.artifact.lineItemsLabel}</p>
                        )}
                      </div>
                    )}
                  </TabPanel>

                  {/* Evidence Status */}
                  <TabPanel className="evidence-intel__tab-panel">
                    {review ? (
                      <Tile className="evidence-intel__status-tile">
                        <h5 className="evidence-intel__block-title">Recorded evidence status across this claim</h5>
                        <p className="evidence-intel__block-body">{review.evidenceValidity.summary}</p>
                        <p className="evidence-intel__lineitems-note">
                          This section is a first-pass rollup from the recorded evidence list on the claim and any police reference on file. It is not a full claim determination.
                        </p>
                        <div className="evidence-intel__chips">
                          <Tag type="outline" size="sm">Overall: {review.evidenceValidity.overall.toUpperCase()}</Tag>
                          <Tag type="outline" size="sm">Recorded artifacts considered: {review.claimWideAssessment.evidenceConsidered}</Tag>
                        </div>

                        <Tile className="evidence-intel__support-tile">
                          <h6 className="evidence-intel__block-subtitle">Supporting evidence</h6>
                          <UnorderedList>
                            {supportSignals.length > 0
                              ? supportSignals.map((item, index) => <ListItem key={`${item}-${index}`}>{item}</ListItem>)
                              : <ListItem>No independent corroboration has been recorded yet.</ListItem>}
                            {supportOverflow > 0 && (
                              <ListItem>And {supportOverflow} more supporting item{supportOverflow === 1 ? '' : 's'}.</ListItem>
                            )}
                          </UnorderedList>
                        </Tile>

                        <Tile className="evidence-intel__concern-tile">
                          <h6 className="evidence-intel__block-subtitle">Concerns and gaps</h6>
                          <UnorderedList>
                            {concernsAndGaps.length > 0
                              ? concernsAndGaps.map((item, index) => <ListItem key={`${item}-${index}`}>{item}</ListItem>)
                              : <ListItem>No material evidence concerns were flagged in the first pass.</ListItem>}
                            {concernsOverflow > 0 && (
                              <ListItem>And {concernsOverflow} more concern{concernsOverflow === 1 ? '' : 's'} or gap{concernsOverflow === 1 ? '' : 's'}.</ListItem>
                            )}
                          </UnorderedList>
                        </Tile>
                      </Tile>
                    ) : (
                      <p className="evidence-intel__tab-empty">Evidence status will appear once the AI review is complete.</p>
                    )}
                  </TabPanel>

                  {/* Source Lineage */}
                  <TabPanel className="evidence-intel__tab-panel">
                    <Tile className="evidence-intel__insight-tile evidence-intel__lineage">
                      <h5 className="evidence-intel__block-title">Source lineage</h5>
                      <StructuredListWrapper>
                        <StructuredListBody>
                          <StructuredListRow>
                            <StructuredListCell noWrap className="evidence-intel__metadata-label">Origin</StructuredListCell>
                            <StructuredListCell className="evidence-intel__metadata-value">{intel.lineage.origin}</StructuredListCell>
                          </StructuredListRow>
                          <StructuredListRow>
                            <StructuredListCell noWrap className="evidence-intel__metadata-label">Collected by</StructuredListCell>
                            <StructuredListCell className="evidence-intel__metadata-value">{intel.lineage.collectedBy}</StructuredListCell>
                          </StructuredListRow>
                          <StructuredListRow>
                            <StructuredListCell noWrap className="evidence-intel__metadata-label">Collected</StructuredListCell>
                            <StructuredListCell className="evidence-intel__metadata-value">{formatUsDate(intel.lineage.collectedAt)}</StructuredListCell>
                          </StructuredListRow>
                          <StructuredListRow>
                            <StructuredListCell noWrap className="evidence-intel__metadata-label">System of record</StructuredListCell>
                            <StructuredListCell className="evidence-intel__metadata-value">{intel.lineage.systemOfRecord}</StructuredListCell>
                          </StructuredListRow>
                        </StructuredListBody>
                      </StructuredListWrapper>
                      <div className="evidence-intel__trust">
                        <span className="evidence-intel__trust-label">Trust posture</span>
                        <p>{intel.lineage.trustPosture}</p>
                      </div>
                    </Tile>
                  </TabPanel>

                  {/* Metadata */}
                  <TabPanel className="evidence-intel__tab-panel">
                    <StructuredListWrapper className="evidence-intel__metadata-list">
                      <StructuredListBody>
                        {intel.artifact?.fields.map((f) => (
                          <StructuredListRow key={f.label}>
                            <StructuredListCell noWrap className="evidence-intel__metadata-label">{f.label}</StructuredListCell>
                            <StructuredListCell className="evidence-intel__metadata-value">
                              {f.label === 'Received' && selected
                                ? formatUsDate(selected.dateReceived)
                                : f.value}
                            </StructuredListCell>
                          </StructuredListRow>
                        ))}
                      </StructuredListBody>
                    </StructuredListWrapper>
                  </TabPanel>

                </TabPanels>
              </Tabs>

            </section>
          )}
        </div>
        </>
      )}
    </Modal>
  );
};
