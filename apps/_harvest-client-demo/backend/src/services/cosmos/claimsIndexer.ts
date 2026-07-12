import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ClaimChunk,
  ClaimSection,
  ClaimChunkMetadata,
  IndexingJobRequest,
  IndexingJobStatus,
} from '../../types/steward';
import { CosmosServiceInterface } from './cosmosService';

interface RawClaimDocument {
  id: string;
  policyNumber: string;
  claimType: string;
  status: string;
  dateOfLoss: string;
  description: string;
  claimant: {
    name: string;
    contact?: string;
  };
  policyDetails?: {
    coverageTypes: string[];
    deductible: number;
    coverageLimit: number;
    effectiveDate: string;
    expirationDate: string;
  };
  investigationNotes?: string[];
  evidence?: string[];
  settlement?: {
    amount?: number;
    status: string;
    date?: string;
    notes?: string;
  };
  timeline?: Array<{ date: string; event: string }>;
  parties?: string[];
  jurisdiction?: string;
  priority?: string;
  amount?: number;
}

/** Shape of a live claim document as stored in the production `claims` Cosmos container. */
interface LiveClaimDocument {
  id: string;
  claimantName: string;
  incidentType: string;
  incidentDate?: string;
  incidentLocation?: string;
  incidentDescription?: string;
  partiesInvolved?: Array<{ name: string; role: string }>;
  policyRef?: string;
  policyContext?: {
    policyNumber?: string;
    coverageType?: string;
    relevantClauses?: string[];
    coverageApplicability?: string;
    ambiguityIndicators?: string[];
  };
  claimStage?: string;
  pendingDecisionType?: string;
  blockerReason?: string;
  confidenceLevel?: string;
  priority?: string;
  narrativeSynthesis?: Array<{ timestamp: string; description: string; status?: string; source?: string }>;
  anomalySignals?: Array<{ id: string; type: string; description: string; severity?: string; explanation?: string }>;
  evidenceItems?: Array<{ id: string; type: string; description: string; status?: string }>;
  recommendedAction?: {
    actionType?: string;
    description?: string;
    rationale?: string;
    financialImpact?: { estimatedAmount?: number; currency?: string };
  };
  auditTrail?: Array<{ timestamp: string; action: string; outcome?: string }>;
}


/**
 * Handles chunking and indexing of claims data into Cosmos DB.
 * Splits claims into meaningful sections for optimal RAG retrieval.
 */
export class ClaimsIndexer {
  private cosmosService: CosmosServiceInterface;
  private embeddingModel: string;
  private chunkVersion: string;

  constructor(cosmosService: CosmosServiceInterface) {
    this.cosmosService = cosmosService;
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'mock';
    this.chunkVersion = '1.0';
  }

