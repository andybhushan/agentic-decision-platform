import { useState } from 'react';
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  ClickableTile,
  CodeSnippet,
  Tag,
  InlineNotification,
} from '@carbon/react';
import { WarningAlt } from '@carbon/icons-react';
import type { Claim, ClaimNote, EvidenceItem, NarrativeStatus } from '../types';
import { EvidenceIntelligenceModal } from './EvidenceIntelligenceModal';
import './ClaimDocket.scss';

const statusTagColor: Record<string, 'green' | 'cyan' | 'red'> = {
  verified: 'green',
  pending: 'cyan',
  disputed: 'red',
};

const noteCategoryColor: Record<string, 'blue' | 'cyan' | 'purple' | 'red' | 'gray'> = {
  general: 'gray',
  investigation: 'cyan',
  coverage: 'blue',
  legal: 'purple',
  communication: 'gray',
};

const narrativeStatusColor: Record<NarrativeStatus, 'green' | 'red' | 'cyan' | 'gray'> = {
  Confirmed: 'green',
  Disputed: 'red',
  Inferred: 'cyan',
  Pending: 'gray',
};

const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface ClaimDocketProps {
  claim: Claim;
}

/**
 * The "Full Claim" docket: Overview / History / Evidence / Policy / Consent.
 * The evidence list opens the Evidence Intelligence detail in a modal.
 * Shared by the Decision Mode "Full Claim" tab and the standalone evidence route.
 */
