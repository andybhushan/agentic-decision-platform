import {
  AIGenerateAgentRequest,
  AIGenerateAgentResponse,
  AIGeneratePromptRequest,
  AIGeneratePromptResponse,
  AISimulateRequest,
  AISimulateResponse,
  AIClaimAssistRequest,
  AIClaimAssistResponse,
} from '../../types';

/**
 * Abstract interface for AI providers
 */
export interface AIProvider {
  name: string;
  
  generateAgent(request: AIGenerateAgentRequest): Promise<AIGenerateAgentResponse>;
  generatePrompt(request: AIGeneratePromptRequest): Promise<AIGeneratePromptResponse>;
  simulate(request: AISimulateRequest): Promise<AISimulateResponse>;
  claimAssist(request: AIClaimAssistRequest): Promise<AIClaimAssistResponse>;
  assessClaimConfidence(signals: ClaimConfidenceSignals): Promise<{ score: number; rationale: string }>;
  testConnection(): Promise<boolean>;
}

/** Structured claim signals passed to the LLM for confidence assessment. */
export interface ClaimConfidenceSignals {
  claimId: string;
  incidentType: string;
  complexity: string;
  stage: string;
  coverageApplicability: string;
  straightThroughEligible: boolean;
  injuryIndicated: boolean;
  /** e.g. "4 confirmed, 1 inferred, 0 pending, 0 disputed (5 total)" */
  narrativeSummary: string;
  /** e.g. "3 verified, 1 pending, 0 disputed (4 total)" */
  evidenceSummary: string;
  /** e.g. "none" or "1 high-severity, 1 medium-severity" */
  anomalySummary: string;
  estimatedAmount: number;
}

/**
 * Factory to create AI provider instances
 */
export class AIProviderFactory {
  static create(): AIProvider {
    return new FoundryAIProvider();
  }
}

/**
 * Azure AI Foundry Provider - uses the Foundry Responses API for all AI operations
 */
class FoundryAIProvider implements AIProvider {
  name = 'Azure AI Foundry';

  private get endpoint(): string {
    const ep = process.env.FOUNDRY_PROJECT_ENDPOINT;
    if (ep) return ep.replace(/\/$/, '');

    const accountName = process.env.FOUNDRY_ACCOUNT_NAME;
    const projectName = process.env.FOUNDRY_PROJECT_NAME;
    if (accountName && projectName) {
      return `https://${accountName}.services.ai.azure.com/api/projects/${projectName}`;
    }

    throw new Error('FOUNDRY_PROJECT_ENDPOINT not configured');
  }

  private get apiKey(): string {
    const key = process.env.FOUNDRY_API_KEY;
    if (!key) throw new Error('FOUNDRY_API_KEY not set in .env');
    return key;
  }

  private get model(): string {
    return process.env.FOUNDRY_MODEL_DEPLOYMENT_NAME || 'gpt-5.4';
  }

