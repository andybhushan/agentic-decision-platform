import { Router } from 'express';
import { AIService } from '../services/aiService';
import { recordInteraction } from '../services/interactionService';

const router = Router();
const aiService = new AIService();

// POST /api/v1/ai/generate-agent - Generate new agent from description
router.post('/generate-agent', async (req, res, next) => {
  try {
    const { description, verticalId, archetype, requirements } = req.body;

    if (!description || !verticalId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'description and verticalId are required',
        },
      });
    }

    const result = await aiService.generateAgent({
      description,
      verticalId,
      archetype,
      requirements,
    });

    // Audit: fire-and-forget.
    recordInteraction({
      agentId: 'ai-generate',
      sessionId: `ai-generate-${Date.now()}`,
      interactionType: 'ai_generate',
      userContent: description,
      assistantContent: result?.agent?.name ?? '',
      meta: { verticalId, archetype },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ai/customize-agent - Customize existing agent
router.post('/customize-agent', async (req, res, next) => {
  try {
    const { agentId, customization } = req.body;

    if (!agentId || !customization) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'agentId and customization are required',
        },
      });
    }

    const result = await aiService.customizeAgent(agentId, customization);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ai/generate-prompt - Generate prompt for agent
router.post('/generate-prompt', async (req, res, next) => {
  try {
    const { agentId, input, context } = req.body;

    if (!agentId || !input) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'agentId and input are required',
        },
      });
    }

    const result = await aiService.generatePrompt({
      agentId,
      input,
      context,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ai/simulate - Simulate agent execution
router.post('/simulate', async (req, res, next) => {
  try {
    const { agentId, input, context } = req.body;

    if (!agentId || !input) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'agentId and input are required',
        },
      });
    }

    const result = await aiService.simulate({
      agentId,
      input,
      context,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ai/claim-assist - Claims decision assistant grounded in claim context
router.post('/claim-assist', async (req, res, next) => {
  try {
    const { command, claimContext } = req.body;

    if (!command || !claimContext) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'command and claimContext are required',
        },
      });
    }

    const result = await aiService.claimAssist({ command, claimContext });

    // Audit: fire-and-forget.
    recordInteraction({
      agentId: 'claim-assist',
      sessionId: `claim-assist-${Date.now()}`,
      interactionType: 'ai_review',
      userContent: command,
      assistantContent: typeof result === 'object' ? JSON.stringify(result) : String(result),
      meta: { claimContext },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ai/test-connection - Test AI provider connection
router.get('/test-connection', async (req, res, next) => {
  try {
    const result = await aiService.testConnection();

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

// Made with Bob