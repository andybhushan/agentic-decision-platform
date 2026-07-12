// Build a clean, typed model module from the exported Insurance Claims Process JSON.
// Source: the workshop export (claims-model.json). Output: src/data/claimsModel.ts.
// Re-run with: node scripts/buildClaimsModel.mjs <path-to-source-json>
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = process.argv[2];
if (!srcPath) {
  console.error('Usage: node scripts/buildClaimsModel.mjs <path-to-source-json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(srcPath, 'utf8'));
const topProps = raw.metadata.nodeProperties || {};
const nodeLabels = Object.fromEntries((raw.model.nodes || []).map((n) => [n.id, n.label]));

// Top-level edges from the model.
const topEdges = (raw.model.edges || [])
  .map((e) => ({ source: e.source ?? e.from, target: e.target ?? e.to }))
  .filter((e) => e.source && e.target);

const pick = (p) => ({
  description: p.description || '',
  capability: p.capability || '',
  primaryActor: p.primaryActor || '',
  architectureRole: p.architectureRole || '',
  channelType: p.channelType || '',
  scope: p.scope || '',
  customerImpact: p.customerImpact || '',
  pillar: p.pillar || '',
  constraintsAssumptions: p.constraintsAssumptions || '',
  purpose: p.purpose || '',
  dataIn: Array.isArray(p.dataIn) ? p.dataIn.filter(Boolean) : [],
  dataOut: Array.isArray(p.dataOut) ? p.dataOut.filter(Boolean) : [],
  technologies: Array.isArray(p.technologies) ? p.technologies.filter(Boolean) : [],
  supportingSystems: Array.isArray(p.supportingSystems) ? p.supportingSystems.filter(Boolean) : [],
  integrations: Array.isArray(p.integrations) ? p.integrations.filter(Boolean) : [],
  referencedTechnologies:
    p.workshopContext && Array.isArray(p.workshopContext.referencedTechnologies)
      ? p.workshopContext.referencedTechnologies.filter(Boolean)
      : [],
  controls: p.controls && typeof p.controls === 'object' ? {
    authRequired: !!p.controls.authRequired,
    dataSensitivity: p.controls.dataSensitivity || '',
    auditLogging: !!p.controls.auditLogging,
    regulatoryTags: Array.isArray(p.controls.regulatoryTags) ? p.controls.regulatoryTags.filter(Boolean) : [],
  } : undefined,
  agent: p.agent && typeof p.agent === 'object' && Object.keys(p.agent).length ? {
    agentMode: p.agent.agentMode || '',
    agentRole: p.agent.agentRole || '',
    assertionLevel: p.agent.assertionLevel || '',
    scope: p.agent.scope || '',
    runtime: p.agent.runtime || '',
    toolInvocation: p.agent.toolInvocation || '',
    orchestrator: p.agent.orchestrator || '',
    hosting: p.agent.hosting || '',
    knowledgeRetrieval: p.agent.knowledgeRetrieval || '',
    confidenceThreshold: typeof p.agent.confidenceThreshold === 'number' ? p.agent.confidenceThreshold : undefined,
    escalationPath: p.agent.escalationPath || '',
    memoryScope: p.agent.memoryScope || '',
    decisionBoundary: p.agent.decisionBoundary || '',
    narrative: p.agent.narrative || '',
  } : undefined,
});

const clean = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === '' || v === false) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = clean(v);
      if (Object.keys(inner).length === 0) continue;
      out[k] = inner;
      continue;
    }
    out[k] = v;
  }
  return out;
};

// ---- Top-level nodes ----
const topNodes = {};
for (const [id, p] of Object.entries(topProps)) {
  topNodes[id] = clean({
    id,
    name: p.stepName || nodeLabels[id] || id,
    stepType: p.stepType || 'node',
    ...pick(p),
  });
}

// ---- Sub-flows ----
function parseSubflowDsl(dsl) {
  const lines = dsl.split('\n');
  const metaLine = lines.find((l) => l.includes('DIAGRAM_METADATA'));
  let props = {};
  if (metaLine) {
    const jsonStr = metaLine.replace(/^\s*%%\s*/, '');
    try {
      props = JSON.parse(jsonStr).nodeProperties || {};
    } catch (e) {
      console.warn('  failed to parse subflow metadata:', e.message);
    }
  }
  const edges = [];
  const seen = new Set();
  for (const l of lines) {
    if (l.includes('DIAGRAM_METADATA')) continue;
    // SOURCE --> TARGET, optionally with an |edge label| and/or a TARGET[node label].
    // Capture only the bare node ids on each side (stop before [, (, " or whitespace).
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*-->\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)/);
    if (m) {
      const source = m[1];
      const target = m[2];
      const key = source + '->' + target;
      if (source && target && !seen.has(key)) {
        seen.add(key);
        edges.push({ source, target });
      }
    }
  }
  return { props, edges };
}

