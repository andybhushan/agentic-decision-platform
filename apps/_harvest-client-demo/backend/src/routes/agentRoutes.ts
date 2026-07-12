import { Router } from 'express';
import { randomUUID } from 'crypto';
import { AgentService } from '../services/agentService';
import { generateAgentSpec } from '../services/agentSpecGenerator';
import { deployAgentToFoundry, testDeployedAgent } from '../services/foundryAgentDeployer';
import { getPolicyByHolder, formatPolicyContext, getPrimaryAutoPolicyByPersona } from '../services/policyService';
import { buildFnolInstructions } from '../services/fnolPrompt';
import { recordInteraction } from '../services/interactionService';
import { formatCustomerPersonaContext, getCustomerPersona, getCustomerPersonaByName } from '../services/customerPersonaService';
import { getSessionUser } from '../services/sessionService';
import { entraService } from '../services/entraService';
import { a365Service } from '../services/a365Service';
import { recordDeployment } from '../services/auditLogService';
import {
  recordAgentCreated,
  recordAgentUpdated,
  recordAgentDeployed,
  recordAgentRevoked,
  recordAgentDeleted,
  getAgentLifecycleHistory,
} from '../services/agentLifecycleTelemetryService';

const router = Router();
const agentService = new AgentService();

function formatTodayContext(timeZone = 'America/New_York'): string {
  return `TODAY: ${new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date())} (${timeZone})`;
}

// GET /api/v1/agents - Get all agents with optional filters
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      verticalId: req.query.verticalId as string | undefined,
      archetype: req.query.archetype as string | undefined,
      authorityLevel: req.query.authorityLevel as string | undefined,
      search: req.query.search as string | undefined,
    };

    const agents = await agentService.getAll(filters);
    res.json({
      success: true,
      data: agents,
      meta: {
        count: agents.length,
        filters: Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== undefined)
        ),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/agents/:id/generate-spec - Generate agent specification and prompt (MUST be before GET /:id)
router.post('/:id/generate-spec', async (req, res, next) => {
  try {
    console.log(`Generating spec for agent: ${req.params.id}`);
    
    const agent = await agentService.getById(req.params.id);
    console.log(`Agent found:`, agent ? 'Yes' : 'No');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent with id '${req.params.id}' not found`,
        },
      });
    }

    console.log(`Calling generateAgentSpec...`);
    const artifacts = await generateAgentSpec(agent);
    console.log(`Specification generated, length: ${artifacts.specification.length}`);
    
    // Update agent with generated spec and prompt
    await agentService.update(req.params.id, {
      generatedSpec: artifacts.specification,
      foundryPrompt: artifacts.foundryPrompt,
      specReviewerSummary: artifacts.reviewerSummary,
      specGeneratedAt: new Date().toISOString(),
    });
    
    const response = {
      success: true,
      data: {
        agentId: agent.id,
        agentName: agent.name,
        specification: artifacts.specification,
        foundryPrompt: artifacts.foundryPrompt,
        reviewerSummary: artifacts.reviewerSummary,
        generatedAt: new Date().toISOString(),
      },
    };
    
    console.log(`Sending response with spec and prompt...`);
    res.json(response);
    console.log(`Response sent successfully`);
  } catch (error) {
    console.error(`Error in generate-spec:`, error);
    next(error);
  }
});

// GET /api/v1/agents/:id - Get agent by ID
router.get('/:id', async (req, res, next) => {
  try {
    const agent = await agentService.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent with id '${req.params.id}' not found`,
        },
      });
    }
    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/agents - Create new agent
