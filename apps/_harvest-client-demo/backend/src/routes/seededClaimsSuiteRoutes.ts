import { Router } from 'express';
import { SeededClaimsSuiteService } from '../services/seededClaimsSuiteService';
import { resetSyntheticGovernanceDataset } from '../services/governanceSyntheticStore';

const router = Router();
const service = new SeededClaimsSuiteService();

function isTransientBackendError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: unknown }).code ?? '').toUpperCase();
  const message = String((error as { message?: unknown }).message ?? '').toUpperCase();
  return (
    ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code) ||
    message.includes('ECONNRESET') ||
    message.includes('TLS CONNECTION') ||
    message.includes('CLIENT NETWORK SOCKET DISCONNECTED')
  );
}

async function withTransientRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientBackendError(error) || attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError;
}

router.get('/', async (req, res, next) => {
  try {
    const suites = await service.listSuites();
    res.json({
      success: true,
      data: suites,
      meta: { count: suites.length, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/clear', async (req, res, next) => {
  try {
    const result = await withTransientRetry(() => service.clearClaimsDemoData());
    resetSyntheticGovernanceDataset();
    res.json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reimport', async (req, res, next) => {
  try {
    const { count, seed, name, generatedBy, agentIds } = req.body as {
      count?: number;
      seed?: string;
      name?: string;
      generatedBy?: string;
      agentIds?: string[];
    };
    const result = await withTransientRetry(() => service.clearAndReimport({
      count,
      seed,
      name,
      generatedBy,
      agentIds,
    }));
    res.status(201).json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const { count, seed, name, generatedBy, autoRun, agentIds } = req.body as {
      count?: number;
      seed?: string;
      name?: string;
      generatedBy?: string;
      autoRun?: boolean;
      agentIds?: string[];
    };
    const result = await service.generateSuite({
      count,
      seed,
      name,
      generatedBy,
      autoRun,
      agentIds,
    });
    res.status(201).json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:suiteId', async (req, res, next) => {
  try {
    const suite = await service.getSuite(req.params.suiteId);
    if (!suite.suite) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Suite not found' },
      });
    }
    res.json({ success: true, data: suite, meta: { timestamp: new Date().toISOString() } });
  } catch (error) {
    next(error);
  }
});

router.post('/:suiteId/run', async (req, res, next) => {
  try {
    const { agentIds, forceCompletion } = req.body as { agentIds?: string[]; forceCompletion?: boolean };
    const run = await service.runSuite(req.params.suiteId, agentIds, { forceCompletion });
    res.json({
      success: true,
      data: run,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:suiteId/runs/:runId/evaluate', async (req, res, next) => {
  try {
    const evaluation = await service.evaluateRun(req.params.suiteId, req.params.runId);
    res.json({
      success: true,
      data: evaluation,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:suiteId/runs/:runId/foundry-export', async (req, res, next) => {
  try {
    const payload = await service.exportFoundryEvalPayload(req.params.suiteId, req.params.runId);
    res.json({
      success: true,
      data: payload,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
