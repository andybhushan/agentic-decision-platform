// DSL Generator for Agent Definitions
// Generates human-readable DSL snippets from agent configurations

import type { Agent, WorkflowRole, GovernanceProfile } from '../types';

/**
 * Maps authority levels to DSL-friendly names
 */
const mapAuthorityLevel = (level: string): string => {
  const mapping: Record<string, string> = {
    'Low': 'low',
    'Medium': 'medium',
    'High': 'high',
    'Critical': 'critical',
  };
  return mapping[level] || 'low';
};

/**
 * Maps governance profile authority to DSL format
 */
const mapGovernanceAuthority = (profile?: GovernanceProfile): string => {
  if (!profile) return 'advisory';
  return profile.authorityLevel || 'advisory';
};

/**
 * Generates a simple, demo-friendly DSL snippet for an agent
 */
export const generateAgentDSL = (agent: Agent): string => {
  const lines: string[] = [];
  
  // Agent declaration
  lines.push(`agent ${agent.name.replace(/\s+/g, '')} {`);
  
  // Role
  if (agent.workflowRole) {
    lines.push(`  role: ${agent.workflowRole.toLowerCase()}`);
  }
  
  // Authority
  const authority = agent.governanceProfile 
    ? mapGovernanceAuthority(agent.governanceProfile)
    : mapAuthorityLevel(agent.authorityLevel);
  lines.push(`  authority: ${authority}`);
  
  // Archetype
  lines.push(`  archetype: ${agent.archetype.toLowerCase()}`);
  
  // Inputs (simplified)
  if (agent.inputs.length > 0) {
    const inputNames = agent.inputs.slice(0, 3).map(i => i.name).join(', ');
    const more = agent.inputs.length > 3 ? ', ...' : '';
    lines.push(`  inputs: [${inputNames}${more}]`);
  }
  
  // Outputs (simplified)
  if (agent.outputs.length > 0) {
    const outputNames = agent.outputs.slice(0, 3).map(o => o.name).join(', ');
    const more = agent.outputs.length > 3 ? ', ...' : '';
    lines.push(`  outputs: [${outputNames}${more}]`);
  }
  
  // Governance (key controls only)
  if (agent.governanceControls.length > 0) {
    const enabledControls = agent.governanceControls
      .filter(c => c.enabled)
      .slice(0, 2)
      .map(c => c.type);
    if (enabledControls.length > 0) {
      lines.push(`  governance: [${enabledControls.join(', ')}]`);
    }
  }
  
  // Escalation
  if (agent.escalationCriteria && agent.escalationCriteria.length > 0) {
    lines.push(`  escalates: true`);
  }
  
  lines.push(`}`);
  
  return lines.join('\n');
};

/**
 * Generates a more detailed DSL with governance profile
 */
export const generateDetailedAgentDSL = (agent: Agent): string => {
  const lines: string[] = [];
  
  lines.push(`agent ${agent.name.replace(/\s+/g, '')} {`);
  lines.push(`  // ${agent.description}`);
  lines.push('');
  
  // Basic properties
  lines.push(`  role: ${agent.workflowRole?.toLowerCase() || 'generic'}`);
  lines.push(`  archetype: ${agent.archetype.toLowerCase()}`);
  lines.push(`  vertical: ${agent.verticalId}`);
  lines.push('');
  
  // Governance profile
  if (agent.governanceProfile) {
    lines.push('  governance {');
    lines.push(`    authority: ${agent.governanceProfile.authorityLevel}`);
    
    if (agent.governanceProfile.autonomyDescription) {
      lines.push(`    autonomy: "${agent.governanceProfile.autonomyDescription}"`);
    }
    
    if (agent.governanceProfile.boundaries && agent.governanceProfile.boundaries.length > 0) {
      lines.push('    boundaries: [');
      agent.governanceProfile.boundaries.forEach(b => {
        lines.push(`      "${b}"`);
      });
      lines.push('    ]');
    }
    
    if (agent.governanceProfile.humanInTheLoop && agent.governanceProfile.humanInTheLoop.length > 0) {
      lines.push('    human_review: [');
      agent.governanceProfile.humanInTheLoop.forEach(h => {
        lines.push(`      "${h}"`);
      });
      lines.push('    ]');
    }
    
    lines.push('  }');
    lines.push('');
  }
  
  // Inputs
  lines.push('  inputs {');
  agent.inputs.forEach(input => {
    const required = input.required ? ' (required)' : '';
    lines.push(`    ${input.name}: ${input.type}${required}`);
  });
  lines.push('  }');
  lines.push('');
  
  // Outputs
  lines.push('  outputs {');
  agent.outputs.forEach(output => {
    lines.push(`    ${output.name}: ${output.type}`);
  });
  lines.push('  }');
  
  lines.push(`}`);
  
  return lines.join('\n');
};

