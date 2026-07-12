import {
  StewardChatRequest,
  StewardChatResponse,
  StewardContext,
  StewardPageContext,
  Conversation,
  ConversationMessage,
  RetrievedSource,
  ChatCompletionRequest,
  ChatCompletionResponse,
  IndexingJobRequest,
  IndexingJobStatus,
  BriefingData,
  PageClaimSummary,
} from '../../types/steward';
import { CosmosServiceInterface, CosmosServiceFactory } from '../cosmos/cosmosService';
import { ClaimsIndexer } from '../cosmos/claimsIndexer';
import { testDeployedAgent, getDeployedAgentInstructions } from '../foundryAgentDeployer';
import { CosmosRepository } from '../cosmosRepository';
import { getControlBlock, searchSops } from './sopService';
import type { Claim } from '../../types';

const claimsRepo = new CosmosRepository<Claim>('claims');

/** Foundry deployment id of the published Digital Steward agent. The chat path
 * uses this agent's deployed instructions as its base persona so the agent can
 * be iterated in Foundry without code changes. */
const STEWARD_DEPLOYMENT_ID = process.env.STEWARD_DEPLOYMENT_ID || 'digital-steward';

/** Operational rules specific to the in-app Steward UI that are layered on top
 * of the deployed agent persona. These cover live-data grounding behaviours the
 * generic deployed prompt does not (and should not) encode. */
const STEWARD_OPERATIONAL_ADDENDUM = `
--- OPERATIONAL CONTEXT (in-app assistant) ---
You are assisting insurance claims adjuster Priya Patel inside her claims workspace.
- You have FULL access to the live claims database via the CURRENT PAGE DATA and RELEVANT CLAIMS DATA provided below.
- When a focused claim record is provided, treat it as the live full claim record for that claim, including uploaded evidence.
- The visible all-claims list is a routing summary for what is on screen; do not mistake that summary list for the limit of your access.
- NEVER imply limited or screen-only access. NEVER hedge with "from what I can see", "based on the queue display", or similar.
- Resolve claimant first names to claim IDs using the data below; never ask for a claim ID you can infer by name.
- Be concise and direct — Priya is a busy adjuster.
- AGENTIC ACTIONS: You CAN execute escalation and routing actions when explicitly instructed. When you confirm an escalation to SIU or the fraud team has been executed, say so clearly and confirm what happened.
- For non-action queries you are ADVISORY ONLY: decline to approve, deny, or settle claims.
- COMPARATIVE RANKING: When asked "why this claim and not <other>", "why is X ranked above Y", or "why not <name> first", you MUST answer by comparing the two claims on the published ranking signals in order: (1) client service tier (Masterpiece Signature > Masterpiece > Premier > Core), (2) AI confidence score, (3) queue age, (4) financial exposure — plus the variety rule (at most one fraud/SIU case in the top three). Name BOTH claims, cite each one's signals from the data below, and state the specific signal that breaks the tie. Never say you cannot compare them or that ranking is unavailable — the RECOMMENDED RANKING and its methodology are provided below.
- Only say data is unavailable if it genuinely does not exist in any source provided below.
--- END OPERATIONAL CONTEXT ---`;

const STEWARD_SYSTEM_PROMPT = `You are the Digital Steward, an AI assistant helping insurance claims adjuster Priya Patel manage her claims portfolio.

ROLE AND BOUNDARIES:
- You have full access to the claims database via CURRENT QUEUE DATA and RELEVANT CLAIMS DATA provided below.
- You help Priya find information, summarize claims, identify patterns, prioritise work, and navigate complex claim histories.
- You are ADVISORY ONLY. You do NOT make coverage determinations, approve/deny claims, or authorize settlements.
- Always cite the specific claim data you reference.

DATA ACCESS — YOU HAVE FULL DATABASE ACCESS:
1. CURRENT PAGE DATA (below): Contains the live focused-claim record when available, plus route summaries for visible claims on the page.
2. RELEVANT CLAIMS DATA (below): Additional detail retrieved from the claims database for this query.
3. Your insurance domain knowledge: Use for context only, never to invent claim-specific facts.

RESPONSE RULES:
- NEVER say "what's visible from the queue", "what's on screen", "based on the queue display", or any phrase implying limited data access. You have the full database.
- NEVER qualify your answer with "from what I can see" or similar hedges about data access.
- Always answer as if you have complete information about every claim — because you do.
- Be concise and direct — Priya is a busy adjuster, not an analyst.
- Resolve claimant first names to claim IDs using CURRENT QUEUE DATA — never ask for a claim ID if you can match by name.
- If asked to make a decision (approve, deny, settle), decline — only authorized personnel can do that.
- Only say you lack information if the specific data genuinely does not exist in any data source provided.`;

/**
 * Core Digital Steward service.
 * Handles RAG-based chat for claims navigation assistance.
 */
export class StewardService {
  private _cosmos: CosmosServiceInterface | null = null;
  private _indexer: ClaimsIndexer | null = null;

  private get cosmosService(): CosmosServiceInterface {
    if (!this._cosmos) this._cosmos = CosmosServiceFactory.create();
    return this._cosmos;
  }

  private get claimsIndexer(): ClaimsIndexer {
    if (!this._indexer) this._indexer = new ClaimsIndexer(this.cosmosService);
    return this._indexer;
  }

