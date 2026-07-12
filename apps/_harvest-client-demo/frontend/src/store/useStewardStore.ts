import { create } from 'zustand';
import { stewardApi, type Conversation, type ConversationMessage, type DecisionBriefingData, type RetrievedSource, type StewardPageContext } from '../services/stewardApi';

interface StewardState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  greetingDelivered: boolean;
  error: string | null;
  lastSources: RetrievedSource[];
  lastWarnings: string[];
  indexingStatus: string | null;

  // Actions
  sendMessage: (message: string, pageContext?: StewardPageContext) => Promise<void>;
  sendProactiveMessage: (message: string, pageContext?: StewardPageContext) => Promise<void>;
  sendGreeting: (pageContext: StewardPageContext) => Promise<void>;
  setDecisionBriefing: (data: DecisionBriefingData) => void;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  triggerIndexing: () => Promise<void>;
  clearError: () => void;
}

export const useStewardStore = create<StewardState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  greetingDelivered: false,
  error: null,
  lastSources: [],
  lastWarnings: [],
  indexingStatus: null,

  sendMessage: async (message: string, pageContext?: StewardPageContext) => {
    const state = get();
    
    // Add user message optimistically
    const userMessage: ConversationMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    
    set({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    });

    try {
      const response = await stewardApi.chat({
        message,
        conversationId: state.activeConversationId || undefined,
        pageContext,
      });

      const assistantMessage: ConversationMessage = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        sources: response.sources,
        action: response.action,
      };

      set({
        messages: [...get().messages, assistantMessage],
        activeConversationId: response.conversationId,
        lastSources: response.sources,
        lastWarnings: response.warnings || [],
        isLoading: false,
      });

      get().loadConversations();
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || error.message || 'Failed to send message',
        isLoading: false,
      });
    }
  },

  sendProactiveMessage: async (message: string, pageContext?: StewardPageContext) => {
    const state = get();
    set({
      isLoading: true,
      error: null,
    });

    try {
      const response = await stewardApi.chat({
        message,
        conversationId: state.activeConversationId || undefined,
        pageContext,
      });

      const assistantMessage: ConversationMessage = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        sources: response.sources,
        action: response.action,
      };

      set({
        messages: [...get().messages, assistantMessage],
        activeConversationId: response.conversationId,
        lastSources: response.sources,
        lastWarnings: response.warnings || [],
        isLoading: false,
      });

      get().loadConversations();
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || error.message || 'Failed to load guidance',
        isLoading: false,
      });
    }
  },

  /**
   * Fire a proactive morning briefing on page load.
   * Only adds the assistant response — no user bubble shown — so Priya sees
   * the Steward speaking first, not a user prompt.
   */
  sendGreeting: async (pageContext: StewardPageContext) => {
    if (get().greetingDelivered || get().isLoading) return;
    set({ isLoading: true, greetingDelivered: true, error: null });

    try {
      const briefingData = await stewardApi.getBriefing(pageContext);

      const assistantMessage: ConversationMessage = {
        id: `greeting-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        briefingData,
      };

      set({
        messages: [assistantMessage],
        isLoading: false,
      });
    } catch (error: any) {
      // Reset so it retries on next page load (e.g. after a backend restart)
      set({ greetingDelivered: false, isLoading: false });
    }
  },

  /**
   * Open the Decision Mode panel with a deterministic single-claim briefing card.
   * No backend call — the card is built client-side from the claim, so the opening
   * overview is instant and can't time out.
   */
  setDecisionBriefing: (data: DecisionBriefingData) => {
    set({
      messages: [{
        id: `decision-briefing-${data.claimId}`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        decisionBriefing: data,
      }],
      isLoading: false,
      error: null,
    });
  },

  loadConversations: async () => {
    try {
      const conversations = await stewardApi.listConversations();
      set({ conversations });
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
    }
  },

  selectConversation: async (id: string) => {
    try {
      set({ isLoading: true });
      const conversation = await stewardApi.getConversation(id);
      set({
        activeConversationId: id,
        messages: conversation.messages,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error?.message || 'Failed to load conversation',
        isLoading: false,
      });
    }
  },

  startNewConversation: () => {
    set({
      activeConversationId: null,
      messages: [],
      greetingDelivered: false,
      lastSources: [],
      lastWarnings: [],
      error: null,
    });
  },

  deleteConversation: async (id: string) => {
    try {
      await stewardApi.deleteConversation(id);
      const state = get();
      set({
        conversations: state.conversations.filter(c => c.id !== id),
        ...(state.activeConversationId === id ? { activeConversationId: null, messages: [], greetingDelivered: false } : {}),
      });
    } catch (error: any) {
      set({ error: 'Failed to delete conversation' });
    }
  },

  triggerIndexing: async () => {
    try {
      set({ indexingStatus: 'processing' });
      const result = await stewardApi.triggerIndexing();
      set({ indexingStatus: result.status });
    } catch (error: any) {
      set({
        indexingStatus: 'failed',
        error: 'Failed to trigger indexing',
      });
    }
  },

  clearError: () => set({ error: null }),
}));
