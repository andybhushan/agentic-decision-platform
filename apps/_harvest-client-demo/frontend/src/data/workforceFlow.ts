// End-to-end flow for the Claims Processing Workforce.
//
// The edge list below is the exact graph from the source DSL the claims process
// was modelled from (a Mermaid `flowchart LR`). The node IDs (N1..N42, A) map
// 1:1 onto the Digital Workers / agents / humans / systems defined in
// `claimsWorkforce.ts`, so we render the *real* names and colour each node by
// its kind. This keeps the diagram factually faithful to the DSL while being
// readable.

import { claimsWorkforce, type Workforce } from './claimsWorkforce.seed';
import type { WorkforceMemberKind } from './claimsWorkforce.seed';

// Faithful edge list from the source DSL (from -> to).
const EDGES: ReadonlyArray<readonly [string, string]> = [
  ['A', 'N1'],
  ['N1', 'N2'],
  ['N1', 'N3'],
  ['N1', 'N4'],
  ['N1', 'N5'],
  ['N2', 'N7'],
  ['N3', 'N7'],
  ['N4', 'N7'],
  ['N5', 'N6'],
  ['N7', 'N6'],
  ['N7', 'N8'],
  ['N8', 'N10'],
  ['N8', 'N9'],
  ['N8', 'N19'],
  ['N10', 'N11'],
  ['N9', 'N11'],
  ['N19', 'N11'],
  ['N11', 'N18'],
  ['N18', 'N27'],
  ['N7', 'N12'],
  ['N12', 'N13'],
  ['N12', 'N14'],
  ['N12', 'N15'],
  ['N12', 'N16'],
  ['N13', 'N17'],
  ['N14', 'N17'],
  ['N15', 'N17'],
  ['N16', 'N17'],
  ['N17', 'N29'],
  ['N7', 'N20'],
  ['N20', 'N21'],
  ['N20', 'N23'],
  ['N20', 'N24'],
  ['N21', 'N25'],
  ['N23', 'N25'],
  ['N24', 'N25'],
  ['N24', 'N28'],
  ['N25', 'N28'],
  ['N28', 'N31'],
  ['N31', 'N32'],
  ['N31', 'N33'],
  ['N32', 'N33'],
  ['N33', 'N34'],
  ['N34', 'N35'],
  ['N35', 'N22'],
  ['N22', 'N37'],
  ['N22', 'N38'],
  ['N22', 'N39'],
  ['N22', 'N40'],
  ['N22', 'N41'],
  ['N37', 'N42'],
  ['N38', 'N42'],
  ['N39', 'N42'],
  ['N40', 'N42'],
  ['N41', 'N42'],
];

interface FlowNode {
  label: string;
  kind: WorkforceMemberKind | 'start';
}

// Build id -> { label, kind } from the provided workforce (or seed fallback), then add the
// two structural nodes that only exist in the DSL (the Start marker and the
// first-notification-of-loss intake fan-out).
function buildNodeMap(workforce: Workforce = claimsWorkforce): Record<string, FlowNode> {
  const map: Record<string, FlowNode> = {
    A: { label: 'Start', kind: 'start' },
    N1: { label: 'First Notification of Loss', kind: 'channel' },
  };
  for (const stage of workforce.stages) {
    for (const m of stage.members) {
      map[m.id] = { label: m.name, kind: m.kind };
    }
  }
  return map;
}

function shapeFor(kind: FlowNode['kind'], label: string): string {
  const safe = `"${label}"`;
  switch (kind) {
    case 'start':
      return `((${safe}))`;
    case 'orchestrator':
      return `{{${safe}}}`;
    case 'human':
      return `([${safe}])`;
    case 'rules':
      return `{${safe}}`;
    case 'system':
      return `[(${safe})]`;
    case 'channel':
      return `(${safe})`;
    case 'agent':
    default:
      return `[${safe}]`;
  }
}

export interface FlowLegendItem {
  kind: FlowNode['kind'];
  label: string;
}

