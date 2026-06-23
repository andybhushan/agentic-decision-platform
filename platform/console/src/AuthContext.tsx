import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthContextValue {
  isAuthenticated: boolean;
  username: string;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

// Session-only credentials for the v1 build preview. Same pattern as the adp-portal SPA.
// Replace with Entra (MSAL) or SWA built-in auth in v1.5 when the portal goes wider.
const VALID_USERS: Record<string, string> = {
  admin: "adp@2026!",
};

const STORAGE_AUTH = "adp-v1-auth";
const STORAGE_USER = "adp-v1-user";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_AUTH) === "true";
    } catch {
      return false;
    }
  });
  const [username, setUsername] = useState<string>(() => {
    try {
      return sessionStorage.getItem(STORAGE_USER) ?? "";
    } catch {
      return "";
    }
  });

  const login = (user: string, pass: string): boolean => {
    const trimmedUser = user.trim().toLowerCase();
    if (VALID_USERS[trimmedUser] && VALID_USERS[trimmedUser] === pass) {
      setIsAuthenticated(true);
      setUsername(trimmedUser);
      try {
        sessionStorage.setItem(STORAGE_AUTH, "true");
        sessionStorage.setItem(STORAGE_USER, trimmedUser);
      } catch {}
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUsername("");
    try {
      sessionStorage.removeItem(STORAGE_AUTH);
      sessionStorage.removeItem(STORAGE_USER);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
