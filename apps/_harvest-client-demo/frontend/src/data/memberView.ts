// Composition helpers that bridge the curated workforce blueprint
// (claimsWorkforce.ts) with the real exported process model (claimsModel.ts).
// The model is the source of truth for factual per-node detail; the curated
// workforce supplies stage grouping, kind and the coordination narrative.
import type { WorkforceMemberKind } from './claimsWorkforce.seed';
import type { ModelNode, Subflow } from './claimsModel';

const stepTypeKind: Record<string, WorkforceMemberKind> = {
  ai_orchestration: 'orchestrator',
  ai_agent_task: 'agent',
  human_task: 'human',
  decision_rules: 'rules',
  data_operation: 'system',
  channel_interaction: 'channel',
};

export const stepTypeToKind = (stepType: string | undefined): WorkforceMemberKind =>
  (stepType && stepTypeKind[stepType]) || 'agent';

/** Human-readable label for a snake/camel coded enum value (e.g. semi_autonomous). */
export const prettyValue = (v: string | undefined): string => {
  if (!v) return '';
  return v
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Order a sub-flow's nodes breadth-first from its root, appending any orphans. */
export const subflowOrder = (sf: Subflow): ModelNode[] => {
  const byId = new Map(sf.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  for (const e of sf.edges) {
    const list = adjacency.get(e.source) ?? [];
    list.push(e.target);
    adjacency.set(e.source, list);
  }
  const ordered: ModelNode[] = [];
  const seen = new Set<string>();
  const queue: string[] = byId.has(sf.rootId) ? [sf.rootId] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) ordered.push(node);
    for (const next of adjacency.get(id) ?? []) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  // Append any nodes not reachable from the root so nothing is hidden.
  for (const n of sf.nodes) {
    if (!seen.has(n.id)) ordered.push(n);
  }
  return ordered;
};

const sanitizeLabel = (s: string): string =>
  s
    .replace(/"/g, "'")
    .replace(/[\r\n]+/g, ' ')
    .replace(/[[\]{}<>]/g, '')
    .trim();

// Namespaced mermaid id so sub-flow-local ids (which collide across sub-flows
// and with top-level ids) never clash inside a rendered diagram.
const mermaidId = (parentId: string, nodeId: string): string =>
  `sf_${parentId}_${nodeId}`.replace(/[^A-Za-z0-9_]/g, '_');

/** Build a self-contained `flowchart` DSL for a sub-flow, coloured by step kind. */
export const buildSubflowMermaid = (sf: Subflow): string => {
  const lines: string[] = ['flowchart LR'];
  lines.push('classDef orchestrator fill:#6929c4,stroke:#a56eff,color:#ffffff;');
  lines.push('classDef agent fill:#0043ce,stroke:#4589ff,color:#ffffff;');
  lines.push('classDef human fill:#005d5d,stroke:#3ddbd9,color:#ffffff;');
  lines.push('classDef rules fill:#00539a,stroke:#33b1ff,color:#ffffff;');
  lines.push('classDef system fill:#393939,stroke:#8d8d8d,color:#ffffff;');
  lines.push('classDef channel fill:#198038,stroke:#42be65,color:#ffffff;');

  for (const n of sf.nodes) {
    const kind = stepTypeToKind(n.stepType);
    lines.push(`${mermaidId(sf.parentId, n.id)}["${sanitizeLabel(n.name)}"]:::${kind}`);
  }
  for (const e of sf.edges) {
    lines.push(`${mermaidId(sf.parentId, e.source)} --> ${mermaidId(sf.parentId, e.target)}`);
  }
  return lines.join('\n');
};
