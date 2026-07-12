import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, SkeletonText, Tag } from "@carbon/react";
import { Printer } from "@carbon/icons-react";
import { fetchDecisions, lifecycleStages, type DecisionsResponse } from "../services/decisionsClient";
import { fetchJourney, type JourneyResponse } from "../services/journeyClient";
import { fetchTrace } from "../services/traceClient";
import type { Trace } from "../services/types";
import { pct, secs } from "../lib/format";
import { ontologyLabel, shortDocId, sourceSystem } from "../lib/evidence";

// The Decision Record: a complete, print-ready account of every decision made on a subject.
// This is the regulator-facing artifact: what was decided, by which worker and agents, on what
// evidence (with source system and relevance), under which regulatory basis, at what confidence,
// and where humans intervened. Reconstructed entirely from the immutable journal.

export default function DecisionRecordPage() {
  const { subjectId = "" } = useParams();
  const [queue, setQueue] = useState<DecisionsResponse | null>(null);
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [q, j] = await Promise.all([fetchDecisions(), fetchJourney(subjectId)]);
        if (cancelled) return;
        setQueue(q);
        setJourney(j);
        const results = await Promise.all(j.traces.map((t) => fetchTrace(subjectId, t.traceId)));
        if (cancelled) return;
        setTraces(results.filter((r) => r.source === "live").map((r) => r.trace));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [subjectId]);

  const decision = useMemo(() => queue?.decisions.find((d) => d.subjectId === subjectId), [queue, subjectId]);
  const stages = useMemo(() => lifecycleStages(queue?.packages ?? [], decision?.useCase), [queue, decision]);
  const stageName = (packageId?: string | null) =>
    stages.find((s) => s.packageId === packageId)?.stage ?? packageId ?? "decision";

  const generatedAt = useMemo(() => new Date().toISOString(), []);

  const summary = useMemo(() => {
    let steps = 0, grounded = 0, gates = 0, operatorActions = 0;
    const regulatory = new Set<string>();
    const entities = new Set<string>();
    for (const t of traces) {
      for (const s of t.steps) {
        if (s.agentId.startsWith("human.")) { operatorActions++; continue; }
        steps++;
        if (s.origin === "GROUNDED") grounded++;
        if (s.hitlGateId) gates++;
        for (const r of s.regulatoryBasis ?? []) regulatory.add(r);
        for (const o of s.ontologyBindings ?? []) entities.add(o);
      }
    }
    return { steps, grounded, gates, operatorActions, regulatory: [...regulatory], entities: [...entities] };
  }, [traces]);

  return (
    <div className="adp-record">
      <div className="adp-record__toolbar adp-no-print">
        <nav className="adp-member-breadcrumb">
          <Link to="/decisions">Decision Queue</Link> <span>/</span>{" "}
          <Link to={`/decisions/${encodeURIComponent(subjectId)}`}>{subjectId}</Link> <span>/</span> Decision record
        </nav>
        <Button renderIcon={Printer} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>

      <header className="adp-record__head">
        <p className="adp-record__brand">ADP · Agentic Decision Platform</p>
        <h1>Decision Record</h1>
        <p className="adp-record__subject">{subjectId}</p>
        <div className="adp-record__meta">
          <span>Use case: {decision?.useCase ?? "-"}</span>
          <span>Generated: {generatedAt}</span>
          <span>Source: immutable decision journal (Cosmos DB), reconstructed without alteration</span>
        </div>
      </header>

      {error && <p className="adp-queue__dim">Record unavailable: {error}</p>}
      {!error && traces.length === 0 && <SkeletonText paragraph lineCount={6} />}

      {traces.length > 0 && (
        <>
          <section className="adp-record__summary">
            <div><strong>{journey?.traces.length}</strong> decision runs</div>
            <div><strong>{summary.steps}</strong> agent steps</div>
            <div><strong>{summary.grounded}/{summary.steps}</strong> grounded</div>
            <div><strong>{summary.gates}</strong> human gates</div>
            <div><strong>{summary.operatorActions}</strong> operator judgments</div>
            <div><strong>{summary.regulatory.length}</strong> regulatory references</div>
          </section>

          {traces.map((t, i) => {
            const jt = journey?.traces[i];
            return (
              <section key={t.traceId} className="adp-record__stage">
                <h2>
                  {i + 1}. {stageName(jt?.packageId)}
                </h2>
                <p className="adp-record__stage-meta">
                  Worker {t.package.id} v{t.package.version} ({t.package.agentCount} agents,{" "}
                  {t.package.skillCount} skills, {t.package.toolCount} tools) · trace {t.traceId} · started{" "}
                  {String(t.startedAt)}
                </p>
                {t.steps.map((s) => {
                  const isOperator = s.agentId.startsWith("human.");
                  return (
                    <div key={s.stepId} className={`adp-record__step${isOperator ? " adp-record__step--operator" : ""}`}>
                      <div className="adp-record__step-head">
                        <strong>{s.stepId} · {s.label}</strong>
                        <span>{s.agentId}</span>
                        {isOperator ? (
                          <Tag type="purple" size="sm">Operator judgment</Tag>
                        ) : (
                          <>
                            <span>{s.origin}</span>
                            <span>confidence {pct(s.confidence)}</span>
                            <span>{secs(s.durationMs)}</span>
                          </>
                        )}
                        {s.hitlGateId && <span className="adp-record__gate">gate {s.hitlGateId}</span>}
                      </div>
                      <p className="adp-record__output">{s.output}</p>
                      {(s.citedSources?.length ?? 0) > 0 && (
                        <ul className="adp-record__evidence">
                          {s.citedSources!.map((c) => (
                            <li key={c.docId}>
                              [{sourceSystem(c.sourceId).label}] {shortDocId(c.docId)}
                              {c.title && c.title !== c.docId ? ` — ${c.title}` : ""}
                              {c.score > 0 ? ` (relevance ${c.score.toFixed(2)})` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      {(s.ontologyBindings?.length ?? 0) > 0 && (
                        <p className="adp-record__semantics">
                          Ontology entities: {s.ontologyBindings!.map(ontologyLabel).join(", ")}{" "}
                          <span className="adp-record__ns">({s.ontologyBindings!.join(", ")})</span>
                        </p>
                      )}
                      {(s.regulatoryBasis?.length ?? 0) > 0 && (
                        <p className="adp-record__semantics">Regulatory basis: {s.regulatoryBasis!.join(" · ")}</p>
                      )}
                    </div>
                  );
                })}
                {t.slos.length > 0 && (
                  <p className="adp-record__slos">
                    Declared SLOs: {t.slos.map((s) => `${s.metric} ${s.target} over ${s.window}`).join(" · ")}
                  </p>
                )}
              </section>
            );
          })}

          <footer className="adp-record__foot">
            <p>
              This record is reconstructed verbatim from the platform's append-only decision journal. Each entry was
              written at execution time by the digital worker or the human operator identified above and cannot be
              modified or deleted. Confidence values are the model's own calibrated scores at the moment of decision;
              GROUNDED steps cite the retrieved evidence they relied on, attributed to the producing context system
              (Foundry IQ knowledge, Fabric IQ semantic layer, Work IQ collaboration).
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
