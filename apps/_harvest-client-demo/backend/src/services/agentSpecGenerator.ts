import { Agent } from '../types';

interface GeneratedAgentArtifacts {
  specification: string;
  foundryPrompt: string;
  reviewerSummary: string;
}

interface AIReviewResult {
  specification: string;
  foundryPrompt: string;
  reviewerSummary: string;
}

const DEFAULT_REVIEW_TIMEOUT_MS = 90000;
const MAX_SPEC_COMPLETION_TOKENS = 16000;
const MAX_PARSE_RETRIES = 3;

export async function generateAgentSpec(agent: Agent): Promise<GeneratedAgentArtifacts> {
  // Some agents in the catalog have no explicit governanceProfile. Rather than
  // failing the whole request, synthesize a sensible default from the agent's
  // own fields so every agent can generate a specification.
  const normalizedAgent: Agent = agent.governanceProfile
    ? agent
    : { ...agent, governanceProfile: buildDefaultGovernanceProfile(agent) };

  const draftFoundryPrompt = buildFoundryPromptDraft(normalizedAgent);
  const draftSpecification = buildSpecificationDraft(normalizedAgent, draftFoundryPrompt);
  const reviewTimeoutMs = getReviewTimeoutMs();

  // The draft above is only the seed sent to the Foundry model. The returned
  // specification/prompt MUST come from Azure AI Foundry. There is no rule-based
  // fallback: if Foundry fails, the error propagates to the caller.
  return reviewSpecWithFoundry(
    normalizedAgent,
    draftSpecification,
    draftFoundryPrompt,
    reviewTimeoutMs
  );
}

function buildDefaultGovernanceProfile(agent: Agent): NonNullable<Agent['governanceProfile']> {
  const authorityLevel = (agent.authorityLevel || 'Medium').toString();
  const boundaries =
    agent.limitations && agent.limitations.length > 0
      ? agent.limitations
      : ['Operate strictly within the stated capabilities and domain.'];
  const humanInTheLoop =
    agent.escalationCriteria && agent.escalationCriteria.length > 0
      ? agent.escalationCriteria
      : ['Escalate any low-confidence, high-impact, or out-of-policy decision to a human supervisor.'];

  return {
    authorityLevel: authorityLevel.toLowerCase(),
    escalationPath: 'Human supervisor',
    autonomyDescription: `Acts as a ${agent.archetype} with ${authorityLevel} authority in the ${agent.verticalId} domain, deferring to a human for anything outside its bounded scope.`,
    boundaries,
    humanInTheLoop,
    confidenceThresholds: {
      minimum: 0.6,
      reviewRequired: 0.8,
    },
  };
}

function buildFoundryPromptDraft(agent: Agent): string {
  const gp = agent.governanceProfile;
  const confidenceMinimum = gp?.confidenceThresholds?.minimum;
  const confidenceReviewRequired = gp?.confidenceThresholds?.reviewRequired;

  return `You are ${agent.name}, a ${agent.archetype} agent operating in the ${agent.verticalId} domain for enterprise workflows.

Primary mission:
${agent.description}

Role and operating model:
- Workflow role: ${agent.workflowRole || 'Generic'}
- Authority level: ${agent.authorityLevel}
- Governance authority profile: ${gp?.authorityLevel || 'advisory'}
- Autonomy description: ${gp?.autonomyDescription || 'Not specified'}
- Escalation path: ${gp?.escalationPath || 'Supervisor'}

Capabilities (you MAY do):
${toBullets(agent.capabilities)}

Boundaries (you MUST NOT violate):
${toBullets(gp?.boundaries)}

Known limitations:
${toBullets(agent.limitations)}

Human-in-the-loop triggers:
${toBullets(gp?.humanInTheLoop)}

Escalation criteria:
${toBullets(agent.escalationCriteria)}

Governance controls to enforce:
${toBullets(
  (agent.governanceControls || []).map((control) => {
    const enabledState = control.enabled ? 'enabled' : 'disabled';
    const params = control.parameters ? ` | parameters: ${JSON.stringify(control.parameters)}` : '';
    return `${control.type}: ${control.description} (${enabledState})${params}`;
  })
)}

Confidence policy:
- Minimum confidence to proceed: ${confidenceMinimum !== undefined ? `${Math.round(confidenceMinimum * 100)}%` : 'Not configured'}
- Confidence threshold for mandatory review: ${confidenceReviewRequired !== undefined ? `${Math.round(confidenceReviewRequired * 100)}%` : 'Not configured'}

Input contract (required schema):
${toBullets(
  (agent.inputs || []).map((input) => `${input.name} [${input.type}] ${input.required ? '(required)' : '(optional)'}: ${input.description}`)
)}

Output contract (must be respected):
${toBullets(
  (agent.outputs || []).map((output) => `${output.name} [${output.type}]: ${output.description}`)
)}

${buildInteractionSection(agent)}

${buildOperatingModesSection(agent)}

${agent.systemPrompt ? `Base domain instructions:\n${agent.systemPrompt}` : 'Base domain instructions: none provided.'}`;
}

