import { Claim, FNOLSubmission, DecisionOutcome, EvidenceItem, ClaimHandlingMode } from '../types';
import { createHash } from 'crypto';
import { CosmosRepository } from './cosmosRepository';
import { assignAdjusterDecision, ensureAssignedAdjuster, getBuiltinAdjusterLimit } from './adjusterDataService';
import { getPolicyByRef } from './policyService';
import { getCustomerPersonas } from './customerPersonaService';
import { deriveAppointedRepresentative } from './policyTier';
import { getSessionByClaimId } from './fnolSessionService';
import type { EvidenceItem as SessionEvidenceItem, FNOLSession } from '../types/fnolSession';
import { evaluateDecision } from './governanceEvaluator';
import { recordInteraction } from './interactionService';

const repo = new CosmosRepository<Claim>('claims');

// Derive an initial exposure estimate from FNOL data so queue cards show a non-zero value.
function estimateInitialExposure(submission: FNOLSubmission): Claim['recommendedAction']['financialImpact'] {
  const type = (submission.incidentType ?? '').toLowerCase();
  const hasInjury = Boolean(submission.injuryIndicated);

  // Base property damage estimate by incident type
  let propertyBase = 8500;
  if (type.includes('theft') || type.includes('vandal')) propertyBase = 12000;
  else if (type.includes('fire') || type.includes('total loss')) propertyBase = 28000;
  else if (type.includes('flood') || type.includes('weather')) propertyBase = 18000;
  else if (type.includes('collision') || type.includes('auto') || type.includes('vehicle')) propertyBase = 11000;
  else if (type.includes('commercial') || type.includes('cargo')) propertyBase = 35000;

  const laborAmount = Math.round(propertyBase * 0.35);   // ~35% of damage is labor
  const partsAmount = Math.round(propertyBase * 0.65);   // ~65% is parts
  const partsTax = Math.round(partsAmount * 0.0825);     // 8.25% TX sales tax on parts
  const towingStorage = 425;                              // towing + 3 days storage typical
  const rentalCar = Math.round(propertyBase * 0.04);     // ~4% rental / loss of use
  const injuryAmount = hasInjury ? Math.round(propertyBase * 0.65) : 0;
  const deductible = 500;                                // standard policy deductible

  const grossTotal = laborAmount + partsAmount + partsTax + towingStorage + rentalCar + injuryAmount;
  const netTotal = grossTotal - deductible;

  const breakdown: NonNullable<Claim['recommendedAction']['financialImpact']>['breakdown'] = [
    { category: 'Labor', amount: laborAmount, description: 'Body repair and mechanical labor (estimated hours × shop rate).' },
    { category: 'Parts', amount: partsAmount, description: 'OEM / aftermarket parts required for repair.' },
    { category: 'Parts Sales Tax', amount: partsTax, description: 'TX sales tax on parts (8.25%). Labor not taxed.' },
    { category: 'Towing & Storage', amount: towingStorage, description: 'Tow to shop + 3 days vehicle storage.' },
    { category: 'Rental Car / Loss of Use', amount: rentalCar, description: 'Estimated rental vehicle during repair period.' },
    ...(injuryAmount > 0 ? [{ category: 'Bodily Injury / Medical', amount: injuryAmount, description: 'Injury-related costs pending medical evaluation.' }] : []),
    { category: 'Less: Policy Deductible', amount: -deductible, description: `Insured's standard deductible applied.`, isDeduction: true },
  ];

  const repairQuotes: NonNullable<Claim['recommendedAction']['financialImpact']>['repairQuotes'] = [
    {
      id: 'rq-001',
      vendor: 'Caliber Collision – Austin TX',
      vendorType: 'body_shop',
      amount: Math.round(propertyBase * 1.02),
      currency: 'USD',
      receivedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending_review',
      notes: 'Includes OEM parts. Estimate valid 30 days.',
    },
    {
      id: 'rq-002',
      vendor: 'Maaco Body Shop – Round Rock TX',
      vendorType: 'body_shop',
      amount: Math.round(propertyBase * 0.88),
      currency: 'USD',
      receivedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending_review',
      notes: 'Aftermarket parts used. Faster turnaround (4–5 days).',
    },
    {
      id: 'rq-tow',
      vendor: 'Quick Tow & Recovery',
      vendorType: 'tow_service',
      amount: towingStorage,
      currency: 'USD',
      receivedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'accepted',
      notes: 'Tow + 3 days storage. Vehicle released.',
    },
  ];

  return { estimatedAmount: netTotal, currency: 'USD', breakdown, repairQuotes };
}