/**
 * Generates a workflow-focused DSL showing agent relationships
 */
export const generateWorkflowDSL = (agent: Agent): string => {
  const lines: string[] = [];
  
  lines.push(`// Workflow context for ${agent.name}`);
  lines.push('');
  lines.push(`agent ${agent.name.replace(/\s+/g, '')} {`);
  lines.push(`  role: ${agent.workflowRole?.toLowerCase() || 'generic'}`);
  
  // Related agents
  if (agent.relatedAgents) {
    if (agent.relatedAgents.dependsOn && agent.relatedAgents.dependsOn.length > 0) {
      lines.push('');
      lines.push('  depends_on: [');
      agent.relatedAgents.dependsOn.forEach(id => {
        lines.push(`    ${id}`);
      });
      lines.push('  ]');
    }
    
    if (agent.relatedAgents.supports && agent.relatedAgents.supports.length > 0) {
      lines.push('');
      lines.push('  supports: [');
      agent.relatedAgents.supports.forEach(id => {
        lines.push(`    ${id}`);
      });
      lines.push('  ]');
    }
  }
  
  lines.push(`}`);
  
  return lines.join('\n');
};

/**
 * Determines related agents based on workflow role heuristics
 */
export const inferRelatedAgents = (
  agent: Agent,
  allAgents: Agent[]
): { dependsOn: string[]; supports: string[]; oftenUsedWith: string[] } => {
  const related = {
    dependsOn: [] as string[],
    supports: [] as string[],
    oftenUsedWith: [] as string[],
  };
  
  if (!agent.workflowRole) return related;
  
  // Role-based relationship heuristics
  const roleRelationships: Record<WorkflowRole, { before: WorkflowRole[]; after: WorkflowRole[] }> = {
    'Intake': { before: [], after: ['Evidence', 'Fraud', 'Policy'] },
    'Evidence': { before: ['Intake'], after: ['Fraud', 'Policy'] },
    'Fraud': { before: ['Intake', 'Evidence'], after: ['Policy', 'Settlement'] },
    'Policy': { before: ['Intake', 'Evidence', 'Fraud'], after: ['Settlement'] },
    'Settlement': { before: ['Policy', 'Fraud'], after: ['Compliance'] },
    'Supervision': { before: [], after: [] },
    'Compliance': { before: ['Settlement'], after: [] },
    'Generic': { before: [], after: [] },
  };
  
  const relationships = roleRelationships[agent.workflowRole];
  
  allAgents.forEach(other => {
    if (other.id === agent.id || !other.workflowRole) return;
    
    // Check if this agent depends on the other
    if (relationships.before.includes(other.workflowRole)) {
      related.dependsOn.push(other.id);
    }
    
    // Check if this agent supports the other
    if (relationships.after.includes(other.workflowRole)) {
      related.supports.push(other.id);
    }
    
    // Same vertical = often used together
    if (other.verticalId === agent.verticalId && other.workflowRole !== agent.workflowRole) {
      related.oftenUsedWith.push(other.id);
    }
  });
  
  return related;
};

// Made with Bob
