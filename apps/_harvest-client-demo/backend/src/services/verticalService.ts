import { Vertical } from '../types';
import { CosmosRepository } from './cosmosRepository';

const repo = new CosmosRepository<Vertical>('verticals');

const DEFAULT_VERTICALS: Vertical[] = [
  {
    id: 'claims',
    name: 'Claims Processing',
    description: 'Insurance claims processing and adjudication workflows',
    icon: 'DocumentAttachment',
    color: '#0f62fe',
    agentCount: 4,
    workflowCount: 1,
    features: ['Automated claim intake', 'Fraud detection', 'Policy validation', 'Settlement calculation', 'Customer communication'],
    complianceRequirements: ['SOX', 'GDPR', 'State Insurance Regulations'],
  },
  {
    id: 'healthcare',
    name: 'Healthcare Services',
    description: 'Medical service coordination and patient care workflows',
    icon: 'Health',
    color: '#24a148',
    agentCount: 3,
    workflowCount: 1,
    features: ['Patient intake', 'Medical record analysis', 'Treatment planning', 'Insurance verification', 'Care coordination'],
    complianceRequirements: ['HIPAA', 'HITECH', 'FDA Regulations'],
  },
  {
    id: 'customer-service',
    name: 'Customer Service',
    description: 'Customer support and service request management',
    icon: 'UserMultiple',
    color: '#8a3ffc',
    agentCount: 3,
    workflowCount: 1,
    features: ['Ticket routing', 'Sentiment analysis', 'Knowledge base search', 'Escalation management', 'Quality assurance'],
    complianceRequirements: ['GDPR', 'CCPA', 'PCI DSS'],
  },
];

export class VerticalService {
  async getAll(): Promise<Vertical[]> {
    const results = await repo.findAll();
    return results.length > 0 ? results : DEFAULT_VERTICALS;
  }

  async getById(id: string): Promise<Vertical | null> {
    const result = await repo.findById(id);
    if (result) return result;
    return DEFAULT_VERTICALS.find((v) => v.id === id) ?? null;
  }

  async reload(): Promise<void> {}
}