router.post('/', async (req, res, next) => {
  try {
    const requestId = randomUUID();
    const agent = await agentService.create(req.body);

    const sessionUser = getSessionUser(req);
    const userId = sessionUser?.userId ?? 'unknown';
    const userName = sessionUser?.userName ?? 'Unknown User';

    // Fire-and-forget — never block the response
    recordAgentCreated({
      agent,
      actorId: userId,
      actorName: userName,
      requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      triggerSource: 'ui',
    }).catch((err) => console.error('[AgentRoutes] recordAgentCreated failed:', err));

    res.status(201).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/agents/:id - Update agent
router.put('/:id', async (req, res, next) => {
  try {
    const requestId = randomUUID();
    const agentBefore = await agentService.getById(req.params.id);
    if (!agentBefore) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent with id '${req.params.id}' not found`,
        },
      });
    }

    const agent = await agentService.update(req.params.id, req.body);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent with id '${req.params.id}' not found`,
        },
      });
    }

    const sessionUser = getSessionUser(req);
    const userId = sessionUser?.userId ?? 'unknown';
    const userName = sessionUser?.userName ?? 'Unknown User';

    recordAgentUpdated({
      agentBefore,
      agentAfter: agent,
      actorId: userId,
      actorName: userName,
      requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      triggerSource: 'ui',
      changeReason: req.body._changeReason,
    }).catch((err) => console.error('[AgentRoutes] recordAgentUpdated failed:', err));

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/agents/:id - Delete agent
router.delete('/:id', async (req, res, next) => {
  try {
    const requestId = randomUUID();
    const agentToDelete = await agentService.getById(req.params.id);
    if (!agentToDelete) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent with id '${req.params.id}' not found`,
        },
      });
    }

    const deleted = await agentService.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent with id '${req.params.id}' not found`,
        },
      });
    }

    const sessionUser = getSessionUser(req);
    const userId = sessionUser?.userId ?? 'unknown';
    const userName = sessionUser?.userName ?? 'Unknown User';

    recordAgentDeleted({
      agent: agentToDelete,
      actorId: userId,
      actorName: userName,
      requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      triggerSource: 'ui',
    }).catch((err) => console.error('[AgentRoutes] recordAgentDeleted failed:', err));

    res.json({
      success: true,
      data: { id: req.params.id, deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/agents/:id/revoke - Revoke a deployed agent
router.post('/:id/revoke', async (req, res, next) => {
  try {
    const requestId = randomUUID();
    const agent = await agentService.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Agent with id '${req.params.id}' not found` },
      });
    }

    const sessionUser = getSessionUser(req);
    const userId = sessionUser?.userId ?? 'unknown';
    const userName = sessionUser?.userName ?? 'Unknown User';
    const revokeReason: string | undefined = req.body?.reason;

    const revokedAt = new Date().toISOString();
    const updatedAgent = await agentService.update(req.params.id, {
      revokedAt,
      revokedBy: userName,
      revokeReason,
      // Clear active deployment fields so chat/test routes won't route to it
      deploymentId: undefined,
      deploymentEndpoint: undefined,
    });

    // Gather Entra & A365 signals for governance
    const entraProfile = await entraService.getUserProfile(userId);
    const a365Signals = await a365Service.getUnusualAccessPatterns(userId);

    recordAgentRevoked({
      agent,
      revokeReason,
      actorId: userId,
      actorName: userName,
      requestId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      triggerSource: 'ui',
      entraProfile,
      a365Signals,
    }).catch((err) => console.error('[AgentRoutes] recordAgentRevoked failed:', err));

    res.json({
      success: true,
      data: {
        agentId: agent.id,
        agentName: agent.name,
        revokedAt,
        revokedBy: userName,
        revokeReason,
        wasDeployed: !!(agent.deploymentId && agent.deploymentEndpoint),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/agents/:id/lifecycle-history - Lifecycle audit trail for an agent
router.get('/:id/lifecycle-history', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const agent = await agentService.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Agent with id '${req.params.id}' not found` },
      });
    }
    const events = await getAgentLifecycleHistory(req.params.id, limit);
    res.json({ success: true, data: events, meta: { count: events.length } });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/agents/:id/deploy-to-foundry - Deploy agent to Azure AI Foundry
router.post('/:id/deploy-to-foundry', async (req, res, next) => {
  try {
    const agent = await agentService.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent with id '${req.params.id}' not found`,
        },
      });
    }

    // Extract session user for governance
    const sessionUser = getSessionUser(req);
    const userId = sessionUser?.userId ?? 'unknown';
    const userName = sessionUser?.userName ?? 'Unknown User';

    // Use the already-generated spec/prompt if it exists so deployment doesn't
    // require a second Foundry round-trip. The caller should run Generate Spec
    // first if they want a fresh review; Deploy just pushes what is already saved.
    let specToUse: string;
    if (agent.generatedSpec && agent.foundryPrompt) {
      console.log(`Using existing spec for deployment (generated at ${agent.specGeneratedAt || 'unknown'})`);
      specToUse = agent.generatedSpec;
    } else {
      console.log('No existing spec found — generating one before deploying...');
      const artifacts = await generateAgentSpec(agent);
      await agentService.update(req.params.id, {
        generatedSpec: artifacts.specification,
        foundryPrompt: artifacts.foundryPrompt,
        specReviewerSummary: artifacts.reviewerSummary,
        specGeneratedAt: new Date().toISOString(),
      });
      specToUse = artifacts.specification;
    }

    // Deploy to Foundry
    const deployment = await deployAgentToFoundry(agent, specToUse);
    
    // Save deployment info to agent
    await agentService.update(req.params.id, {
      deploymentId: deployment.deploymentId,
      deploymentEndpoint: deployment.endpoint,
      deployedAt: new Date().toISOString(),
    });

    // Gather Entra & A365 signals for governance
    const entraProfile = await entraService.getUserProfile(userId);
    const a365Signals = await a365Service.getUnusualAccessPatterns(userId);

    // Record rich deployment lifecycle event (replaces legacy recordDeployment)
    const resolvedDeployId = deployment.deploymentId ?? agent.id;
    const resolvedEndpoint = deployment.endpoint ?? '';
    recordAgentDeployed({
      agent: { ...agent, deploymentId: resolvedDeployId, deploymentEndpoint: resolvedEndpoint },
      deploymentId: resolvedDeployId,
      deploymentEndpoint: resolvedEndpoint,
      modelId: process.env.AZURE_OPENAI_DEPLOYMENT ?? process.env.FOUNDRY_MODEL_ID,
      specUsed: specToUse,
      environment: process.env.NODE_ENV ?? 'development',
      actorId: userId,
      actorName: userName,
      requestId: randomUUID(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      triggerSource: 'ui',
      entraProfile,
      a365Signals,
    }).catch((err) => console.error('[AgentRoutes] recordAgentDeployed failed:', err));

    // Keep legacy audit record for backward compatibility with governance dashboard
    recordDeployment(agent.id, userId, userName, entraProfile, a365Signals);
    
    res.json({
      success: true,
      data: {
        agentId: agent.id,
        agentName: agent.name,
        ...deployment,
        deployedAt: new Date().toISOString(),
        deployedBy: userName,
      },
    });
  } catch (error) {
    // Surface the real error message so the UI can show something useful.
    const message = error instanceof Error ? error.message : 'Deployment failed';
    console.error('Deploy error:', message);
    res.status(500).json({
      success: false,
      error: { code: 'DEPLOY_FAILED', message },
    });
  }
});

// POST /api/v1/agents/:id/chat - Test agent with a query
router.post('/:id/chat', async (req, res, next) => {
  try {
    const { query, history, deploymentId, context, taskEnvelope, callerPersonaId } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Query is required',
        },
      });
    }

    // Sanitize client-supplied conversation history: only allow user/assistant
    // string turns, cap length and count to bound prompt size and cost.
    const MAX_TURNS = 20;
    const MAX_CONTENT = 4000;
    const safeHistory: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(history)
      ? history
          .filter(
            (m: any) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string' &&
              m.content.trim().length > 0
          )
          .slice(-MAX_TURNS)
          .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_CONTENT) }))
      : [];

    const agent = await agentService.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent with id '${req.params.id}' not found`,
        },
      });
    }

    // Resolve the requested operating context against what the agent supports.
    // Only agents that declare 'orchestrated' may be driven in orchestrated mode;
    // everything else falls back to standalone (the safe default).
    const supportedModes = agent.operatingModes && agent.operatingModes.length ? agent.operatingModes : ['standalone'];
    const requestedContext = context === 'orchestrated' ? 'orchestrated' : context === 'standalone' ? 'standalone' : undefined;
    const effectiveContext: 'standalone' | 'orchestrated' | undefined =
      requestedContext === 'orchestrated' && !supportedModes.includes('orchestrated')
        ? 'standalone'
        : requestedContext;


    // The live FNOL interview override (caller's policy/persona injected into a
    // structured, one-question-at-a-time script) is ONLY for the conversational
    // Web/Mobile Intake Assistants. The hybrid Unstructured Intake Assistant — and
    // any non-conversational intake agent — must use its OWN generated prompt instead,
    // so it processes the submitted bundle first rather than interrogating the caller
    // from pre-loaded policy data.
    const isConversationalFnolIntake =
      agent.interactionStyle === 'conversational' &&
      (agent.workflowRole?.toLowerCase().includes('intake') ||
        agent.workflowRole?.toLowerCase().includes('fnol') ||
        agent.workflowRole?.toLowerCase().includes('first notice'));

    let overrideInstructions: string | undefined;
    if (isConversationalFnolIntake) {
      // Build dynamic FNOL context: today's date + caller's policy record.
      const DEMO_CALLER = process.env.DEMO_CALLER_NAME ?? 'Richard Hogan';
      const callerPersona = typeof callerPersonaId === 'string'
        ? await getCustomerPersona(callerPersonaId)
        : await getCustomerPersonaByName(DEMO_CALLER);
      const todayContext = formatTodayContext(callerPersona?.timeZone ?? 'America/New_York');
      const callerPolicy = callerPersona?.id
        ? await getPrimaryAutoPolicyByPersona(callerPersona.id)
        : await getPolicyByHolder(DEMO_CALLER);
      const policyContext = callerPolicy ? formatPolicyContext(callerPolicy) : '';
      const customerContext = callerPersona ? formatCustomerPersonaContext(callerPersona) : '';
      overrideInstructions = buildFnolInstructions(todayContext, `${customerContext}\n${policyContext}`.trim());
    } else if (agent.foundryPrompt) {
      // Use the agent's own generated foundry prompt as the instruction override
      overrideInstructions = agent.foundryPrompt;
    } else if (agent.systemPrompt) {
      // No generated foundry prompt yet — fall back to the agent's own system prompt
      overrideInstructions = agent.systemPrompt;
    }
    // If none, testDeployedAgent falls back to fetching instructions from the Foundry deployment


    // Test the deployed agent
    const testDeploymentId = deploymentId || `foundry-${agent.id}`;
    const chatStartedAt = new Date().toISOString();
    const chatStartMs = Date.now();
    const result = await testDeployedAgent(testDeploymentId, query, safeHistory, {
      context: effectiveContext,
      taskEnvelope,
      overrideInstructions,
    });
    const chatDurationMs = Date.now() - chatStartMs;
    const chatCompletedAt = new Date().toISOString();
    // Cast to any so the telemetry block can pick up future extended fields
    // (inputTokens, toolCalls, etc.) without requiring a deployer type update.
    const r = result as any;

    // Audit: fire-and-forget.
    if (result.success) {
      const traceId = randomUUID();
      recordInteraction({
        agentId: agent.id,
        sessionId: `agent-test-${agent.id}-${Date.now()}`,
        interactionType: 'agent_test',
        userContent: query,
        assistantContent: result.response ?? '',
        phase: result.phase,
        confidence: result.confidence,
        escalated: result.escalateToHuman ?? false,
        escalationReason: r.escalationReason,
        startedAt: chatStartedAt,
        completedAt: chatCompletedAt,
        durationMs: chatDurationMs,
        modelId: process.env.AZURE_OPENAI_DEPLOYMENT ?? process.env.FOUNDRY_MODEL_ID ?? testDeploymentId,
        deploymentId: testDeploymentId,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        totalTokens: typeof r.inputTokens === 'number' && typeof r.outputTokens === 'number'
          ? r.inputTokens + r.outputTokens
          : undefined,
        estimatedCostUsd: r.estimatedCostUsd,
        toolCalls: Array.isArray(r.toolCalls) ? r.toolCalls : undefined,
        toolCallsTotal: Array.isArray(r.toolCalls) ? r.toolCalls.length : 0,
        toolCallsFailed: Array.isArray(r.toolCalls)
          ? r.toolCalls.filter((tc: any) => tc?.success === false).length
          : 0,
        policyEvaluations: Array.isArray(r.policyEvaluations) ? r.policyEvaluations : undefined,
        policyViolations: Array.isArray(r.policyEvaluations)
          ? r.policyEvaluations.filter((p: any) => ['failed', 'blocked', 'violation'].includes(p?.outcome)).length
          : 0,
        riskScore: r.riskScore,
        channelId: 'agent-test-ui',
        callerType: 'adjuster',
        operatingContext: effectiveContext,
        traceId,
        status: 'success',
        meta: {
          context: effectiveContext,
          operatingModes: agent.operatingModes,
        },
      });
    } else {
      recordInteraction({
        agentId: agent.id,
        sessionId: `agent-test-${agent.id}-${Date.now()}`,
        interactionType: 'agent_test',
        userContent: query,
        assistantContent: '',
        startedAt: chatStartedAt,
        completedAt: chatCompletedAt,
        durationMs: chatDurationMs,
        modelId: process.env.AZURE_OPENAI_DEPLOYMENT ?? process.env.FOUNDRY_MODEL_ID ?? testDeploymentId,
        deploymentId: testDeploymentId,
        channelId: 'agent-test-ui',
        callerType: 'adjuster',
        operatingContext: effectiveContext,
        traceId: randomUUID(),
        status: 'error',
        errorCode: r.errorCode,
        errorMessage: r.error ?? result.message,
        meta: { context: effectiveContext },
      });
    }

    res.json({
      success: true,
      data: {
        agentId: agent.id,
        agentName: agent.name,
        query,
        ...result,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/agents/:id/interactions/summary ────────────────────────────
// Returns aggregated observability data — no raw message content exposed.

router.get('/:id/interactions/summary', async (req, res, next) => {
  try {
    const agent = await agentService.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Agent '${req.params.id}' not found` } });
    }

    const { getAgentInteractions } = await import('../services/cosmosService');

    // Query by canonical agent id PLUS any legacy deployment/alias IDs so that
    // interactions logged before the agentId fix are also surfaced.
    const queryIds = Array.from(new Set([
      agent.id,
      agent.deploymentId,
      // Common legacy patterns used before the canonical ID was wired in
      `foundry-${agent.id}`,
      // FNOL-specific: was logged as 'claims-intake-agent' before fix
      agent.id === 'agent_claims_intake' ? 'claims-intake-agent' : null,
      agent.id === 'agent_claims_mobile_intake' ? 'claims-mobile-intake-agent' : null,
    ].filter(Boolean) as string[]));

    const allInteractions = (
      await Promise.all(queryIds.map((aid) => getAgentInteractions(aid, 200)))
    ).flat().sort((a, b) => (b.ts > a.ts ? 1 : -1)).slice(0, 200);

    const interactions = allInteractions;

    // Compute aggregates
    const total = interactions.length;
    const turnConfidenceRows = interactions.filter((i) => i.interactionType !== 'fnol_submit' && typeof i.confidence === 'number');
    const routingConfidenceRows = interactions.filter((i) => typeof i.confidence === 'number' && i.interactionType === 'fnol_submit');
    const avgConfidence = turnConfidenceRows.length
      ? turnConfidenceRows.reduce((sum, i) => sum + (i.confidence ?? 0), 0) / turnConfidenceRows.length
      : null;
    const avgRoutingConfidence = routingConfidenceRows.length
      ? routingConfidenceRows.reduce((sum, i) => sum + (i.confidence ?? 0), 0) / routingConfidenceRows.length
      : null;
    const escalated = interactions.filter((i) => i.escalated === true).length;
    const escalationRate = total > 0 ? escalated / total : null;
    const withDuration = interactions.filter((i) => typeof i.durationMs === 'number' || typeof (i.meta as any)?.durationMs === 'number');
    const avgDurationMs = withDuration.length
      ? withDuration.reduce((sum, i) => sum + (i.durationMs ?? Number((i.meta as any)?.durationMs ?? 0)), 0) / withDuration.length
      : null;
    const tokenized = interactions.filter((i) => typeof i.inputTokens === 'number' || typeof i.outputTokens === 'number');
    const avgInputTokens = tokenized.length
      ? tokenized.reduce((sum, i) => sum + Number(i.inputTokens ?? 0), 0) / tokenized.length
      : null;
    const avgOutputTokens = tokenized.length
      ? tokenized.reduce((sum, i) => sum + Number(i.outputTokens ?? 0), 0) / tokenized.length
      : null;

    const errorCount = interactions.filter(
      (i) => i.status === 'error' || i.status === 'timeout' || typeof (i.meta as any)?.errorCode === 'string'
    ).length;
    const errorRate = total > 0 ? errorCount / total : null;

    let policyChecks = 0;
    let policyViolations = 0;
    let governanceOverrides = 0;
    let toolCalls = 0;
    let toolFailures = 0;
    let totalEstimatedCostUsd = 0;
    let estimatedCostCount = 0;

    const byType: Record<string, number> = {};
    const byPhase: Record<string, number> = {};
    for (const i of interactions) {
      const t = i.interactionType || 'unknown';
      byType[t] = (byType[t] ?? 0) + 1;
      if (i.phase) { byPhase[i.phase] = (byPhase[i.phase] ?? 0) + 1; }

      const meta = (i.meta ?? {}) as Record<string, any>;
      // Top-level fields take precedence; fall back to legacy meta for older records
      const policyEvaluations = Array.isArray(i.policyEvaluations)
        ? i.policyEvaluations
        : Array.isArray(meta.policyEvaluations) ? meta.policyEvaluations : [];
      const calls = Array.isArray(i.toolCalls)
        ? i.toolCalls
        : Array.isArray(meta.toolCalls) ? meta.toolCalls : [];
      const estimatedCostUsd = typeof i.estimatedCostUsd === 'number'
        ? i.estimatedCostUsd
        : meta.estimatedCostUsd;

      policyChecks += policyEvaluations.length;
      policyViolations += policyEvaluations.filter((evalItem: any) => {
        const outcome = typeof evalItem?.outcome === 'string' ? evalItem.outcome.toLowerCase() : '';
        return outcome === 'failed' || outcome === 'blocked' || outcome === 'violation';
      }).length;

      if (meta.governanceOverride === true || policyEvaluations.some((evalItem: any) => evalItem?.actionTaken === 'override')) {
        governanceOverrides += 1;
      }

      toolCalls += calls.length;
      toolFailures += calls.filter((call: any) => call?.success === false).length;

      if (typeof estimatedCostUsd === 'number') {
        totalEstimatedCostUsd += estimatedCostUsd;
        estimatedCostCount += 1;
      }
    }
    const policyViolationRate = policyChecks > 0 ? policyViolations / policyChecks : null;
    const overrideRate = total > 0 ? governanceOverrides / total : null;
    const toolFailureRate = toolCalls > 0 ? toolFailures / toolCalls : null;
    const avgEstimatedCostUsd = estimatedCostCount > 0 ? totalEstimatedCostUsd / estimatedCostCount : null;

    // Recent interactions — metadata only, no content
    const latestHandoff = interactions.find((i) => (i.meta as any)?.handoff)?.meta as any;
    const recent = interactions.slice(0, 20).map((i) => {
      const meta = (i.meta ?? {}) as Record<string, any>;
      const handoff = (meta.handoff ?? null) as Record<string, any> | null;
      const clientIssueFlags = Array.isArray(meta.clientIssueFlags)
        ? meta.clientIssueFlags.map((flag: any) => flag.label).filter(Boolean)
        : [];
      const decisionPoints = Array.isArray(meta.decisionPoints)
        ? meta.decisionPoints.map((point: any) => `${point.label}: ${point.outcome}`).filter(Boolean)
        : [];
      return {
        id: i.id,
        ts: i.ts,
        interactionType: i.interactionType,
        phase: i.phase ?? null,
        confidence: typeof i.confidence === 'number' ? i.confidence : null,
        escalated: i.escalated ?? false,
        claimId: i.claimId ?? null,
        claimantName: typeof meta.claimantName === 'string' ? meta.claimantName : i.callerId ?? null,
        handoffTarget: typeof handoff?.targetName === 'string' ? handoff.targetName : null,
        handoffReason: typeof handoff?.reason === 'string' ? handoff.reason : null,
        durationMs: typeof i.durationMs === 'number' ? i.durationMs : typeof meta.durationMs === 'number' ? meta.durationMs : null,
        summary: typeof meta.summary === 'string'
          ? meta.summary
          : typeof meta.claimSummary === 'string'
            ? meta.claimSummary
            : null,
        clientIssueFlags,
        decisionPoints,
      };
    });

    res.json({
      success: true,
      data: {
        agentId: agent.id,
        total,
        avgConfidence,
        avgRoutingConfidence,
        avgDurationMs,
        escalationRate,
        escalated,
        errorCount,
        errorRate,
        avgInputTokens,
        avgOutputTokens,
        avgEstimatedCostUsd,
        policyChecks,
        policyViolations,
        policyViolationRate,
        governanceOverrides,
        overrideRate,
        toolCalls,
        toolFailures,
        toolFailureRate,
        byType,
        byPhase,
        latestHandoff: latestHandoff?.handoff
          ? {
              targetName: latestHandoff.handoff.targetName ?? null,
              reason: latestHandoff.handoff.reason ?? null,
              confidence: typeof latestHandoff.handoff.confidence === 'number' ? latestHandoff.handoff.confidence : null,
            }
          : null,
        recent,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/v1/agents/:id/configure ──────────────────────────────────────
// Natural-language agent configuration: PROPOSES changes only — does NOT save.
// Caller must confirm and then PUT /api/v1/agents/:id to persist.

const CONFIGURE_ALLOWED_FIELDS = new Set([
  'name', 'description', 'capabilities', 'limitations',
  'escalationCriteria', 'systemPrompt', 'governanceProfile', 'authorityLevel',
]);

router.post('/:id/configure', async (req, res, next) => {
  try {
    const agent = await agentService.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Agent '${req.params.id}' not found` } });
    }

    const { message, history = [] } = req.body as {
      message: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'message is required' } });
    }

    // Build conversation context
    const historyText = (history as { role: string; content: string }[])
      .slice(-10)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const agentSnapshot = JSON.stringify({
      name: agent.name,
      description: agent.description,
      authorityLevel: agent.authorityLevel,
      capabilities: agent.capabilities,
      limitations: agent.limitations,
      escalationCriteria: agent.escalationCriteria,
      systemPrompt: agent.systemPrompt?.slice(0, 1200),
      governanceProfile: agent.governanceProfile ?? null,
    }, null, 2);

    const instructions = `You are an AI agent configuration assistant for "Project Imagine", a UK insurance claims AI platform built by Bane and Ox Insurance.
You translate plain-English requests into structured, semantically meaningful configuration updates for AI agents.

═══ CURRENT AGENT STATE ════════════════════════════════════
${agentSnapshot}
════════════════════════════════════════════════════════════

═══ FIELDS YOU MAY UPDATE ══════════════════════════════════

1. name (string) — display name of the agent
2. description (string) — one-sentence plain-English description
3. capabilities (string[]) — what this agent CAN do. Each item is an active verb phrase, e.g. "Analyse CCTV footage metadata"
4. limitations (string[]) — what this agent CANNOT or MUST NOT do. Each item is a constraint, e.g. "Cannot approve claims above £50,000 without human sign-off"
5. escalationCriteria (string[]) — conditions that trigger escalation to a human. E.g. "Confidence below 0.7", "Customer expresses distress"
6. systemPrompt (string) — the full system instruction sent to the LLM at runtime. When updating, return the COMPLETE revised prompt, not just the diff.
7. authorityLevel ("Low" | "Medium" | "High" | "Critical") — how much autonomous decision-making power this agent has
8. governanceProfile (object) — governance controls. The schema is:
   {
     "authorityLevel": "signal" | "advisory" | "authoritative" | "bounded-authority",
     "escalationPath": string,           // who/what to escalate to
     "autonomyDescription": string,      // plain-English description of what the agent decides autonomously
     "boundaries": string[],             // hard limits on what the agent may access or do
     "humanInTheLoop": string[],         // specific scenarios that MUST have human approval
     "confidenceThresholds": {
       "minimum": number,               // 0-1: below this, refuse to act
       "reviewRequired": number         // 0-1: below this, flag for human review
     }
   }

═══ GOVERNANCE TRANSLATION GUIDE ═══════════════════════════
When the user uses natural language about governance, map it like this:

  "require human approval for all decisions"
    → humanInTheLoop: ["All decisions require human approval before execution"]

  "make it advisory only" / "just signal, don't act"
    → authorityLevel (governanceProfile): "signal" or "advisory"

  "give it more autonomy" / "let it approve small claims"
    → authorityLevel (Agent): "Medium" or "High", autonomyDescription updated

  "lower the confidence threshold" / "only act when it's sure"
    → confidenceThresholds.minimum increased (e.g. 0.8), reviewRequired increased (e.g. 0.9)

  "it should never access financial records"
    → boundaries: add "Must not access or modify financial records directly"

  "escalate to a compliance officer"
    → escalationPath: "Compliance Officer via ServiceNow ticket"

  "add a rule: if the claim is over £25k it needs a manager"
    → escalationCriteria: add "Claim value exceeds £25,000"
    → humanInTheLoop: add "Claims exceeding £25,000 require manager sign-off"

  "update the prompt to always greet the customer by name"
    → systemPrompt: full revised prompt with greeting instruction

IMPORTANT RULES:
- For array fields (capabilities, limitations, escalationCriteria, boundaries, humanInTheLoop) always return the COMPLETE updated array
- For governanceProfile, return the COMPLETE updated object (merge current + changes)
- For systemPrompt, return the FULL revised text
- If the user's intent is ambiguous, ask ONE clarifying question and set changes to null
- If no change is needed, set changes to null and explain why
- NEVER modify: id, deploymentId, foundryPrompt, generatedSpec, createdAt, updatedAt, version, archetype

ALWAYS respond with ONLY valid JSON — no markdown fences, no prose outside the JSON:
{
  "response": "<friendly conversational explanation of what you are proposing or what clarification you need>",
  "changes": [{ "field": "<fieldName>", "currentValue": <currentValue>, "newValue": <newValue>, "reason": "<plain-English justification>" }] | null
}`;

    const input = historyText
      ? `Previous conversation:\n${historyText}\n\nUser: ${message}`
      : message;

    // Call Foundry
    const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT?.replace(/\/$/, '').split('/api/projects/')[0];
    const apiKey = process.env.FOUNDRY_API_KEY;
    const model = process.env.FOUNDRY_MODEL_DEPLOYMENT_NAME || 'gpt-5.4';

    if (!endpoint || !apiKey) {
      return res.status(503).json({ success: false, error: { code: 'AI_UNAVAILABLE', message: 'AI provider not configured' } });
    }

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 90000);

    const aiRes = await fetch(`${endpoint}/openai/v1/responses`, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, instructions, input }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!aiRes.ok) {
      throw new Error(`AI call failed: ${aiRes.status}`);
    }

    const aiData = await aiRes.json() as any;
    const rawText: string = aiData?.output?.[0]?.content?.[0]?.text
      ?? aiData?.choices?.[0]?.message?.content
      ?? '';

    let parsed: { response: string; changes: { field: string; currentValue: unknown; newValue: unknown; reason: string }[] | null };
    try {
      // Strip markdown fences if present
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // AI returned prose — treat as response-only, no changes
      parsed = { response: rawText || 'Sorry, I could not process that request.', changes: null };
    }

    // Server-side allowlist enforcement
    const safeChanges = parsed.changes
      ? parsed.changes.filter((c) => CONFIGURE_ALLOWED_FIELDS.has(c.field))
      : null;

    res.json({
      success: true,
      data: {
        response: parsed.response,
        proposedChanges: safeChanges?.length ? safeChanges : null,
      },
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ success: false, error: { code: 'TIMEOUT', message: 'AI request timed out' } });
    }
    next(error);
  }
});

export default router;