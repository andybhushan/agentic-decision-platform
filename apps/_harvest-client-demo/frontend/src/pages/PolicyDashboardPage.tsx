/**
 * PolicyDashboardPage — full-screen mobile insurance customer dashboard.
 * Route: /claims/dashboard (outside app shell for PWA feel)
 *
 * Shows the customer's Bane & Ox Insurance policies, any active claims,
 * and a prominent "File a Claim" CTA that navigates to the FNOL flow.
 */

import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loading, InlineNotification } from '@carbon/react';
import {
  Car,
  Home,
  Plane,
  DocumentAdd,
  ChevronRight,
  User,
  CircleDash,
  CheckmarkFilled,
  Warning,
} from '@carbon/icons-react';
import { api } from '../services/api';
import { useCustomerPersonaStore, readStoredCustomerPersonaId } from '../store/useCustomerPersonaStore';
import type { Claim, ClientServiceTier, ClaimHandlingMode } from '../types';
import './PolicyDashboardPage.scss';

// ── Service tier ──────────────────────────────────────────────────────────────

const SERVICE_TIER_META: Record<ClientServiceTier, { label: string; modifier: string; blurb: string }> = {
  standard: { label: 'Core', modifier: 'standard', blurb: 'AI-managed claims, end-to-end' },
  priority: { label: 'Premier', modifier: 'priority', blurb: 'AI claims with adjuster oversight' },
  white_glove: { label: 'Masterpiece', modifier: 'white-glove', blurb: 'Dedicated senior adjuster' },
  signature: { label: 'Masterpiece Signature', modifier: 'signature', blurb: 'Appointed representative · dedicated senior adjuster' },
};

function tierMeta(tier?: ClientServiceTier) {
  return SERVICE_TIER_META[tier ?? 'standard'];
}