function operatingModesFor(agent: Agent): string[] {
  const modes = agent.operatingModes && agent.operatingModes.length ? agent.operatingModes : ['standalone'];
  return modes;
}

function buildOperatingModesSection(agent: Agent): string {
  const modes = operatingModesFor(agent);
  const supportsStandalone = modes.includes('standalone');
  const supportsOrchestrated = modes.includes('orchestrated');

  if (supportsStandalone && supportsOrchestrated) {
    return `Operating context (IMPORTANT — detect this on every turn):
You can run in TWO contexts and MUST adapt your behaviour to whichever applies. At the start of the input you will be told the operating context explicitly (e.g. "Operating context: standalone" or "Operating context: orchestrated"). If it is not stated, infer it: a direct message from an end user ⇒ standalone; a structured task envelope handed to you by a parent orchestrator ⇒ orchestrated.
- STANDALONE: you are the primary point of contact for the end user. Greet once, lead the interaction (per your interaction style above), and drive it through to producing your defined outputs.
- ORCHESTRATED: you are one step inside a wider orchestration. Do NOT greet, do NOT chit-chat, and do NOT ask the user open questions. Consume the structured task envelope from the parent orchestrator, perform only your task, and return ONLY structured output matching your output contract (no conversational filler). If required inputs are missing, return a structured request for exactly those fields rather than starting a conversation.`;
  }

  if (supportsOrchestrated) {
    return `Operating context: ORCHESTRATED ONLY.
You are always invoked as a step inside a wider orchestration. Do not greet or hold a conversation. Consume the structured task envelope from the parent orchestrator, perform only your task, and return ONLY structured output matching your output contract. If required inputs are missing, return a structured request for exactly those fields.`;
  }

  return `Operating context: STANDALONE ONLY.
You are the primary point of contact for the end user and own the interaction end-to-end, following your interaction style above.`;
}

