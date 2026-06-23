import { useEffect, useState, useMemo } from "react";
import { makeStyles, tokens, Button } from "@fluentui/react-components";
import { ChevronRight20Regular, ChevronLeft20Regular, Navigation20Regular } from "@fluentui/react-icons";
import { Home, CubeView, Industry, CloudUpload, Document, Catalog } from "@carbon/icons-react";
import { NAV, DEFAULT_ROUTE, findCurrent, getPrevNext } from "./docs/nav";
import {
  HomePage, MissionPage, SystemOverviewPage, TechStackPage, LiveStatusPage,
} from "./docs/sections/overview";
import {
  PlatformLayersPage, PlatformAppArchPage, PlatformCompilePage, PlatformRuntimePage,
  PlatformL5Page, PlatformHitlPage, PlatformBoundaryPage, PlatformOntologyPage,
} from "./docs/sections/platform";
import {
  MeridianOverviewPage, MeridianPersonasPage, MeridianWorkersPage, MeridianKnowledgePage, MeridianDemoPage, BankingPage,
  MeridianAsIsPage, MeridianToBePage,
} from "./docs/sections/usecases";
import {
  DeployResourcesPage, DeployTopologyPage, DeployBicepPage, DeployRunbookPage, DeployCostPage,
  DeployHierarchyPage,
} from "./docs/sections/deployment";
import { AdrsPage } from "./docs/sections/adrs";
import { RepoPage, HonestGapsPage, GlossaryPage, TeamAlignmentPage } from "./docs/sections/reference";
import { DocsFooter } from "./docs/common";

