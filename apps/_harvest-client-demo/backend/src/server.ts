// Trigger reload for updated claims data
// Updated claims with specific agent assignments
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import verticalRoutes from './routes/verticalRoutes';
import agentRoutes from './routes/agentRoutes';
import workflowRoutes from './routes/workflowRoutes';
import aiRoutes from './routes/aiRoutes';
import reportingRoutes from './routes/reportingRoutes';
import governanceRoutes from './routes/governanceRoutes';
import claimsRoutes from './routes/claimsRoutes';
import claimsModelRoutes from './routes/claimsModelRoutes';
import voiceRoutes from './routes/voiceRoutes';
import fnolSessionRoutes from './routes/fnolSessionRoutes';
import evidenceUploadRoutes from './routes/evidenceUploadRoutes';
import policyRoutes from './routes/policyRoutes';
import workforceRoutes from './routes/workforceRoutes';
import staffRoutes from './routes/staffRoutes';
import stewardRoutes from './routes/stewardRoutes';
import customerRoutes from './routes/customerRoutes';
import seededClaimsSuiteRoutes from './routes/seededClaimsSuiteRoutes';
import authRoutes from './routes/authRoutes';
import { getAllPoliciesByHolder, getAllPoliciesByPersona } from './services/policyService';
import { getInteractionMode } from './services/interactionService';
import { runSeeder } from './services/dataSeeder';
import { syncAdjusterDemoData } from './services/adjusterDataService';
import { syncCustomerPersonaData } from './services/customerPersonaService';
import { ensureClaimDemoData } from './services/claimsDemoSeeder';
import { initializeSessionMiddleware } from './services/sessionService';

// __dirname = …/backend/src — resolve two levels up to get project root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Azure load balancer / reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Session middleware (before routes)
initializeSessionMiddleware(app);

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  const { persistence, search } = getInteractionMode();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    persistenceMode: persistence,
    searchMode: search,
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/verticals', verticalRoutes);
// Agent and AI routes get a longer timeout (120s) for Foundry calls
app.use('/api/v1/agents', (req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
}, agentRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/ai', (req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
}, aiRoutes);
app.use('/api/v1/reporting', reportingRoutes);
app.use('/api/v1/governance', governanceRoutes);
app.use('/api/v1/claims', claimsRoutes);
app.use('/api/v1/process-models', claimsModelRoutes);
app.use('/api/v1/workforces', workforceRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/steward', stewardRoutes);
app.use('/api/v1/claim-suites', seededClaimsSuiteRoutes);
// Policy CRUD + legacy holder-filter endpoint
app.use('/api/v1/policies', async (req, res, next) => {
  if (req.method === 'GET' && req.query.personaId) {
    try {
      const policies = await getAllPoliciesByPersona(req.query.personaId as string);
      return res.json({ success: true, data: policies });
    } catch (err) {
      return next(err);
    }
  }
  // Legacy: GET /api/v1/policies?holder=<name> → filter by holder
  if (req.method === 'GET' && req.query.holder) {
    try {
      const policies = await getAllPoliciesByHolder(req.query.holder as string);
      return res.json({ success: true, data: policies });
    } catch (err) {
      return next(err);
    }
  }
  next();
}, policyRoutes);
// FNOL session lifecycle routes (120s timeout for agent calls)
app.use('/api/v1/fnol/sessions', (req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
}, fnolSessionRoutes);
app.use('/api/v1/fnol/sessions', evidenceUploadRoutes);
app.use('/api/v1/fnol', evidenceUploadRoutes);
// Voice routes get a longer timeout (120s) for Foundry STT/TTS calls
app.use('/api/v1/voice', (req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
}, voiceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handler - must have 4 parameters for Express to recognize it as error middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error occurred:', err);
  
  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
});

// Start server then seed data
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 AI Provider: Azure AI Foundry`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);

  // Seed baseline reference data, then ensure the curated production claim
  // dataset + telemetry (idempotent). Legacy UK demo claims are no longer seeded.
  void (async () => {
    await runSeeder();
    await syncAdjusterDemoData({ seedDemoClaims: false });
    await ensureClaimDemoData();
    await syncCustomerPersonaData();
  })().catch((err) => console.error('[StartupData] Fatal error:', err));
});