function buildInteractionSection(agent: Agent): string {
  const requiredInputs = (agent.inputs || []).filter((i) => i.required).map((i) => i.name);
  const checklist = requiredInputs.length ? requiredInputs.join(', ') : 'the required inputs above';

  if (agent.interactionStyle === 'hybrid') {
    return `Interaction style: HYBRID (manifest intake + targeted clarification conversation)
You combine one-shot bundle processing with a focused follow-up conversation. Apply this on every engagement:
1. INGEST FIRST. A submission arrives as a manifest — structured data plus free text and/or attachments (documents, images, transcripts). Take in the WHOLE bundle at once; never open by asking the user a question before you have processed what they already gave you.
2. EXTRACT IN ONE PASS. Pull every field you can from the manifest, and for each one record a value, a confidence, and where it came from (its source in the bundle). Do not fabricate a value to fill a gap — leave unsupported fields explicitly empty.
3. ASSESS COMPLETENESS against the required inputs (${checklist}). Determine exactly which required fields are still missing or sit below the confidence policy above.
4. ONLY THEN CONVERSE, and only about the gaps. Raise the outstanding items together in a single concise, friendly clarification message (group related gaps) rather than a robotic one-question-at-a-time interview. Never re-ask for anything the manifest already answered.
5. ITERATE. The user's reply may itself carry more data or attachments — fold it back into the manifest, re-extract, and re-check completeness. Continue until the required inputs are satisfied or an item must be escalated.
6. Acknowledge what you received, keep messages short and human, do not output JSON to the user, and do not expose internal field names.
7. When the required inputs are complete (or routed for review), play back a short summary and produce your defined outputs.
Throughout, you MUST enforce every boundary, governance control, the confidence policy, and the escalation criteria above.`;
  }

  if (agent.interactionStyle === 'conversational') {
    return `Interaction style: CONVERSATIONAL (multi-turn interview)
You gather what you need through a natural, back-and-forth conversation. Apply these rules on every turn:
1. On the very first turn only, open with a brief, friendly greeting, then immediately ask for the first piece of information.
2. Ask for ONE piece of information at a time. Never present the full list of questions, and never emit a numbered questionnaire in a single message.
3. Wait for the user's answer before asking the next question. Use the conversation so far to know what has already been provided.
4. Track — internally, never shown to the user — which required inputs are still outstanding (${checklist}) and ask only for the next missing one. Never re-ask for something already answered; skip inputs the user has already supplied.
5. Briefly acknowledge each answer in one short sentence, then ask a context-aware follow-up if the answer is missing, unclear, or inconsistent.
6. Validate each value against the input contract as it is provided. If a value is invalid, explain the problem in one sentence and ask again for just that item.
7. Once every required input is collected, play back a short summary and ask the user to confirm before you finalise or hand off.
8. Keep every message short and human. Do not lecture, do not output JSON, and do not expose internal field names to the user.
Throughout the conversation you MUST still enforce every boundary, governance control, the confidence policy, and the escalation criteria above.`;
  }

  return `Interaction style: TRANSACTIONAL (single-shot processing)
Execution requirements:
1. Validate required inputs before processing.
2. Explicitly state confidence and key assumptions in your reasoning.
3. If confidence is low, policy is ambiguous, or constraints are violated, escalate using the configured path.
4. Do not fabricate external data sources or integrations.
5. Keep outputs aligned to the output contract and avoid unsupported fields.`;
}

function buildSpecificationDraft(agent: Agent, foundryPrompt: string): string {
  const gp = agent.governanceProfile;
  const generatedAt = new Date().toISOString();

  return `---
agent_id: ${agent.id}
agent_name: ${agent.name}
version: ${agent.version}
generated_at: ${generatedAt}
workflow_role: ${agent.workflowRole || 'Generic'}
archetype: ${agent.archetype}
authority_level: ${agent.authorityLevel}
governance_authority: ${gp?.authorityLevel || 'advisory'}
---

# ${agent.name}

## 1. Purpose and Mission
${agent.description}

## 2. Role and Responsibilities
- Vertical: ${agent.verticalId}
- Workflow Role: ${agent.workflowRole || 'Generic'}
- Archetype: ${agent.archetype}
- Authority Level: ${agent.authorityLevel}
- Interaction Style: ${agent.interactionStyle === 'conversational' ? 'Conversational (step-by-step interview, one question at a time)' : agent.interactionStyle === 'hybrid' ? 'Hybrid (manifest intake in one pass, then targeted clarification conversation for gaps)' : 'Transactional (single-shot processing)'}
- Operating Contexts: ${operatingModesFor(agent).join(', ')}
- Autonomy Description: ${gp?.autonomyDescription || 'Not specified'}

### Core capabilities
${toNumberedList(agent.capabilities)}

## 3. Scope, Boundaries, and Constraints
### Hard boundaries
${toBullets(gp?.boundaries)}

### Operational limitations
${toBullets(agent.limitations)}

## 4. Input and Output Contracts
### Inputs
${toBullets(
  (agent.inputs || []).map(
    (input) =>
      `**${input.name}** (${input.type})${input.required ? ' [REQUIRED]' : ''}: ${input.description}${
        input.validation ? ` | validation: ${input.validation}` : ''
      }`
  )
)}

### Outputs
${toBullets(
  (agent.outputs || []).map((output) => `**${output.name}** (${output.type}): ${output.description}`)
)}

## 5. Governance Policy
### Human-in-the-loop requirements
${toBullets(gp?.humanInTheLoop)}

### Escalation criteria
${toBullets(agent.escalationCriteria)}

### Escalation path
${gp?.escalationPath || 'Supervisor'}

### Confidence thresholds
- Minimum confidence: ${gp?.confidenceThresholds?.minimum !== undefined ? `${Math.round(gp.confidenceThresholds.minimum * 100)}%` : 'Not configured'}
- Review required threshold: ${gp?.confidenceThresholds?.reviewRequired !== undefined ? `${Math.round(gp.confidenceThresholds.reviewRequired * 100)}%` : 'Not configured'}

### Governance controls
${toBullets(
  (agent.governanceControls || []).map((control) => {
    const state = control.enabled ? 'enabled' : 'disabled';
    const params = control.parameters ? ` | parameters: ${JSON.stringify(control.parameters)}` : '';
    return `${control.type}: ${control.description} (${state})${params}`;
  })
)}

## 6. Azure AI Foundry Prompt
\`\`\`text
${foundryPrompt}
\`\`\`

## 7. Deployment and Validation Checklist
- [ ] Prompt enforces all boundaries and limitations
- [ ] Required input validation is present
- [ ] Output contract is explicit and testable
- [ ] Confidence thresholds and escalation path are operational
- [ ] Human-in-the-loop triggers are represented in policy
- [ ] Governance controls are enabled and auditable
- [ ] Edge cases and low-confidence scenarios are covered

---
Generated by Agent Workflow Builder`;
}

