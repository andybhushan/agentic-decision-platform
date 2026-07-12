import { Router } from 'express';
import { getAdjusterProfile, getAdjusterProfiles } from '../services/adjusterDataService';

const router = Router();

// GET /api/v1/staff/adjusters — list all claims adjusters
router.get('/adjusters', async (_req, res, next) => {
  try {
    const adjusters = await getAdjusterProfiles();
    res.json({ success: true, data: adjusters, meta: { count: adjusters.length } });
  } catch (error) {
    next(error);
  }
});

router.get('/adjusters/:id', async (req, res, next) => {
  try {
    const adjuster = await getAdjusterProfile(req.params.id);
    if (!adjuster) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Adjuster '${req.params.id}' not found`,
        },
      });
    }
    return res.json({ success: true, data: adjuster, meta: { timestamp: new Date().toISOString() } });
  } catch (error) {
    return next(error);
  }
});

export default router;
