import { Router } from 'express';
import { getWorkforce, getWorkforces, upsertWorkforce } from '../services/cosmosService';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const workforces = await getWorkforces();
    res.json({
      success: true,
      data: workforces,
      meta: {
        count: workforces.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const workforce = await getWorkforce(req.params.id);
    if (!workforce) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Workforce with id '${req.params.id}' not found`,
        },
      });
    }

    res.json({
      success: true,
      data: workforce,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const workforce = await upsertWorkforce({ ...(req.body ?? {}), id: req.params.id });
    res.json({
      success: true,
      data: workforce,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
