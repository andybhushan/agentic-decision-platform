import { Router } from 'express';
import { getCustomerPersona, getCustomerPersonas } from '../services/customerPersonaService';

const router = Router();

router.get('/personas', async (req, res, next) => {
  try {
    const selectableOnly = req.query.selectableOnly === 'true';
    const personas = await getCustomerPersonas(selectableOnly);
    res.json({
      success: true,
      data: personas,
      meta: { count: personas.length, selectableOnly },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/personas/:id', async (req, res, next) => {
  try {
    const persona = await getCustomerPersona(req.params.id);
    if (!persona) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Customer persona '${req.params.id}' not found`,
        },
      });
    }

    return res.json({
      success: true,
      data: persona,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