  private async chat(instructions: string, input: string): Promise<string> {
    const baseEndpoint = this.endpoint.split('/api/projects/')[0];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch(`${baseEndpoint}/openai/v1/responses`, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: this.model, instructions, input }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Foundry API error (${response.status}): ${err}`);
      }

      const data = await response.json() as any;
      return data?.output?.[0]?.content?.[0]?.text ?? '';
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Foundry API request timed out after 90000ms');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractJson(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) return text.slice(start, end + 1);
    return text;
  }

  async generateAgent(request: AIGenerateAgentRequest): Promise<AIGenerateAgentResponse> {
    const instructions = `You are an expert AI agent architect. Generate a detailed agent specification as JSON.
Return ONLY valid JSON matching this schema:
{
  "agent": {
    "name": "string",
    "description": "string",
    "verticalId": "string",
    "archetype": "Analyst|Coordinator|Specialist|Validator|Communicator|Auditor|Optimizer",
    "authorityLevel": "Low|Medium|High|Critical",
    "inputs": [{"name":"string","type":"string|number|boolean|object|array","description":"string","required":true,"example":null}],
    "outputs": [{"name":"string","type":"string|number|boolean|object|array","description":"string","example":null}],
    "governanceControls": [{"type":"confidence_threshold|human_review|data_validation|compliance_check|escalation_rule|audit_logging|rate_limiting|access_control","description":"string","enabled":true,"parameters":{}}],
    "capabilities": ["string"],
    "limitations": ["string"],
    "version": "1.0.0"
  },
  "confidence": 0.0-1.0,
  "suggestions": ["string"]
}`;

    const input = `Generate an agent specification for:
Description: ${request.description}
Vertical ID: ${request.verticalId}
${request.archetype ? `Archetype: ${request.archetype}` : ''}
${request.requirements?.length ? `Requirements:\n- ${request.requirements.join('\n- ')}` : ''}`;

    const content = await this.chat(instructions, input);

    try {
      const parsed = JSON.parse(this.extractJson(content));
      parsed.agent.verticalId = request.verticalId;
      if (request.archetype) parsed.agent.archetype = request.archetype;
      return parsed as AIGenerateAgentResponse;
    } catch {
      throw new Error('Failed to parse Foundry response as valid agent specification');
    }
  }

  async generatePrompt(request: AIGeneratePromptRequest): Promise<AIGeneratePromptResponse> {
    const instructions = `You are a prompt engineering expert. Generate a system prompt and user prompt for an AI agent.
Return ONLY valid JSON: {"prompt":"string","systemPrompt":"string","tokens":number}`;

    const input = `Generate prompts for agent ${request.agentId} processing this input:
${JSON.stringify(request.input, null, 2)}
${request.context ? `Context: ${JSON.stringify(request.context, null, 2)}` : ''}`;

    const content = await this.chat(instructions, input);

    try {
      return JSON.parse(this.extractJson(content)) as AIGeneratePromptResponse;
    } catch {
      throw new Error('Failed to parse Foundry response as valid prompt');
    }
  }

  async simulate(request: AISimulateRequest): Promise<AISimulateResponse> {
    const startTime = Date.now();

    const instructions = `You are simulating an AI agent's execution. Analyze the input and produce a realistic output.
Return ONLY valid JSON:
{
  "output": {},
  "confidence": 0.0-1.0,
  "governanceChecks": [{"controlType":"string","passed":true,"message":"string"}],
  "tokensUsed": number,
  "escalated": false,
  "escalationReason": null
}`;

    const input = `Simulate agent ${request.agentId} processing:
Input: ${JSON.stringify(request.input, null, 2)}
${request.context ? `Context: ${JSON.stringify(request.context, null, 2)}` : ''}`;

    const content = await this.chat(instructions, input);
    const executionTime = Date.now() - startTime;

    try {
      const parsed = JSON.parse(this.extractJson(content));
      parsed.executionTime = executionTime;
      return parsed as AISimulateResponse;
    } catch {
      throw new Error('Failed to parse Foundry simulation response');
    }
  }

  async claimAssist(request: AIClaimAssistRequest): Promise<AIClaimAssistResponse> {
    const instructions = `You are "AI Steward", an expert insurance claims decision assistant.
You help a human claims adjuster reason about a specific claim. Be concise, accurate and grounded
strictly in the provided claim context. Do not invent facts that are not present in the context.
Return ONLY valid JSON matching this schema:
{
  "message": "string - a direct, helpful answer to the adjuster's command",
  "confidence": 0.0-1.0,
  "suggestedActions": ["string - up to 3 concrete follow-up actions"]
}`;

    const input = `Claim context:
${request.claimContext}

Adjuster command:
${request.command}`;

    const content = await this.chat(instructions, input);

    try {
      const parsed = JSON.parse(this.extractJson(content));
      return {
        message: String(parsed.message ?? ''),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        suggestedActions: Array.isArray(parsed.suggestedActions)
          ? parsed.suggestedActions.map((a: unknown) => String(a)).slice(0, 3)
          : [],
      };
    } catch {
      throw new Error('Failed to parse Foundry claim assist response');
    }
  }

  async assessClaimConfidence(signals: ClaimConfidenceSignals): Promise<{ score: number; rationale: string }> {
    const instructions = `You are an AI claims confidence assessment engine for an insurance company.
Given structured claim signals, return an integer confidence score from 0–100 representing how
confident the AI system is that this claim is valid, accurately valued, and ready for a decision.

Score bands:
90–100 Exceptional — all evidence verified, narrative fully confirmed, no anomalies, clear coverage, straightforward claim type. Auto-approve eligible.
80–89  Strong — mostly confirmed, minor gaps only, standard scenario.
65–79  Moderate — some pending evidence or inferred elements, manageable complexity.
50–64  Uncertain — disputed elements, pending investigation, or coverage ambiguity.
30–49  Low — significant concerns, multiple disputes, potential fraud indicators.
0–29   Critical — strong fraud signals or fundamentally contested claim.

Return ONLY valid JSON: {"score": <integer 0-100>, "rationale": "<one sentence explaining the score>"}`;

    const input = `Claim signals:
- Claim ID: ${signals.claimId}
- Incident type: ${signals.incidentType}
- Complexity: ${signals.complexity}
- Stage: ${signals.stage}
- Coverage: ${signals.coverageApplicability}
- Straight-through eligible: ${signals.straightThroughEligible}
- Injury indicated: ${signals.injuryIndicated}
- Narrative: ${signals.narrativeSummary}
- Evidence: ${signals.evidenceSummary}
- Anomalies: ${signals.anomalySummary}
- Estimated settlement amount: $${signals.estimatedAmount.toLocaleString()}`;

    const content = await this.chat(instructions, input);

    try {
      const parsed = JSON.parse(this.extractJson(content));
      const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
      return { score, rationale: String(parsed.rationale ?? '') };
    } catch {
      throw new Error('Failed to parse Foundry confidence assessment response');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat('You are a test agent.', 'Hello');
      return true;
    } catch {
      return false;
    }
  }
}