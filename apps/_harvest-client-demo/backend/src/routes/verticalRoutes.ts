import { Router } from 'express';
import { VerticalService } from '../services/verticalService';

const router = Router();
const verticalService = new VerticalService();

// GET /api/v1/verticals - Get all verticals
router.get('/', async (req, res, next) => {
  try {
    const verticals = await verticalService.getAll();
    res.json({
      success: true,
      data: verticals,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/verticals/:id - Get vertical by ID
router.get('/:id', async (req, res, next) => {
  try {
    const vertical = await verticalService.getById(req.params.id);
    if (!vertical) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Vertical with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: vertical,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

// Made with Bob
