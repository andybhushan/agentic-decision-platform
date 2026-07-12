import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, InlineNotification, Search, SkeletonText, Tag, Tile } from "@carbon/react";
import { ArrowRight, CheckmarkFilled } from "@carbon/icons-react";
import { Insurance } from "@carbon/pictograms-react";
import { useMember } from "./MemberContext";

// Simulated member sign-in: pick a policyholder identity that already exists in the
// system. Presentation-only; no real authentication.

export default function SignInPage() {
  const { members, loading, error, signIn } = useMember();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? members.filter(
          (m) =>
            m.fullName.toLowerCase().includes(q) ||
            (m.policy.policyNumber ?? "").toLowerCase().includes(q) ||
            (m.city ?? "").toLowerCase().includes(q),
        )
      : members;
    return list.slice(0, 12);
  }, [members, search]);

  return (
    <div className="adp-signin adp-signin--split">
      <div className="adp-signin__brand">
        <Insurance className="adp-signin__pictogram" aria-hidden="true" />
        <h1 className="adp-signin__title">Welcome to Meridian Mutual</h1>
        <p className="adp-signin__sub">
          Manage your auto policy, report an accident in minutes, and track every claim decision with full
          transparency.
        </p>
        <ul className="adp-signin__points">
          <li><CheckmarkFilled size={16} /> Report an accident in about two minutes, on any device</li>
          <li><CheckmarkFilled size={16} /> Watch every step of your claim as it happens</li>
          <li><CheckmarkFilled size={16} /> Anything uncertain is reviewed by a person, and you can see it</li>
        </ul>
        <Tag type="teal">Demo environment · simulated identity · synthetic data</Tag>
      </div>

      <Tile className="adp-signin__panel">
        <h3 className="adp-signin__panel-title">Member sign in</h3>
        <p className="adp-queue__dim">Choose a member identity to continue as.</p>
        <Search
          labelText="Find your account"
          placeholder="Name, policy number, or city"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="adp-signin__search"
        />
        {error && <InlineNotification kind="error" title="Service unavailable" subtitle={error} lowContrast hideCloseButton />}
        {loading && <SkeletonText paragraph lineCount={5} />}
        <div className="adp-signin__list">
          {filtered.map((m) => (
            <button
              key={m.policyholderId}
              type="button"
              className="adp-persona"
              onClick={() => {
                signIn(m.policyholderId);
                navigate("/member/home");
              }}
            >
              <span className="adp-persona__avatar">{(m.firstName[0] ?? "") + (m.lastName[0] ?? "")}</span>
              <span className="adp-persona__meta">
                <strong>{m.fullName}</strong>
                <span className="adp-queue__dim">
                  {m.policy.policyNumber} · {m.city}, {m.state} · {m.vehicles.length} vehicle{m.vehicles.length === 1 ? "" : "s"}
                </span>
              </span>
              <ArrowRight className="adp-persona__go" />
            </button>
          ))}
          {!loading && filtered.length === 0 && <p className="adp-queue__dim">No members match that search.</p>}
        </div>
      </Tile>

      <p className="adp-signin__foot">
        <Button kind="ghost" size="sm" href="/">Explore the ADP platform</Button>
      </p>
    </div>
  );
}
