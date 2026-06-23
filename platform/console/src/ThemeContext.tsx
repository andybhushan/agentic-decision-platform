import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components";

export type Mode = "light" | "dark";

interface ThemeCtx {
  mode: Mode;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ mode: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const stored = localStorage.getItem("adp.theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {}
    return "light";
  });

  useEffect(() => {
    try { localStorage.setItem("adp.theme", mode); } catch {}
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));

  return (
    <Ctx.Provider value={{ mode, toggle }}>
      <FluentProvider theme={mode === "light" ? webLightTheme : webDarkTheme} style={{ minHeight: "100vh" }}>
        {children}
      </FluentProvider>
    </Ctx.Provider>
  );
}

export function useThemeMode() {
  return useContext(Ctx);
}
