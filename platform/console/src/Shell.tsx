import { useEffect, useRef, useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import {
  Book20Regular,
  Apps20Regular,
  WeatherSunny20Regular,
  WeatherMoon20Regular,
  Sparkle20Regular,
  SignOut20Regular,
  Person20Regular,
} from "@fluentui/react-icons";
import { App } from "./App";
import { DocsPortal } from "./DocsPortal";
import { ProjectPortal } from "./ProjectPortal";
import { LoginPage } from "./LoginPage";
import { useThemeMode } from "./ThemeContext";
import { useAuth } from "./AuthContext";

type View = "operator" | "docs" | "project";

function viewFromHash(): View {
  const h = (window.location.hash || "").toLowerCase();
  if (h === "#operator") return "operator";
  if (h.startsWith("#docs")) return "docs";
  if (h.startsWith("#project")) return "project";
  return "project";
}

const useStyles = makeStyles({
  shell: { minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: tokens.colorNeutralBackground2 },
  nav: {
    height: "56px",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0b1220",
    color: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 10,
    boxShadow: "0 1px 0 rgba(255,255,255,0.05)",
  },
  brand: { display: "flex", alignItems: "center", gap: "12px" },
  brandTitle: { fontSize: "16px", fontWeight: 700, letterSpacing: "0.5px", color: "#fff" },
  brandVersion: { fontSize: "11px", color: "rgba(255,255,255,0.55)", letterSpacing: "1px" },
  tabs: { display: "flex", alignItems: "center", gap: "4px" },
  themeBtn: {
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "4px",
    marginRight: "8px",
  },
  userChip: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 10px",
    border: "1px solid rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    fontSize: "12px",
    fontWeight: 500,
    borderRadius: "4px",
    marginLeft: "12px",
  },
  logoutBtn: {
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "4px",
    marginLeft: "6px",
  },
  tab: {
    padding: "8px 16px",
    border: "none",
    backgroundColor: "transparent",
    color: "rgba(255,255,255,0.6)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "4px",
    transition: "background 120ms ease",
  },
  tabActive: {
    color: "#fff",
    backgroundColor: "rgba(0,120,212,0.4)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  body: { flex: 1, minHeight: 0 },
});

export function Shell() {
  const styles = useStyles();
  const [view, setView] = useState<View>(viewFromHash());
  const { mode, toggle } = useThemeMode();
  const { isAuthenticated, username, logout } = useAuth();
  const isFirstRenderRef = useRef(true);

  // Hook 1: hashchange listener (sync view with browser hash)
  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Hook 2: auth transition — fire on actual login (not on initial mount of an
  // already-authenticated session), force the user to project/hub + scroll to top.
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      // First render — if we're already authenticated from session storage and
      // have no hash, land on project/hub. Otherwise honor the deep link.
      if (isAuthenticated) {
        const h = (window.location.hash || "").toLowerCase();
        if (!h.startsWith("#docs") && !h.startsWith("#operator") && !h.startsWith("#project/")) {
          window.location.hash = "project/hub";
          setView("project");
        }
      }
      return;
    }
    // Subsequent renders — true auth transition
    if (isAuthenticated) {
      window.location.hash = "project/hub";
      setView("project");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    } else {
      // On logout: reset to project view so when user signs back in they land on hub
      setView("project");
    }
  }, [isAuthenticated]);

  function nav(target: View) {
    if (target === "docs") {
      window.location.hash = "docs/home";
    } else if (target === "project") {
      window.location.hash = "project/hub";
    } else {
      window.location.hash = target;
    }
    setView(target);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  // CRITICAL: conditional return MUST come AFTER all hook calls (Rules of Hooks).
  // Putting an early return between hooks causes React's hook ordering to shift
  // when auth flips, which manifests as a blank page until full reload.
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>PROJECT ADP</span>
          <span className={styles.brandVersion}>v1.0 · live</span>
        </div>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${view === "project" ? styles.tabActive : ""}`}
            onClick={() => nav("project")}
          >
            <Sparkle20Regular /> Project
          </button>
          <button
            type="button"
            className={`${styles.tab} ${view === "docs" ? styles.tabActive : ""}`}
            onClick={() => nav("docs")}
          >
            <Book20Regular /> Docs
          </button>
          <button
            type="button"
            className={`${styles.tab} ${view === "operator" ? styles.tabActive : ""}`}
            onClick={() => nav("operator")}
          >
            <Apps20Regular /> Operator
          </button>
          <button
            type="button"
            className={styles.themeBtn}
            onClick={toggle}
            title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
            aria-label="Toggle theme"
          >
            {mode === "light" ? <WeatherMoon20Regular /> : <WeatherSunny20Regular />}
            <span>{mode === "light" ? "Dark" : "Light"}</span>
          </button>
          <span className={styles.userChip} title={`Signed in as ${username}`}>
            <Person20Regular /> {username || "user"}
          </span>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => logout()}
            title="Sign out"
            aria-label="Sign out"
          >
            <SignOut20Regular /> Sign out
          </button>
        </div>
      </header>
      <main className={styles.body} key={`view-${view}`}>
        {view === "docs" ? <DocsPortal /> : view === "project" ? <ProjectPortal /> : <App />}
      </main>
    </div>
  );
}