const subflows = {};
for (const [key, dsl] of Object.entries(raw.metadata.subflowDsls || {})) {
  const parentId = key.split('/').pop();
  const { props, edges } = parseSubflowDsl(dsl);
  const ids = Object.keys(props);
  if (ids.length === 0) continue;
  const nodes = ids.map((id) =>
    clean({ id, name: props[id].stepName || id, stepType: props[id].stepType || 'node', ...pick(props[id]) }),
  );
  const idSet = new Set(ids);
  const validEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));
  const incoming = new Set(validEdges.map((e) => e.target));
  const orch = nodes.find((n) => n.stepType === 'ai_orchestration');
  const noIncoming = nodes.find((n) => !incoming.has(n.id));
  // Prefer the true process entry (no incoming edge) so ordering reads naturally;
  // fall back to the orchestrator, then the first declared node.
  const rootId = (noIncoming || orch || nodes[0]).id;
  subflows[parentId] = { parentId, rootId, nodes, edges: validEdges };
}

const richSubflows = {};
for (const [k, v] of Object.entries(subflows)) {
  if (v.nodes.length > 1) richSubflows[k] = v;
}

const banner = `// AUTO-GENERATED from the Insurance Claims Process export. Do not edit by hand.
// Regenerate: node scripts/buildClaimsModel.mjs <path-to-source-json>
/* eslint-disable */
`;

const types = `
export interface AgentMeta {
  agentMode?: string;
  agentRole?: string;
  assertionLevel?: string;
  scope?: string;
  runtime?: string;
  toolInvocation?: string;
  orchestrator?: string;
  hosting?: string;
  knowledgeRetrieval?: string;
  confidenceThreshold?: number;
  escalationPath?: string;
  memoryScope?: string;
  decisionBoundary?: string;
  narrative?: string;
}

export interface ModelControls {
  authRequired?: boolean;
  dataSensitivity?: string;
  auditLogging?: boolean;
  regulatoryTags?: string[];
}

export interface ModelNode {
  id: string;
  name: string;
  stepType: string;
  description?: string;
  capability?: string;
  primaryActor?: string;
  architectureRole?: string;
  channelType?: string;
  scope?: string;
  customerImpact?: string;
  pillar?: string;
  constraintsAssumptions?: string;
  purpose?: string;
  dataIn?: string[];
  dataOut?: string[];
  technologies?: string[];
  supportingSystems?: string[];
  integrations?: string[];
  referencedTechnologies?: string[];
  controls?: ModelControls;
  agent?: AgentMeta;
}

export interface SubflowEdge {
  source: string;
  target: string;
}

export interface Subflow {
  parentId: string;
  rootId: string;
  nodes: ModelNode[];
  edges: SubflowEdge[];
}
`;

const bodyParts = [];
bodyParts.push(`\nexport const modelNodes: Record<string, ModelNode> = ${JSON.stringify(topNodes, null, 2)};\n`);
bodyParts.push(`\nexport const topEdges: SubflowEdge[] = ${JSON.stringify(topEdges, null, 2)};\n`);
bodyParts.push(`\nexport const subflows: Record<string, Subflow> = ${JSON.stringify(richSubflows, null, 2)};\n`);
bodyParts.push(`
export function getModelNode(id: string): ModelNode | undefined {
  return modelNodes[id];
}

export function getSubflow(parentId: string): Subflow | undefined {
  return subflows[parentId];
}

export function getSubflowNode(parentId: string, stepId: string): ModelNode | undefined {
  return subflows[parentId]?.nodes.find((n) => n.id === stepId);
}
`);

const outPath = join(__dirname, '..', 'src', 'data', 'claimsModel.ts');
writeFileSync(outPath, banner + types + bodyParts.join(''), 'utf8');
console.log('Wrote', outPath);
console.log('Top nodes:', Object.keys(topNodes).length);
console.log('Sub-flows:', Object.keys(richSubflows).map((k) => `${k}(${richSubflows[k].nodes.length})`).join(', '));
