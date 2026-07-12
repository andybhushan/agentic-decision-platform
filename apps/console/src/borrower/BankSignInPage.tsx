import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, InlineNotification, Search, SkeletonText, Tag, Tile } from "@carbon/react";
import { ArrowRight, CheckmarkFilled } from "@carbon/icons-react";
import { Banking } from "@carbon/pictograms-react";
import { useBorrower } from "./BorrowerContext";

// Simulated borrower sign-in: pick an identity that already exists in the system.

export default function BankSignInPage() {
  const { borrowers, loading, error, signIn } = useBorrower();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? borrowers.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            (b.employer ?? "").toLowerCase().includes(q) ||
            (b.state ?? "").toLowerCase().includes(q),
        )
      : borrowers;
    return list.slice(0, 12);
  }, [borrowers, search]);

  return (
    <div className="adp-signin adp-signin--split">
      <div className="adp-signin__brand">
        <Banking className="adp-signin__pictogram" aria-hidden="true" />
        <h1 className="adp-signin__title">Welcome to Northwind Bank</h1>
        <p className="adp-signin__sub">
          Apply for a loan in minutes and watch your application decided transparently: every step recorded, every
          judgment reviewable.
        </p>
        <ul className="adp-signin__points">
          <li><CheckmarkFilled size={16} /> Apply in about a minute; your financials are already on file</li>
          <li><CheckmarkFilled size={16} /> A decision in minutes, not days, against published lending policy</li>
          <li><CheckmarkFilled size={16} /> Anything uncertain goes to a loan officer, visibly</li>
        </ul>
        <Tag type="purple">Demo environment · simulated identity · synthetic data</Tag>
      </div>

      <Tile className="adp-signin__panel">
        <h3 className="adp-signin__panel-title">Customer sign in</h3>
        <p className="adp-queue__dim">Choose a customer identity to continue as.</p>
        <Search
          labelText="Find your account"
          placeholder="Name, employer, or state"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="adp-signin__search"
        />
        {error && <InlineNotification kind="error" title="Service unavailable" subtitle={error} lowContrast hideCloseButton />}
        {loading && <SkeletonText paragraph lineCount={5} />}
        <div className="adp-signin__list">
          {filtered.map((b) => (
            <button
              key={b.borrowerId}
              type="button"
              className="adp-persona"
              onClick={() => {
                signIn(b.borrowerId);
                navigate("/bank/home");
              }}
            >
              <span className="adp-persona__avatar">
                {b.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
              </span>
              <span className="adp-persona__meta">
                <strong>{b.name}</strong>
                <span className="adp-queue__dim">
                  {b.employer} · {b.state} · {b.applications.length} application{b.applications.length === 1 ? "" : "s"}
                </span>
              </span>
              <ArrowRight className="adp-persona__go" />
            </button>
          ))}
          {!loading && filtered.length === 0 && <p className="adp-queue__dim">No customers match that search.</p>}
        </div>
      </Tile>

      <p className="adp-signin__foot">
        <Button kind="ghost" size="sm" href="/">Explore the ADP platform</Button>
      </p>
    </div>
  );
}
