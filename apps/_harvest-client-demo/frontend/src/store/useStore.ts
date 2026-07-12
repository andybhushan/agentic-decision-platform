import { create } from 'zustand';
import type { Vertical, Agent, Workflow } from '../types';

interface AppState {
  // Verticals
  verticals: Vertical[];
  selectedVertical: Vertical | null;
  setVerticals: (verticals: Vertical[]) => void;
  setSelectedVertical: (vertical: Vertical | null) => void;

  // Agents
  agents: Agent[];
  selectedAgent: Agent | null;
  setAgents: (agents: Agent[]) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  removeAgent: (id: string) => void;

  // Workflows
  workflows: Workflow[];
  selectedWorkflow: Workflow | null;
  setWorkflows: (workflows: Workflow[]) => void;
  setSelectedWorkflow: (workflow: Workflow | null) => void;
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  removeWorkflow: (id: string) => void;

  // UI State
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Filters
  agentFilters: {
    search: string;
    verticalId?: string;
    archetype?: string;
    authorityLevel?: string;
  };
  setAgentFilters: (filters: Partial<AppState['agentFilters']>) => void;
  resetAgentFilters: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Verticals
  verticals: [],
  selectedVertical: null,
  setVerticals: (verticals) => set({ verticals }),
  setSelectedVertical: (selectedVertical) => set({ selectedVertical }),

  // Agents
  agents: [],
  selectedAgent: null,
  setAgents: (agents) => set({ agents }),
  setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
    })),

  // Workflows
  workflows: [],
  selectedWorkflow: null,
  setWorkflows: (workflows) => set({ workflows }),
  setSelectedWorkflow: (selectedWorkflow) => set({ selectedWorkflow }),
  addWorkflow: (workflow) => set((state) => ({ workflows: [...state.workflows, workflow] })),
  updateWorkflow: (id, updates) =>
    set((state) => ({
      workflows: state.workflows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),
  removeWorkflow: (id) =>
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
    })),

  // UI State
  loading: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Filters
  agentFilters: {
    search: '',
  },
  setAgentFilters: (filters) =>
    set((state) => ({
      agentFilters: { ...state.agentFilters, ...filters },
    })),
  resetAgentFilters: () =>
    set({
      agentFilters: { search: '' },
    }),
}));

// Made with Bob