  /**
   * Index claims from a JSON file or source.
   * Uses deterministic IDs for idempotent upserts.
   */
  async indexClaims(request: IndexingJobRequest): Promise<IndexingJobStatus> {
    const jobId = `idx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const status: IndexingJobStatus = {
      jobId,
      status: 'processing',
      totalDocuments: 0,
      processedDocuments: 0,
      failedDocuments: 0,
      startedAt: new Date().toISOString(),
    };

    try {
      if (request.sourceType === 'cosmos') {
        const liveClaims = await this.cosmosService.getAllLiveClaims();
        status.totalDocuments = liveClaims.length;

        for (const claim of liveClaims as LiveClaimDocument[]) {
          try {
            const chunks = this.chunkLiveClaim(claim, request.tenantId);
            await this.cosmosService.upsertClaimChunks(chunks);
            status.processedDocuments++;
          } catch (error) {
            status.failedDocuments++;
            console.error(`Failed to index live claim ${claim.id}:`, error);
          }
        }
      } else {
        const claims = this.loadClaims(request);
        status.totalDocuments = claims.length;

        for (const claim of claims) {
          try {
            const chunks = this.chunkClaim(claim, request.tenantId);
            await this.cosmosService.upsertClaimChunks(chunks);
            status.processedDocuments++;
          } catch (error) {
            status.failedDocuments++;
            console.error(`Failed to index claim ${claim.id}:`, error);
          }
        }
      }

      status.status = 'completed';
      status.completedAt = new Date().toISOString();
    } catch (error: any) {
      status.status = 'failed';
      status.error = error.message;
      status.completedAt = new Date().toISOString();
    }

    // Store status via the service interface (getIndexingStatus uses Cosmos)
    try {
      await (this.cosmosService as any).indexingRepo?.upsert?.(status);
    } catch {
      // indexing status persistence is best-effort
    }

    return status;
  }

  private loadClaims(request: IndexingJobRequest): RawClaimDocument[] {
    if (request.sourceType === 'json') {
      const filePath = request.sourcePath || join(__dirname, '../../../data/claims-data.json');
      if (!existsSync(filePath)) {
        throw new Error(`Claims data file not found: ${filePath}`);
      }
      const raw = readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }

    throw new Error(`Unsupported source type: ${request.sourceType}`);
  }

  /**
   * Split a claim into semantically meaningful chunks.
   * Each chunk gets a deterministic ID for idempotent upserts.
   */
  private chunkClaim(claim: RawClaimDocument, tenantId: string): ClaimChunk[] {
    const chunks: ClaimChunk[] = [];
    const baseMetadata: ClaimChunkMetadata = {
      claimType: claim.claimType,
      status: claim.status,
      dateOfLoss: claim.dateOfLoss,
      jurisdiction: claim.jurisdiction,
      parties: claim.parties,
      coverageTypes: claim.policyDetails?.coverageTypes,
      claimAmount: claim.amount,
      priority: claim.priority,
    };

    // Summary chunk (always created)
    chunks.push(this.createChunk(
      claim.id,
      claim.policyNumber,
      tenantId,
      'summary',
      this.buildSummaryContent(claim),
      baseMetadata
    ));

    // Policy details chunk
    if (claim.policyDetails) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyNumber,
        tenantId,
        'policy_details',
        this.buildPolicyContent(claim),
        baseMetadata
      ));
    }

    // Investigation notes chunk
    if (claim.investigationNotes && claim.investigationNotes.length > 0) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyNumber,
        tenantId,
        'investigation_notes',
        this.buildInvestigationContent(claim),
        baseMetadata
      ));
    }

    // Settlement chunk
    if (claim.settlement) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyNumber,
        tenantId,
        'settlement_info',
        this.buildSettlementContent(claim),
        baseMetadata
      ));
    }

    // Evidence chunk
    if (claim.evidence && claim.evidence.length > 0) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyNumber,
        tenantId,
        'evidence',
        `Evidence items for claim ${claim.id}: ${claim.evidence.join('; ')}`,
        baseMetadata
      ));
    }

    // Timeline chunk
    if (claim.timeline && claim.timeline.length > 0) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyNumber,
        tenantId,
        'timeline',
        this.buildTimelineContent(claim),
        baseMetadata
      ));
    }

    return chunks;
  }

  private createChunk(
    claimId: string,
    policyId: string,
    tenantId: string,
    section: ClaimSection,
    content: string,
    metadata: ClaimChunkMetadata
  ): ClaimChunk {
    // Deterministic ID for idempotent upserts
    const id = `${tenantId}:${claimId}:${section}:${this.chunkVersion}`;

    return {
      id,
      claimId,
      policyId,
      tenantId,
      section,
      content,
      metadata,
      chunkVersion: this.chunkVersion,
      embeddingModel: this.embeddingModel,
      createdAt: new Date().toISOString(),
    };
  }

  private buildSummaryContent(claim: RawClaimDocument): string {
    return [
      `Claim ${claim.id} - ${claim.claimType} claim`,
      `Status: ${claim.status}`,
      `Policy: ${claim.policyNumber}`,
      `Date of Loss: ${claim.dateOfLoss}`,
      `Claimant: ${claim.claimant.name}`,
      `Description: ${claim.description}`,
      claim.amount ? `Claimed Amount: $${claim.amount.toLocaleString()}` : '',
      claim.priority ? `Priority: ${claim.priority}` : '',
    ].filter(Boolean).join('\n');
  }

  private buildPolicyContent(claim: RawClaimDocument): string {
    const pd = claim.policyDetails!;
    return [
      `Policy Details for claim ${claim.id}`,
      `Policy Number: ${claim.policyNumber}`,
      `Coverage Types: ${pd.coverageTypes.join(', ')}`,
      `Deductible: $${pd.deductible.toLocaleString()}`,
      `Coverage Limit: $${pd.coverageLimit.toLocaleString()}`,
      `Effective: ${pd.effectiveDate} to ${pd.expirationDate}`,
    ].join('\n');
  }

  private buildInvestigationContent(claim: RawClaimDocument): string {
    return [
      `Investigation Notes for claim ${claim.id}:`,
      ...claim.investigationNotes!.map((note, i) => `${i + 1}. ${note}`),
    ].join('\n');
  }

  private buildSettlementContent(claim: RawClaimDocument): string {
    const s = claim.settlement!;
    return [
      `Settlement Information for claim ${claim.id}`,
      `Status: ${s.status}`,
      s.amount ? `Amount: $${s.amount.toLocaleString()}` : '',
      s.date ? `Date: ${s.date}` : '',
      s.notes ? `Notes: ${s.notes}` : '',
    ].filter(Boolean).join('\n');
  }

  private buildTimelineContent(claim: RawClaimDocument): string {
    return [
      `Timeline for claim ${claim.id}:`,
      ...claim.timeline!.map(t => `- ${t.date}: ${t.event}`),
    ].join('\n');
  }

  // ── Live claim (production `claims` container) chunking ──────────────────

  /**
   * Split a live production claim into semantically meaningful chunks for RAG.
   * Mirrors chunkClaim() above but matches the actual schema used by the
   * adjuster-facing claims queue (claimantName, claimStage, narrativeSynthesis,
   * anomalySignals, auditTrail, etc.) rather than the demo/seed JSON schema.
   */
  private chunkLiveClaim(claim: LiveClaimDocument, tenantId: string): ClaimChunk[] {
    const chunks: ClaimChunk[] = [];
    const baseMetadata: ClaimChunkMetadata = {
      claimType: claim.incidentType,
      status: claim.claimStage ?? '',
      dateOfLoss: claim.incidentDate ?? '',
      priority: claim.priority,
      parties: claim.partiesInvolved?.map(p => `${p.name} (${p.role})`),
      coverageTypes: claim.policyContext?.coverageType ? [claim.policyContext.coverageType] : undefined,
    };

    // Summary chunk (always created)
    chunks.push(this.createChunk(
      claim.id,
      claim.policyRef ?? claim.policyContext?.policyNumber ?? '',
      tenantId,
      'summary',
      this.buildLiveSummaryContent(claim),
      baseMetadata
    ));

    // Policy details chunk
    if (claim.policyContext) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyRef ?? claim.policyContext.policyNumber ?? '',
        tenantId,
        'policy_details',
        this.buildLivePolicyContent(claim),
        baseMetadata
      ));
    }

    // Investigation notes: narrative synthesis + anomaly signals (fraud/SIU findings)
    if ((claim.narrativeSynthesis && claim.narrativeSynthesis.length > 0) ||
        (claim.anomalySignals && claim.anomalySignals.length > 0)) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyRef ?? '',
        tenantId,
        'investigation_notes',
        this.buildLiveInvestigationContent(claim),
        baseMetadata
      ));
    }

    // Settlement / recommended-action chunk
    if (claim.recommendedAction) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyRef ?? '',
        tenantId,
        'settlement_info',
        this.buildLiveSettlementContent(claim),
        baseMetadata
      ));
    }

    // Evidence chunk
    if (claim.evidenceItems && claim.evidenceItems.length > 0) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyRef ?? '',
        tenantId,
        'evidence',
        `Evidence items for claim ${claim.id}: ` +
          claim.evidenceItems.map(e => `${e.type} (${e.status ?? 'unknown'}) — ${e.description}`).join('; '),
        baseMetadata
      ));
    }

    // Timeline chunk (audit trail — who did what, when)
    if (claim.auditTrail && claim.auditTrail.length > 0) {
      chunks.push(this.createChunk(
        claim.id,
        claim.policyRef ?? '',
        tenantId,
        'timeline',
        this.buildLiveTimelineContent(claim),
        baseMetadata
      ));
    }

    return chunks;
  }

  private buildLiveSummaryContent(claim: LiveClaimDocument): string {
    return [
      `Claim ${claim.id} - ${claim.incidentType} claim`,
      `Claimant: ${claim.claimantName}`,
      `Stage: ${claim.claimStage ?? 'unknown'}`,
      `Priority: ${claim.priority ?? 'unknown'}`,
      claim.pendingDecisionType ? `Pending Decision: ${claim.pendingDecisionType}` : '',
      claim.blockerReason ? `Blocker: ${claim.blockerReason}` : '',
      claim.confidenceLevel ? `Confidence: ${claim.confidenceLevel}` : '',
      claim.incidentLocation ? `Location: ${claim.incidentLocation}` : '',
      claim.incidentDate ? `Date of Loss: ${claim.incidentDate}` : '',
      claim.incidentDescription ? `Description: ${claim.incidentDescription}` : '',
    ].filter(Boolean).join('\n');
  }

  private buildLivePolicyContent(claim: LiveClaimDocument): string {
    const pc = claim.policyContext!;
    return [
      `Policy Details for claim ${claim.id}`,
      pc.policyNumber ? `Policy Number: ${pc.policyNumber}` : '',
      pc.coverageType ? `Coverage Type: ${pc.coverageType}` : '',
      pc.relevantClauses?.length ? `Relevant Clauses: ${pc.relevantClauses.join(', ')}` : '',
      pc.coverageApplicability ? `Coverage Applicability: ${pc.coverageApplicability}` : '',
      pc.ambiguityIndicators?.length ? `Ambiguity Indicators: ${pc.ambiguityIndicators.join(', ')}` : '',
    ].filter(Boolean).join('\n');
  }

  private buildLiveInvestigationContent(claim: LiveClaimDocument): string {
    const lines: string[] = [`Investigation Notes for claim ${claim.id}:`];
    (claim.narrativeSynthesis ?? []).forEach((n, i) => {
      lines.push(`${i + 1}. [${n.status ?? 'noted'}${n.source ? ` — ${n.source}` : ''}] ${n.description}`);
    });
    if (claim.anomalySignals?.length) {
      lines.push('Anomaly / fraud signals:');
      claim.anomalySignals.forEach(a => {
        lines.push(`- ${a.type} (${a.severity ?? 'unknown'} severity): ${a.description}${a.explanation ? ` — ${a.explanation}` : ''}`);
      });
    }
    return lines.join('\n');
  }

  private buildLiveSettlementContent(claim: LiveClaimDocument): string {
    const ra = claim.recommendedAction!;
    return [
      `Settlement / Recommended Action for claim ${claim.id}`,
      ra.actionType ? `Action: ${ra.actionType}` : '',
      ra.description ? `Description: ${ra.description}` : '',
      ra.rationale ? `Rationale: ${ra.rationale}` : '',
      ra.financialImpact?.estimatedAmount !== undefined
        ? `Estimated Amount: ${ra.financialImpact.currency ?? 'USD'} ${ra.financialImpact.estimatedAmount.toLocaleString()}`
        : '',
    ].filter(Boolean).join('\n');
  }

  private buildLiveTimelineContent(claim: LiveClaimDocument): string {
    return [
      `Timeline for claim ${claim.id}:`,
      ...claim.auditTrail!.map(a => `- ${a.timestamp}: ${a.action}${a.outcome ? ` (${a.outcome})` : ''}`),
    ].join('\n');
  }
}