export const ClaimDocket = ({ claim }: ClaimDocketProps) => {
  const evidenceItems = claim.evidenceItems ?? [];
  const parties = claim.partiesInvolved ?? [];
  const immediateNeeds = claim.immediateNeeds ?? [];
  const auditTrail = claim.auditTrail ?? [];
  const narrative = claim.narrativeSynthesis ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const openEvidence = (evidenceId: string) => {
    setSelectedEvidenceId(evidenceId);
    setModalOpen(true);
  };

  return (
    <div className="claim-docket">
      <Tabs>
        <TabList aria-label="Full claim tabs">
          <Tab>Overview</Tab>
          <Tab>History</Tab>
          <Tab>Evidence ({evidenceItems.length})</Tab>
          <Tab>Notes {claim.claimNotes?.length ? `(${claim.claimNotes.length})` : ''}</Tab>
          <Tab>Policy</Tab>
          <Tab>Consent &amp; Authorization</Tab>
        </TabList>
        <TabPanels>
          {/* Overview Tab — incident spine + parties + key information */}
          <TabPanel>
            <div className="claim-docket__section">
              {/* Incident spine */}
              <div className="claim-docket__spine">
                <div className="claim-docket__spine-head">
                  <div>
                    <span className="claim-docket__eyebrow">Incident overview</span>
                    <h3 className="claim-docket__spine-title">
                      {claim.incidentType} · {claim.pendingDecisionType}
                    </h3>
                  </div>
                  <div className="claim-docket__spine-tags">
                    <Tag type="outline" size="sm">
                      {claim.claimStage.toUpperCase()}
                    </Tag>
                    <Tag
                      type={
                        claim.priority === 'urgent'
                          ? 'red'
                          : claim.priority === 'high'
                          ? 'magenta'
                          : 'blue'
                      }
                      size="sm"
                    >
                      {claim.priority.toUpperCase()} PRIORITY
                    </Tag>
                    {claim.injuryIndicated && (
                      <Tag type="red" size="sm">
                        INJURY INDICATED
                      </Tag>
                    )}
                  </div>
                </div>

                <dl className="claim-docket__facts">
                  <div>
                    <dt>Incident type</dt>
                    <dd>{claim.incidentType}</dd>
                  </div>
                  <div>
                    <dt>Date &amp; time</dt>
                    <dd>
                      {fmtDate(claim.incidentDate)}
                      {claim.incidentTime ? ` · ${claim.incidentTime}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{claim.incidentLocation}</dd>
                  </div>
                  <div>
                    <dt>Police report</dt>
                    <dd>{claim.policeReportRef ?? 'Not on file'}</dd>
                  </div>
                  <div>
                    <dt>Preferred contact</dt>
                    <dd>{claim.preferredContactChannel}</dd>
                  </div>
                  <div>
                    <dt>Immediate needs</dt>
                    <dd>
                      {immediateNeeds.length > 0 ? (
                        <span className="claim-docket__chips">
                          {immediateNeeds.map((n) => (
                            <Tag key={n} type="cool-gray" size="sm">
                              {n}
                            </Tag>
                          ))}
                        </span>
                      ) : (
                        'None recorded'
                      )}
                    </dd>
                  </div>
                </dl>

                <p className="claim-docket__desc">{claim.incidentDescription}</p>
              </div>

              {/* Parties involved */}
              <h3 className="claim-docket__section-title">Parties involved ({parties.length})</h3>
              {parties.length === 0 ? (
                <p className="claim-docket__muted">No parties recorded.</p>
              ) : (
                <ul className="claim-docket__parties">
                  {parties.map((p, i) => (
                    <li key={`${p.name}-${i}`} className="claim-docket__party">
                      <span className="claim-docket__party-name">{p.name}</span>
                      <span className="claim-docket__party-role">{p.role}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Key information */}
              <h3 className="claim-docket__section-title">Key information</h3>
              <dl className="claim-docket__facts claim-docket__facts--keyinfo">
                <div>
                  <dt>Claimant</dt>
                  <dd>{claim.claimantName}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{claim.claimantEmail ?? '—'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{claim.claimantPhone ?? '—'}</dd>
                </div>
                <div>
                  <dt>Policy reference</dt>
                  <dd>{claim.policyRef}</dd>
                </div>
                <div>
                  <dt>Coverage type</dt>
                  <dd>{claim.policyContext.coverageType}</dd>
                </div>
                <div>
                  <dt>Pending decision</dt>
                  <dd>{claim.pendingDecisionType}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{claim.owner ?? 'Unassigned'}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{claim.confidenceLevel.toUpperCase()}</dd>
                </div>
                <div>
                  <dt>Time in queue</dt>
                  <dd>{claim.timeInQueue}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{fmtDateTime(claim.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{fmtDateTime(claim.updatedAt)}</dd>
                </div>
                <div className="claim-docket__facts-wide">
                  <dt>Last agent action</dt>
                  <dd>{claim.lastAgentAction}</dd>
                </div>
              </dl>
            </div>
          </TabPanel>

          {/* History Tab — claim history audit trail + event timeline */}
          <TabPanel>
            <div className="claim-docket__section">
              <h3 className="claim-docket__section-title">Claim history</h3>
              {auditTrail.length === 0 ? (
                <p className="claim-docket__muted">No history recorded.</p>
              ) : (
                <ol className="claim-docket__timeline">
                  {auditTrail.map((a, i) => (
                    <li key={i} className="claim-docket__timeline-item">
                      <span className="claim-docket__timeline-dot" />
                      <div className="claim-docket__timeline-body">
                        <div className="claim-docket__timeline-head">
                          <span className="claim-docket__timeline-action">{a.action}</span>
                          <span className="claim-docket__timeline-time">{fmtDateTime(a.timestamp)}</span>
                        </div>
                        <p className="claim-docket__timeline-outcome">{a.outcome}</p>
                        {a.rationale && (
                          <p className="claim-docket__timeline-rationale">{a.rationale}</p>
                        )}
                        <span className="claim-docket__timeline-by">{a.userId}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <h3 className="claim-docket__section-title">Event timeline</h3>
              {narrative.length === 0 ? (
                <p className="claim-docket__muted">No reconstructed events.</p>
              ) : (
                <ol className="claim-docket__timeline">
                  {narrative.map((n, i) => (
                    <li key={i} className="claim-docket__timeline-item">
                      <span className="claim-docket__timeline-dot" />
                      <div className="claim-docket__timeline-body">
                        <div className="claim-docket__timeline-head">
                          <span className="claim-docket__timeline-action">{n.description}</span>
                          <Tag type={narrativeStatusColor[n.status]} size="sm">
                            {n.status}
                          </Tag>
                        </div>
                        <span className="claim-docket__timeline-by">
                          {fmtDateTime(n.timestamp)} · {n.source}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </TabPanel>

          {/* Evidence Tab — artifact list that opens the intelligence modal */}
          <TabPanel>
            {evidenceItems.length === 0 ? (
              <div className="claim-docket__section">
                <InlineNotification
                  kind="info"
                  title="No evidence on file"
                  subtitle="No evidence artifacts have been attached to this claim yet."
                  hideCloseButton
                  lowContrast
                />
              </div>
            ) : (
              <div className="claim-docket__evidence">
                <p className="claim-docket__evidence-hint">
                  Select an artifact to open its Evidence Intelligence packet.
                </p>
                <ul className="evidence-intel__list">
                  {evidenceItems.map((evidence: EvidenceItem) => (
                    <li key={evidence.id}>
                      <ClickableTile
                        className="evidence-intel__item"
                        onClick={() => openEvidence(evidence.id)}
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
                      </ClickableTile>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabPanel>

          {/* Notes Tab */}
          <TabPanel>
            <div className="claim-docket__section">
              {!claim.claimNotes?.length ? (
                <p className="claim-docket__muted">No notes on file for this claim.</p>
              ) : (
                <ul className="claim-docket__notes">
                  {claim.claimNotes.map((note: ClaimNote) => (
                    <li key={note.id} className="claim-docket__note">
                      <div className="claim-docket__note-head">
                        <span className="claim-docket__note-author">{note.author}</span>
                        <span className="claim-docket__note-role">{note.authorRole}</span>
                        <Tag type={noteCategoryColor[note.category]} size="sm">
                          {note.category.charAt(0).toUpperCase() + note.category.slice(1)}
                        </Tag>
                        <span className="claim-docket__note-date">{fmtDateTime(note.createdAt)}</span>
                      </div>
                      <p className="claim-docket__note-text">{note.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabPanel>

          {/* Policy Tab */}
          <TabPanel>
            <div className="claim-docket__section">
              <h3 className="claim-docket__section-title">Policy Information</h3>
              <div className="claim-docket__policy-info">
                <p>
                  <strong>Policy Number:</strong> {claim.policyContext.policyNumber}
                </p>
                <p>
                  <strong>Coverage Type:</strong> {claim.policyContext.coverageType}
                </p>
                <p>
                  <strong>Coverage Applicability:</strong>{' '}
                  <Tag
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
                </p>
              </div>

              <h3 className="claim-docket__section-title">Relevant Policy Clauses</h3>
              {claim.policyContext.relevantClauses.map((clause, index) => (
                <CodeSnippet key={index} type="multi" feedback="Copied">
                  {clause}
                </CodeSnippet>
              ))}

              {claim.policyContext.ambiguityIndicators &&
                claim.policyContext.ambiguityIndicators.length > 0 && (
                  <>
                    <h3 className="claim-docket__section-title">Ambiguity Indicators</h3>
                    <InlineNotification
                      kind="warning"
                      title="Policy Ambiguity Detected"
                      subtitle="The following ambiguities require careful review:"
                      hideCloseButton
                      lowContrast
                    />
                    <ul className="claim-docket__ambiguity-list">
                      {claim.policyContext.ambiguityIndicators.map((indicator, index) => (
                        <li key={index}>{indicator}</li>
                      ))}
                    </ul>
                  </>
                )}
            </div>
          </TabPanel>

          {/* Consent Tab */}
          <TabPanel>
            <div className="claim-docket__section">
              <div className="claim-docket__consent-info">
                <p>
                  <strong>Claimant Consent:</strong> <Tag type="green">Provided</Tag>
                </p>
                <p>
                  <strong>Medical Records Release:</strong>{' '}
                  {claim.injuryIndicated ? (
                    <Tag type="green">Authorized</Tag>
                  ) : (
                    <Tag type="gray">Not Required</Tag>
                  )}
                </p>
                <p>
                  <strong>Third-Party Communication:</strong> <Tag type="green">Authorized</Tag>
                </p>
                <p>
                  <strong>Data Processing Consent:</strong> <Tag type="green">Provided</Tag>
                </p>
              </div>
              <InlineNotification
                kind="info"
                title="Consent Tracking"
                subtitle="All required consents have been obtained and documented in the claim file."
                hideCloseButton
                lowContrast
              />
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <EvidenceIntelligenceModal
        open={modalOpen}
        claim={claim}
        evidenceId={selectedEvidenceId}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

// Made with Bob
