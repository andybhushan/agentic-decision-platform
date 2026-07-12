import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchRecords, type RecordsResponse } from "../services/recordsClient";
import { deriveBorrowers, type BorrowerProfile, type LoanApplication } from "./borrowerData";

// Borrower session for the Northwind Bank portal (the lending use-case view).
// Identity is simulated exactly like the claims member portal: presentation only.

interface BorrowerState {
  loading: boolean;
  error: string | null;
  data: RecordsResponse | null;
  borrowers: BorrowerProfile[];
  borrower: BorrowerProfile | null;
  signIn: (borrowerId: string) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "adp-borrower-session";

const BorrowerContext = createContext<BorrowerState>({
  loading: true,
  error: null,
  data: null,
  borrowers: [],
  borrower: null,
  signIn: () => {},
  signOut: () => {},
  refresh: async () => {},
});

export function BorrowerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borrowerId, setBorrowerId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const refresh = useCallback(async () => {
    try {
      setData(await fetchRecords("banking"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const borrowers = useMemo(
    () => (data ? deriveBorrowers(data.records as LoanApplication[]) : []),
    [data],
  );
  const borrower = useMemo(() => borrowers.find((b) => b.borrowerId === borrowerId) ?? null, [borrowers, borrowerId]);

  const signIn = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setBorrowerId(id);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setBorrowerId(null);
  }, []);

  const value = useMemo<BorrowerState>(
    () => ({ loading, error, data, borrowers, borrower, signIn, signOut, refresh }),
    [loading, error, data, borrowers, borrower, signIn, signOut, refresh],
  );

  return <BorrowerContext.Provider value={value}>{children}</BorrowerContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBorrower(): BorrowerState {
  return useContext(BorrowerContext);
}