function handlingModeLabel(mode: ClaimHandlingMode): string {
  if (mode === 'human') return 'Senior human adjuster handling (white-glove)';
  if (mode === 'ai_oversight') return 'AI-managed with adjuster oversight';
  return 'AI-managed end-to-end';
}

function handlingModeClaimantMessage(mode: ClaimHandlingMode, adjusterName: string, claimId: string): string {
  if (mode === 'human') {
    return `Thank you for submitting your claim. As one of our priority clients, you'll receive white-glove service — ${adjusterName}, a senior adjuster, will personally handle your claim. Your claim number is ${claimId}.`;
  }
  if (mode === 'ai_oversight') {
    return `Thank you for submitting your claim. Our AI claims team will process it immediately with ${adjusterName} providing adjuster oversight. Your claim number is ${claimId}.`;
  }
  return `Thank you for submitting your claim. Our AI claims assistant will handle it end-to-end and keep you updated, with ${adjusterName} available if needed. Your claim number is ${claimId}.`;
}

function formatEvidenceType(item: SessionEvidenceItem): string {
  if (item.type === 'document') {
    switch (item.category) {
      case 'medical_record':
        return 'Medical Record';
      case 'witness_statement':
        return 'Witness Statement';
      case 'police_report':
        return 'Police Report';
      default:
        return 'Supporting Document';
    }
  }
  if (item.type !== 'photo') return item.type;
  switch (item.category) {
    case 'own_vehicle':
      return 'Vehicle Photo';
    case 'third_party':
      return 'Third-Party Photo';
    case 'scene':
      return 'Scene Photo';
    default:
      return 'Photo Upload';
  }
}

function formatEvidenceDescription(item: SessionEvidenceItem): string {
  const categoryLabel = item.category ? item.category.replace(/_/g, ' ') : 'uploaded evidence';
  if (item.analysisText?.trim()) return item.analysisText.trim();
  if (item.filename?.trim()) {
    return item.type === 'document'
      ? `${categoryLabel} document uploaded: ${item.filename.trim()}`
      : `${categoryLabel} image uploaded: ${item.filename.trim()}`;
  }
  return item.type === 'document'
    ? `${categoryLabel} document uploaded during FNOL intake.`
    : `${categoryLabel} image uploaded during FNOL intake.`;
}

function buildEvidenceUrl(item: SessionEvidenceItem): string | undefined {
  const storedFile = item.blobName?.split('/').pop();
  if (!item.sessionId || !storedFile) return undefined;
  return `/api/v1/fnol/evidence-files/${encodeURIComponent(item.sessionId)}/${encodeURIComponent(storedFile)}`;
}

function mapSessionEvidenceToClaimEvidence(item: SessionEvidenceItem): EvidenceItem {
  return {
    id: item.id,
    type: formatEvidenceType(item),
    description: formatEvidenceDescription(item),
    source: item.filename?.trim() || 'Mobile FNOL Upload',
    provenance: 'Claimant Provided',
    dateReceived: item.uploadedAt || item.storedAt,
    status: 'pending',
    url: buildEvidenceUrl(item),
  };
}

function hasEvidenceChanged(existing: EvidenceItem, incoming: EvidenceItem): boolean {
  return existing.type !== incoming.type
    || existing.description !== incoming.description
    || existing.source !== incoming.source
    || existing.provenance !== incoming.provenance
    || existing.dateReceived !== incoming.dateReceived
    || existing.status !== incoming.status
    || existing.url !== incoming.url;
}

