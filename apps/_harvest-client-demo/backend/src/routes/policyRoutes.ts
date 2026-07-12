import { Router } from 'express';
import {
  getAllPolicies,
  getPolicyByRef,
  createPolicy,
  updatePolicy,
  deletePolicy,
  type Policy,
} from '../services/policyService';

const router = Router();

// GET /api/v1/policies?holder=<name>  (holder filter handled in server.ts, this handles general list)
router.get('/', async (req, res, next) => {
  try {
    const policies = await getAllPolicies();
    res.json({ success: true, data: policies, meta: { count: policies.length } });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/policies/:policyRef
router.get('/:policyRef', async (req, res, next) => {
  try {
    const policy = await getPolicyByRef(req.params.policyRef);
    if (!policy) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Policy '${req.params.policyRef}' not found` } });
    }
    res.json({ success: true, data: policy });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/policies
router.post('/', async (req, res, next) => {
  try {
    const body = req.body as Omit<Policy, 'id'>;
    if (!body.policyRef) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'policyRef is required' } });
    }
    const policy = await createPolicy(body);
    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/policies/:policyRef
router.put('/:policyRef', async (req, res, next) => {
  try {
    const policy = await updatePolicy(req.params.policyRef, req.body);
    if (!policy) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Policy '${req.params.policyRef}' not found` } });
    }
    res.json({ success: true, data: policy });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/policies/:policyRef
router.delete('/:policyRef', async (req, res, next) => {
  try {
    const deleted = await deletePolicy(req.params.policyRef);
    if (!deleted) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Policy '${req.params.policyRef}' not found` } });
    }
    res.json({ success: true, data: { deleted: true, policyRef: req.params.policyRef } });
  } catch (error) {
    next(error);
  }
});

export default router;