  /**
   * Process a chat message: retrieve relevant claims context and generate a response.
   */
  async chat(request: StewardChatRequest): Promise<StewardChatResponse> {
    const context = {
      ...this.getDefaultContext(),
      ...(request.context || {}),
      claimId: request.context?.claimId || request.pageContext?.focusedClaimId,
    };
    const conversationId = request.conversationId || this.generateId();

    // ── ESCALATION INTENT DETECTION ──────────────────────────────────────────
    // Check for explicit SIU/fraud escalation BEFORE calling the AI model.
    const escalationPatterns = [
      /\b(escalate|push|refer|send|route|redirect|delegate|pass)\b.*\b(siu|fraud|special\s+investigations?)\b/i,
      /\b(siu|fraud|special\s+investigations?)\b.*\b(escalate|team|investigat|referral)\b/i,
      /\bescalate\s+with\s+(the\s+)?fraud\b/i,
    ];
    const focusedClaimId = request.pageContext?.focusedClaimId;
    const isEscalationIntent = escalationPatterns.some(p => p.test(request.message));
    let executedAction: StewardChatResponse['action'] | undefined;

    if (isEscalationIntent && focusedClaimId) {
      executedAction = await this.executeSiuEscalation(focusedClaimId, request.message);
    } else if (isEscalationIntent && !focusedClaimId) {
      // No focused claim — try to extract a claim ID from the message
      const claimMatch = request.message.match(/CLM-[\w-]+/i);
      if (claimMatch) {
        executedAction = await this.executeSiuEscalation(claimMatch[0].toUpperCase(), request.message);
      }
    }
    // ── END ESCALATION INTENT DETECTION ─────────────────────────────────────

    // Load or create conversation
    let conversation = await this.cosmosService.getConversation(conversationId, context.tenantId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        tenantId: context.tenantId,
        userId: context.userId,
        title: this.generateTitle(request.message),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      id: this.generateId(),
      role: 'user',
      content: request.message,
      timestamp: new Date().toISOString(),
    };
    conversation.messages.push(userMessage);

    // Retrieve relevant claims context via vector search
    const searchResults = await this.cosmosService.vectorSearch({
      query: request.message,
      tenantId: context.tenantId,
      filters: {
        claimId: context.claimId,
        lineOfBusiness: context.lineOfBusiness,
        region: context.region,
      },
      topK: 5,
      minSimilarity: 0.3,
    });

    // Build sources for citation
    const sources: RetrievedSource[] = searchResults.map(r => ({
      claimId: r.chunk.claimId,
      section: r.chunk.section,
      snippet: r.chunk.content.substring(0, 200),
      documentType: r.chunk.section,
      similarity: r.similarity,
      metadata: r.chunk.metadata,
    }));

    // Retrieve relevant SOP / governance controls. These are agent controls, so
    // matched sections are added to the model context and cited as sources (with
    // the SOP id in place of a claim id, tagged documentType 'sop').
    const sopResults = await searchSops(request.message, 4);
    for (const s of sopResults) {
      sources.push({
        claimId: s.chunk.sopId,
        section: s.chunk.section,
        snippet: s.chunk.content.substring(0, 200),
        documentType: 'sop',
        similarity: s.similarity,
        metadata: { sopId: s.chunk.sopId, title: s.chunk.title, version: s.chunk.version, category: s.chunk.category },
      });
    }

    // If we executed an escalation, inject the result into page context for the AI narrative
    const enrichedPageContext = executedAction
      ? {
          ...request.pageContext,
          _actionExecuted: `SIU escalation executed for claim ${executedAction.claimId}. Status: ${executedAction.status}. ${executedAction.summary}`,
        }
      : request.pageContext;

    // Generate response using retrieved context and conversation history.
    const response = await this.generateResponse(
      request.message,
      searchResults.map(r => r.chunk.content),
      conversation.messages.slice(-10), // Last 10 messages for context
      context,
      enrichedPageContext as StewardPageContext | undefined,
      sopResults.map(s => s.chunk.content)
    );

    // Add assistant message to conversation
    const assistantMessage: ConversationMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date().toISOString(),
      sources,
    };
    conversation.messages.push(assistantMessage);
    conversation.updatedAt = new Date().toISOString();

    // Persist conversation
    await this.cosmosService.upsertConversation(conversation);

    // Determine confidence based on retrieval quality
    const avgSimilarity = sources.length > 0
      ? sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length
      : 0;