export class ClaimsService {
  async getAll(filters?: {
    stage?: string;
    priority?: string;
    decisionType?: string;
    confidenceLevel?: string;
    adjusterId?: string;
    claimantPersonaId?: string;
  }): Promise<Claim[]> {
    let claims = await repo.findAll();
    claims = await Promise.all(claims.map((claim) => ensureAssignedAdjuster(claim)));
    claims = await Promise.all(claims.map((claim) => this.syncClaimEvidenceFromSession(claim)));

    if (filters) {
      if (filters.stage) claims = claims.filter((c) => c.claimStage === filters.stage);
      if (filters.priority) claims = claims.filter((c) => c.priority === filters.priority);
      if (filters.decisionType) claims = claims.filter((c) => c.pendingDecisionType === filters.decisionType);
      if (filters.confidenceLevel) claims = claims.filter((c) => c.confidenceLevel === filters.confidenceLevel);
      if (filters.adjusterId) claims = claims.filter((c) => c.assignedAdjusterId === filters.adjusterId);
      if (filters.claimantPersonaId) claims = claims.filter((c) => c.claimantPersonaId === filters.claimantPersonaId);
    }

    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const sorted = claims.sort((a, b) => (priorityOrder[a.priority] ?? 999) - (priorityOrder[b.priority] ?? 999));
    return this.enrichAppointedRepresentatives(sorted);
  }

  /**
   * Enrich claims with their branded tier + Appointed Representative at read time.
   * For a known customer persona, the persona's tier is authoritative (so a tier
   * change propagates to existing claims); top-tier clients also get a firm.
   * Not persisted — purely a presentation enrichment.
   */
  private async enrichAppointedRepresentatives(claims: Claim[]): Promise<Claim[]> {
    if (claims.length === 0) return claims;
    const personas = await getCustomerPersonas(false).catch(() => []);
    const byId = new Map(personas.map((p) => [p.id, p]));
    const byName = new Map(personas.map((p) => [p.displayName.trim().toLowerCase(), p]));
    return claims.map((claim) => {
      const persona = (claim.claimantPersonaId ? byId.get(claim.claimantPersonaId) : undefined)
        ?? byName.get(claim.claimantName.trim().toLowerCase());
      const tier = persona?.serviceTier ?? claim.clientServiceTier;
      const representative = deriveAppointedRepresentative({
        tier,
        explicit: persona?.appointedRepresentative,
        seedKey: claim.claimantPersonaId ?? claim.claimantName,
      });
      if (!persona && !representative) return claim;
      return {
        ...claim,
        clientServiceTier: tier ?? claim.clientServiceTier,
        appointedRepresentative: representative ?? claim.appointedRepresentative,
      };
    });
  }

  async getById(id: string): Promise<Claim | null> {
    const claim = await repo.findById(id);
    if (!claim) return null;
    const assignedClaim = await ensureAssignedAdjuster(claim);
    // Enrich with the adjuster's real authority limit so governance displays correctly.
    assignedClaim.adjusterAuthorityLimit = getBuiltinAdjusterLimit(assignedClaim.assignedAdjusterId);
    const synced = await this.syncClaimEvidenceFromSession(assignedClaim);
    const [enriched] = await this.enrichAppointedRepresentatives([synced]);
    return enriched;
  }

