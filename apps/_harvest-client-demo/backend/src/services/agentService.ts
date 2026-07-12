import { Agent } from '../types';
import { randomUUID } from 'crypto';
import { CosmosRepository } from './cosmosRepository';

const repo = new CosmosRepository<Agent>('agents');

export class AgentService {
  async getAll(filters?: {
    verticalId?: string;
    archetype?: string;
    authorityLevel?: string;
    search?: string;
  }): Promise<Agent[]> {
    let agents = await repo.findAll();

    if (filters) {
      if (filters.verticalId) {
        agents = agents.filter((a) => a.verticalId === filters.verticalId);
      }
      if (filters.archetype) {
        agents = agents.filter((a) => a.archetype === filters.archetype);
      }
      if (filters.authorityLevel) {
        agents = agents.filter((a) => a.authorityLevel === filters.authorityLevel);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        agents = agents.filter(
          (a) =>
            a.name.toLowerCase().includes(searchLower) ||
            a.description.toLowerCase().includes(searchLower)
        );
      }
    }

    return agents;
  }

  async getById(id: string): Promise<Agent | null> {
    return repo.findById(id);
  }

  async create(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<Agent> {
    const newAgent: Agent = {
      ...agent,
      id: `agent_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return repo.upsert(newAgent);
  }

  async update(id: string, updates: Partial<Agent>): Promise<Agent | null> {
    const existing = await repo.findById(id);
    if (!existing) return null;
    const updated: Agent = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
    return repo.upsert(updated);
  }

  async delete(id: string): Promise<boolean> {
    return repo.delete(id);
  }

  /** No-op — Cosmos is always fresh; kept for interface compatibility. */
  async reload(): Promise<void> {}
}