import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchRecords, type RecordsResponse } from "../services/recordsClient";
import { deriveMembers, type MemberProfile } from "./memberData";

// Member session for the Meridian member portal (the claims use-case view).
// Identity is simulated: the demo "signs in" as one of the policyholders already in the
// system. No credentials are real and nothing is protected; this is presentation only.

interface MemberState {
  loading: boolean;
  error: string | null;
  data: RecordsResponse | null;
  members: MemberProfile[];
  member: MemberProfile | null;
  signIn: (policyholderId: string) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = "adp-member-session";

const MemberContext = createContext<MemberState>({
  loading: true,
  error: null,
  data: null,
  members: [],
  member: null,
  signIn: () => {},
  signOut: () => {},
  refresh: async () => {},
});

export function MemberProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<RecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const refresh = useCallback(async () => {
    try {
      setData(await fetchRecords("insurance"));
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

  const members = useMemo(() => (data ? deriveMembers(data) : []), [data]);
  const member = useMemo(() => members.find((m) => m.policyholderId === memberId) ?? null, [members, memberId]);

  const signIn = useCallback((policyholderId: string) => {
    localStorage.setItem(STORAGE_KEY, policyholderId);
    setMemberId(policyholderId);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMemberId(null);
  }, []);

  const value = useMemo<MemberState>(
    () => ({ loading, error, data, members, member, signIn, signOut, refresh }),
    [loading, error, data, members, member, signIn, signOut, refresh],
  );

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMember(): MemberState {
  return useContext(MemberContext);
}
