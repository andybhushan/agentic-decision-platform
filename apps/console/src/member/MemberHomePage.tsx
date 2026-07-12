import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Column, Grid, SkeletonText, Tag, Tile } from "@carbon/react";
import { Add, ArrowRight, Car, Document, Phone } from "@carbon/icons-react";
import { useMember } from "./MemberContext";
import { fetchDecisions, lifecycleStages, type DecisionsResponse } from "../services/decisionsClient";
import { relativeTime } from "../lib/format";

// Claimant-friendly wording for platform decision states.
function claimStatusView(status?: string): { label: string; tag: "teal" | "magenta" | "cool-gray" | "red" } {
  if (status === "needs-review") return { label: "With a claims specialist", tag: "magenta" };
  if (status === "completed") return { label: "Decision made", tag: "teal" };
  if (status === "failed") return { label: "Being looked into", tag: "red" };
  return { label: "Received", tag: "cool-gray" };
}

export default function MemberHomePage() {
  const { member } = useMember();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<DecisionsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDecisions()
      .then((d) => { if (!cancelled) setQueue(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const myClaims = useMemo(() => {
    if (!member) return [];
    const ids = new Set(member.claims.map((c) => c.claimNumber));
    return (queue?.decisions ?? []).filter((d) => ids.has(d.subjectId));
  }, [member, queue]);

  const stages = useMemo(
    () => lifecycleStages(queue?.packages ?? [], myClaims[0]?.useCase ?? "p-and-c-auto-claims"),
    [queue, myClaims],
  );

  if (!member) return null;

  return (
    <>
      <div className="adp-member-hero">
        <h1 className="adp-member-hero__title">Hello, {member.firstName}</h1>
        <p className="adp-queue__dim">
          Policy {member.policy.policyNumber} · {member.city}, {member.state}
        </p>
        <div className="adp-member-hero__actions">
          <Button renderIcon={Add} onClick={() => navigate("/member/report")}>
            Report an accident or loss
          </Button>
        </div>
      </div>

      <Grid narrow fullWidth>
        <Column lg={5} md={4} sm={4}>
          <Tile className="adp-member-card">
            <div className="adp-member-card__head">
              <Document size={20} />
              <h4>My policy</h4>
            </div>
            <p className="adp-member-card__big">{member.policy.policyNumber}</p>
            <p className="adp-queue__dim">{member.policy.policyType}</p>
            <p className="adp-queue__dim">
              Active {member.policy.effectiveStart} to {member.policy.effectiveEnd}
            </p>
            <div className="adp-citations">
              {(member.policy.coverages ?? []).map((c) => (
                <Tag key={c} type="teal" size="sm">{c}</Tag>
              ))}
            </div>
            {member.policy.deductibles && (
              <p className="adp-queue__dim">
                Deductibles:{" "}
                {Object.entries(member.policy.deductibles)
                  .map(([k, v]) => `${k} $${v}`)
                  .join(" · ")}
              </p>
            )}
          </Tile>
        </Column>

        <Column lg={5} md={4} sm={4}>
          <Tile className="adp-member-card">
            <div className="adp-member-card__head">
              <Car size={20} />
              <h4>My vehicle{member.vehicles.length === 1 ? "" : "s"}</h4>
            </div>
            {member.vehicles.map((v) => (
              <div key={v.vehicleId} className="adp-member-vehicle">
                <p className="adp-member-card__big">
                  {v.year} {v.make} {v.model}
                </p>
                <p className="adp-queue__dim">Plate {v.plate} · VIN {v.vin}</p>
              </div>
            ))}
          </Tile>
        </Column>

        <Column lg={6} md={4} sm={4}>
          <Tile className="adp-member-card">
            <div className="adp-member-card__head">
              <Phone size={20} />
              <h4>We're here to help</h4>
            </div>
            <p className="adp-queue__dim">
              Claims line: 1-800-MERIDIAN, 24/7. Your registered contact: {member.contactPhone}.
            </p>
            <p className="adp-queue__dim">
              Every claim decision is explainable: you can see what was decided, on what basis, and when a person
              reviewed it.
            </p>
          </Tile>
        </Column>
      </Grid>

      <div className="adp-member-claims-head">
        <h3 className="adp-section-title">My claims</h3>
      </div>
      {!queue && <SkeletonText paragraph lineCount={3} />}
      {queue && myClaims.length === 0 && (
        <Tile className="adp-member-card">
          <p className="adp-queue__dim">No claims on file. We hope it stays that way.</p>
        </Tile>
      )}
      <Grid narrow fullWidth>
        {myClaims.map((d) => {
          const view = claimStatusView(d.latestTrace?.status ?? (d.receivedAt ? undefined : undefined));
          const done = stages.filter((s) => d.packagesRun.includes(s.packageId)).length;
          return (
            <Column key={d.subjectId} lg={8} md={4} sm={4}>
              <Link to={`/member/claims/${encodeURIComponent(d.subjectId)}`} className="adp-member-claim-link">
                <Tile className="adp-member-card adp-member-card--claim">
                  <div className="adp-member-card__head">
                    <strong>{d.subjectId}</strong>
                    <Tag type={view.tag} size="sm">{view.label}</Tag>
                  </div>
                  {stages.length > 0 && (
                    <span className="adp-journey-progress">
                      <span className="adp-journey-progress__segments">
                        {stages.map((s) => (
                          <span
                            key={s.packageId}
                            className={`adp-journey-progress__seg${d.packagesRun.includes(s.packageId) ? " adp-journey-progress__seg--done" : ""}`}
                          />
                        ))}
                      </span>
                      {done} of {stages.length} steps
                    </span>
                  )}
                  <p className="adp-queue__dim">
                    last update {relativeTime(d.latestTrace?.lastActivityAt ?? d.receivedAt)}
                  </p>
                  <span className="adp-member-claim-link__go">
                    Track claim <ArrowRight size={16} />
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
