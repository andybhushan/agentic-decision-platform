import { useEffect, useState, type ReactNode } from "react";
import { Button, TextInput, Tile } from "@carbon/react";

// Shared-link access gate (decision #4): stakeholders get the console URL with ?key=<token>;
// the token is remembered locally. This is COSMETIC gating for demo hygiene, not security:
// everything here is synthetic and client-side. No key configured (dev) = no gate.

const SHARE_KEY = (import.meta.env.VITE_SHARE_KEY as string | undefined)?.trim();
const STORAGE_KEY = "adp-console-access";

export default function AccessGate({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState(() => !SHARE_KEY || localStorage.getItem(STORAGE_KEY) === SHARE_KEY);
  const [attempt, setAttempt] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!SHARE_KEY || granted) return;
    const q = new URLSearchParams(window.location.search).get("key");
    if (q === SHARE_KEY) {
      localStorage.setItem(STORAGE_KEY, SHARE_KEY);
      setGranted(true);
    }
  }, [granted]);

  if (granted) return children;

  const submit = () => {
    if (attempt.trim() === SHARE_KEY) {
      localStorage.setItem(STORAGE_KEY, SHARE_KEY!);
      setGranted(true);
    } else {
      setFailed(true);
    }
  };

  return (
    <div className="adp-access">
      <Tile className="adp-access__panel">
        <h2>ADP · Agentic Decision Platform</h2>
        <p className="adp-queue__dim">
          This demo is shared by link. Open the invitation link you received, or enter its access key.
        </p>
        <TextInput
          id="access-key"
          labelText="Access key"
          value={attempt}
          invalid={failed}
          invalidText="That key does not match."
          onChange={(e) => {
            setAttempt(e.target.value);
            setFailed(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <Button onClick={submit} disabled={!attempt.trim()}>
          Continue
        </Button>
      </Tile>
    </div>
  );
}