export const flowLegend: FlowLegendItem[] = [
  { kind: 'start', label: 'Start / End' },
  { kind: 'orchestrator', label: 'Digital Worker' },
  { kind: 'agent', label: 'Agent' },
  { kind: 'human', label: 'Human-in-the-loop' },
  { kind: 'rules', label: 'Rules engine' },
  { kind: 'system', label: 'System of record' },
  { kind: 'channel', label: 'Intake channel' },
];

const CLASS_DEFS: string[] = [
  'classDef start fill:#161616,stroke:#f4f4f4,stroke-width:1px,color:#f4f4f4;',
  'classDef orchestrator fill:#6929c4,stroke:#be95ff,stroke-width:2px,color:#ffffff;',
  'classDef agent fill:#0043ce,stroke:#78a9ff,stroke-width:1px,color:#ffffff;',
  'classDef human fill:#005d5d,stroke:#3ddbd9,stroke-width:1px,color:#ffffff;',
  'classDef rules fill:#00539a,stroke:#82cfff,stroke-width:1px,color:#ffffff;',
  'classDef system fill:#393939,stroke:#a8a8a8,stroke-width:1px,color:#f4f4f4;',
  'classDef channel fill:#0e6027,stroke:#6fdc8c,stroke-width:1px,color:#ffffff;',
];

// Generate the Mermaid source for the end-to-end flow.
// Accepts the live workforce from Cosmos; falls back to the seed if not provided.
export function buildWorkforceFlowDsl(workforce?: Workforce): string {
  const nodes = buildNodeMap(workforce);

  // Declare every node referenced by an edge, in first-seen order, with its
  // shape + colour class.
  const seen = new Set<string>();
  const order: string[] = [];
  for (const [from, to] of EDGES) {
    for (const id of [from, to]) {
      if (!seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
  }

  const lines: string[] = ['flowchart LR'];

  for (const id of order) {
    const node = nodes[id] ?? { label: id, kind: 'agent' as const };
    lines.push(`  ${id}${shapeFor(node.kind, node.label)}:::${node.kind}`);
  }

  for (const [from, to] of EDGES) {
    lines.push(`  ${from} --> ${to}`);
  }

  for (const def of CLASS_DEFS) {
    lines.push(`  ${def}`);
  }

  return lines.join('\n');
}

// The module-level constant is kept for backward compatibility (seed fallback).
export const workforceFlowDsl = buildWorkforceFlowDsl();

export interface FlowConnection {
  id: string;
  name: string;
  /** True when the node is a real workforce member with its own details page. */
  isMember: boolean;
}

function buildMemberIds(workforce: Workforce = claimsWorkforce): Set<string> {
  return new Set<string>(workforce.stages.flatMap((s) => s.members.map((m) => m.id)));
}

function toConnection(id: string, nodes: Record<string, FlowNode>, ids: Set<string>): FlowConnection {
  return {
    id,
    name: nodes[id]?.label ?? id,
    isMember: ids.has(id),
  };
}

/**
 * Upstream (feeds into) and downstream (hands off to) nodes for a member,
 * derived from the source DSL edges. Deduplicated; structural nodes (A / N1)
 * are included by name but flagged as non-members so the UI can render them
 * without a link.
 *
 * Accepts the live workforce from Cosmos; falls back to the seed if not provided.
 */
export function getMemberConnections(memberId: string, workforce?: Workforce): {
  upstream: FlowConnection[];
  downstream: FlowConnection[];
} {
  const nodes = buildNodeMap(workforce);
  const ids = buildMemberIds(workforce);
  const upstream = new Map<string, FlowConnection>();
  const downstream = new Map<string, FlowConnection>();

  for (const [from, to] of EDGES) {
    if (to === memberId && from !== memberId && !upstream.has(from)) {
      upstream.set(from, toConnection(from, nodes, ids));
    }
    if (from === memberId && to !== memberId && !downstream.has(to)) {
      downstream.set(to, toConnection(to, nodes, ids));
    }
  }

  return { upstream: [...upstream.values()], downstream: [...downstream.values()] };
}