function buildAIReviewPrompt(agent: Agent, spec: string, foundryPrompt: string): string {
  const interactionConstraint =
    agent.interactionStyle === 'conversational'
      ? `\nNON-NEGOTIABLE: This is a CONVERSATIONAL agent. The foundryPrompt MUST instruct the agent to gather information through a multi-turn interview, asking ONE question at a time and waiting for the answer before the next. It MUST NOT tell the agent to ask for everything at once or present a numbered questionnaire. Preserve and strengthen this behaviour; do not rewrite it into single-shot/transactional processing.`
      : agent.interactionStyle === 'hybrid'
        ? `\nNON-NEGOTIABLE: This is a HYBRID agent. The foundryPrompt MUST keep BOTH behaviours: (1) ingest a manifest of structured data plus free text and/or attachments in a single pass and extract from it BEFORE asking the user anything; and (2) only AFTER processing the bundle, hold a targeted clarification conversation about the remaining gaps (group related gaps into a concise message, not a one-question-at-a-time interview), folding any new data/attachments from replies back into the manifest. Do not collapse it into a pure single-shot transactional flow, and do not turn it into an open-ended interview that ignores the submitted manifest.`
        : `\nThis is a TRANSACTIONAL agent: keep single-shot processing semantics; do not turn it into a chat/interview flow.`;

  const operatingModes = operatingModesFor(agent);
  const operatingConstraint =
    operatingModes.includes('standalone') && operatingModes.includes('orchestrated')
      ? `\nNON-NEGOTIABLE: This agent is DUAL-CONTEXT (standalone and orchestrated). The foundryPrompt MUST keep both operating contexts and the rule that the agent detects which one applies: standalone = leads the user interaction; orchestrated = no greeting, consumes a structured task envelope from a parent orchestrator and returns ONLY structured output. Do not collapse this into a single mode.`
      : operatingModes.includes('orchestrated')
        ? `\nNON-NEGOTIABLE: This agent runs ORCHESTRATED ONLY. The foundryPrompt MUST keep it non-conversational: it consumes a structured task envelope and returns structured output, no greeting or chit-chat.`
        : `\nThis agent runs STANDALONE: it owns the user interaction end-to-end.`;

  // Trim the agent object to only the fields needed for the review (omit large generated artifacts)
  const agentSummary = {
    id: agent.id,
    name: agent.name,
    version: agent.version,
    archetype: agent.archetype,
    verticalId: agent.verticalId,
    workflowRole: agent.workflowRole,
    authorityLevel: agent.authorityLevel,
    interactionStyle: agent.interactionStyle,
    operatingModes: agent.operatingModes,
    description: agent.description,
    capabilities: agent.capabilities,
    limitations: agent.limitations,
    escalationCriteria: agent.escalationCriteria,
    inputs: agent.inputs,
    outputs: agent.outputs,
    governanceProfile: agent.governanceProfile,
    governanceControls: agent.governanceControls,
  };

  return `Review and improve this agent specification and Foundry prompt.

Goals:
1. Make the Foundry prompt significantly richer and operational.
2. Ensure it reflects the exact fields selected in the current agent details view.
3. Strengthen governance, confidence handling, escalation behavior, and output contract clarity.
4. Keep the style production-ready and specific to this agent.
${interactionConstraint}
${operatingConstraint}

Return JSON with exactly this shape:
{
  "foundryPrompt": "string",
  "specification": "string",
  "reviewerSummary": "string"
}

Agent summary:
${JSON.stringify(agentSummary, null, 2)}

Current draft Foundry prompt:
${foundryPrompt}

Current draft specification:
${spec}`;
}

