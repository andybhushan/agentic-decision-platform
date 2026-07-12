import { Agent } from '../types';
import { DefaultAzureCredential } from '@azure/identity';

const API_VERSION = 'v1';
const REQUEST_TIMEOUT_MS = 90000; // 90 seconds

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function estimateMobileFnolConfidence(input: {
  responseText: string;
  historyLength: number;
  escalateToHuman: boolean;
  phase?: string;
}): number {
  let score = 0.74;
  if (input.historyLength >= 4) score += 0.04;
  if (input.phase === 'SUMMARY') score += 0.08;
  if (input.phase === 'DETAILS' || input.phase === 'EVIDENCE' || input.phase === 'CONSENT') score += 0.04;
  if (/\b(please confirm|can you confirm|what happened|when did|where did|who was involved)\b/i.test(input.responseText)) score += 0.03;
  if (/\b(maybe|might|unclear|appears|likely|possibly|if you can)\b/i.test(input.responseText)) score -= 0.08;
  if (input.escalateToHuman) score -= 0.18;
  return Number(clamp(score, 0.52, 0.95).toFixed(2));
}

function getProjectEndpoint(): string {
  // Use explicit endpoint if provided
  const ep = process.env.FOUNDRY_PROJECT_ENDPOINT;
  if (ep) return ep.replace(/\/$/, '');

  // Otherwise construct from component env vars
  const accountName = process.env.FOUNDRY_ACCOUNT_NAME;
  const projectName = process.env.FOUNDRY_PROJECT_NAME;

  if (accountName && projectName) {
    return `https://${accountName}.services.ai.azure.com/api/projects/${projectName}`;
  }

  throw new Error(
    'Foundry endpoint not configured. Set FOUNDRY_PROJECT_ENDPOINT, or both FOUNDRY_ACCOUNT_NAME and FOUNDRY_PROJECT_NAME in .env'
  );
}

async function getApiKey(): Promise<string> {
  const apiKey = process.env.FOUNDRY_API_KEY;
  if (!apiKey) {
    throw new Error('FOUNDRY_API_KEY not set in .env');
  }
  return apiKey;
}

// Agent management calls (create agent / publish version) require a Microsoft
// Entra bearer token — the api-key cannot provision the managed identity that
// Foundry creates for a new agent, so those calls fail with a 500. We acquire
// a bearer token via DefaultAzureCredential (az login / managed identity) and
// cache it until shortly before expiry.
let cachedToken: { token: string; expiresOnMs: number } | null = null;
let credential: DefaultAzureCredential | null = null;

async function getBearerToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresOnMs - now > 60_000) {
    return cachedToken.token;
  }
  if (!credential) {
    credential = new DefaultAzureCredential();
  }
  const result = await credential.getToken('https://ai.azure.com/.default');
  if (!result?.token) {
    throw new Error('Failed to acquire Foundry bearer token via DefaultAzureCredential (run `az login`)');
  }
  cachedToken = {
    token: result.token,
    expiresOnMs: result.expiresOnTimestamp ?? now + 5 * 60_000,
  };
  return result.token;
}

