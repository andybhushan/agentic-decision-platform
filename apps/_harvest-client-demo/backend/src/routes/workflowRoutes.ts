import { Router } from 'express';
import { WorkflowService } from '../services/workflowService';

const router = Router();
const workflowService = new WorkflowService();

// GET /api/v1/workflows - Get all workflows with optional filters
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      verticalId: req.query.verticalId as string | undefined,
      search: req.query.search as string | undefined,
    };

    const workflows = await workflowService.getAll(filters);
    res.json({
      success: true,
      data: workflows,
      meta: {
        count: workflows.length,
        filters: Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== undefined)
        ),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/workflows/:id - Get workflow by ID
router.get('/:id', async (req, res, next) => {
  try {
    const workflow = await workflowService.getById(req.params.id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Workflow with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/workflows - Create new workflow
router.post('/', async (req, res, next) => {
  try {
    const workflow = await workflowService.create(req.body);
    res.status(201).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/workflows/:id - Update workflow
router.put('/:id', async (req, res, next) => {
  try {
    const workflow = await workflowService.update(req.params.id, req.body);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Workflow with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/workflows/:id - Delete workflow
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await workflowService.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Workflow with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: { id: req.params.id, deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

// Made with Bob