const useStyles = makeStyles({
  shell: {
    display: "flex",
    minHeight: "calc(100vh - 56px)",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  sidebar: {
    width: "260px",
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    position: "sticky",
    top: "56px",
    alignSelf: "flex-start",
    maxHeight: "calc(100vh - 56px)",
    overflowY: "auto",
    overflowX: "hidden",
  },
  sidebarMobile: { display: "none" },
  sidebarHeader: {
    padding: "20px 18px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  sidebarBadge: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: tokens.colorBrandForeground1,
  },
  sidebarTitle: { fontSize: "15px", fontWeight: 700, color: tokens.colorNeutralForeground1 },
  sidebarSub: { fontSize: "11px", color: tokens.colorNeutralForeground3, marginTop: "2px" },
  nav: { padding: "8px 0 40px" },
  navGroup: { marginBottom: "8px" },
  navGroupTitle: {
    padding: "14px 18px 6px",
    fontSize: "10px",
    fontWeight: 700,
    color: tokens.colorNeutralForeground3,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 18px",
    fontSize: "13px",
    color: tokens.colorNeutralForeground2,
    cursor: "pointer",
    borderLeft: "3px solid transparent",
    transition: "background 80ms ease, color 80ms ease",
    "&:hover": { backgroundColor: tokens.colorNeutralBackground1Hover, color: tokens.colorNeutralForeground1 },
  },
  navItemActive: {
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    fontWeight: 600,
  },
  content: {
    flex: 1,
    padding: "32px 48px 48px",
    minWidth: 0,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  breadcrumb: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  breadcrumbActive: { color: tokens.colorBrandForeground1, fontWeight: 600 },
  prevNext: {
    marginTop: "60px",
    paddingTop: "24px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  pnLink: {
    flex: "1 1 280px",
    padding: "12px 16px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "6px",
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: "pointer",
    transition: "border-color 100ms ease",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: "200px",
  },
  pnLabel: { fontSize: "10px", color: tokens.colorNeutralForeground3, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 700 },
  pnTitle: { fontSize: "14px", color: tokens.colorNeutralForeground1, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" },
  toggle: {
    display: "none",
    position: "fixed",
    top: "70px",
    left: "10px",
    zIndex: 20,
    "@media (max-width: 900px)": { display: "block" },
  },
});

function routeFromHash(): string {
  const h = window.location.hash || "";
  if (h.startsWith("#docs/")) {
    const rest = h.slice(6);
    return rest || DEFAULT_ROUTE;
  }
  if (h === "#docs") return DEFAULT_ROUTE;
  return DEFAULT_ROUTE;
}

function renderPage(routeId: string) {
  switch (routeId) {
    case "home": return <HomePage />;
    case "mission": return <MissionPage />;
    case "overview": return <SystemOverviewPage />;
    case "tech-stack": return <TechStackPage />;
    case "live-status": return <LiveStatusPage />;
    case "platform/layers": return <PlatformLayersPage />;
    case "platform/app-arch": return <PlatformAppArchPage />;
    case "platform/compile": return <PlatformCompilePage />;
    case "platform/runtime": return <PlatformRuntimePage />;
    case "platform/l5": return <PlatformL5Page />;
    case "platform/hitl": return <PlatformHitlPage />;
    case "platform/ontology": return <PlatformOntologyPage />;
    case "platform/boundary": return <PlatformBoundaryPage />;
    case "meridian/overview": return <MeridianOverviewPage />;
    case "meridian/as-is": return <MeridianAsIsPage />;
    case "meridian/to-be": return <MeridianToBePage />;
    case "meridian/personas": return <MeridianPersonasPage />;
    case "meridian/workers": return <MeridianWorkersPage />;
    case "meridian/knowledge": return <MeridianKnowledgePage />;
    case "meridian/demo": return <MeridianDemoPage />;
    case "banking": return <BankingPage />;
    case "deploy/resources": return <DeployResourcesPage />;
    case "deploy/hierarchy": return <DeployHierarchyPage />;
    case "deploy/topology": return <DeployTopologyPage />;
    case "deploy/bicep": return <DeployBicepPage />;
    case "deploy/runbook": return <DeployRunbookPage />;
    case "deploy/cost": return <DeployCostPage />;
    case "adrs": return <AdrsPage />;
    case "repo": return <RepoPage />;
    case "honest-gaps": return <HonestGapsPage />;
    case "team-alignment": return <TeamAlignmentPage />;
    case "glossary": return <GlossaryPage />;
    default: return <HomePage />;
  }
}

function navigate(id: string) {
  window.location.hash = `docs/${id}`;
}

const NAV_ICONS = {
  home: Home,
  platform: CubeView,
  usecase: Industry,
  deploy: CloudUpload,
  decisions: Document,
  reference: Catalog,
} as const;

export function DocsPortal() {
  const styles = useStyles();
  const [route, setRoute] = useState<string>(routeFromHash());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onHash = () => {
      setRoute(routeFromHash());
      setMobileNavOpen(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Scroll to top whenever the route changes — runs AFTER React renders the new page.
  // Uses "instant" so we don't animate a long distance that React might cancel mid-frame.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [route]);

  const current = useMemo(() => findCurrent(route), [route]);
  const { prev, next } = useMemo(() => getPrevNext(route), [route]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} style={mobileNavOpen ? { display: "block" } : undefined}>
        <div className={styles.sidebarHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <img src="/images/adp/adp-logo.webp" alt="" style={{ width: "34px", height: "34px", borderRadius: "6px", objectFit: "cover" }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className={styles.sidebarBadge}>Docs · v1.0</span>
              <span className={styles.sidebarTitle}>Project ADP</span>
            </div>
          </div>
          <span className={styles.sidebarSub}>Microsoft-native agentic platform</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map((section) => {
            const IconCmp = NAV_ICONS[section.iconKey];
            return (
            <div key={section.title} className={styles.navGroup}>
              <div className={styles.navGroupTitle}>
                <IconCmp size={14} /> {section.title}
              </div>
              {section.items.map((item) => {
                const active = route === item.id;
                return (
                  <div
                    key={item.id}
                    className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                    onClick={() => navigate(item.id)}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>
            );
          })}
        </nav>
      </aside>

      <Button
        className={styles.toggle}
        icon={<Navigation20Regular />}
        appearance="primary"
        size="small"
        onClick={() => setMobileNavOpen((v) => !v)}
      >
        Nav
      </Button>

      <main className={styles.content}>
        {current && (
          <div className={styles.breadcrumb}>
            <span>Docs</span>
            <ChevronRight20Regular style={{ width: 12, height: 12 }} />
            <span>{current.section.title}</span>
            <ChevronRight20Regular style={{ width: 12, height: 12 }} />
            <span className={styles.breadcrumbActive}>{current.item.label}</span>
          </div>
        )}

        {renderPage(route)}

        {(prev || next) && (
          <div className={styles.prevNext} key="prev-next-container">
            {prev ? (
              <div className={styles.pnLink} onClick={() => navigate(prev.id)}>
                <span className={styles.pnLabel}>← Previous</span>
                <span className={styles.pnTitle}><ChevronLeft20Regular style={{ width: 16, height: 16 }} /> {prev.label}</span>
              </div>
            ) : <div style={{ flex: "1 1 280px" }} />}
            {next ? (
              <div className={styles.pnLink} onClick={() => navigate(next.id)} style={{ textAlign: "right" }}>
                <span className={styles.pnLabel}>Next →</span>
                <span className={styles.pnTitle} style={{ justifyContent: "flex-end" }}>{next.label} <ChevronRight20Regular style={{ width: 16, height: 16 }} /></span>
              </div>
            ) : <div style={{ flex: "1 1 280px" }} />}
          </div>
        )}
        <DocsFooter />
      </main>
    </div>
  );
}
