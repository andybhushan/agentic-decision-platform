import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// App-wide light/dark mode. Carbon zones: content flips white <-> g100, the header
// stays g100 in both (standard Carbon shell pattern). Persisted; defaults to LIGHT
// (stage/projector friendly) regardless of the OS preference.

export type Mode = "light" | "dark";

interface ThemeState {
  mode: Mode;
  carbonTheme: "white" | "g100";
  toggle: () => void;
}

const STORAGE_KEY = "adp-console-theme";

const ThemeContext = createContext<ThemeState>({ mode: "light", carbonTheme: "white", toggle: () => {} });

function initialMode(): Mode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    // Native form controls + scrollbars follow the app, not the OS.
    document.documentElement.style.colorScheme = mode;
    document.documentElement.dataset.adpTheme = mode;
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === "light" ? "dark" : "light")), []);

  const value = useMemo<ThemeState>(
    () => ({ mode, carbonTheme: mode === "dark" ? "g100" : "white", toggle }),
    [mode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}
