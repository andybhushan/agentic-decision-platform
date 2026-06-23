export interface NavItem {
  id: string;
  label: string;
}
export interface NavSection {
  title: string;
  iconKey: "home" | "platform" | "usecase" | "deploy" | "decisions" | "reference";
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "Overview",
    iconKey: "home",
    items: [
      { id: "home", label: "Welcome" },
      { id: "mission", label: "Mission · Vision · Goals" },
      { id: "overview", label: "System Overview" },
      { id: "tech-stack", label: "Technology Stack" },
      { id: "live-status", label: "Live Operational Status" },
    ],
  },
  {
    title: "Platform",
    iconKey: "platform",
    items: [
      { id: "platform/layers", label: "Ten Platform Layers" },
      { id: "platform/app-arch", label: "Application Architecture" },
      { id: "platform/compile", label: "Compile Pipeline" },
      { id: "platform/runtime", label: "Runtime & Orchestration" },
      { id: "platform/l5", label: "L5 Federation (IQ Trio)" },
      { id: "platform/hitl", label: "HITL Gates" },
      { id: "platform/ontology", label: "Ontology + Regulatory Binding" },
      { id: "platform/boundary", label: "Boundary & Agnostic Proof" },
    ],
  },
  {
    title: "Use Cases",
    iconKey: "usecase",
    items: [
      { id: "meridian/overview", label: "Meridian · Customer Brief" },
      { id: "meridian/as-is", label: "Meridian · AS-IS Today" },
      { id: "meridian/to-be", label: "Meridian · TO-BE with ADP" },
      { id: "meridian/personas", label: "Meridian · Personas & Journey" },
      { id: "meridian/workers", label: "Meridian · 4 Digital Workers" },
      { id: "meridian/knowledge", label: "Meridian · Knowledge Corpus" },
      { id: "meridian/demo", label: "Meridian · Demo Script" },
      { id: "banking", label: "Banking · Stress Test" },
    ],
  },
  {
    title: "Deployment",
    iconKey: "deploy",
    items: [
      { id: "deploy/resources", label: "Azure Resources" },
      { id: "deploy/hierarchy", label: "Resource Group Structure" },
      { id: "deploy/topology", label: "Deployment Topology" },
      { id: "deploy/bicep", label: "Bicep & IaC" },
      { id: "deploy/runbook", label: "Provisioning Runbook" },
      { id: "deploy/cost", label: "Cost & Operations" },
    ],
  },
  {
    title: "Decisions",
    iconKey: "decisions",
    items: [
      { id: "adrs", label: "All 16 ADRs" },
    ],
  },
  {
    title: "Reference",
    iconKey: "reference",
    items: [
      { id: "repo", label: "Repo at a Glance" },
      { id: "honest-gaps", label: "Honest Gaps · v1.5" },
      { id: "team-alignment", label: "Team Repo Alignment" },
      { id: "glossary", label: "Glossary" },
    ],
  },
];

export function findCurrent(routeId: string): { section: NavSection; item: NavItem } | null {
  for (const section of NAV) {
    for (const item of section.items) {
      if (item.id === routeId) return { section, item };
    }
  }
  return null;
}

export function getPrevNext(routeId: string): { prev: NavItem | null; next: NavItem | null } {
  const flat: NavItem[] = NAV.flatMap((s) => s.items);
  const idx = flat.findIndex((i) => i.id === routeId);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

export const DEFAULT_ROUTE = "home";