function parseReviewJSON(content: string): AIReviewResult | null {
  const trimmed = content.trim();
  const direct = safeParse(trimmed);
  if (direct) return direct;

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return safeParse(fencedMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return safeParse(trimmed.substring(firstBrace, lastBrace + 1));
  }

  return null;
}

function safeParse(candidate: string): AIReviewResult | null {
  try {
    const parsed = JSON.parse(candidate) as Partial<AIReviewResult>;
    if (
      typeof parsed.foundryPrompt === 'string' &&
      typeof parsed.specification === 'string'
    ) {
      return {
        foundryPrompt: parsed.foundryPrompt,
        specification: parsed.specification,
        reviewerSummary:
          typeof parsed.reviewerSummary === 'string' && parsed.reviewerSummary.trim().length > 0
            ? parsed.reviewerSummary
            : 'Foundry model reviewed and refined the draft specification and prompt.',
      };
    }
    return null;
  } catch {
    return null;
  }
}

function toBullets(items?: string[]): string {
  if (!items || items.length === 0) {
    return '- None specified';
  }
  return items.map((item) => `- ${item}`).join('\n');
}

function toNumberedList(items?: string[]): string {
  if (!items || items.length === 0) {
    return '1. None specified';
  }
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.FOUNDRY_API_KEY;
  if (!apiKey) {
    throw new Error('FOUNDRY_API_KEY not set in .env');
  }
  return { 'api-key': apiKey };
}

export async function reviewSpecWithFoundry(
  agent: Agent,
  draftSpecification: string,
  draftFoundryPrompt: string,
  timeoutMs: number
): Promise<AIReviewResult> {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  const model = process.env.FOUNDRY_MODEL_DEPLOYMENT_NAME;
  if (!endpoint) {
    throw new Error('FOUNDRY_PROJECT_ENDPOINT not set in .env');
  }
  if (!model) {
    throw new Error('FOUNDRY_MODEL_DEPLOYMENT_NAME not set in .env');
  }

  const authHeaders = await getAuthHeaders();
  const baseEndpoint = endpoint.split('/api/projects/')[0];

  // Use Chat Completions (much faster than the Responses API)
  const chatUrl = `${baseEndpoint}/openai/deployments/${model}/chat/completions?api-version=2024-08-01-preview`;
  let lastError: unknown = null;
  let lastText = '';

  for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        chatUrl,
        {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert AI agent architect and governance reviewer. Return strict JSON with exactly three fields: foundryPrompt (string), specification (string), reviewerSummary (string). No markdown, no explanation — only the JSON object.',
              },
              {
                role: 'user',
                content: buildAIReviewPrompt(agent, draftSpecification, draftFoundryPrompt),
              },
            ],
            max_completion_tokens: MAX_SPEC_COMPLETION_TOKENS,
            response_format: { type: 'json_object' },
          }),
        },
        timeoutMs
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Foundry chat completions API failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
      };
      const choice = payload.choices?.[0];
      const text = choice?.message?.content;

      if (!text) {
        throw new Error('Foundry chat completions API returned no content');
      }

      lastText = text;
      const parsed = parseReviewJSON(text);
      if (parsed) {
        return parsed;
      }

      if (choice?.finish_reason && choice.finish_reason !== 'stop') {
        console.warn(`Foundry spec review attempt ${attempt} ended with finish_reason=${choice.finish_reason}`);
      }
      throw new Error(
        `Foundry chat completions output was not valid JSON in required shape. Raw prefix: ${lastText.slice(0, 400)}`
      );
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Foundry spec review attempt ${attempt}/${MAX_PARSE_RETRIES} failed: ${message}`);
      if (attempt < MAX_PARSE_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
        continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Foundry spec review failed after multiple attempts');
}

function getReviewTimeoutMs(): number {
  const raw = Number(process.env.AGENT_SPEC_REVIEW_TIMEOUT_MS || DEFAULT_REVIEW_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw < 1000) {
    return DEFAULT_REVIEW_TIMEOUT_MS;
  }
  return Math.floor(raw);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
