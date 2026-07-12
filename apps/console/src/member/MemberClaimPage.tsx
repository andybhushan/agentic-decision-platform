import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, ProgressIndicator, ProgressStep, SkeletonText, Tag, Tile } from "@carbon/react";
import { Renew, MachineLearningModel } from "@carbon/icons-react";
import { useMember } from "./MemberContext";
import { fetchDecisions, lifecycleStages, type DecisionsResponse } from "../services/decisionsClient";
import { fetchJourney, type JourneyResponse } from "../services/journeyClient";
import { fetchTrace } from "../services/traceClient";
import { evidenceFileUrl, fetchEvidenceForSubject, type EvidenceGroup } from "../services/evidenceClient";
import { relativeTime } from "../lib/format";

// Claimant-facing claim tracker: the same journey the operators see, in member language.
// Deliberately shows stage progress + review moments, not internal agent output.

const STAGE_MEMBER_COPY: Record<string, string> = {
  "Intake & Routing": "We received your report, verified your coverage, and routed your claim to the right team.",
  "Damage & Estimation": "We assessed the damage and prepared a repair estimate.",
  "Fraud Screen": "A routine integrity check protects all members and keeps premiums fair.",
  "Settlement & Payment": "We calculated your settlement and prepared payment.",
};

export default function MemberClaimPage() {
  const { subjectId = "" } = useParams();
  const { member } = useMember();
  const [queue, setQueue] = useState<DecisionsResponse | null>(null);
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [evidence, setEvidence] = useState<EvidenceGroup | null>(null);
  const [estimate, setEstimate] = useState<{ amount?: string; excerpt: string } | null>(null);

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
    fetchEvidenceForSubject(subjectId).then(setEvidence).catch(() => setEvidence(null));
  }, [subjectId]);

  // When the estimation stage has run, surface its outcome in member language: pull the
  // latest damage/estimation trace and lift the estimate figure from the step output.
  useEffect(() => {
    const damageTrace = [...(journey?.traces ?? [])]
      .reverse()
      .find((t) => /damage|estimat/i.test(t.packageId ?? "") && t.status === "completed");
    if (!damageTrace) return;
    let cancelled = false;
    fetchTrace(subjectId, damageTrace.traceId).then(({ trace, source }) => {
      if (cancelled || source !== "live") return;
      const step =
        [...trace.steps].reverse().find((s) => /estimat/i.test(`${s.label} ${s.agentId}`) && s.output) ??
        [...trace.steps].reverse().find((s) => s.output);
      if (!step) return;
      const amounts = step.output.match(/\$\s?[\d,]+(?:\.\d{2})?/g) ?? [];
      const excerpt = step.output.length > 320 ? `${step.output.slice(0, 320)}…` : step.output;
      setEstimate({ amount: amounts.length ? amounts[amounts.length - 1].replace(/\s/g, "") : undefined, excerpt });
    });
    return () => {
      cancelled = true;
    };
  }, [journey, subjectId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const decision = useMemo(() => queue?.decisions.find((d) => d.subjectId === subjectId), [queue, subjectId]);
  const stages = useMemo(
    () => lifecycleStages(queue?.packages ?? [], decision?.useCase ?? "p-and-c-auto-claims"),
    [queue, decision],
  );
  const latestByPackage = useMemo(() => {
    const m = new Map<string, (typeof journey extends null ? never : JourneyResponse)["traces"][number]>();
    for (const t of journey?.traces ?? []) if (t.packageId) m.set(t.packageId, t);
    return m;
  }, [journey]);

  const record = useMemo(() => member?.claims.find((c) => c.claimNumber === subjectId), [member, subjectId]);
  const currentIdx = useMemo(() => {
    const firstOpen = stages.findIndex((s) => latestByPackage.get(s.packageId)?.status !== "completed");
    return firstOpen === -1 ? stages.length : firstOpen;
  }, [stages, latestByPackage]);

  const underReview = [...latestByPackage.values()].some((t) => t.status === "needs-review");

  return (
    <div className="adp-report">
      <nav className="adp-member-breadcrumb">
        <Link to="/member/home">My account</Link> <span>/</span> {subjectId}
      </nav>

      <div className="adp-page-head">
        <div>
          <h2>Claim {subjectId}</h2>
          <div className="adp-page-head__tags">
            {underReview ? (
              <Tag type="magenta">With a claims specialist</Tag>
            ) : currentIdx >= stages.length && stages.length > 0 ? (
              <Tag type="teal">All steps complete</Tag>
            ) : (
              <Tag type="cool-gray">In progress</Tag>
            )}
            {record?.incident?.incidentType && (
              <Tag type="outline">{record.incident.incidentType.replaceAll("-", " ")}</Tag>
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
                        ? "a specialist is reviewing"
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
                  <strong>{s.stage}:</strong> {STAGE_MEMBER_COPY[s.stage ?? ""] ?? "Processed."}
                  {jt.operatorActions > 0 ? " A Meridian specialist personally reviewed this step." : ""}
                </p>
              );
            })}
            {journey && journey.traces.length === 0 && (
              <p className="adp-queue__dim">
                Your claim has been received and is waiting to be picked up. You'll see each step here as it happens.
              </p>
            )}
          </div>
        </Tile>
      )}

      {(evidence || record?.evidenceAssessment || estimate) && (
        <Tile className="adp-member-card adp-member-evidence">
          <h4 className="adp-side-card__title">
            <MachineLearningModel size={20} /> Damage assessment
          </h4>
          {evidence && evidence.files.length > 0 && (
            <div className="adp-member-evidence__photos">
              {evidence.files.map((f) => (
                <a
                  key={f.name}
                  href={evidenceFileUrl(evidence.groupId, f.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="adp-report__photo-thumb"
                >
                  <img src={evidenceFileUrl(evidence.groupId, f.name)} alt={`Submitted damage photo ${f.name}`} />
                </a>
              ))}
            </div>
          )}
          {record?.evidenceAssessment && (
            <p className="adp-queue__dim">
              <strong>What our AI saw in your photos:</strong> {record.evidenceAssessment}
            </p>
          )}
          {estimate ? (
            <div className="adp-member-evidence__estimate">
              {estimate.amount && (
                <p className="adp-member-evidence__amount">
                  {estimate.amount}
                  <span> estimated repair cost</span>
                </p>
              )}
              <p className="adp-queue__dim">
                <strong>From your claim's estimation step:</strong> {estimate.excerpt}
              </p>
            </div>
          ) : (
            (evidence || record?.evidenceAssessment) && (
              <p className="adp-queue__dim">
                Your repair estimate will appear here once the Damage &amp; Estimation step completes.
              </p>
            )
          )}
        </Tile>
      )}

      <Tile className="adp-member-card">
        <h4 className="adp-side-card__title">Your promise from Meridian</h4>
        <p className="adp-queue__dim">
          Every decision on this claim is recorded permanently, grounded in your actual policy, and checked against
          confidence thresholds. Anything uncertain goes to a person. That record cannot be altered afterwards.
        </p>
      </Tile>
    </div>
  );
}
