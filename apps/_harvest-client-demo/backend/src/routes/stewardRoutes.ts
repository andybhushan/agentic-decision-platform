import { Router } from 'express';
import { StewardService } from '../services/steward/stewardService';
import { recordInteraction } from '../services/interactionService';
import { getSopById, syncSops, getSopStatus } from '../services/steward/sopService';

const router = Router();
const stewardService = new StewardService();

// Deployment id of the published Digital Steward agent. Interactions are logged
// under this id so the agent's Observability tab (which queries by the agent's
// deploymentId) surfaces them.
const STEWARD_DEPLOYMENT_ID = process.env.STEWARD_DEPLOYMENT_ID || 'digital-steward';

// POST /api/v1/steward/briefing - Generate structured morning briefing card
router.post('/briefing', async (req, res, next) => {
  try {
    const { pageContext } = req.body;
    if (!pageContext) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'pageContext is required' },
      });
    }
    const data = await stewardService.generateBriefing(pageContext);

    // Audit: fire-and-forget — surfaces in the agent Observability tab.
    recordInteraction({
      agentId: STEWARD_DEPLOYMENT_ID,
      sessionId: `steward-briefing-${Date.now()}`,
      interactionType: 'steward_briefing',
      userContent: `Briefing for page: ${pageContext?.pageName ?? 'unknown'}`,
      assistantContent: data?.topPriority?.name ? `Top priority: ${data.topPriority.name}` : '',
      meta: { pageName: pageContext?.pageName },
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/steward/chat - Send a message to the Digital Steward
router.post('/chat', async (req, res, next) => {
  try {
    const { message, conversationId, context, pageContext } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'message is required',
        },
      });
    }

    const result = await stewardService.chat({
      message,
      conversationId,
      context,
      pageContext,
    });

    // Audit: fire-and-forget — surfaces in the agent Observability tab.
    recordInteraction({
      agentId: STEWARD_DEPLOYMENT_ID,
      sessionId: result.conversationId,
      interactionType: 'steward_chat',
      userContent: message,
      assistantContent: result.message,
      confidence: typeof result.confidence === 'number' ? result.confidence : undefined,
      meta: { claimId: context?.claimId, pageName: pageContext?.pageName },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/steward/conversations - List conversations for a user
router.get('/conversations', async (req, res, next) => {
  try {
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const userId = (req.query.userId as string) || 'default-user';

    const conversations = await stewardService.listConversations(tenantId, userId);

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/steward/conversations/:id - Get a specific conversation
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const conversation = await stewardService.getConversation(req.params.id, tenantId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        },
      });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/steward/conversations/:id - Delete a conversation
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    await stewardService.deleteConversation(req.params.id, tenantId);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/steward/admin/index - Trigger claims indexing (admin only)
router.post('/admin/index', async (req, res, next) => {
  try {
    const { tenantId, sourceType, sourcePath, forceReindex } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'tenantId is required',
        },
      });
    }

    const result = await stewardService.indexClaims({
      tenantId,
      sourceType: sourceType || 'json',
      sourcePath,
      forceReindex,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/steward/admin/index/:jobId - Get indexing job status
router.get('/admin/index/:jobId', async (req, res, next) => {
  try {
    const status = await stewardService.getIndexingStatus(req.params.jobId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Indexing job not found',
        },
      });
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

// ── SOP (governance controls) admin endpoints ───────────────────────────────

// GET /api/v1/steward/admin/sops - List all SOPs with their indexed status
router.get('/admin/sops', async (_req, res, next) => {
  try {
    const data = await getSopStatus();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/steward/admin/sops/:id - Get a single SOP (metadata + body)
router.get('/admin/sops/:id', async (req, res, next) => {
  try {
    const sop = getSopById(req.params.id);
    if (!sop) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `SOP '${req.params.id}' not found` },
      });
    }
    res.json({ success: true, data: sop });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/steward/admin/sops/sync - Detect changes + (re)index SOP controls
router.post('/admin/sops/sync', async (_req, res, next) => {
  try {
    const report = await syncSops();

    // Audit: fire-and-forget — surfaces in the agent Observability tab.
    recordInteraction({
      agentId: STEWARD_DEPLOYMENT_ID,
      sessionId: `steward-sop-sync-${Date.now()}`,
      interactionType: 'steward_sop_sync',
      userContent: 'SOP control sync requested',
      assistantContent: `added ${report.added}, changed ${report.changed}, removed ${report.removed}, unchanged ${report.unchanged}`,
      meta: { totalSops: report.totalSops, changedIds: report.items.filter((i) => i.status === 'changed' || i.status === 'added').map((i) => i.sopId) },
    });

    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

export default router;