  async create(submission: FNOLSubmission): Promise<Claim> {
    const now = new Date().toISOString();
    const claimId = this.generateId();
    const assignment = await assignAdjusterDecision(submission);
    const assignedAdjuster = assignment.adjuster;
    const policy = submission.policyRef ? await getPolicyByRef(submission.policyRef) : undefined;
    const resolvedPolicyRef = policy?.policyRef ?? submission.policyRef ?? `POL-AUTO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    const resolvedPolicyNumber = policy?.policyRef ?? resolvedPolicyRef;
    const resolvedCoverageType = policy?.coverageType ?? `${submission.incidentType} Insurance`;
    const resolvedClauses = policy
      ? [
          `${policy.coverageType} coverage currently active`,
          policy.excessAmount ? `Deductible applies at ${policy.excessAmount}` : null,
          policy.notes ?? null,
        ].filter((value): value is string => Boolean(value))
      : ['Coverage verification pending policy review'];

    const newClaim: Claim = {
      ...submission,
      id: claimId,
      intakeChannel: 'Web Portal',
      policyRef: resolvedPolicyRef,
      policyContext: {
        policyNumber: resolvedPolicyNumber,
        coverageType: resolvedCoverageType,
        relevantClauses: resolvedClauses,
        coverageApplicability: 'covered',
        ambiguityIndicators: [],
      },
      claimStage: 'intake',
      pendingDecisionType: 'Coverage Verification',
      blockerReason: 'New claim requires initial coverage verification',
      confidenceLevel: 'high',
      complexity: 'medium',
      lastAgentAction: 'Claim created from FNOL intake',
      timeInQueue: '0 minutes',
      priority: submission.injuryIndicated ? 'urgent' : 'normal',
      owner: assignedAdjuster.name.toUpperCase(),
      workingOn: 'FNOL Intake Agent',
      claimantPersonaId: submission.claimantPersonaId,
      assignedAdjusterId: assignedAdjuster.id,
      assignedAdjusterName: assignedAdjuster.name,
      assignmentReason: assignment.reason,
      assignmentConfidence: assignment.confidence,
      assignmentSignals: assignment.signals,
      clientServiceTier: assignment.serviceTier,
      handlingMode: assignment.handlingMode,
      narrativeSynthesis: [
        { timestamp: now, description: `Claim initiated via ${submission.preferredContactChannel}`, status: 'Confirmed', source: 'FNOL Intake' },
        { timestamp: now, description: submission.incidentDescription, status: 'Pending', source: 'Claimant Statement' },
      ],
      anomalySignals: [],
      evidenceItems: [],
      recommendedAction: {
        actionType: 'Initiate Coverage Review',
        description: 'Begin coverage verification and evidence gathering process',
        confidence: 'high',
        rationale: `New claim routed to ${assignedAdjuster.name} based on ${assignment.reason.toLowerCase()} Handling mode: ${handlingModeLabel(assignment.handlingMode)}.`,
        estimatedImpact: 'Standard processing timeline',
        agentId: 'agent_intake_001',
        agentName: 'Intake Processing DW',
        claimantMessage: handlingModeClaimantMessage(assignment.handlingMode, assignedAdjuster.name, claimId),
        financialImpact: estimateInitialExposure(submission),
      },
      auditTrail: [{ timestamp: now, userId: 'system', action: 'Claim Created', outcome: 'FNOL intake completed successfully' }],
      createdAt: now,
      updatedAt: now,
    };

    return repo.upsert(newClaim);
  }

  async syncClaimEvidenceFromSession(claim: Claim, session?: FNOLSession | null): Promise<Claim> {
    const linkedSession = session ?? await getSessionByClaimId(claim.id);
    if (!linkedSession?.evidenceItems?.length) return claim;

    const existingEvidence = claim.evidenceItems ?? [];
    const sessionEvidence = linkedSession.evidenceItems.map(mapSessionEvidenceToClaimEvidence);
    const existingById = new Map(existingEvidence.map((item) => [item.id, item]));

    let changed = false;
    for (const item of sessionEvidence) {
      const current = existingById.get(item.id);
      if (!current) {
        existingById.set(item.id, item);
        changed = true;
        continue;
      }
      if (hasEvidenceChanged(current, item)) {
        existingById.set(item.id, { ...current, ...item });
        changed = true;
      }
    }

    if (!changed) return claim;

    const updatedClaim: Claim = {
      ...claim,
      evidenceItems: Array.from(existingById.values()),
      updatedAt: new Date().toISOString(),
    };

    await repo.upsert(updatedClaim);
    return updatedClaim;
  }

  async updateDecision(id: string, outcome: DecisionOutcome): Promise<Claim | null> {
    const claim = await repo.findById(id);
    if (!claim) return null;

    const now = new Date().toISOString();

    // ── Governance enforcement ──────────────────────────────────────────────
    // Run the authority/threshold checks on the server (authoritative), not just
    // in the UI. The verdict gates approvals and is persisted for the audit trail.
    const approver =
      outcome.approverId || outcome.approverName || outcome.approverRole
        ? { id: outcome.approverId, name: outcome.approverName, role: outcome.approverRole }
        : undefined;
    const verdict = evaluateDecision(claim, outcome.decision, {
      settlementAmount: outcome.settlementAmount,
      approver,
      authorityLimit: getBuiltinAdjusterLimit(claim.assignedAdjusterId),
    });

    // ── Tamper-evident write-back (FR-6 / C-13) ─────────────────────────────
    // Chain each governance record to the previous one with a SHA-256 hash so any
    // retroactive edit to the decision history is detectable.
    const previousHash = claim.governanceDecision?.recordHash ?? null;
    const chainPayload = JSON.stringify({
      claimId: claim.id,
      status: verdict.status,
      decision: verdict.decision,
      canonicalCategory: verdict.canonicalCategory,
      settlementAmount: verdict.settlementAmount,
      authorityLimit: verdict.authorityLimit,
      confidenceLevel: verdict.confidenceLevel,
      approver: verdict.approver ?? null,
      reasons: verdict.reasons,
      evaluatedAt: verdict.evaluatedAt,
      previousHash,
    });
    verdict.previousHash = previousHash;
    verdict.recordHash = createHash('sha256').update(chainPayload).digest('hex');
    claim.governanceDecision = verdict;

    const verdictLabel =
      verdict.status === 'blocked'
        ? 'BLOCKED'
        : verdict.status === 'requires_senior_approval'
        ? 'SENIOR APPROVAL'
        : 'WITHIN AUTHORITY';
    const approverSuffix = approver?.name ? ` — approved by ${approver.name}` : '';

    claim.auditTrail.push({
      timestamp: outcome.timestamp || now,
      userId: approver?.name || outcome.userId,
      action: `Decision: ${outcome.decision} [${verdictLabel}]`,
      rationale: outcome.rationale,
      outcome: `${outcome.nextAction || `Claim ${outcome.decision}`}${approverSuffix}`,
    });

    if (outcome.decision === 'approved' && verdict.blocked) {
      // Hard stop — an approval was attempted but governance blocks it.
      claim.lastAgentAction = `Decision blocked by governance: ${verdict.reasons[0] ?? 'authority exceeded'}`;
      claim.blockerReason = verdict.reasons[0] ?? 'Decision blocked by governance controls.';
      claim.priority = 'urgent';
    } else if (outcome.decision === 'approved' && verdict.requiresApproval && !approver?.name?.trim()) {
      // Senior sign-off is required but no approver was captured — refuse to
      // advance. The backend is authoritative even if the client mis-renders.
      claim.lastAgentAction = 'Approval withheld: senior sign-off required but no approver recorded.';
      claim.blockerReason = 'Senior approver must be recorded before this decision can proceed.';
      claim.priority = 'urgent';
    } else if (outcome.decision === 'approved') {
      claim.lastAgentAction = verdict.requiresApproval
        ? `Decision approved with senior sign-off${approverSuffix}: ${outcome.rationale}`
        : `Decision approved: ${outcome.rationale}`;
      if (claim.claimStage === 'intake') claim.claimStage = 'investigation';
      else if (claim.claimStage === 'investigation') claim.claimStage = 'evaluation';
      else if (claim.claimStage === 'evaluation') claim.claimStage = 'settlement';
    } else if (outcome.decision === 'more_info_needed') {
      claim.lastAgentAction = `Additional information requested: ${outcome.rationale}`;
      claim.blockerReason = outcome.rationale;
    } else if (outcome.decision === 'escalated') {
      // Visibly route the claim so the reassign story isn't cosmetic.
      claim.lastAgentAction = `Escalated for reassignment: ${outcome.rationale}`;
      claim.blockerReason = outcome.rationale;
      claim.workingOn = 'Senior Review';
      claim.priority = 'urgent';
    }

    claim.updatedAt = now;
    const saved = await repo.upsert(claim);

    // ── Telemetry ───────────────────────────────────────────────────────────
    // Surface the governed decision in the interaction/telemetry store so the
    // audit and dashboards reflect settlement actions (fire-and-forget).
    try {
      recordInteraction({
        agentId: claim.recommendedAction?.agentId || 'decision-agent',
        sessionId: `decision-${claim.id}`,
        claimId: claim.id,
        callerId: approver?.id || outcome.userId,
        callerType: 'adjuster',
        interactionType: 'settlement_decision',
        userContent: `Decision: ${outcome.decision} — ${outcome.rationale}`,
        assistantContent: `${verdictLabel}: ${verdict.reasons.join('; ') || 'within delegated authority'}`,
        confidence:
          claim.confidenceLevel === 'high' ? 0.9 : claim.confidenceLevel === 'medium' ? 0.7 : 0.4,
        escalated: verdict.requiresApproval || verdict.blocked,
        escalationReason: verdict.requiresApproval || verdict.blocked ? verdict.reasons[0] : undefined,
        riskScore: verdict.criteria.filter((c) => !c.passed).length,
        status: verdict.blocked ? 'error' : verdict.requiresApproval ? 'escalated' : 'success',
        policyEvaluations: verdict.criteria.map((c) => ({
          policyId: c.id,
          outcome: c.passed ? 'passed' : verdict.blocked ? 'blocked' : 'failed',
          severity: c.passed ? 'low' : verdict.blocked ? 'critical' : 'high',
        })),
        policyViolations: verdict.criteria.filter((c) => !c.passed).length,
        meta: {
          decision: outcome.decision,
          verdict: verdict.status,
          settlementAmount: verdict.settlementAmount,
          authorityLimit: verdict.authorityLimit,
          approver: approver?.name,
          pendingDecisionType: claim.pendingDecisionType,
        },
      });
    } catch {
      /* telemetry is best-effort */
    }

    return saved;
  }

  /**
   * "Clear the greens" batch approve. Each claim ID is run through the exact
   * same governed `updateDecision` path as a single-claim approval — its own
   * governance record, its own hash-chained audit entry. There is no bypass:
   * a claim that comes back blocked (e.g. it turns out to need senior
   * sign-off or was already actioned) is a valid, expected result, not an
   * error, and is reported back to the caller as such.
   */
  async batchApprove(
    claimIds: string[],
    actor: { userId: string; rationale?: string },
  ): Promise<Array<{ claimId: string; outcome: 'approved' | 'blocked' | 'not_found'; reason?: string }>> {
    const results: Array<{ claimId: string; outcome: 'approved' | 'blocked' | 'not_found'; reason?: string }> = [];

    for (const claimId of claimIds) {
      const before = await repo.findById(claimId);
      if (!before) {
        results.push({ claimId, outcome: 'not_found' });
        continue;
      }

      const updated = await this.updateDecision(claimId, {
        claimId,
        decision: 'approved',
        rationale:
          actor.rationale?.trim() ||
          'Batch approved — high confidence, no blockers, within delegated authority.',
        userId: actor.userId,
        timestamp: new Date().toISOString(),
        nextAction: 'Settlement authorized',
      });

      if (!updated) {
        results.push({ claimId, outcome: 'not_found' });
        continue;
      }

      const blocked = updated.governanceDecision?.status === 'blocked' || !!updated.blockerReason;
      results.push({
        claimId,
        outcome: blocked ? 'blocked' : 'approved',
        reason: blocked ? updated.governanceDecision?.reasons?.[0] ?? updated.blockerReason : undefined,
      });
    }

    return results;
  }

  async getEvidence(id: string): Promise<EvidenceItem[]> {
    const claim = await this.getById(id);
    return claim?.evidenceItems || [];
  }

  async update(id: string, updates: Partial<Claim>): Promise<Claim | null> {
    const existing = await repo.findById(id);
    if (!existing) return null;
    return repo.upsert({ ...existing, ...updates, id, updatedAt: new Date().toISOString() });
  }

  async delete(id: string): Promise<boolean> {
    return repo.delete(id);
  }

  async reload(): Promise<void> {}

  private generateId(): string {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 10000).toString().padStart(3, '0');
    return `CLM-${year}-${sequence}`;
  }
}
