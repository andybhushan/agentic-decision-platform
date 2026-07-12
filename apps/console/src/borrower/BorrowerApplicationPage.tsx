import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, ProgressIndicator, ProgressStep, SkeletonText, Tag, Tile } from "@carbon/react";
import { Renew } from "@carbon/icons-react";
import { useBorrower } from "./BorrowerContext";
import { fetchDecisions, lifecycleStages, type DecisionsResponse } from "../services/decisionsClient";
import { fetchJourney, type JourneyResponse } from "../services/journeyClient";
import { relativeTime } from "../lib/format";

// Borrower-facing application tracker: stage progress in customer language, no internal
// agent output. Mirrors the claims tracker pattern.

const STAGE_COPY: Record<string, string> = {
  "Origination Decision":
    "We parsed your application, checked eligibility against Northwind's published lending policy, and prepared the decision.",
};

export default function BorrowerApplicationPage() {
  const { subjectId = "" } = useParams();
  const { borrower } = useBorrower();
  const [queue, setQueue] = useState<DecisionsResponse | null>(null);
  const [journey, setJourney] = useState<JourneyResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const [q, j] = await Promise.all([fetchDecisions(), fetchJourney(subjectId)]);
      setQueue(q);
      setJourney(j);
    } catch {
      // tracker degrades to the received state
    }
  }, [subjectId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const decision = useMemo(() => queue?.decisions.find((d) => d.subjectId === subjectId), [queue, subjectId]);
  const stages = useMemo(
    () => lifecycleStages(queue?.packages ?? [], decision?.useCase ?? "consumer-loan-origination"),
    [queue, decision],
  );
  const latestByPackage = useMemo(() => {
    const m = new Map<string, JourneyResponse["traces"][number]>();
    for (const t of journey?.traces ?? []) if (t.packageId) m.set(t.packageId, t);
    return m;
  }, [journey]);

  const record = useMemo(
    () => borrower?.applications.find((a) => a.applicationId === subjectId),
    [borrower, subjectId],
  );
  const currentIdx = useMemo(() => {
    const firstOpen = stages.findIndex((s) => latestByPackage.get(s.packageId)?.status !== "completed");
    return firstOpen === -1 ? stages.length : firstOpen;
  }, [stages, latestByPackage]);

  const underReview = [...latestByPackage.values()].some((t) => t.status === "needs-review");

  return (
    <div className="adp-report">
      <nav className="adp-member-breadcrumb">
        <Link to="/bank/home">My account</Link> <span>/</span> {subjectId}
      </nav>

      <div className="adp-page-head">
        <div>
          <h2>Application {subjectId}</h2>
          <div className="adp-page-head__tags">
            {underReview ? (
              <Tag type="magenta">With a loan officer</Tag>
            ) : currentIdx >= stages.length && stages.length > 0 ? (
              <Tag type="teal">Decision made</Tag>
            ) : (
              <Tag type="cool-gray">In progress</Tag>
            )}
            {record?.loanPurpose && (
              <Tag type="outline">
                ${(record.loanAmount ?? 0).toLocaleString("en-US")} {record.loanPurpose.replaceAll("-", " ")}
              </Tag>
            )}
          </div>
        </div>
        <Button kind="ghost" renderIcon={Renew} onClick={load}>
          Refresh
        </Button>
      </div>

      {!queue && <SkeletonText paragraph lineCount={4} />}

      {queue && stages.length > 0 && (
        <Tile className="adp-report__panel">
          <ProgressIndicator currentIndex={Math.min(currentIdx, stages.length - 1)} vertical className="adp-member-tracker">
            {stages.map((s) => {
              const jt = latestByPackage.get(s.packageId);
              const state = jt?.status;
              return (
                <ProgressStep
                  key={s.packageId}
                  label={s.stage ?? s.packageId}
                  complete={state === "completed"}
                  invalid={state === "needs-review" || state === "failed"}
                  secondaryLabel={
                    state === "completed"
                      ? `done ${relativeTime(jt?.lastActivityAt)}`
                      : state === "needs-review"
                        ? "a loan officer is reviewing"
                        : state === "failed"
                          ? "being looked into"
                          : "up next"
                  }
                />
              );
            })}
          </ProgressIndicator>
          <div className="adp-member-tracker__copy">
            {stages.map((s) => {
              const jt = latestByPackage.get(s.packageId);
              if (!jt) return null;
              return (
                <p key={s.packageId} className="adp-queue__dim">
                  <strong>{s.stage}:</strong> {STAGE_COPY[s.stage ?? ""] ?? "Processed."}
                  {jt.operatorActions > 0 ? " A Northwind loan officer personally reviewed this step." : ""}
                </p>
              );
            })}
            {journey && journey.traces.length === 0 && (
              <p className="adp-queue__dim">
                Your application has been received and is waiting to be picked up. You'll see each step here as it
                happens. A decision usually takes minutes, not days.
              </p>
            )}
          </div>
        </Tile>
      )}

      <Tile className="adp-member-card">
        <h4 className="adp-side-card__title">Your promise from Northwind</h4>
        <p className="adp-queue__dim">
          Every decision on this application is recorded permanently, grounded in our published lending policy, and
          checked against confidence thresholds. Anything uncertain goes to a loan officer. That record cannot be
          altered afterwards.
        </p>
      </Tile>
    </div>
  );
}
