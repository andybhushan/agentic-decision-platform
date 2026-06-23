export interface ProjectNavItem {
  id: string;
  label: string;
}
export interface ProjectNavSection {
  title: string;
  iconKey: "hub" | "brief" | "vision" | "what" | "method" | "roadmap" | "showcase" | "reflect";
  items: ProjectNavItem[];
}

export const PROJECT_NAV: ProjectNavSection[] = [
  {
    title: "Start here",
    iconKey: "hub",
    items: [
      { id: "hub", label: "Hub · Welcome" },
      { id: "brief", label: "The Brief" },
    ],
  },
  {
    title: "The story",
    iconKey: "vision",
    items: [
      { id: "vision", label: "Vision & Why" },
      { id: "what-how", label: "What & How I built it" },
      { id: "methodology", label: "Methodology · How I worked" },
    ],
  },
  {
    title: "Path forward",
    iconKey: "roadmap",
    items: [
      { id: "roadmap", label: "Roadmap" },
      { id: "showcase", label: "Showcase" },
      { id: "studio", label: "Studio · generate visuals" },
      { id: "reflection", label: "Reflection" },
    ],
  },
];

export const DEFAULT_PROJECT_ROUTE = "hub";

export function findProjectCurrent(routeId: string): { section: ProjectNavSection; item: ProjectNavItem } | null {
  for (const section of PROJECT_NAV) {
    for (const item of section.items) {
      if (item.id === routeId) return { section, item };
    }
  }
  return null;
}

export function getProjectPrevNext(routeId: string): { prev: ProjectNavItem | null; next: ProjectNavItem | null } {
  const flat: ProjectNavItem[] = PROJECT_NAV.flatMap((s) => s.items);
  const idx = flat.findIndex((i) => i.id === routeId);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}
