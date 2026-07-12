import { AIProvider, AIProviderFactory } from './ai/aiProvider';
import { AgentService } from './agentService';
import {
  AIGenerateAgentRequest,
  AIGenerateAgentResponse,
  AIGeneratePromptRequest,
  AIGeneratePromptResponse,
  AISimulateRequest,
  AISimulateResponse,
  AIClaimAssistRequest,
  AIClaimAssistResponse,
} from '../types';

export class AIService {
  private provider: AIProvider;
  private agentService: AgentService;

  constructor() {
    this.provider = AIProviderFactory.create();
    this.agentService = new AgentService();
    console.log(`AI Service initialized with provider: ${this.provider.name}`);
  }

  /**
   * Generate a new agent from natural language description
   */
  async generateAgent(request: AIGenerateAgentRequest): Promise<AIGenerateAgentResponse> {
    try {
      return await this.provider.generateAgent(request);
    } catch (error) {
      console.error('Error generating agent:', error);
      throw new Error('Failed to generate agent');
    }
  }

  /**
   * Generate a prompt for an agent
   */
  async generatePrompt(request: AIGeneratePromptRequest): Promise<AIGeneratePromptResponse> {
    try {
      // Get agent details
      const agent = await this.agentService.getById(request.agentId);
      if (!agent) {
        throw new Error(`Agent with id '${request.agentId}' not found`);
      }

      // Add agent context to the request
      const enrichedRequest = {
        ...request,
        context: {
          ...request.context,
          agentName: agent.name,
          agentArchetype: agent.archetype,
          agentCapabilities: agent.capabilities,
          systemPrompt: agent.systemPrompt,
        },
      };

      return await this.provider.generatePrompt(enrichedRequest);
    } catch (error) {
      console.error('Error generating prompt:', error);
      throw error;
    }
  }

  /**
   * Simulate agent execution
   */
  async simulate(request: AISimulateRequest): Promise<AISimulateResponse> {
    try {
      // Get agent details
      const agent = await this.agentService.getById(request.agentId);
      if (!agent) {
        throw new Error(`Agent with id '${request.agentId}' not found`);
      }

      // Validate inputs
      this.validateInputs(agent, request.input);

      // Add agent context
      const enrichedRequest = {
        ...request,
        context: {
          ...request.context,
          agent,
        },
      };

      // Run simulation
      const result = await this.provider.simulate(enrichedRequest);

      // Apply governance controls
      const governanceResult = this.applyGovernanceControls(agent, result);

      return governanceResult;
    } catch (error) {
      console.error('Error simulating agent:', error);
      throw error;
    }
  }

  /**
   * Customize an existing agent
   */
  async customizeAgent(
    agentId: string,
    customizationRequest: string
  ): Promise<AIGenerateAgentResponse> {
    try {
      const agent = await this.agentService.getById(agentId);
      if (!agent) {
        throw new Error(`Agent with id '${agentId}' not found`);
      }

      // Create a generation request based on the existing agent
      const request: AIGenerateAgentRequest = {
        description: `Customize the following agent: ${agent.name}. ${customizationRequest}`,
        verticalId: agent.verticalId,
        archetype: agent.archetype,
        requirements: [
          `Base agent: ${agent.description}`,
          `Current capabilities: ${agent.capabilities.join(', ')}`,
          `Customization: ${customizationRequest}`,
        ],
      };

      return await this.provider.generateAgent(request);
    } catch (error) {
      console.error('Error customizing agent:', error);
      throw error;
    }
  }

  /**
   * Claims decision assistant - answers an adjuster's free-form command grounded
   * in a specific claim's context using Azure AI Foundry.
   */
  async claimAssist(request: AIClaimAssistRequest): Promise<AIClaimAssistResponse> {
    try {
      return await this.provider.claimAssist(request);
    } catch (error) {
      console.error('Error in claim assist:', error);
      throw error;
    }
  }

  /**
   * Test connection to AI provider
   */
  async testConnection(): Promise<{ success: boolean; provider: string }> {
    try {
      const connected = await this.provider.testConnection();
      return {
        success: connected,
        provider: this.provider.name,
      };
    } catch (error) {
      console.error('Error testing AI provider connection:', error);
      return {
        success: false,
        provider: this.provider.name,
      };
    }
  }

  /**
   * Validate agent inputs against schema
   */
  private validateInputs(agent: any, input: Record<string, any>): void {
    const requiredInputs = agent.inputs.filter((i: any) => i.required);
    
    for (const requiredInput of requiredInputs) {
      if (!(requiredInput.name in input)) {
        throw new Error(`Missing required input: ${requiredInput.name}`);
      }
    }
  }

  /**
   * Apply governance controls to simulation result
   */
  private applyGovernanceControls(agent: any, result: AISimulateResponse): AISimulateResponse {
    const additionalChecks = [];

    // Check confidence threshold
    const confidenceControl = agent.governanceControls.find(
      (c: any) => c.type === 'confidence_threshold' && c.enabled
    );
    
    if (confidenceControl) {
      const threshold = confidenceControl.parameters?.threshold || 0.8;
      const passed = result.confidence >= threshold;
      
      additionalChecks.push({
        controlType: 'confidence_threshold' as const,
        passed,
        message: `Confidence ${result.confidence.toFixed(2)} ${passed ? 'meets' : 'below'} threshold of ${threshold}`,
        details: { threshold, actual: result.confidence },
      });

      // Escalate if below threshold
      if (!passed && !result.escalated) {
        result.escalated = true;
        result.escalationReason = 'Confidence below governance threshold';
      }
    }

    // Merge with existing checks
    result.governanceChecks = [...result.governanceChecks, ...additionalChecks];

    return result;
  }
}

// Made with Bob