const HANDLING_MODE_LABEL: Record<ClaimHandlingMode, string> = {
  ai: 'AI-managed end-to-end',
  ai_oversight: 'AI-managed · adjuster oversight',
  human: 'Senior human adjuster · white-glove',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface PolicyRecord {
  policyRef: string;
  personaId?: string;
  policyType?: string;
  coverageType: string;
  coverageActive: boolean;
  renewalDate: string;
  annualPremium?: number;
  excessAmount: number;
  noClaims: number;
  address?: string;
  vehicles?: Array<{ make: string; model: string; registration: string; year: number }>;
  buildingsValue?: number;
  contentsValue?: number;
  maxTripDuration?: number;
}

interface ActiveClaim {
  claimId: string;
  policyRef: string;
  policyType: string;
  submittedAt: string;
  status: 'In progress' | 'Under review' | 'Awaiting information' | 'Settled';
  handlingMode?: ClaimHandlingMode;
  adjuster: {
    name: string;
    team: string;
    phone: string;
    email: string;
  };
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const POLICY_ICONS: Record<string, React.FC<{ size?: number }>> = {
  Auto: Car,
  Homeowners: Home,
  Renters: Home,
  'Personal Umbrella': Plane,
};

function policyIcon(type?: string) {
  const Icon = (type && POLICY_ICONS[type]) || DocumentAdd;
  return Icon;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getActiveClaimStorageKey(personaId: string | null) {
  return `baneox_active_claim:${personaId ?? 'default'}`;
}

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

function statusFromClaim(claim: Claim): ActiveClaim['status'] {
  if (claim.claimStage === 'settlement') return 'Settled';
  if (/additional information requested|awaiting/i.test(`${claim.lastAgentAction} ${claim.blockerReason}`)) {
    return 'Awaiting information';
  }
  if (claim.claimStage === 'evaluation' || claim.claimStage === 'investigation') return 'Under review';
  return 'In progress';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PolicyDashboardPage = () => {
  const navigate = useNavigate();
  const { personas, activeCustomerId, setPersonas, setActiveCustomer, hydrateActiveCustomer } = useCustomerPersonaStore();
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeClaim, setActiveClaim] = useState<ActiveClaim | null>(null);
  const [isDeletingClaim, setIsDeletingClaim] = useState(false);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const activeCustomer = personas.find((persona) => persona.id === activeCustomerId) ?? personas[0] ?? null;

  useEffect(() => {
    hydrateActiveCustomer();
    void api.getCustomerPersonas(true).then(setPersonas).catch(() => {});
  }, [hydrateActiveCustomer, setPersonas]);

  const loadDashboard = useCallback(async () => {
    const fallbackPersonaId = readStoredCustomerPersonaId();
    const selectedPersona = activeCustomer ?? (fallbackPersonaId ? await api.getCustomerPersona(fallbackPersonaId).catch(() => null) : null);

    if (!selectedPersona) {
      setPolicies([]);
      setActiveClaim(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [policyData, claimData] = await Promise.all([
        api.getPolicies({ personaId: selectedPersona.id }),
        api.getClaims({ claimantPersonaId: selectedPersona.id }),
      ]);
      setPolicies(policyData as PolicyRecord[]);

      const newestClaim = [...claimData].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null;
      if (newestClaim) {
        const adjuster = newestClaim.assignedAdjusterId
          ? await api.getAdjuster(newestClaim.assignedAdjusterId).catch(() => null)
          : null;
        setActiveClaim({
          claimId: newestClaim.id,
          policyRef: newestClaim.policyRef,
          policyType: newestClaim.incidentType,
          submittedAt: newestClaim.createdAt,
          status: statusFromClaim(newestClaim),
          handlingMode: newestClaim.handlingMode,
          adjuster: {
            name: adjuster?.name ?? newestClaim.assignedAdjusterName ?? 'Your Claims Handler',
            team: adjuster?.team ?? 'Claims',
            phone: adjuster?.phone ?? '',
            email: adjuster?.email ?? '',
          },
          description: newestClaim.incidentDescription,
        });
        localStorage.removeItem(getActiveClaimStorageKey(selectedPersona.id));
      } else {
        const stored = localStorage.getItem(getActiveClaimStorageKey(selectedPersona.id));
        if (stored) {
          try {
            setActiveClaim(JSON.parse(stored));
          } catch {
            setActiveClaim(null);
          }
        } else {
          setActiveClaim(null);
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load policies.'));
    } finally {
      setIsLoading(false);
    }
  }, [activeCustomer]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleFileClaim = () => navigate('/claims/intake');

  const handleDeleteClaim = useCallback(async () => {
    if (!activeClaim) return;
    const confirmed = window.confirm(`Delete claim ${activeClaim.claimId}? This removes it from the demo so you can submit a fresh claim.`);
    if (!confirmed) return;

    setIsDeletingClaim(true);
    setError(null);
    try {
      await api.deleteClaim(activeClaim.claimId);
      localStorage.removeItem(getActiveClaimStorageKey(activeCustomer?.id ?? readStoredCustomerPersonaId() ?? null));
      setActiveClaim(null);
      await loadDashboard();
    } catch (err) {
      setError(getApiErrorMessage(err, `Unable to delete claim ${activeClaim.claimId}.`));
    } finally {
      setIsDeletingClaim(false);
    }
  }, [activeClaim, activeCustomer?.id, loadDashboard]);

  const togglePolicy = (ref: string) =>
    setExpandedPolicy((prev) => (prev === ref ? null : ref));

  const handleCustomerSwitch = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCustomerId = event.target.value || null;
    if (!nextCustomerId || nextCustomerId === activeCustomerId) return;
    setActiveCustomer(nextCustomerId);
    setShowProfileMenu(false);
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="bx-dashboard bx-dashboard--loading">
        <Loading description="Loading your policies…" withOverlay={false} />
      </div>
    );
  }

  const totalPremium = policies.reduce((s, p) => s + (p.annualPremium ?? 0), 0);

  return (
    <div className="bx-dashboard" role="main" aria-label="My Insurance">
      {/* ── Header ── */}
      <header className="bx-dashboard__header">
        <div className="bx-dashboard__header-brand">
          <div className="bx-dashboard__brand-mark">B&amp;O</div>
          <div className="bx-dashboard__brand-text">
            <span className="bx-dashboard__brand-name">Bane &amp; Ox</span>
            <span className="bx-dashboard__brand-sub">US Personal Lines</span>
          </div>
          <button
            type="button"
            className="bx-dashboard__queue-link"
            onClick={() => navigate('/claims/queue')}
            aria-label="Go to adjuster queue"
          >
            Adjuster queue
          </button>
        </div>
        <div className="bx-dashboard__profile">
          <button className="bx-dashboard__header-icon" aria-label="Profile" onClick={() => setShowProfileMenu((open) => !open)}>
            <User size={20} />
          </button>
          {showProfileMenu && activeCustomer && (
            <div className="bx-dashboard__profile-menu">
              <div className="bx-dashboard__profile-label">Customer persona</div>
              <div className="bx-dashboard__profile-name">{activeCustomer.displayName}</div>
              <div className="bx-dashboard__profile-meta">
                <span
                  className={`bx-tier-badge bx-tier-badge--${tierMeta(activeCustomer.serviceTier).modifier}`}
                  title={tierMeta(activeCustomer.serviceTier).blurb}
                >
                  {tierMeta(activeCustomer.serviceTier).label}
                </span>
                {' '}· {tierMeta(activeCustomer.serviceTier).blurb}
              </div>
              <div className="bx-dashboard__profile-meta">
                {[activeCustomer.city, activeCustomer.state].filter(Boolean).join(', ')} · {activeCustomer.preferredContactChannel}
              </div>
              <div className="bx-dashboard__profile-meta">
                {activeCustomer.supportSummary.policyCount} policies · {activeCustomer.supportSummary.claimFreeYears} claim-free years
              </div>
              <select className="bx-dashboard__profile-select" value={activeCustomer.id} onChange={handleCustomerSwitch}>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>{persona.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <div className="bx-dashboard__scroll">
        {/* ── Welcome hero ── */}
        <section className="bx-dashboard__hero">
          <div className="bx-dashboard__welcome">
            <span className="bx-dashboard__welcome-text">Welcome back,</span>
            <span className="bx-dashboard__welcome-name">{activeCustomer?.firstName ?? 'Customer'}</span>
            {activeCustomer && (
              <span
                className={`bx-tier-badge bx-tier-badge--${tierMeta(activeCustomer.serviceTier).modifier}`}
                title={tierMeta(activeCustomer.serviceTier).blurb}
              >
                {tierMeta(activeCustomer.serviceTier).label}
              </span>
            )}
          </div>
          <div className="bx-dashboard__hero-stats">
            <div className="bx-dashboard__hero-stat">
              <span className="bx-dashboard__hero-stat-value">{policies.length}</span>
              <span className="bx-dashboard__hero-stat-label">Active Policies</span>
            </div>
            <div className="bx-dashboard__hero-stat-divider" />
            <div className="bx-dashboard__hero-stat">
              <span className="bx-dashboard__hero-stat-value">{formatCurrency(totalPremium)}</span>
              <span className="bx-dashboard__hero-stat-label">Annual Premium</span>
            </div>
            <div className="bx-dashboard__hero-stat-divider" />
            <div className="bx-dashboard__hero-stat">
              <span className="bx-dashboard__hero-stat-value">
                {policies.length ? Math.max(...policies.map((p) => p.noClaims)) : 0}
              </span>
              <span className="bx-dashboard__hero-stat-label">Claim-Free (best)</span>
            </div>
          </div>
        </section>

        {/* ── File a claim CTA ── */}
        <section className="bx-dashboard__cta-section">
          <button className="bx-dashboard__cta-btn" onClick={handleFileClaim} aria-label="File a new claim">
            <DocumentAdd size={22} />
            <span>File a Claim</span>
          </button>
          <p className="bx-dashboard__cta-hint">
            Alex, our AI claims assistant, is available 24/7
          </p>
        </section>

        {/* ── Error banner ── */}
        {error && (
          <InlineNotification kind="error" title={error} lowContrast hideCloseButton />
        )}

        {/* ── Active claim card ── */}
        {activeClaim && (
          <section className="bx-dashboard__section">
            <h2 className="bx-dashboard__section-title">Active Claims</h2>
            <div className="bx-dashboard__claim-card">
              <div className="bx-dashboard__claim-card-header">
                <div className="bx-dashboard__claim-status bx-dashboard__claim-status--active">
                  <CircleDash size={14} />
                  <span>{activeClaim.status}</span>
                </div>
                <span className="bx-dashboard__claim-ref">{activeClaim.claimId}</span>
              </div>
              <p className="bx-dashboard__claim-desc">{activeClaim.description}</p>
              {activeClaim.handlingMode && (
                <div className={`bx-dashboard__claim-handling bx-dashboard__claim-handling--${activeClaim.handlingMode}`}>
                  {HANDLING_MODE_LABEL[activeClaim.handlingMode]}
                </div>
              )}
              <div className="bx-dashboard__claim-submitted">
                Submitted {formatDate(activeClaim.submittedAt)}
              </div>
              <div className="bx-dashboard__adjuster">
                <div className="bx-dashboard__adjuster-avatar">
                  {activeClaim.adjuster.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="bx-dashboard__adjuster-info">
                  <span className="bx-dashboard__adjuster-name">{activeClaim.adjuster.name}</span>
                  <span className="bx-dashboard__adjuster-team">{activeClaim.adjuster.team} · Your assigned handler</span>
                  <a className="bx-dashboard__adjuster-contact" href={`mailto:${activeClaim.adjuster.email}`}>
                    {activeClaim.adjuster.email}
                  </a>
                </div>
              </div>
              <div className="bx-dashboard__claim-actions">
                <button
                  type="button"
                  className="bx-dashboard__claim-delete"
                  onClick={() => { void handleDeleteClaim(); }}
                  disabled={isDeletingClaim}
                >
                  {isDeletingClaim ? 'Deleting claim…' : 'Delete claim'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Policies ── */}
        <section className="bx-dashboard__section">
          <h2 className="bx-dashboard__section-title">Your Policies</h2>
          {policies.map((policy) => {
            const Icon = policyIcon(policy.policyType);
            const days = daysUntil(policy.renewalDate);
            const renewalSoon = days <= 30;
            const isExpanded = expandedPolicy === policy.policyRef;

            return (
              <div
                key={policy.policyRef}
                className={`bx-dashboard__policy-card${isExpanded ? ' bx-dashboard__policy-card--expanded' : ''}`}
              >
                <button
                  className="bx-dashboard__policy-card-header"
                  onClick={() => togglePolicy(policy.policyRef)}
                  aria-expanded={isExpanded}
                  aria-controls={`policy-detail-${policy.policyRef}`}
                >
                  <div className={`bx-dashboard__policy-icon bx-dashboard__policy-icon--${policy.policyType?.replace(/[\s&]+/g, '-').replace(/-+/g, '-').toLowerCase() ?? 'other'}`}>
                    <Icon size={20} />
                  </div>
                  <div className="bx-dashboard__policy-summary">
                    <span className="bx-dashboard__policy-type">{policy.policyType ?? 'Coverage'}</span>
                    <span className="bx-dashboard__policy-ref">{policy.policyRef}</span>
                    {policy.vehicles?.length ? (
                      <span className="bx-dashboard__policy-subtitle">
                        {policy.vehicles.map((v) => `${v.make} ${v.model} (${v.registration})`).join(' · ')}
                      </span>
                    ) : policy.policyType === 'Homeowners' || policy.policyType === 'Renters' ? (
                      <span className="bx-dashboard__policy-subtitle">{policy.address ?? policy.coverageType}</span>
                    ) : (
                      <span className="bx-dashboard__policy-subtitle">{policy.coverageType}</span>
                    )}
                  </div>
                  <div className="bx-dashboard__policy-header-right">
                    {policy.coverageActive
                      ? <CheckmarkFilled size={16} className="bx-dashboard__policy-active-icon" />
                      : <Warning size={16} className="bx-dashboard__policy-inactive-icon" />
                    }
                    <ChevronRight
                      size={16}
                      className={`bx-dashboard__policy-chevron${isExpanded ? ' bx-dashboard__policy-chevron--open' : ''}`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div
                    id={`policy-detail-${policy.policyRef}`}
                    className="bx-dashboard__policy-detail"
                    aria-label={`${policy.policyType} policy details`}
                  >
                    <div className="bx-dashboard__policy-detail-grid">
                      <div className="bx-dashboard__policy-detail-item">
                        <span className="bx-dashboard__policy-detail-label">Coverage</span>
                        <span className="bx-dashboard__policy-detail-value">{policy.coverageType}</span>
                      </div>
                      {policy.annualPremium && (
                        <div className="bx-dashboard__policy-detail-item">
                          <span className="bx-dashboard__policy-detail-label">Annual Premium</span>
                          <span className="bx-dashboard__policy-detail-value">{formatCurrency(policy.annualPremium)}</span>
                        </div>
                      )}
                      <div className="bx-dashboard__policy-detail-item">
                        <span className="bx-dashboard__policy-detail-label">Deductible</span>
                        <span className="bx-dashboard__policy-detail-value">{formatCurrency(policy.excessAmount)}</span>
                      </div>
                      <div className="bx-dashboard__policy-detail-item">
                        <span className="bx-dashboard__policy-detail-label">Claim-Free History</span>
                        <span className="bx-dashboard__policy-detail-value">{policy.noClaims} year{policy.noClaims !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="bx-dashboard__policy-detail-item">
                        <span className="bx-dashboard__policy-detail-label">Renewal Date</span>
                        <span className={`bx-dashboard__policy-detail-value${renewalSoon ? ' bx-dashboard__policy-detail-value--warn' : ''}`}>
                          {formatDate(policy.renewalDate)}
                          {renewalSoon && ` · ${days}d`}
                        </span>
                      </div>
                      {policy.buildingsValue && (
                        <div className="bx-dashboard__policy-detail-item">
                          <span className="bx-dashboard__policy-detail-label">Buildings Value</span>
                          <span className="bx-dashboard__policy-detail-value">{formatCurrency(policy.buildingsValue)}</span>
                        </div>
                      )}
                      {policy.contentsValue && (
                        <div className="bx-dashboard__policy-detail-item">
                          <span className="bx-dashboard__policy-detail-label">Contents Value</span>
                          <span className="bx-dashboard__policy-detail-value">{formatCurrency(policy.contentsValue)}</span>
                        </div>
                      )}
                      {policy.maxTripDuration && (
                        <div className="bx-dashboard__policy-detail-item">
                          <span className="bx-dashboard__policy-detail-label">Max Trip Duration</span>
                          <span className="bx-dashboard__policy-detail-value">{policy.maxTripDuration} days</span>
                        </div>
                      )}
                    </div>
                    {policy.vehicles?.map((v) => (
                      <div key={v.registration} className="bx-dashboard__vehicle-chip">
                        <Car size={14} />
                        <span>{v.year} {v.make} {v.model}</span>
                        <span className="bx-dashboard__vehicle-reg">{v.registration}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ── Footer ── */}
        <footer className="bx-dashboard__footer">
          <p>Bane &amp; Ox Insurance Group demo environment for US personal-lines claims workflows.</p>
          <p>Sample policy and claims data shown for demonstration only.</p>
        </footer>
      </div>
    </div>
  );
};

// Exported helper so FNOLConversationPage can write claim data after submission.
// It reads the actual created claim and resolves the real assigned adjuster rather than
// inventing a random handler locally.
export async function storeActiveClaim(claimId: string, policyType = 'Auto'): Promise<ActiveClaim> {
  let adjuster = {
    name: 'Your Claims Handler',
    team: 'Claims',
    phone: '',
    email: '',
  };
  let policyRef = 'POL-AUTO-US-2026-RH01';
  let description = 'Auto incident claim — FNOL intake completed. Under initial review.';
  let personaId: string | null = null;

  const claimResponse = await fetch(`/api/v1/claims/${claimId}`);
  let claimBody: any = null;
  try {
    claimBody = await claimResponse.json();
  } catch {
    throw new Error(`Unable to read claim ${claimId} from the API.`);
  }
  if (!claimResponse.ok || !claimBody?.success || !claimBody?.data) {
    throw new Error(claimBody?.error ?? claimBody?.message ?? `Unable to load claim ${claimId}.`);
  }

  const loadedClaim = claimBody.data;
  personaId = loadedClaim.claimantPersonaId ?? null;
  policyRef = loadedClaim.policyRef || policyRef;
  description = loadedClaim.incidentDescription || description;
  if (loadedClaim.assignedAdjusterId) {
    const adjusterResponse = await fetch(`/api/v1/staff/adjusters/${loadedClaim.assignedAdjusterId}`);
    let adjusterBody: any = null;
    try {
      adjusterBody = await adjusterResponse.json();
    } catch {
      throw new Error(`Unable to read adjuster ${loadedClaim.assignedAdjusterId} from the API.`);
    }
    if (!adjusterResponse.ok || !adjusterBody?.success || !adjusterBody?.data) {
      if (loadedClaim.assignedAdjusterName) {
        adjuster = { ...adjuster, name: loadedClaim.assignedAdjusterName };
      } else {
        throw new Error(
          adjusterBody?.error
          ?? adjusterBody?.message
          ?? `Unable to load assigned adjuster ${loadedClaim.assignedAdjusterId}.`
        );
      }
    } else {
      adjuster = adjusterBody.data;
    }
  } else if (loadedClaim.assignedAdjusterName) {
    adjuster = { ...adjuster, name: loadedClaim.assignedAdjusterName };
  }

  const claim: ActiveClaim = {
    claimId,
    policyRef,
    policyType,
    submittedAt: new Date().toISOString(),
    status: 'In progress',
    adjuster,
    description,
  };
  localStorage.setItem(getActiveClaimStorageKey(personaId), JSON.stringify(claim));
  return claim;
}
