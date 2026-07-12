import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, SkeletonText, Tag } from "@carbon/react";
import { Printer } from "@carbon/icons-react";
import {
  fetchCycleTime,
  fetchOutcomes,
  fetchTimeline,
  type AggregateOutcomes,
  type CycleTimeResponse,
  type TimelineResponse,
} from "../services/outcomesClient";
import { fetchAgents, type AgentsResponse } from "../services/agentsClient";
import { fetchDecisions, lifecycleStages, type DecisionsResponse } from "../services/decisionsClient";
import { pct } from "../lib/format";

// The Outcomes Report: a print-ready operations summary in the Decision Record style.
// Everything on it is reconstructed from the immutable journal at generation time; nothing
// is hand-entered. Default window is the last 7 days (the weekly report).

const WINDOW_LABELS: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
};

export default function OutcomesReportPage() {
  const [searchParams] = useSearchParams();
  const window_ = searchParams.get("window") ?? "7d";
  const bucket = window_ === "24h" ? "1h" : "1d";

  const [outcomes, setOutcomes] = useState<AggregateOutcomes | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [cycle, setCycle] = useState<CycleTimeResponse | null>(null);
  const [agents, setAgents] = useState<AgentsResponse | null>(null);
  const [queue, setQueue] = useState<DecisionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchOutcomes(window_),
      fetchTimeline(window_, bucket),
      fetchCycleTime(window_).catch(() => null),
      fetchAgents(window_),
      fetchDecisions(),
    ])
      .then(([o, t, c, a, q]) => {
        if (cancelled) return;
        setOutcomes(o);
        setTimeline(t);
        setCycle(c);
        setAgents(a);
        setQueue(q);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [window_, bucket]);

  const generatedAt = useMemo(() => new Date().toISOString(), []);

  const lifecycleProgress = useMemo(() => {
    if (!queue) return [];
    const cases = [...new Set(queue.packages.map((p) => p.useCase))];
    return cases
      .map((uc) => {
        const stages = lifecycleStages(queue.packages, uc);
        const subjects = queue.decisions.filter((d) => d.useCase === uc);
        return {
          useCase: uc,
          total: subjects.length,
          rows: stages.map((s) => ({
            stage: s.stage ?? s.packageId,
            done: subjects.filter((d) => d.packagesRun.includes(s.packageId)).length,
          })),
        };
      })
      .filter((c) => c.rows.length > 0 && c.total > 0);
  }, [queue]);

  const workers = useMemo(
    () => (agents?.workers ?? []).filter((w) => w.stats && w.stats.runs > 0).sort((a, b) => (b.stats?.runs ?? 0) - (a.stats?.runs ?? 0)),
    [agents],
  );

  const reviewDays = useMemo(
    () => (timeline?.buckets ?? []).filter((b) => b.needsReview > 0),
    [timeline],
  );

  const ready = outcomes && timeline && agents && queue;

  return (
    <div className="adp-record">
      <div className="adp-record__toolbar adp-no-print">
        <nav className="adp-member-breadcrumb">
          <Link to="/outcomes">Outcomes</Link> <span>/</span> Report
        </nav>
        <Button renderIcon={Printer} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>

      <header className="adp-record__head">
        <p className="adp-record__brand">ADP · Agentic Decision Platform</p>
        <h1>Outcomes Report</h1>
        <p className="adp-record__subject">{WINDOW_LABELS[window_] ?? window_}</p>
        <div className="adp-record__meta">
          <span>Generated: {generatedAt}</span>
          <span>Source: immutable decision journal (Cosmos DB), aggregated at generation time</span>
          <span>All data synthetic · demonstration environment</span>
        </div>
      </header>

      {error && <p className="adp-queue__dim">Report unavailable: {error}</p>}
      {!error && !ready && <SkeletonText paragraph lineCount={6} />}

      {ready && (
        <>
          <section className="adp-record__summary">
            <div><strong>{outcomes.tracesRecorded}</strong> decision runs</div>
            <div><strong>{outcomes.claimsHandled}</strong> subjects decided</div>
            <div><strong>{pct(outcomes.groundedStepRate)}</strong> steps grounded</div>
            <div><strong>{pct(outcomes.avgConfidence)}</strong> avg confidence</div>
            <div><strong>{outcomes.stepsNeedingHumanReview}</strong> awaiting review</div>
            <div><strong>{(outcomes.avgStepDurationMs / 1000).toFixed(1)}s</strong> avg step</div>
          </section>

          <section className="adp-record__stage">
            <h2>Lifecycle progress</h2>
            {lifecycleProgress.map((c) => (
              <div key={c.useCase} className="adp-lifebar-group">
                <div className="adp-lifebar-group__head">
                  <Tag type={c.useCase.includes("loan") ? "purple" : "blue"} size="sm">{c.useCase}</Tag>
                  <span className="adp-queue__dim">{c.total} subjects</span>
                </div>
                {c.rows.map((r) => (
                  <div key={r.stage} className="adp-lifebar">
                    <span className="adp-lifebar__label">{r.stage}</span>
                    <span className="adp-lifebar__track">
                      <span className="adp-lifebar__fill" style={{ width: `${c.total ? Math.round((r.done / c.total) * 100) : 0}%` }} />
                    </span>
                    <span className="adp-lifebar__count">{r.done}/{c.total}</span>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section className="adp-record__stage">
            <h2>Digital worker performance</h2>
            {workers.map((w) => {
              const ct = cycle?.packages.find((c) => c.packageId === w.packageId);
              return (
                <div key={w.packageId} className="adp-record__step">
                  <div className="adp-record__step-head">
                    <strong>{w.workerName}</strong>
                    <span>{w.stage ?? w.packageId}</span>
                    <span>{w.stats!.runs} runs · {w.stats!.steps} steps</span>
                    <span>avg confidence {pct(w.stats!.avgConfidence)}</span>
                    <span>{w.stats!.gatesFired} gates · {w.stats!.operatorActions} operator judgments</span>
                    {ct && ct.runs > 0 && (
                      <span>cycle time p50 {(ct.p50Ms / 1000).toFixed(1)}s · p90 {(ct.p90Ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="adp-record__stage">
            <h2>Human oversight</h2>
            {reviewDays.length === 0 ? (
              <p className="adp-record__output">
                No step paused for human review in this window: every decision cleared its declared confidence
                thresholds.
              </p>
            ) : (
              reviewDays.map((b) => (
                <p key={b.start} className="adp-record__output">
                  {new Date(b.start).toLocaleString()}: {b.needsReview} step{b.needsReview === 1 ? "" : "s"} paused for
                  human judgment.
                </p>
              ))
            )}
          </section>

          <footer className="adp-record__foot">
            <p>
              This report is aggregated directly from the platform's append-only decision journal. Every underlying
              step was written at execution time by the digital worker or human operator involved and cannot be
              modified or deleted. Grounded steps cite retrieved evidence attributed to the producing context system
              (Foundry IQ knowledge, Fabric IQ semantic layer, Work IQ collaboration).
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
