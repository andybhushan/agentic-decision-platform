import { Router } from 'express';
import { ClaimsService } from '../services/claimsService';
import { reviewClaimEvidence } from '../services/evidenceReviewService';
import { getAllPolicies } from '../services/policyService';
import { getCustomerPersonas } from '../services/customerPersonaService';
import { reseedClaimDemoData } from '../services/claimsDemoSeeder';
import { deriveAppointedRepresentative } from '../services/policyTier';

const router = Router();
const claimsService = new ClaimsService();

// GET /api/v1/claims/master - Cross-portfolio claims with policy-holder context
router.get('/master', async (req, res, next) => {
  try {
    const filters = {
      stage: req.query.stage as string | undefined,
      adjusterId: req.query.adjusterId as string | undefined,
      claimantPersonaId: req.query.claimantPersonaId as string | undefined,
      clientTier: req.query.clientTier as string | undefined,
      handlingMode: req.query.handlingMode as string | undefined,
      search: (req.query.search as string | undefined)?.trim(),
      seededOnly: req.query.seededOnly === 'true',
    };
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, Number.parseInt(String(req.query.pageSize ?? '50'), 10) || 50));

    const [claims, policies, personas] = await Promise.all([
      claimsService.getAll({
        stage: filters.stage,
        adjusterId: filters.adjusterId,
        claimantPersonaId: filters.claimantPersonaId,
      }),
      getAllPolicies(),
      getCustomerPersonas(false),
    ]);

    const policyByRef = new Map(policies.map((policy) => [policy.policyRef, policy]));
    const personaById = new Map(personas.map((persona) => [persona.id, persona]));
    const personaByName = new Map(personas.map((persona) => [persona.displayName.trim().toLowerCase(), persona]));

    const records = claims
      .map((claim) => {
        const policy = policyByRef.get(claim.policyRef);
        const persona = (claim.claimantPersonaId ? personaById.get(claim.claimantPersonaId) : undefined)
          ?? personaByName.get(claim.claimantName.trim().toLowerCase())
          ?? null;
        const governanceFlags = [
          ...(claim.assignmentSignals ?? []).filter((signal) => signal.toLowerCase().includes('policy')),
          ...((claim.auditTrail ?? [])
            .filter((entry) => entry.action.toLowerCase().includes('policy'))
            .map((entry) => entry.action)),
        ];
        const seeded = claim.policyRef.startsWith('POL-AUTO-SEEDED-')
          || (claim.assignmentReason?.toLowerCase().includes('seeded') ?? false);

        const clientTier = persona?.serviceTier ?? claim.clientServiceTier ?? null;
        const appointedRepresentative = deriveAppointedRepresentative({
          tier: clientTier,
          explicit: persona?.appointedRepresentative,
          seedKey: claim.claimantPersonaId ?? persona?.id ?? claim.claimantName,
        }) ?? null;

        return {
          claimId: claim.id,
          claimStage: claim.claimStage,
          priority: claim.priority,
          pendingDecisionType: claim.pendingDecisionType,
          claimantName: claim.claimantName,
          claimantPersonaId: claim.claimantPersonaId ?? persona?.id ?? null,
          clientTier,
          appointedRepresentative,
          handlingMode: claim.handlingMode ?? null,
          assignedAdjusterId: claim.assignedAdjusterId ?? null,
          assignedAdjusterName: claim.assignedAdjusterName ?? null,
          owner: claim.owner ?? null,
          policyRef: claim.policyRef,
          policyType: policy?.policyType ?? null,
          coverageType: policy?.coverageType ?? claim.policyContext.coverageType,
          coverageActive: policy?.coverageActive ?? null,
          holderName: policy?.holderName ?? claim.claimantName,
          holderEmail: policy?.holderEmail ?? persona?.email ?? null,
          holderPhone: policy?.holderPhone ?? persona?.phone ?? null,
          seeded,
          governanceFlags,
          updatedAt: claim.updatedAt,
          createdAt: claim.createdAt,
        };
      })
      .filter((record) => {
        if (filters.clientTier && record.clientTier !== filters.clientTier) return false;
        if (filters.handlingMode && record.handlingMode !== filters.handlingMode) return false;
        if (filters.seededOnly && !record.seeded) return false;
        if (filters.search) {
          const haystack = [
            record.claimId,
            record.claimantName,
            record.holderName,
            record.policyRef,
            record.assignedAdjusterName ?? '',
          ].join(' ').toLowerCase();
          if (!haystack.includes(filters.search.toLowerCase())) return false;
        }
        return true;
      });

    const start = (page - 1) * pageSize;
    const paged = records.slice(start, start + pageSize);

    res.json({
      success: true,
      data: paged,
      meta: {
        count: paged.length,
        total: records.length,
        page,
        pageSize,
        filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== false && value !== '')),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/claims/reseed - Wipe (preserve Richard) and rebuild curated production claims + telemetry
router.post('/reseed', async (req, res, next) => {
  try {
    const useRealAgents = req.query.useRealAgents === 'true' || req.body?.useRealAgents === true;
    const result = await reseedClaimDemoData({ useRealAgents });
    res.json({
      success: true,
      data: result,
      meta: { useRealAgents, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/claims - Get all claims with optional filters
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      stage: req.query.stage as string | undefined,
      priority: req.query.priority as string | undefined,
      decisionType: req.query.decisionType as string | undefined,
      confidenceLevel: req.query.confidenceLevel as string | undefined,
      adjusterId: req.query.adjusterId as string | undefined,
      claimantPersonaId: req.query.claimantPersonaId as string | undefined,
    };

    const claims = await claimsService.getAll(filters);
    res.json({
      success: true,
      data: claims,
      meta: {
        count: claims.length,
        filters: Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== undefined)
        ),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/claims/:id - Get claim by ID
router.get('/:id', async (req, res, next) => {
  try {
    const claim = await claimsService.getById(req.params.id);
    if (!claim) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Claim with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: claim,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/claims - Create new claim from FNOL
router.post('/', async (req, res, next) => {
  try {
    const claim = await claimsService.create(req.body);
    res.status(201).json({
      success: true,
      data: claim,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/claims/:id - Update claim fields (general patch)
router.put('/:id', async (req, res, next) => {
  try {
    const claim = await claimsService.update(req.params.id, req.body);
    if (!claim) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Claim with id '${req.params.id}' not found` } });
    }
    res.json({ success: true, data: claim, meta: { timestamp: new Date().toISOString() } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/claims/:id - Delete claim
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await claimsService.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Claim with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: { id: req.params.id, deleted: true },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/claims/:id/decision - Submit decision outcome
router.put('/:id/decision', async (req, res, next) => {
  try {
    const claim = await claimsService.updateDecision(req.params.id, req.body);
    if (!claim) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Claim with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: claim,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/claims/batch-decision - "Clear the greens" batch approve.
// Each claim ID is run through the same governed decision path individually
// (its own governance record + hash) — no bypass. A claim can still come
// back blocked; that is reported per-claim, not treated as a request error.
router.post('/batch-decision', async (req, res, next) => {
  try {
    const claimIds: string[] = Array.isArray(req.body?.claimIds) ? req.body.claimIds : [];
    if (claimIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'claimIds must be a non-empty array' },
      });
    }
    const userId = (req.body?.userId as string | undefined) || 'batch-approve';
    const rationale = req.body?.rationale as string | undefined;

    const results = await claimsService.batchApprove(claimIds, { userId, rationale });
    res.json({
      success: true,
      data: {
        results,
        approvedCount: results.filter((r) => r.outcome === 'approved').length,
        blockedCount: results.filter((r) => r.outcome === 'blocked').length,
        notFoundCount: results.filter((r) => r.outcome === 'not_found').length,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/claims/:id/evidence - Get evidence items for a claim
router.get('/:id/evidence', async (req, res, next) => {
  try {
    const evidence = await claimsService.getEvidence(req.params.id);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Claim with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: evidence,
      meta: {
        count: evidence.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/claims/:id/evidence/:evidenceId/review - Build an evidence review packet
router.get('/:id/evidence/:evidenceId/review', async (req, res, next) => {
  try {
    const claim = await claimsService.getById(req.params.id);
    if (!claim) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Claim with id '${req.params.id}' not found`,
        },
      });
    }

    const review = await reviewClaimEvidence(claim, req.params.evidenceId);
    res.json({
      success: true,
      data: review,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    if (error?.status === 404 || error?.status === 422 || error?.status === 502 || error?.status === 503) {
      return res.status(error.status).json({
        success: false,
        error: {
          code: error.status === 404 ? 'NOT_FOUND' : 'EVIDENCE_REVIEW_UNAVAILABLE',
          message: error.message,
        },
      });
    }
    next(error);
  }
});

export default router;

// Made with Bob