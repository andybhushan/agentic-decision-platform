import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Column, Grid, SkeletonText, Tag, Tile } from "@carbon/react";
import { Add, ArrowRight, Money, ReportData, UserProfile } from "@carbon/icons-react";
import { useBorrower } from "./BorrowerContext";
import { fetchDecisions, type DecisionsResponse } from "../services/decisionsClient";
import { relativeTime } from "../lib/format";

function applicationStatusView(status?: string, isNew?: boolean): { label: string; tag: "teal" | "magenta" | "cool-gray" | "red" | "blue" } {
  if (status === "needs-review") return { label: "With a loan officer", tag: "magenta" };
  if (status === "completed") return { label: "Decision made", tag: "teal" };
  if (status === "failed") return { label: "Being looked into", tag: "red" };
  if (isNew) return { label: "Submitted", tag: "blue" };
  return { label: "Received", tag: "cool-gray" };
}

const money = (v?: number) => (v == null ? "-" : `$${v.toLocaleString("en-US")}`);

export default function BorrowerHomePage() {
  const { borrower } = useBorrower();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<DecisionsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDecisions()
      .then((d) => { if (!cancelled) setQueue(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const myApplications = useMemo(() => {
    if (!borrower) return [];
    const ids = new Set(borrower.applications.map((a) => a.applicationId));
    return (queue?.decisions ?? []).filter((d) => ids.has(d.subjectId));
  }, [borrower, queue]);

  if (!borrower) return null;

  const dti =
    borrower.grossMonthlyIncome && borrower.existingMonthlyDebt != null
      ? Math.round((borrower.existingMonthlyDebt / borrower.grossMonthlyIncome) * 100)
      : null;

  return (
    <>
      <div className="adp-member-hero">
        <h1 className="adp-member-hero__title">Hello, {borrower.name.split(" ")[0]}</h1>
        <p className="adp-queue__dim">
          Customer {borrower.borrowerId} · {borrower.state}
        </p>
        <div className="adp-member-hero__actions">
          <Button renderIcon={Add} onClick={() => navigate("/bank/apply")}>
            Apply for a loan
          </Button>
        </div>
      </div>

      <Grid narrow fullWidth>
        <Column lg={5} md={4} sm={4}>
          <Tile className="adp-member-card">
            <div className="adp-member-card__head">
              <UserProfile size={20} />
              <h4>My profile</h4>
            </div>
            <p className="adp-member-card__big">{borrower.name}</p>
            <p className="adp-queue__dim">
              {borrower.employer} · {borrower.employerTenureYears} yrs · age {borrower.ageBand}
            </p>
            <p className="adp-queue__dim">Preferred language: {borrower.languagePreference ?? "en"}</p>
          </Tile>
        </Column>

        <Column lg={5} md={4} sm={4}>
          <Tile className="adp-member-card">
            <div className="adp-member-card__head">
              <ReportData size={20} />
              <h4>My financial snapshot</h4>
            </div>
            <p className="adp-member-card__big">
              FICO {borrower.ficoScore} <Tag type="purple" size="sm">band {borrower.ficoBand}</Tag>
            </p>
            <p className="adp-queue__dim">Gross monthly income {money(borrower.grossMonthlyIncome)}</p>
            <p className="adp-queue__dim">
              Existing monthly debt {money(borrower.existingMonthlyDebt)}
              {dti != null ? ` · DTI ${dti}%` : ""}
            </p>
          </Tile>
        </Column>

        <Column lg={6} md={4} sm={4}>
          <Tile className="adp-member-card">
            <div className="adp-member-card__head">
              <Money size={20} />
              <h4>How decisions work here</h4>
            </div>
            <p className="adp-queue__dim">
              Your application is decided against Northwind's published lending policy, step by step. Anything the
              system is not confident about goes to a loan officer before a decision stands, and the whole record is
              permanent.
            </p>
          </Tile>
        </Column>
      </Grid>

      <div className="adp-member-claims-head">
        <h3 className="adp-section-title">My applications</h3>
      </div>
      {!queue && <SkeletonText paragraph lineCount={3} />}
      {queue && myApplications.length === 0 && (
        <Tile className="adp-member-card">
          <p className="adp-queue__dim">No applications yet. Ready when you are.</p>
        </Tile>
      )}
      <Grid narrow fullWidth>
        {myApplications.map((d) => {
          const record = borrower.applications.find((a) => a.applicationId === d.subjectId);
          const view = applicationStatusView(d.latestTrace?.status, Boolean(d.receivedAt));
          return (
            <Column key={d.subjectId} lg={8} md={4} sm={4}>
              <Link to={`/bank/applications/${encodeURIComponent(d.subjectId)}`} className="adp-member-claim-link">
                <Tile className="adp-member-card adp-member-card--claim">
                  <div className="adp-member-card__head">
                    <strong>{d.subjectId}</strong>
                    <Tag type={view.tag} size="sm">{view.label}</Tag>
                  </div>
                  <p className="adp-queue__dim">
                    {record ? `${money(record.loanAmount)} ${record.loanPurpose} · ${record.termMonths} months · ` : ""}
                    last update {relativeTime(d.latestTrace?.lastActivityAt ?? d.receivedAt)}
                  </p>
                  <span className="adp-member-claim-link__go">
                    Track application <ArrowRight size={16} />
                  </span>
                </Tile>
              </Link>
            </Column>
          );
        })}
      </Grid>
    </>
  );
}
