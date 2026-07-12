import { Workflow } from '../types';
import { randomUUID } from 'crypto';
import { CosmosRepository } from './cosmosRepository';

const repo = new CosmosRepository<Workflow>('workflows');

export class WorkflowService {
  async getAll(filters?: { verticalId?: string; search?: string }): Promise<Workflow[]> {
    let workflows = await repo.findAll();

    if (filters) {
      if (filters.verticalId) {
        workflows = workflows.filter((w) => w.verticalId === filters.verticalId);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        workflows = workflows.filter(
          (w) =>
            w.name.toLowerCase().includes(searchLower) ||
            w.description.toLowerCase().includes(searchLower)
        );
      }
    }

    return workflows;
  }

  async getById(id: string): Promise<Workflow | null> {
    return repo.findById(id);
  }

  async create(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow> {
    const newWorkflow: Workflow = {
      ...workflow,
      id: `workflow_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return repo.upsert(newWorkflow);
  }

  async update(id: string, updates: Partial<Workflow>): Promise<Workflow | null> {
    const existing = await repo.findById(id);
    if (!existing) return null;
    return repo.upsert({ ...existing, ...updates, id, updatedAt: new Date().toISOString() });
  }

  async delete(id: string): Promise<boolean> {
    return repo.delete(id);
  }

  async reload(): Promise<void> {}
}