    return {
      conversationId,
      message: response.content,
      sources,
      confidence: avgSimilarity,
      action: executedAction,
    };
  }

  /**
   * Execute SIU/fraud escalation for a claim:
   * 1. Fetch the claim from Cosmos
   * 2. Call the SIU Fraud Investigator agent via Foundry
   * 3. Update the claim stage to siu_review in Cosmos
   */
  private async executeSiuEscalation(claimId: string, originalMessage: string): Promise<StewardChatResponse['action']> {
    const executedAt = new Date().toISOString();
    try {
      // Fetch claim record
      const claim = await claimsRepo.findById(claimId);
      if (!claim) {
        return { type: 'escalate_siu', claimId, status: 'failed', summary: `Claim ${claimId} not found.`, executedAt };
      }

      // Find the SIU Fraud Investigator deployment ID from Cosmos
      const agentsRepo = new CosmosRepository<{ id: string; deploymentId?: string; name?: string }>('agents');
      const fraudAgent = await agentsRepo.findById('agent_claims_fraud');
      const siuDeploymentId = fraudAgent?.deploymentId || 'siu-fraud-investigator';

      // Build an investigation prompt for the SIU agent
      const claimSummary = [
        `Claim ID: ${claimId}`,
        `Claimant: ${(claim as any).claimantName || (claim as any).claimant?.name || 'Unknown'}`,
        `Incident Date: ${(claim as any).incidentDate || (claim as any).dateOfLoss || 'Unknown'}`,
        `Claim Amount: ${(claim as any).claimAmount != null ? `$${(claim as any).claimAmount}` : 'Unknown'}`,
        `Current Stage: ${(claim as any).claimStage || (claim as any).stage || 'Unknown'}`,
        `Description: ${(claim as any).description || (claim as any).incidentDescription || 'No description available'}`,
        `Risk Flags: ${JSON.stringify((claim as any).riskFlags || (claim as any).fraudIndicators || [])}`,
      ].join('\n');

      const investigationQuery = `ESCALATION REQUEST — Digital Steward has referred this claim for SIU investigation.\n\nOriginal adjuster instruction: "${originalMessage}"\n\n${claimSummary}\n\nPlease initiate a Phase 1 SIU investigation: review the claim for fraud indicators, cross-reference patterns, and provide an initial investigation assessment.`;

      // Call the SIU Fraud Investigator agent via Foundry
      console.log(`[Steward] Invoking SIU Fraud Investigator (${siuDeploymentId}) for claim ${claimId}`);
      const siuResult = await testDeployedAgent(siuDeploymentId, investigationQuery, [], {
        context: 'orchestrated',
        taskEnvelope: { claimId, source: 'digital_steward', escalatedAt: executedAt },
      });

      const siuSummary = siuResult.success && siuResult.response
        ? siuResult.response.substring(0, 500)
        : 'SIU agent review initiated — investigation queued.';

      // Update claim stage to siu_review in Cosmos
      await claimsRepo.update(claimId, {
        claimStage: 'siu_review',
        siuEscalatedAt: executedAt,
        siuEscalatedBy: 'digital_steward',
        siuInitialAssessment: siuSummary,
        updatedAt: executedAt,
      } as any);

      console.log(`[Steward] Claim ${claimId} escalated to SIU — stage updated to siu_review`);

      return {
        type: 'escalate_siu',
        claimId,
        status: 'executed',
        summary: `Claim referred to SIU Fraud Investigator. Stage updated to SIU Review. ${siuSummary}`,
        executedAt,
      };
    } catch (err: any) {
      console.error(`[Steward] SIU escalation failed for claim ${claimId}:`, err);
      return {
        type: 'escalate_siu',
        claimId,
        status: 'failed',
        summary: `Escalation failed: ${err.message || 'Unknown error'}`,
        executedAt,
      };
    }
  }

  /**
   * List conversations for a user.
   */
  async listConversations(tenantId: string, userId: string): Promise<Conversation[]> {
    return this.cosmosService.listConversations(tenantId, userId);
  }

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId: string, tenantId: string): Promise<Conversation | null> {
    return this.cosmosService.getConversation(conversationId, tenantId);
  }

  /**
   * Delete a conversation.
   */
  async deleteConversation(conversationId: string, tenantId: string): Promise<void> {
    return this.cosmosService.deleteConversation(conversationId, tenantId);
  }

  /**
   * Generate a structured morning briefing card from the current page context.
   * Asks the AI to return JSON directly; falls back to building it from page data.
   */
  async generateBriefing(pageContext: StewardPageContext): Promise<BriefingData> {
    const pageBlock = this.buildPageContextBlock(pageContext);

    const briefingSchema = `{
  "topPriority": {
    "name": "<claimant full name>",
    "claimId": "<e.g. CLM-2024-003>",
    "rank": 1,
    "tags": [{"label": "<tag text>", "color": "red|orange|yellow|green|blue"}],
    "exposure": <number only, no $ sign>,
    "blocker": "<one concise sentence>",
    "requiredAction": "<one concise sentence>",
    "whyThisFirst": "<one sentence naming the deciding signal vs the #2 claim, e.g. 'Outranks James (CLM-...) on confidence at equal HIGH priority.'>",
    "alreadyDone": ["<Agent>: <outcome — copied verbatim from a COMPLETED AGENT WORK audit line>"],
    "recommendedSteps": ["<concrete next step 1>", "<concrete next step 2>", "<concrete next step 3>"]
  },
  "actNow": [
    {
      "name": "<claimant name>",
      "claimId": "<claim ID>",
      "timeInQueue": "<e.g. 12 min, 2 hours, 1 day>",
      "urgency": "urgent|high|medium",
      "reason": "<one concise sentence describing the blocker or action needed>"
    }
  ],
  "keepAnEyeOn": [
    {
      "identifier": "<claimant name or claim ID>",
      "note": "<3-5 word note>"
    }
  ],
  "queueIntelligence": {
    "totalExposure": <number only, sum of all visible exposures>,
    "openDecisions": <number of claims still needing a decision>,
    "highPriorityCount": <number of urgent/high priority claims>,
    "fraudFlags": <number of claims flagged fraud/SIU>,
    "oldestWaiting": "<claimant name + queue age of the longest-waiting claim>",
    "note": "<one sentence tying the queue numbers into a portfolio-level insight>"
  }
}`;

    const prompt = `Using ONLY the CURRENT PAGE data below, produce a morning briefing JSON object for adjuster Priya Patel.

${pageBlock}

Return ONLY a valid JSON object matching this schema exactly. No markdown fences, no explanation, no extra text:
${briefingSchema}

Rules:
- topPriority: the #1 priority claim from the queue data above
- tags: include priority level (Urgent/High/Medium), confidence level if not "High", and queue time
  - priority colors: Urgent=red, High=orange, Medium=yellow
  - confidence colors: Low confidence=orange, Medium confidence=yellow  
  - queue time color: blue
- whyThisFirst: REQUIRED. Use the RECOMMENDED RANKING methodology — name the #2 claim and the single signal (priority/confidence/queue age/exposure) that puts this claim ahead of it.
- alreadyDone: REQUIRED. Take these VERBATIM from the "COMPLETED AGENT WORK (from the claim's audit trail)" lines for the #1 priority claim. Output one item per audit entry as "<Agent>: <outcome>". Do NOT invent, reword, summarise, or add steps that are not in the audit trail. If no completed agent work is listed, return an empty array.
- recommendedSteps: REQUIRED. 2-4 specific, sequenced actions to move the top claim forward (resolve the blocker, request a named piece of evidence, schedule a call, escalate). Be concrete, not generic — this is the value the plain queue cards do NOT provide.
- queueIntelligence: REQUIRED. Compute portfolio-level numbers across ALL visible claims (not just the top one). The note should give Priya a one-line read on her whole queue.
- actNow: claims 2 through 5 ordered by urgency (max 5 items)
- keepAnEyeOn: remaining notable items, max 3, very short notes
- Return ONLY the JSON. No markdown.`;

    try {
      const result = await testDeployedAgent(
        process.env.FOUNDRY_MODEL_DEPLOYMENT_NAME || 'gpt-5.4',
        prompt,
        [],
        { overrideInstructions: 'You generate structured JSON only. Return exactly the JSON object requested with no additional text or formatting.' }
      );

      if (result.success && result.response) {
        const raw = result.response.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(raw) as BriefingData;
        return parsed;
      }
    } catch (err) {
      console.warn('[StewardService] Briefing AI call failed, using page data fallback:', err);
    }

    return this.buildFallbackBriefing(pageContext);
  }

  private buildFallbackBriefing(pageContext: StewardPageContext): BriefingData {
    const top = pageContext.priorityClaim;
    const rest = pageContext.allClaims.filter(c => c.id !== top?.id);
    const ranking = pageContext.recommendedRanking ?? [];
    const runnerUp = ranking.find(r => r.id !== top?.id) ?? null;

    const isUrgent = (p?: string) => p === 'Critical' || p === 'Urgent' || p === 'urgent' || p === 'critical';
    const isHighOrUp = (p?: string) => isUrgent(p) || p === 'High' || p === 'high';
    const isFraud = (c: PageClaimSummary) => {
      const hay = `${c.workingOn ?? ''} ${c.blockerReason ?? ''}`.toLowerCase();
      return hay.includes('fraud') || hay.includes('siu');
    };

    // Comparative "why this is #1" — name the runner-up and the deciding signal.
    let whyThisFirst: string | undefined;
    if (top && runnerUp) {
      const parts: string[] = [];
      if (top.priority && runnerUp.priority && top.priority !== runnerUp.priority) {
        parts.push(`higher ${top.priority} priority vs ${runnerUp.priority}`);
      } else if (top.confidenceLevel && runnerUp.confidenceLevel && top.confidenceLevel !== runnerUp.confidenceLevel) {
        parts.push(`stronger ${top.confidenceLevel} confidence at equal priority`);
      } else if ((top.estimatedExposure ?? 0) !== (runnerUp.estimatedExposure ?? 0)) {
        parts.push(`larger $${(top.estimatedExposure ?? 0).toLocaleString()} exposure`);
      } else {
        parts.push(`longer time waiting in queue`);
      }
      whyThisFirst = `Ranked above ${runnerUp.claimantName} (${runnerUp.id}) on ${parts[0]}.`;
    } else if (top) {
      whyThisFirst = 'Highest-priority decision-ready claim in the queue.';
    }

    // Concrete next steps for the top claim — more than the single required-action line.
    const recommendedSteps: string[] = [];
    if (top?.blockerReason) {
      recommendedSteps.push(`Clear the blocker: ${top.blockerReason}`);
    }
    recommendedSteps.push(
      top
        ? `Open ${top.claimantName}'s file (${top.id}) and confirm the recommended action and exposure of $${(top.estimatedExposure ?? 0).toLocaleString()}.`
        : 'Open the top claim and review the recommended action.',
    );
    if (top && isHighOrUp(top.priority)) {
      recommendedSteps.push('Verify supporting evidence is complete before settling or escalating.');
    }
    recommendedSteps.push('Record the decision or escalation so the claim advances to the next stage.');

    // What the agents have already done on this claim — taken from the claim's audit trail (auditable source).
    const alreadyDone: string[] = (top?.completedActions ?? []).map(
      a => `${a.agent}: ${a.outcome}`,
    );

    const topPriority: BriefingData['topPriority'] = top ? {
      name: top.claimantName,
      claimId: top.id,
      rank: 1,
      tags: [
        { label: isUrgent(top.priority) ? 'Urgent' : top.priority, color: isUrgent(top.priority) ? 'red' : top.priority === 'High' ? 'orange' : 'yellow' },
        ...(top.confidenceLevel && top.confidenceLevel !== 'High' ? [{ label: `${top.confidenceLevel} confidence`, color: 'orange' as const }] : []),
        ...(top.timeInQueue ? [{ label: `${top.timeInQueue} in queue`, color: 'blue' as const }] : []),
      ],
      exposure: top.estimatedExposure || 0,
      blocker: top.blockerReason || 'Requires immediate adjuster review.',
      requiredAction: pageContext.priorityReason || 'Open claim and assess next steps.',
      whyThisFirst,
      alreadyDone,
      recommendedSteps,
    } : { name: 'No claims', claimId: '', rank: 1, tags: [], exposure: 0 };

    const actNow: BriefingData['actNow'] = rest.slice(0, 5).map(c => ({
      name: c.claimantName,
      claimId: c.id,
      timeInQueue: c.timeInQueue || 'unknown',
      urgency: isUrgent(c.priority) ? 'urgent' : c.priority === 'High' ? 'high' : 'medium',
      reason: c.blockerReason || c.workingOn || 'Review required.',
    }));

    const keepAnEyeOn: BriefingData['keepAnEyeOn'] = rest.slice(5, 8).map(c => ({
      identifier: c.claimantName || c.id,
      note: c.workingOn || c.stage || 'Pending review',
    }));

    // Queue-level synthesis the per-claim cards don't surface.
    const all = pageContext.allClaims;
    const oldest = ranking.length > 0
      ? [...ranking].reverse().find(r => r.timeInQueue) ?? ranking[ranking.length - 1]
      : undefined;
    const queueIntelligence: BriefingData['queueIntelligence'] = {
      totalExposure: all.reduce((sum, c) => sum + (c.estimatedExposure ?? 0), 0),
      openDecisions: all.filter(c => c.stage !== 'closed' && c.stage !== 'settlement').length,
      highPriorityCount: all.filter(c => isHighOrUp(c.priority)).length,
      fraudFlags: all.filter(isFraud).length,
      oldestWaiting: oldest ? `${oldest.claimantName} — ${oldest.timeInQueue ?? 'n/a'} in queue` : undefined,
      note: `${all.length} claim(s) on screen carrying $${all.reduce((s, c) => s + (c.estimatedExposure ?? 0), 0).toLocaleString()} total exposure; ${all.filter(c => isHighOrUp(c.priority)).length} high-priority and ${all.filter(isFraud).length} fraud-flagged.`,
    };

    return { topPriority, actNow, keepAnEyeOn, queueIntelligence };
  }

  /**
   * Trigger claims indexing (admin operation).
   */
  async indexClaims(request: IndexingJobRequest): Promise<IndexingJobStatus> {
    return this.claimsIndexer.indexClaims(request);
  }

  /**
   * Get indexing job status.
   */
  async getIndexingStatus(jobId: string): Promise<IndexingJobStatus | null> {
    return this.cosmosService.getIndexingStatus(jobId);
  }

  /**
   * Build a structured page context block to inject into the system prompt so the
   * Steward knows every claim visible on the adjuster's current screen without
   * requiring the adjuster to supply a claim ID.
   */
  private buildPageContextBlock(pageContext: StewardPageContext): string {
    const lines: string[] = [
      `\n\nCURRENT PAGE DATA: ${pageContext.pageName}`,
      `Queue summary for ${pageContext.allClaims.length} claim(s) visible to ${(pageContext.activeAdjuster?.name ?? 'the active adjuster')}:`,
    ];

    if (pageContext.activeAdjuster) {
      lines.push(
        `\nACTIVE ADJUSTER PERSONA (answer as this adjuster's operating context):`,
        `  Adjuster : ${pageContext.activeAdjuster.name}`,
        `  Team     : ${pageContext.activeAdjuster.team}`,
        `  Seniority: ${pageContext.activeAdjuster.seniority}`,
        `  Experience: ${pageContext.activeAdjuster.yearsExperience} years`,
        `  Authority limit: ${pageContext.activeAdjuster.authorityLimit != null ? `$${pageContext.activeAdjuster.authorityLimit.toLocaleString()}` : 'unknown'} (delegated settlement/exposure authority for this adjuster)`,
        `  Workload : ${pageContext.activeAdjuster.currentWorkload}/${pageContext.activeAdjuster.maxCapacity}`,
        `  Focus    : ${pageContext.activeAdjuster.specialisations.join(', ')}`,
        `  NOTE     : Tailor prioritisation, recommendations, and tone to THIS adjuster's persona and authority.`,
        `  ESCALATION RULE: SIU, Legal, and Medical Review referrals are DIRECT for any adjuster regardless of seniority - never say Claims Supervisor sign-off is required to make one of these referrals. Only recommend looping in a Claims Supervisor when the claim's settlement/exposure amount exceeds THIS adjuster's own authority limit above; if it does not, omit Claims Supervisor from the escalation path entirely.`,
      );
    }

    // Focused claim (soft-selected by adjuster) — always wins over priority claim
    const focusedClaim = pageContext.focusedClaimId
      ? pageContext.allClaims.find(c => c.id === pageContext.focusedClaimId)
      : null;
    const focusedClaimRecord = pageContext.focusedClaimRecord;

    if (focusedClaim) {
      lines.push(
        `\n⚑ ADJUSTER-FOCUSED CLAIM (adjuster has selected this — "this claim" refers to this):`,
        `  Claim ID : ${focusedClaim.id}`,
        `  Claimant : ${focusedClaim.claimantName}`,
        `  Stage    : ${focusedClaim.stage}`,
        `  Priority : ${focusedClaim.priority}`,
        `  Confidence: ${focusedClaim.confidenceLevel}`,
        `  Exposure : ${focusedClaim.estimatedExposure != null ? `$${focusedClaim.estimatedExposure.toLocaleString()}` : 'unknown'}`,
        `  Blocker  : ${focusedClaim.blockerReason || 'none'}`,
        `  In queue : ${focusedClaim.timeInQueue || 'unknown'}`,
        `  NOTE     : When the adjuster says "this claim", "it", or similar — they mean THIS claim.`,
      );
    }

    if (focusedClaimRecord) {
      const evidenceItems = focusedClaimRecord.evidenceItems ?? [];
      lines.push(
        `\nFULL LIVE CLAIM RECORD FOR THE FOCUSED CLAIM:`,
        `  Claim ID : ${focusedClaimRecord.id}`,
        `  Claimant : ${focusedClaimRecord.claimantName}`,
        `  Incident : ${focusedClaimRecord.incidentType} on ${focusedClaimRecord.incidentDate} at ${focusedClaimRecord.incidentLocation}`,
        `  Description : ${focusedClaimRecord.incidentDescription}`,
        `  Injury indicated : ${focusedClaimRecord.injuryIndicated ? 'yes' : 'no'}`,
        `  Police reference : ${focusedClaimRecord.policeReportRef || 'none recorded'}`,
        `  Immediate needs : ${focusedClaimRecord.immediateNeeds.length > 0 ? focusedClaimRecord.immediateNeeds.join(', ') : 'none recorded'}`,
        `  Policy ref : ${focusedClaimRecord.policyRef}`,
        `  Coverage type : ${focusedClaimRecord.policyContext.coverageType}`,
        `  Coverage posture : ${focusedClaimRecord.policyContext.coverageApplicability}`,
        `  Relevant clauses : ${focusedClaimRecord.policyContext.relevantClauses.length > 0 ? focusedClaimRecord.policyContext.relevantClauses.join('; ') : 'none recorded'}`,
        `  Pending decision : ${focusedClaimRecord.pendingDecisionType}`,
        `  Last action : ${focusedClaimRecord.lastAgentAction}`,
        `  Working on : ${focusedClaimRecord.workingOn || 'not specified'}`,
        `  Evidence count : ${evidenceItems.length}`,
      );

      if (evidenceItems.length > 0) {
        lines.push(`  Evidence items:`);
        for (const item of evidenceItems) {
          lines.push(
            `    - ${item.type} | status: ${item.status} | source: ${item.source} | received: ${item.dateReceived} | description: ${item.description}`,
          );
        }
      } else {
        lines.push(`  Evidence items: none recorded`);
      }

      if (focusedClaimRecord.recommendedAction) {
        lines.push(
          `  Recommended action : ${focusedClaimRecord.recommendedAction.actionType} — ${focusedClaimRecord.recommendedAction.description}`,
          `  Action rationale : ${focusedClaimRecord.recommendedAction.rationale}`,
        );
        if (focusedClaimRecord.recommendedAction.estimatedAmount != null) {
          lines.push(`  Estimated exposure : $${focusedClaimRecord.recommendedAction.estimatedAmount.toLocaleString()}`);
        }
      }
    }

    // Focused on-screen entry (e.g. a specific risk, metric or evidence item the adjuster clicked)
    if (pageContext.focusedEntry) {
      lines.push(
        `\n⚑ ADJUSTER-FOCUSED ENTRY (adjuster has selected this specific on-screen item — "this", "why is this a problem" refers to THIS):`,
        `  Item   : ${pageContext.focusedEntry.label}`,
        ...(pageContext.focusedEntry.detail ? [`  Detail : ${pageContext.focusedEntry.detail}`] : []),
        `  NOTE   : When the adjuster asks "why is this a problem", "explain this", "what does this mean" or similar — they are referring to THIS entry. Answer specifically about it in the context of the focused/priority claim.`,
      );
    }

    if (pageContext.priorityClaim) {
      const label = focusedClaim ? `\n#1 PRIORITY CLAIM (for reference, NOT the focused claim):` : `\n#1 PRIORITY CLAIM (recommended first action):`;
      lines.push(
        label,
        `  Claim ID : ${pageContext.priorityClaim.id}`,
        `  Claimant : ${pageContext.priorityClaim.claimantName}`,
        `  Stage    : ${pageContext.priorityClaim.stage}`,
        `  Priority : ${pageContext.priorityClaim.priority}`,
        `  Confidence: ${pageContext.priorityClaim.confidenceLevel}`,
        `  Exposure : ${pageContext.priorityClaim.estimatedExposure != null ? `$${pageContext.priorityClaim.estimatedExposure.toLocaleString()}` : 'unknown'}`,
        `  Blocker  : ${pageContext.priorityClaim.blockerReason || 'none'}`,
        `  In queue : ${pageContext.priorityClaim.timeInQueue || 'unknown'}`,
      );
      if (pageContext.priorityReason && !focusedClaim) {
        lines.push(`  Why #1   : ${pageContext.priorityReason}`);
      }
      const completed = pageContext.priorityClaim.completedActions ?? [];
      if (completed.length > 0) {
        lines.push(`  COMPLETED AGENT WORK (from the claim's audit trail — the ONLY source for alreadyDone):`);
        for (const a of completed) {
          lines.push(`    - ${a.agent}: ${a.outcome}`);
        }
      }
    }

    lines.push(`\nALL CLAIMS ON SCREEN:`);
    for (const c of pageContext.allClaims) {
      lines.push(
        `  - ${c.id} | ${c.claimantName} | ${c.incidentType} | Stage: ${c.stage} | Priority: ${c.priority} | Confidence: ${c.confidenceLevel} | Exposure: ${c.estimatedExposure != null ? `$${c.estimatedExposure.toLocaleString()}` : 'n/a'} | Blocker: ${c.blockerReason || 'none'} | In queue: ${c.timeInQueue || 'n/a'}`,
      );
    }

    if (pageContext.recommendedRanking && pageContext.recommendedRanking.length > 0) {
      lines.push(
        `\nRECOMMENDED RANKING (the "Recommended Next Claims" order shown on screen):`,
        `RANKING METHODOLOGY — claims are ordered by these signals in strict priority order:`,
        `  1. Priority tier (urgent > high > medium > low)`,
        `  2. Confidence level (used to break ties within the same priority)`,
        `  3. Queue age (older waits rank higher when priority + confidence tie)`,
        `  4. Financial exposure (higher exposure ranks higher when all above tie)`,
        `  + Variety rule: at most ONE fraud/SIU case appears in the top three so a single investigation stream cannot crowd out actionable work.`,
        `Use this exact methodology to explain why any claim outranks another. The ranked list:`,
      );
      for (const r of pageContext.recommendedRanking) {
        lines.push(
          `  #${r.rank} ${r.claimantName} (${r.id}) | ${r.incidentType} | Priority: ${r.priority} | Confidence: ${r.confidenceLevel} | Queue age: ${r.timeInQueue || 'n/a'} | Exposure: ${r.estimatedExposure != null ? `$${r.estimatedExposure.toLocaleString()}` : 'n/a'} | Decision: ${r.pendingDecisionType || 'n/a'} | Placement: ${r.rationale}`,
        );
      }
      lines.push(
        `When comparing two claims, walk down the signals above until one differs, and name that signal as the deciding factor.`,
      );
    }

    lines.push(
      `\nREMINDER: The focused-claim block above is the live full claim record, including uploaded evidence. The all-claims list is a routing summary for visible claims. Resolve claimant first names to claim IDs — never ask for an ID if the name matches a claim above.`,
    );

    return lines.join('\n');
  }

  /**
   * The deployed Digital Steward agent emits a strict JSON `guidance` object
   * (its orchestration output contract). The in-app chat panel expects readable
   * prose, so convert that structured payload into clean markdown. If the
   * response is not the expected JSON shape, return it unchanged.
   */
  private formatAgentResponse(raw: string): string {
    const trimmed = raw.trim();

    // The model sometimes wraps its JSON in a ```json fence, and sometimes
    // prefixes/suffixes it with conversational prose (e.g. "Hi Priya — ...
    // {...}"). Find the first `{` and its matching closing `}` via brace
    // counting (respecting string literals) rather than assuming the payload
    // starts at index 0 — a naive `startsWith('{')` check causes the whole
    // raw prose+JSON blob to leak into the chat unrendered whenever the model
    // adds any lead-in text.
    const candidate = this.extractJsonObject(trimmed);
    if (!candidate) return raw;

    let parsed: any;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      return raw;
    }

    const g = parsed?.guidance ?? parsed;
    if (!g || typeof g !== 'object' || typeof g.summary !== 'string') return raw;

    // Each block is rendered as its own markdown paragraph/section; blocks are
    // joined with a blank line so ReactMarkdown renders headings and lists cleanly.
    const blocks: string[] = [];
    blocks.push(g.summary.trim());

    // Section headers are emitted as level-3 markdown headings (`### `) so the
    // chat panel renders them as consistent, styled section banners. Severity is
    // emitted as an uppercased `[LEVEL]` token so the panel can render a coloured
    // badge. This keeps every structured response visually identical.
    if (Array.isArray(g.evidence_synthesis) && g.evidence_synthesis.length > 0) {
      const lines = ['### Evidence'];
      for (const e of g.evidence_synthesis) {
        if (!e) continue;
        const item = e.source ? `**${e.source}**` : '';
        const finding = e.key_takeaway ? ` — ${e.key_takeaway}` : '';
        const support = e.assessment ? ` _(${String(e.assessment).replace(/_/g, ' ')})_` : '';
        const line = `- ${item}${finding}${support}`.trim();
        if (line !== '-') lines.push(line);
      }
      if (lines.length > 1) blocks.push(lines.join('\n'));
    }

    if (Array.isArray(g.risks) && g.risks.length > 0) {
      const lines = ['### Risks'];
      for (const r of g.risks) {
        if (!r) continue;
        const sev = r.severity ? `[${String(r.severity).toUpperCase()}] ` : '';
        const risk = r.risk_type ? String(r.risk_type).replace(/_/g, ' ') : '';
        const rationale = r.rationale ? ` — ${r.rationale}` : (r.evidence_basis ? ` — ${r.evidence_basis}` : '');
        const esc = r.immediate_attention ? ' ⚑ needs immediate attention' : '';
        const line = `- ${sev}${risk}${rationale}${esc}`.trim();
        if (line !== '-') lines.push(line);
      }
      if (lines.length > 1) blocks.push(lines.join('\n'));
    }

    if (Array.isArray(g.recommended_next_steps) && g.recommended_next_steps.length > 0) {
      const lines = ['### Recommended next steps'];
      let n = 0;
      g.recommended_next_steps.forEach((s: unknown) => {
        if (typeof s === 'string' && s.trim()) { n += 1; lines.push(`${n}. ${s.trim()}`); }
      });
      if (lines.length > 1) blocks.push(lines.join('\n'));
    }

    if (g.escalation && g.escalation.required) {
      const target = g.escalation.target && g.escalation.target !== 'none' ? ` to **${g.escalation.target}**` : '';
      const reason = g.escalation.reason ? ` — ${g.escalation.reason}` : '';
      blocks.push(`### Escalation\n⚑ escalation required${target}${reason}`);
    }

    if (Array.isArray(g.assumptions) && g.assumptions.length > 0) {
      const lines = ['### Assumptions'];
      for (const a of g.assumptions) {
        if (typeof a === 'string' && a.trim()) lines.push(`- ${a.trim()}`);
      }
      if (lines.length > 1) blocks.push(lines.join('\n'));
    }

    if (g.confidence && typeof g.confidence === 'object') {
      const score = typeof g.confidence.score === 'number' ? ` (${Math.round(g.confidence.score * 100)}%)` : '';
      const tier = g.confidence.tier ? String(g.confidence.tier).toUpperCase() : '';
      const rationale = g.confidence.rationale ? ` — ${g.confidence.rationale}` : '';
      if (tier || rationale) blocks.push(`### Confidence\n${tier}${score}${rationale}`.trim());
    }

    if (typeof g.boundaries_notice === 'string' && g.boundaries_notice.trim()) {
      blocks.push(`_${g.boundaries_notice.trim()}_`);
    }

    const text = blocks.join('\n\n').trim();
    return text.length > 0 ? text : raw;
  }

  /**
   * Locate a top-level `{ ... }` JSON object anywhere within `text` (the model
   * may prepend/append prose around the structured payload, and may wrap it in
   * a ```json fence). Returns the extracted candidate string, or null if no
   * balanced object is found. Brace counting ignores braces inside string
   * literals so it isn't confused by JSON content containing `{`/`}`.
   */
  private extractJsonObject(text: string): string | null {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const searchIn = fenced ? fenced[1] : text;

    const start = searchIn.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < searchIn.length; i++) {
      const ch = searchIn[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return searchIn.slice(start, i + 1).trim();
      }
    }
    return null;
  }

  /**
   * Generate a chat response using retrieved context.
   * Uses Azure AI Foundry when available and falls back to the mock response generator.
   */
  private async generateResponse(
    query: string,
    contextChunks: string[],
    conversationHistory: ConversationMessage[],
    _userContext: StewardContext,
    pageContext?: StewardPageContext,
    sopChunks: string[] = []
  ): Promise<ChatCompletionResponse> {
    const contextBlock = contextChunks.length > 0
      ? `\n\nRELEVANT CLAIMS DATA:\n${contextChunks.join('\n\n---\n\n')}`
      : '';

    // SOP / governance controls retrieved for this query (detail on top of the
    // always-on deterministic control block).
    const sopBlock = sopChunks.length > 0
      ? `\n\nRELEVANT SOP / GOVERNANCE CONTROLS (retrieved detail — apply exactly):\n${sopChunks.join('\n\n---\n\n')}`
      : '';

    const pageBlock = pageContext ? this.buildPageContextBlock(pageContext) : '';

    // Use the deployed Digital Steward agent's instructions as the base persona
    // so the agent can be iterated in Foundry. Fall back to the local prompt if
    // the deployed agent can't be fetched. The deterministic governance control
    // block, operational addendum, and live page/claims/SOP context are always
    // appended on top.
    const deployedInstructions = await getDeployedAgentInstructions(STEWARD_DEPLOYMENT_ID);
    const basePrompt = deployedInstructions || STEWARD_SYSTEM_PROMPT;
    const systemPromptWithContext =
      basePrompt +
      '\n\n' + getControlBlock() +
      STEWARD_OPERATIONAL_ADDENDUM +
      pageBlock +
      sopBlock +
      contextBlock;

    const history = conversationHistory
      .slice(0, -1)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const result = await testDeployedAgent(
        STEWARD_DEPLOYMENT_ID,
        query,
        history,
        { overrideInstructions: systemPromptWithContext }
      );

      if (result.success && result.response) {
        return { content: this.formatAgentResponse(result.response), tokensUsed: 0 };
      }
    } catch (err) {
      console.warn('[StewardService] Foundry call failed, falling back to mock:', err);
    }

    return this.mockGenerateCompletion([], contextChunks, query, pageContext);
  }

  /**
   * Mock LLM completion for development.
   * Generates contextual responses based on retrieved chunks.
   */
  private async mockGenerateCompletion(
    _messages: ChatCompletionRequest['messages'],
    contextChunks: string[],
    query: string,
    pageContext?: StewardPageContext
  ): Promise<ChatCompletionResponse> {
    await this.delay(300);

    const trimmedQuery = query.trim();
    const isConversationalAck = /^(yes|no|ok|sure|please|thanks|thank you|correct|exactly|right|go ahead|proceed)[\s.!?]*$/i.test(trimmedQuery);

    // Try to resolve name reference to a claim using page context
    if (contextChunks.length === 0 && pageContext) {
      const queryLower = trimmedQuery.toLowerCase();
      const matched = pageContext.allClaims.find(c =>
        c.claimantName.toLowerCase().split(' ').some(part => queryLower.includes(part))
      );
      if (matched) {
        const isPriority = pageContext.priorityClaim?.id === matched.id;
        let response = `**${matched.claimantName}** — Claim ${matched.id}\n\n`;
        response += `- Stage: ${matched.stage}\n`;
        response += `- Priority: ${matched.priority}\n`;
        response += `- Confidence: ${matched.confidenceLevel}\n`;
        if (matched.estimatedExposure) response += `- Exposure: $${matched.estimatedExposure.toLocaleString()}\n`;
        if (matched.blockerReason) response += `- Blocker: ${matched.blockerReason}\n`;
        if (matched.timeInQueue) response += `- In queue: ${matched.timeInQueue}\n`;
        if (isPriority && pageContext.priorityReason) {
          response += `\n**Why it's #1 priority**: ${pageContext.priorityReason}`;
        }
        response += `\n\n*Note: For full claim details open the file. Coverage and settlement decisions require authorised personnel.*`;
        return { content: response, tokensUsed: Math.ceil(response.length / 4) };
      }
    }

    if (contextChunks.length === 0 && (trimmedQuery.length < 20 || isConversationalAck)) {
      // If we have page context, summarise what's on screen
      if (pageContext && pageContext.allClaims.length > 0) {
        const top = pageContext.priorityClaim;
        return {
          content: top
            ? `The top priority claim on your queue is **${top.claimantName}** (${top.id}) — ${pageContext.priorityReason || top.blockerReason || 'see claim details'}. There are ${pageContext.allClaims.length} claims on screen. What would you like to know?`
            : `There are ${pageContext.allClaims.length} claims on your queue. What would you like to know?`,
          tokensUsed: 20,
        };
      }
      return {
        content: `I'd be happy to help — could you let me know which claim or topic you'd like me to continue with?`,
        tokensUsed: 10,
      };
    }

    if (contextChunks.length === 0) {
      return {
        content: `I wasn't able to find specific claims data matching your query. Could you provide more details such as a claim number, claimant name, or specific topic?`,
        tokensUsed: 50,
      };
    }

    // Build a contextual mock response
    const firstChunk = contextChunks[0];
    const claimIdMatch = firstChunk.match(/Claim (CLM-[\w-]+)/);
    const claimId = claimIdMatch ? claimIdMatch[1] : 'the referenced claim';

    let response = `Based on the available claims data, here's what I found:\n\n`;

    if (query.toLowerCase().includes('status')) {
      response += `**${claimId}** - ${this.extractField(firstChunk, 'Status') || 'Status information available in the claim record.'}\n\n`;
    } else if (query.toLowerCase().includes('policy') || query.toLowerCase().includes('coverage')) {
      response += `For ${claimId}, the policy details show:\n${firstChunk.substring(0, 300)}\n\n`;
    } else if (query.toLowerCase().includes('settlement')) {
      response += `Settlement information for ${claimId}:\n${firstChunk.substring(0, 300)}\n\n`;
    } else {
      response += `${firstChunk.substring(0, 400)}\n\n`;
    }

    if (contextChunks.length > 1) {
      response += `I also found ${contextChunks.length - 1} additional related record(s). Would you like me to summarize those as well?`;
    }

    response += `\n\n*Note: This information is for reference only. Any coverage determinations or claim decisions must be made by authorized personnel.*`;

    return {
      content: response,
      tokensUsed: Math.ceil(response.length / 4),
    };
  }

  private extractField(content: string, field: string): string | null {
    const match = content.match(new RegExp(`${field}:\\s*(.+?)(?:\\n|$)`));
    return match ? match[1].trim() : null;
  }

  private getDefaultContext(): StewardContext {
    return {
      tenantId: 'default-tenant',
      userId: 'default-user',
      role: 'adjuster',
    };
  }

  private generateTitle(message: string): string {
    return message.length > 50 ? message.substring(0, 47) + '...' : message;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