async function foundryRequest(method: string, path: string, body?: object, retries = 3): Promise<any> {
  const token = await getBearerToken();
  const url = `${getProjectEndpoint()}${path}?api-version=${API_VERSION}`;

  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        const apiError: any = new Error(`Foundry API error (${response.status}): ${err}`);
        apiError.status = response.status;
        // Only retry on 5xx — 4xx are permanent failures
        if (response.status >= 500 && attempt < retries) {
          const delay = attempt * 2000;
          console.warn(`Foundry ${response.status} on attempt ${attempt}/${retries}, retrying in ${delay}ms...`);
          lastError = apiError;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw apiError;
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Foundry API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      // Re-throw 4xx immediately; retry network errors
      if (error.status && error.status < 500) throw error;
      if (attempt < retries) {
        const delay = attempt * 2000;
        console.warn(`Foundry request error on attempt ${attempt}/${retries}, retrying in ${delay}ms...`);
        lastError = error;
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError;
}

/**
 * Deploy agent to Azure AI Foundry � creates a Foundry Agent visible in the portal
 */
export async function deployAgentToFoundry(agent: Agent, specification: string): Promise<{
  success: boolean;
  deploymentId?: string;
  endpoint?: string;
  message: string;
}> {
  if (!agent.governanceProfile) {
    throw new Error('Agent must have a governance profile to deploy to Foundry');
  }

  const model = process.env.FOUNDRY_MODEL_DEPLOYMENT_NAME || 'gpt-5.4';
  // When the agent is reached over a live conversational channel (Microsoft
  // Teams / M365 Copilot), the user's message arrives wrapped in a structured
  // activity envelope. Without an explicit instruction, dual-context agents can
  // misread that envelope as an orchestrated/machine call and reply with empty
  // or JSON-only output, which the Teams relay renders as a blank message. This
  // high-priority directive is prepended (so it survives instruction truncation)
  // to force a visible, conversational reply on every channel turn.
  const CHANNEL_DIRECTIVE =
    'LIVE CHANNEL DIRECTIVE (highest priority): You are deployed to a live conversational channel (Microsoft Teams / Microsoft 365 Copilot). Every incoming message is a STANDALONE, real-time end-user conversation, even when delivered as a structured activity envelope. You MUST always reply with visible, natural-language conversational text - never reply with an empty message, raw JSON, or tool-only output to the user. On the first message, greet the user warmly in one or two sentences and invite them to describe their first-notice-of-loss or share any documents/photos. Then run your normal intake: process whatever they provide, then ask focused, grouped follow-up questions to close any gaps. Keep all user-facing replies in plain prose.\n\n---\n\n';
  // Use the dedicated foundryPrompt field when available (generated by the spec
  // reviewer and already the right length/format). Fall back to extracting from
  // the spec markdown only when foundryPrompt isn't stored yet.
  const rawPrompt = CHANNEL_DIRECTIVE + (agent.foundryPrompt?.trim() || extractSystemPrompt(specification));
  // Foundry enforces a ~8192 char limit on instructions; truncate cleanly at a sentence/paragraph boundary.
  const MAX_INSTRUCTIONS = 8000;
  const systemPrompt =
    rawPrompt.length > MAX_INSTRUCTIONS
      ? rawPrompt.substring(0, MAX_INSTRUCTIONS).replace(/\s+\S*$/, '') + '\n\n[Instructions truncated to fit deployment limit]'
      : rawPrompt;
  // If the agent was previously deployed, use the stored Foundry agent ID (stable).
  // Otherwise derive a stable name from the agent's own id (not the display name, which can change).
  const existingFoundryId = (agent as any).deploymentId as string | undefined;
  const agentName = existingFoundryId || sanitizeAgentName(agent.name);

  console.log(`Deploying agent "${agent.name}" to Azure AI Foundry...`);
  console.log(`- Endpoint: ${getProjectEndpoint()}`);
  console.log(`- Model: ${model}`);
  console.log(`- Agent name: ${agentName} (existing: ${!!existingFoundryId})`);
  console.log(`- Instructions length: ${systemPrompt.length} chars`);

  const definition = {
    kind: 'prompt',
    model,
    instructions: systemPrompt,
    tool_choice: 'auto',
    // 'high' effort can spend the whole turn on hidden reasoning and emit no
    // visible assistant text over the activity protocol (blank Teams reply).
    // 'medium' keeps quality while reliably producing user-visible output.
    reasoning: { effort: 'medium' },
    text: { format: { type: 'text' }, verbosity: 'medium' },
  };

  let foundryAgent: any;
  let updated = false;

  if (existingFoundryId) {
    // Agent already exists in Foundry — publish a new version directly.
    console.log(`Updating existing Foundry agent "${existingFoundryId}"...`);
    foundryAgent = await foundryRequest('POST', `/agents/${existingFoundryId}/versions`, {
      description: agent.description.substring(0, 512),
      definition,
    });
    updated = true;
  } else {
    try {
      // First deploy: create the agent with its full definition.
      foundryAgent = await foundryRequest('POST', '/agents', {
        name: agentName,
        description: agent.description.substring(0, 512),
        definition,
      });
    } catch (error: any) {
      const alreadyExists = error?.status === 409 || /already exists/i.test(error?.message || '');
      if (!alreadyExists) {
        throw error;
      }
      // Already exists (race / manual creation): publish a new version.
      console.log(`Agent "${agentName}" already exists - publishing a new version...`);
      foundryAgent = await foundryRequest('POST', `/agents/${agentName}/versions`, {
        description: agent.description.substring(0, 512),
        definition,
      });
      updated = true;
    }
  }

  // The agent is always addressed by its name (the endpoint routes to @latest).
  const agentId = foundryAgent?.name || foundryAgent?.id || agentName;
  const version = foundryAgent.version ? ` (version ${foundryAgent.version})` : '';
  const portalUrl = `https://ai.azure.com/nextgen/r/wVR7Ctu-Tf6p_ybG6596KA,rgAllianceReporting,,open-msft-alliance-reporting-res,open-msft-alliance-reporting/operate/assets/agents`;

  console.log(`${updated ? 'Agent updated' : 'Agent deployed'}! ID: ${agentId}${version}`);

  return {
    success: true,
    deploymentId: agentId,
    endpoint: portalUrl,
    message: `Agent "${agent.name}" ${updated ? 'updated in' : 'deployed to'} Azure AI Foundry${version}.\n\nAgent ID: ${agentId}\n\nView in portal: ${portalUrl}`,
  };
}

/**
 * Test a deployed Foundry agent using the Responses API
 */
export async function testDeployedAgent(
  deploymentId: string,
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  options: {
    context?: 'standalone' | 'orchestrated';
    taskEnvelope?: unknown;
    /** When provided, replaces the Foundry-stored agent instructions entirely. */
    overrideInstructions?: string;
    confidenceMode?: 'default' | 'mobile-fnol';
  } = {},
): Promise<{
  success: boolean;
  response?: string;
  confidence?: number;
  escalateToHuman?: boolean;
  phase?: string;
  message: string;
}> {
  try {
    console.log(`Testing agent "${deploymentId}" with query: "${query}" (${history.length} prior turns, context: ${options.context || 'standalone'})`);

    const apiKey = await getApiKey();
    const projectEndpoint = getProjectEndpoint();
    const baseEndpoint = projectEndpoint.split('/api/projects/')[0];
    const model = process.env.FOUNDRY_MODEL_DEPLOYMENT_NAME || 'gpt-5.4';

    // Use override instructions if provided; otherwise fetch from deployed agent.
    let instructions: string;
    if (options.overrideInstructions) {
      instructions = options.overrideInstructions;
    } else {
      const agentData = await foundryRequest('GET', `/agents/${deploymentId}`, undefined);
      instructions = agentData?.versions?.latest?.definition?.instructions || 'You are a helpful AI agent.';
    }

    // Prepend an explicit operating-context envelope so the deployed dual-mode
    // prompt knows whether to lead a standalone conversation or behave as an
    // orchestrated sub-agent consuming a structured task.
    const contextPreamble =
      options.context
        ? `Operating context: ${options.context}\n` +
          (options.context === 'orchestrated' && options.taskEnvelope !== undefined
            ? `Task envelope: ${JSON.stringify(options.taskEnvelope)}\n`
            : '') +
          '\n'
        : '';
    const userText = `${contextPreamble}${query}`;

    // Build the Responses API input. With prior turns we send a typed message
    // array so the agent has conversation memory (multi-turn). Without history
    // we keep the simple string form for back-compat.
    const input: unknown = history.length
      ? [
          ...history.map((m) => ({
            role: m.role,
            content: [
              { type: m.role === 'assistant' ? 'output_text' : 'input_text', text: m.content },
            ],
          })),
          { role: 'user', content: [{ type: 'input_text', text: userText }] },
        ]
      : userText;

    // Use Responses API for inference
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${baseEndpoint}/openai/v1/responses`, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, instructions, input }),
        signal: controller.signal,
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Foundry Responses API timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      throw error;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Responses API error (${response.status}): ${err}`);
    }

    const data = await response.json() as any;
    const rawText: string = data?.output?.[0]?.content?.[0]?.text ?? 'No response';

    // Strip the [ESCALATE_TO_HUMAN] sentinel server-side so it never reaches
    // the UI, TTS, or conversation history.
    const escalateToHuman = rawText.includes('[ESCALATE_TO_HUMAN]');

    // Parse the optional [PHASE:NAME] step marker the FNOL agent appends on its
    // own final line. Whitelisted + line-anchored so stray prose can't trip it,
    // and never accepts SUBMITTED (submission is an explicit server action).
    const phaseMatch = rawText.match(
      /^[ \t]*\[PHASE:(GREETING|POLICY_VERIFY|INCIDENT_CAPTURE|DETAILS|EVIDENCE|CONSENT|SUMMARY)\][ \t]*$/m,
    );
    const phase = phaseMatch ? phaseMatch[1] : undefined;

    const responseText = rawText
      .replace(/\[ESCALATE_TO_HUMAN\]\s*/g, '')
      .replace(/\[PHASE:[A-Z_]+\]\s*/gi, '')
      .trim();
    const confidence =
      options.confidenceMode === 'mobile-fnol'
        ? estimateMobileFnolConfidence({
            responseText,
            historyLength: history.length,
            escalateToHuman,
            phase,
          })
        : 0.85;

    console.log(`? Agent responded successfully${escalateToHuman ? ' (escalation requested)' : ''}${phase ? ` (phase: ${phase})` : ''}`);

    return {
      success: true,
      response: responseText,
      confidence,
      escalateToHuman,
      phase,
      message: 'Test query executed successfully',
    };
  } catch (error) {
    console.error('Failed to test agent:', error);
    return {
      success: false,
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Cache of deployed-agent instructions keyed by deployment id. The deployed
// agent's prompt rarely changes mid-session, so we cache it (5 min TTL) to
// avoid a Foundry round-trip on every chat turn.
const agentInstructionsCache = new Map<string, { instructions: string; expiresMs: number }>();
const AGENT_INSTRUCTIONS_TTL_MS = 5 * 60_000;

/**
 * Fetch the latest deployed instructions (system prompt) for a Foundry agent by
 * deployment id. Cached for 5 minutes. Returns null if the agent cannot be
 * fetched so callers can fall back to a local prompt.
 */
export async function getDeployedAgentInstructions(deploymentId: string): Promise<string | null> {
  const now = Date.now();
  const cached = agentInstructionsCache.get(deploymentId);
  if (cached && cached.expiresMs > now) {
    return cached.instructions;
  }
  try {
    const agentData = await foundryRequest('GET', `/agents/${deploymentId}`, undefined);
    const instructions: string | undefined = agentData?.versions?.latest?.definition?.instructions;
    if (!instructions) return null;
    agentInstructionsCache.set(deploymentId, {
      instructions,
      expiresMs: now + AGENT_INSTRUCTIONS_TTL_MS,
    });
    return instructions;
  } catch (err) {
    console.warn(`[foundry] Failed to fetch instructions for agent "${deploymentId}":`, err);
    return null;
  }
}

function extractSystemPrompt(markdown: string): string {
  const match = markdown.match(/## System Prompt\s+([\s\S]*?)(?=\n## |$)/);
  return match ? match[1].trim() : markdown.substring(0, 2000);
}

function sanitizeAgentName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '-')  // underscores → hyphens, strip anything else
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')               // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '')           // strip leading/trailing hyphens
    .toLowerCase()
    .substring(0, 63);
}
