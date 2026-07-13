import { lazy, Suspense, useEffect, useState } from "react";
import {
  Content,
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  HeaderSideNavItems,
  SideNav,
  SideNavItems,
  SkipToContent,
  Theme,
} from "@carbon/react";
import { Asleep, Light, PlayFilledAlt } from "@carbon/icons-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import AccessGate from "./AccessGate";
import NarratorDock from "./narrator/NarratorDock";
import CopilotDock from "./components/CopilotDock";
import DecisionQueuePage from "./pages/DecisionQueuePage";
import DecisionModePage from "./pages/DecisionModePage";
import DecisionRecordPage from "./pages/DecisionRecordPage";
import OutcomesReportPage from "./pages/OutcomesReportPage";
import PlatformPage from "./pages/PlatformPage";
import AgentsPage from "./pages/AgentsPage";
import LiveRunPage from "./pages/LiveRunPage";
import MemberArea from "./member/MemberArea";
import BorrowerArea from "./borrower/BorrowerArea";

// The charts library is heavy; it loads only when the dashboard is opened.
const OutcomesPage = lazy(() => import("./pages/OutcomesPage"));
const DocsPage = lazy(() => import("./pages/DocsPage"));
const DiagramsPage = lazy(() => import("./pages/DiagramsPage"));

// One nav definition for desktop header items AND the mobile drawer.
const NAV_LINKS = [
  { to: "/", label: "Platform", isActive: (p: string) => p === "/" || p === "/platform" },
  { to: "/decisions", label: "Decisions", isActive: (p: string) => p.startsWith("/decisions") },
  { to: "/outcomes", label: "Outcomes", isActive: (p: string) => p.startsWith("/outcomes") },
  { to: "/agents", label: "Agents", isActive: (p: string) => p === "/agents" },
  { to: "/lab", label: "Lab", isActive: (p: string) => p === "/lab" },
  { to: "/docs", label: "Docs", isActive: (p: string) => p.startsWith("/docs") },
  { to: "/member", label: "Meridian claims", isActive: () => false },
  { to: "/bank", label: "Northwind lending", isActive: () => false },
];

function Shell() {
  const { pathname } = useLocation();
  const { mode, carbonTheme, toggle } = useTheme();
  const [narratorOpen, setNarratorOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Pages can request the guided demo (the landing's CTA does).
  useEffect(() => {
    const open = () => setNarratorOpen(true);
    window.addEventListener("adp:open-narrator", open);
    return () => window.removeEventListener("adp:open-narrator", open);
  }, []);

  // Use-case views (client-branded portals) have their own shells.
  if (pathname.startsWith("/member") || pathname.startsWith("/bank")) {
    return (
      <Routes>
        <Route path="/member/*" element={<MemberArea />} />
        <Route path="/bank/*" element={<BorrowerArea />} />
      </Routes>
    );
  }

  return (
    <>
      <Theme theme="g100">
        <Header aria-label="ADP">
          <SkipToContent />
          <HeaderMenuButton
            aria-label={navOpen ? "Close menu" : "Open menu"}
            onClick={() => setNavOpen((o) => !o)}
            isActive={navOpen}
            aria-expanded={navOpen}
          />
          <HeaderName as={Link} to="/" prefix="ADP">
            Agentic Decision Platform
          </HeaderName>
          <HeaderNavigation aria-label="ADP navigation">
            {NAV_LINKS.map((l) => (
              <HeaderMenuItem key={l.to} as={Link} to={l.to} isActive={l.isActive(pathname)}>
                {l.label}
              </HeaderMenuItem>
            ))}
          </HeaderNavigation>
          <SideNav
            aria-label="ADP navigation"
            expanded={navOpen}
            isPersistent={false}
            onOverlayClick={() => setNavOpen(false)}
          >
            <SideNavItems>
              <HeaderSideNavItems>
                {NAV_LINKS.map((l) => (
                  <HeaderMenuItem key={l.to} as={Link} to={l.to} isActive={l.isActive(pathname)}>
                    {l.label}
                  </HeaderMenuItem>
                ))}
              </HeaderSideNavItems>
            </SideNavItems>
          </SideNav>
          <HeaderGlobalBar>
            <HeaderGlobalAction
              aria-label={narratorOpen ? "Close guided demo" : "Start guided demo"}
              onClick={() => setNarratorOpen((o) => !o)}
            >
              <PlayFilledAlt size={20} />
            </HeaderGlobalAction>
            <HeaderGlobalAction
              aria-label={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              tooltipAlignment="end"
              onClick={toggle}
            >
              {mode === "dark" ? <Light size={20} /> : <Asleep size={20} />}
            </HeaderGlobalAction>
          </HeaderGlobalBar>
        </Header>
      </Theme>
      <Theme theme={carbonTheme} className="adp-content-theme">
        <Content id="main-content">
          <div className="adp-page adp-route-enter" key={pathname}>
            <Routes>
              <Route path="/" element={<PlatformPage />} />
              <Route path="/platform" element={<PlatformPage />} />
              <Route path="/decisions" element={<DecisionQueuePage />} />
              <Route path="/decisions/:subjectId" element={<DecisionModePage />} />
              <Route path="/decisions/:subjectId/record" element={<DecisionRecordPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route
                path="/outcomes"
                element={
                  <Suspense fallback={null}>
                    <OutcomesPage />
                  </Suspense>
                }
              />
              <Route path="/outcomes/report" element={<OutcomesReportPage />} />
              <Route path="/lab" element={<LiveRunPage />} />
              <Route
                path="/docs"
                element={
                  <Suspense fallback={null}>
                    <DocsPage />
                  </Suspense>
                }
              />
              <Route
                path="/docs/diagrams"
                element={
                  <Suspense fallback={null}>
                    <DiagramsPage />
                  </Suspense>
                }
              />
            </Routes>
          </div>
        </Content>
        <footer className="adp-footer">
          <span><strong>ADP</strong> · Agentic Decision Platform</span>
          <span>An IBM Consulting engineering build on the Microsoft agentic stack</span>
          <span className="adp-footer__note">Demonstration environment · all data synthetic</span>
        </footer>
        <NarratorDock open={narratorOpen} onClose={() => setNarratorOpen(false)} />
        <CopilotDock />
      </Theme>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AccessGate>
        <Shell />
      </AccessGate>
    </ThemeProvider>
  );
}
