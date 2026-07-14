import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Column,
  Dropdown,
  Grid,
  InlineLoading,
  InlineNotification,
  Modal,
  ProgressIndicator,
  ProgressStep,
  SkeletonText,
  Tag,
  TextArea,
  Tile,
  Toggle,
} from "@carbon/react";
import { DocumentView, Play, User } from "@carbon/icons-react";
// Official product marks + Fluent 2 iconography for the Microsoft IQ systems, per the
// DT Offering dual-brand convention (same assets as the offering website + collateral).
import { PeopleTeam20Regular } from "@fluentui/react-icons";
import { MS_ICONS } from "../assets/msIcons";
import { executeAction } from "../services/actionsClient";
import {
  defaultPackageId,
  fetchDecisions,
  lifecycleStages,
  type DecisionItem,
  type DecisionsResponse,
} from "../services/decisionsClient";
import { fetchJourney, type JourneyResponse, type JourneyTrace } from "../services/journeyClient";
import { evidenceFileUrl, fetchEvidenceForSubject, type EvidenceGroup } from "../services/evidenceClient";
import { useDecisionRun } from "../hooks/useDecisionRun";
import type { LiveStepEvent } from "../services/liveTail";
import type { TraceStep } from "../services/types";
import { pct, relativeTime, secs } from "../lib/format";
import { ontologyLabel, shortDocId, sourceSystem } from "../lib/evidence";

function OriginTag({ origin }: { origin: string }) {
  return origin === "GROUNDED" ? (
    <Tag type="green" size="sm">Grounded</Tag>
  ) : (
    <Tag type="cool-gray" size="sm">Derived</Tag>
  );
}

function StepStatusTag({ status }: { status: string }) {
  if (status === "needs-human-review") return <Tag type="magenta" size="sm">Needs review</Tag>;
  if (status === "failed") return <Tag type="red" size="sm">Failed</Tag>;
  if (status === "running") return <Tag type="blue" size="sm">Running</Tag>;
  return <Tag type="teal" size="sm">Completed</Tag>;
}

interface StepCitation {
  sourceId: string;
  docId: string;
  title: string;
  score: number;
}

interface StepView {
  key: string;
  label: string;
  agentId: string;
  origin: string;
  status: string;
  confidence: number;
  durationMs: number;
  output: string;
  citations: StepCitation[];
  ontology: string[];
  regulatory: string[];
  toolCallCount: number;
  gateId?: string | null;
  isLive: boolean;
}

function fromLive(evt: LiveStepEvent): StepView {
  return {
    key: `${evt.traceId}-${evt.stepId}`,
    label: evt.label,
    agentId: evt.agentId,
    origin: evt.origin,
    status: evt.status,
    confidence: evt.confidence,
    durationMs: evt.durationMs,
    output: evt.outputSummary,
    citations: [],
    ontology: [],
    regulatory: [],
    toolCallCount: evt.toolCallCount ?? 0,
    gateId: evt.hitlGateId,
    isLive: true,
  };
}

function fromTrace(step: TraceStep, traceId: string): StepView {
  return {
    key: `${traceId}-${step.stepId}`,
    label: step.label,
    agentId: step.agentId,
    origin: step.origin,
    status: step.status,
    confidence: step.confidence,
    durationMs: step.durationMs,
    output: step.output,
    citations: (step.citedSources ?? []).map((c) => ({
      sourceId: c.sourceId,
      docId: c.docId,
      title: c.title,
      score: c.score,
    })),
    ontology: step.ontologyBindings ?? [],
    regulatory: step.regulatoryBasis ?? [],
    toolCallCount: step.toolCalls?.length ?? 0,
    gateId: step.hitlGateId,
    isLive: false,
  };
}

interface PendingAction {
  actionId: string;
  label: string;
  danger: boolean;
}

export default function DecisionModePage() {
  const { subjectId = "" } = useParams();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<DecisionsResponse | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [stageOverride, setStageOverride] = useState<number | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [forceGateAgent, setForceGateAgent] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [rationale, setRationale] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceGroup | null>(null);
  const [evidenceAssessment, setEvidenceAssessment] = useState<string | null>(null);
  const [runtimes, setRuntimes] = useState<string[]>([]);
  const [runtime, setRuntime] = useState<string>("");
  const [registry, setRegistry] = useState<import("../services/agentsClient").AgentsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("../services/agentsClient").then(({ fetchAgents }) =>
      fetchAgents().then((a) => {
        if (cancelled) return;
        setRuntimes(a.availableRuntimes ?? []);
        setRuntime(a.runtime);
        setRegistry(a);
      }),
    ).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchEvidenceForSubject(subjectId).then(setEvidence).catch(() => setEvidence(null));
  }, [subjectId]);

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await fetchDecisions());
      setQueueError(null);
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshJourney = useCallback(async () => {
    try {
      setJourney(await fetchJourney(subjectId));
    } catch {
      // journey is enrichment; the workspace still functions without it
    }
  }, [subjectId]);

  const onRunFinished = useCallback(() => {
    refreshQueue();
    refreshJourney();
  }, [refreshQueue, refreshJourney]);

  const runState = useDecisionRun(subjectId, onRunFinished);
  const { loadTrace, clear } = runState;

  useEffect(() => {
    refreshQueue();
    refreshJourney();
  }, [refreshQueue, refreshJourney]);

  const decision: DecisionItem | undefined = useMemo(
    () => queue?.decisions.find((d) => d.subjectId === subjectId),
    [queue, subjectId],
  );

  // The intake vision assessment lives on the stored record; fetch it only when the
  // subject actually has photo evidence.
  useEffect(() => {
    if (!evidence || !decision?.industry) return;
    let cancelled = false;
    import("../services/recordsClient").then(({ fetchRecords }) =>
      fetchRecords(decision.industry!).then((data) => {
        if (cancelled) return;
        const rec = data.records.find((r) => r[data.subjectIdField] === subjectId);
        setEvidenceAssessment(typeof rec?.evidenceAssessment === "string" ? rec.evidenceAssessment : null);
      }),
    ).catch(() => setEvidenceAssessment(null));
    return () => {
      cancelled = true;
    };
  }, [evidence, decision, subjectId]);

  // Lifecycle: the use case's declared stages, plus each stage's latest journey trace.
  const stages = useMemo(() => lifecycleStages(queue?.packages ?? [], decision?.useCase), [queue, decision]);
  const latestByPackage = useMemo(() => {
    const m = new Map<string, JourneyTrace>();
    for (const t of journey?.traces ?? []) {
      if (t.packageId) m.set(t.packageId, t); // traces are time-ordered; last wins
    }
    return m;
  }, [journey]);

  const defaultStageIdx = useMemo(() => {
    if (stages.length === 0) return 0;
    const firstOpen = stages.findIndex((s) => latestByPackage.get(s.packageId)?.status !== "completed");
    return firstOpen === -1 ? stages.length - 1 : firstOpen;
  }, [stages, latestByPackage]);

  const selectedIdx = stageOverride ?? defaultStageIdx;
  const activeStage = stages.length > 0 ? stages[Math.min(selectedIdx, stages.length - 1)] : null;

  const busy = runState.phase === "starting" || runState.phase === "streaming";

  // Browsing the rail loads that stage's latest trace (or a blank slate if never run).
  const shownTraceIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (busy) return;
    if (!activeStage) return;
    const jt = latestByPackage.get(activeStage.packageId);
    if (jt) {
      if (shownTraceIdRef.current !== jt.traceId) {
        shownTraceIdRef.current = jt.traceId;
        loadTrace(jt.traceId).catch(() => {});
      }
    } else if (shownTraceIdRef.current !== null) {
      shownTraceIdRef.current = null;
      clear();
    }
  }, [activeStage, latestByPackage, busy, loadTrace, clear]);

  // Non-staged fallback (a use case that declares no lifecycle): worker dropdown as before.
  const packageChoices = decision?.packageIds ?? [];
  const fallbackPackage =
    selectedPackage ?? (decision && queue ? defaultPackageId(decision, queue.decisions) : null);
  const activePackage = activeStage?.packageId ?? fallbackPackage;

  const forceableAgentId = useMemo(() => {
    if (!runState.trace || runState.trace.steps.length < 2) return undefined;
    return runState.trace.steps[1]?.agentId;
  }, [runState.trace]);

  const steps: StepView[] = useMemo(() => {
    if (runState.liveSteps.length > 0 && (busy || runState.phase === "error")) {
      return runState.liveSteps.map(fromLive);
    }
    if (busy) return [];
    if (runState.trace) return runState.trace.steps.map((s) => fromTrace(s, runState.trace!.traceId));
    return [];
  }, [runState.liveSteps, runState.trace, runState.phase, busy]);

  // The Microsoft IQ federation at a glance: which systems grounded this decision.
  const federation = useMemo(() => {
    const bySource = new Map<string, number>();
    const entities = new Set<string>();
    const regulatory = new Set<string>();
    for (const s of runState.trace?.steps ?? []) {
      for (const c of s.citedSources ?? []) bySource.set(c.sourceId, (bySource.get(c.sourceId) ?? 0) + 1);
      for (const o of s.ontologyBindings ?? []) entities.add(o);
      for (const r of s.regulatoryBasis ?? []) regulatory.add(r);
    }
    return { bySource: [...bySource.entries()], entities: [...entities], regulatory: [...regulatory] };
  }, [runState.trace]);

  const groundedCount = steps.filter((s) => s.origin === "GROUNDED").length;

  const handleStart = useCallback(() => {
    if (!activePackage) return;
    setActionDone(null);
    shownTraceIdRef.current = null;
    runState.start(activePackage, forceGateAgent ? forceableAgentId : undefined, runtime || undefined);
  }, [runState, activePackage, forceGateAgent, forceableAgentId, runtime]);

  const finalAgentStep = useMemo(() => {
    const agentSteps = (runState.trace?.steps ?? []).filter((s) => !s.agentId.startsWith("human."));
    return agentSteps.length > 0 ? agentSteps[agentSteps.length - 1] : null;
  }, [runState.trace]);

  const operatorStep = useMemo(
    () => (runState.trace?.steps ?? []).find((s) => s.agentId.startsWith("human.")),
    [runState.trace],
  );

  const confirmAction = useCallback(async () => {
    if (!pendingAction || !runState.trace) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await executeAction({
        subjectId,
        traceId: runState.trace.traceId,
        actionId: pendingAction.actionId,
        label: pendingAction.label,
        rationale: rationale.trim() || undefined,
      });
      setActionDone(pendingAction.label);
      setPendingAction(null);
      setRationale("");
      await runState.loadTrace(runState.trace.traceId);
      refreshQueue();
      refreshJourney();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(false);
    }
  }, [pendingAction, runState, subjectId, rationale, refreshQueue, refreshJourney]);

  const stageName = useCallback(
    (packageId?: string | null) => stages.find((s) => s.packageId === packageId)?.stage ?? packageId ?? "unknown",
    [stages],
  );

  const nextStage = stages.length > 0 && selectedIdx < stages.length - 1 ? stages[selectedIdx + 1] : null;
  const activeStageDone = activeStage
    ? latestByPackage.get(activeStage.packageId)?.status === "completed"
    : false;

  return (
    <Grid fullWidth>
      <Column lg={16} md={8} sm={4}>
        <Breadcrumb noTrailingSlash className="adp-breadcrumb">
          <BreadcrumbItem>
            <Link to="/decisions">Decision Queue</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>{subjectId}</BreadcrumbItem>
        </Breadcrumb>

        <div className="adp-page-head">
          <div>
            <h2>{subjectId}</h2>
            <div className="adp-page-head__tags">
              {decision?.useCase && (
                <Tag type={decision.industry === "banking" ? "purple" : "blue"} size="sm">
                  {decision.useCase}
                </Tag>
              )}
              {activeStage && (
                <Tag type="outline" size="sm">
                  {activeStage.stage} · {activeStage.workerName}
                </Tag>
              )}
              {runState.trace && <Tag type="outline" size="sm">trace {runState.trace.traceId}</Tag>}
            </div>
          </div>
          <div className="adp-run-launcher">
            {stages.length === 0 && packageChoices.length > 1 && (
              <Dropdown
                id="package-select"
                titleText=""
                label="Digital worker"
                size="lg"
                items={packageChoices}
                itemToString={(i) => i ?? ""}
                selectedItem={fallbackPackage}
                onChange={({ selectedItem }) => setSelectedPackage(selectedItem)}
                disabled={busy}
              />
            )}
            {forceableAgentId && (
              <Toggle
                id="force-gate"
                size="sm"
                labelText=""
                labelA="Force review gate"
                labelB="Force review gate"
                toggled={forceGateAgent}
                onToggle={setForceGateAgent}
                disabled={busy}
              />
            )}
            {runtimes.length > 1 && (
              <Dropdown
                id="run-runtime"
                titleText=""
                label="runtime"
                size="md"
                items={runtimes}
                itemToString={(r) => (r === "agent-framework" ? "Agent Framework" : r === "foundry" ? "Foundry Agent Service" : (r ?? ""))}
                selectedItem={runtime}
                onChange={({ selectedItem }) => setRuntime(selectedItem ?? "")}
                disabled={busy}
                className="adp-runtime-pick"
              />
            )}
            <Button renderIcon={Play} onClick={handleStart} disabled={busy || !activePackage}>
              {activeStageDone ? "Run stage again" : runState.trace || busy ? "Run stage" : "Run decision"}
            </Button>
            {(journey?.traces.length ?? 0) > 0 && (
              <Button
                kind="ghost"
                renderIcon={DocumentView}
                onClick={() => navigate(`/decisions/${encodeURIComponent(subjectId)}/record`)}
              >
                Decision record
              </Button>
            )}
          </div>
        </div>

        {stages.length > 0 && (
          <div className="adp-lifecycle">
            <ProgressIndicator
              currentIndex={selectedIdx}
              spaceEqually
              onChange={(idx: number) => {
                if (!busy) setStageOverride(idx);
              }}
            >
              {stages.map((s) => {
                const jt = latestByPackage.get(s.packageId);
                return (
                  <ProgressStep
                    key={s.packageId}
                    label={s.stage ?? s.packageId}
                    secondaryLabel={
                      jt
                        ? jt.status === "completed"
                          ? `decided · ${pct(jt.avgConfidence)}`
                          : jt.status === "needs-review"
                            ? "awaiting review"
                            : "failed"
                        : "not run"
                    }
                    complete={jt?.status === "completed"}
                    invalid={jt ? jt.status !== "completed" : false}
                    disabled={busy}
                  />
                );
              })}
            </ProgressIndicator>
          </div>
        )}

        {(runState.error || queueError) && (
          <InlineNotification
            kind="error"
            title="Problem"
            subtitle={runState.error ?? queueError ?? ""}
            lowContrast
            className="adp-notification"
          />
        )}
      </Column>

      <Column lg={10} md={8} sm={4}>
        <h3 className="adp-section-title">
          {activeStage ? `${activeStage.stage} trace` : "Agent trace"}{" "}
          {busy && (
            <InlineLoading
              description={
                runState.phase === "starting"
                  ? "Starting orchestration"
                  : runState.openGate
                    ? "Paused: waiting for your judgment (right rail)"
                    : (() => {
                        // Which agent is at work right now: the worker's next undone step.
                        const worker = registry?.workers.find((w) => w.packageId === activePackage);
                        const idx = runState.liveSteps.length;
                        const current = worker?.agents[idx];
                        return current
                          ? `${worker!.workerName} · ${current.agentId} working (step ${idx + 1} of ${worker!.agents.length})`
                          : "Agents working";
                      })()
              }
            />
          )}
        </h3>

        {steps.length === 0 && !busy && (
          <Tile className="adp-empty">
            {queue === null && !queueError ? (
              <SkeletonText paragraph lineCount={2} />
            ) : (
              <>
                <p><strong>{activeStage ? `${activeStage.stage} has not run yet.` : "No runs yet for this subject."}</strong></p>
                <p className="adp-queue__dim">
                  {activeStage
                    ? `Run it to have ${activeStage.workerName} decide this stage live: every step grounded, scored, and journaled.`
                    : "Start a run to watch the digital worker decide it live: every step grounded, scored, and journaled."}
                </p>
              </>
            )}
          </Tile>
        )}

        <div className="adp-trace">
          {steps.map((s) => {
            const isOperator = s.agentId.startsWith("human.");
            return (
              <div
                key={s.key}
                className={`adp-trace-step${s.isLive ? " adp-trace-step--live" : ""}${
                  s.status === "needs-human-review" ? " adp-trace-step--gate" : ""
                }${isOperator ? " adp-trace-step--operator" : ""}`}
              >
                <div className="adp-trace-step__head">
                  <strong>{s.label}</strong>
                  <span className="adp-live-step__agent">{s.agentId}</span>
                  {isOperator ? (
                    <Tag type="purple" size="sm" renderIcon={User}>Operator judgment</Tag>
                  ) : (
                    <>
                      <OriginTag origin={s.origin} />
                      <StepStatusTag status={s.status} />
                      <Tag type="outline" size="sm">confidence {pct(s.confidence)}</Tag>
                    </>
                  )}
                  {s.gateId && <Tag type="magenta" size="sm">gate {s.gateId}</Tag>}
                  <span className="adp-live-step__meta">
                    {s.toolCallCount ? `${s.toolCallCount} tools · ` : ""}
                    {isOperator ? "" : secs(s.durationMs)}
                  </span>
                </div>
                <p className="adp-trace-step__output">{s.output}</p>
                {s.citations.length > 0 && (
                  <div className="adp-citations">
                    {s.citations.map((c) => {
                      const sys = sourceSystem(c.sourceId);
                      return (
                        <Tag
                          key={c.docId}
                          type={sys.tagType}
                          size="sm"
                          title={`${sys.label}${c.title && c.title !== c.docId ? ` · ${c.title}` : ""}${c.score > 0 ? ` · relevance ${c.score.toFixed(2)}` : ""}`}
                        >
                          {shortDocId(c.docId)}
                        </Tag>
                      );
                    })}
                  </div>
                )}
                {(s.ontology.length > 0 || s.regulatory.length > 0) && (
                  <div className="adp-trace-step__semantics">
                    {s.ontology.length > 0 && (
                      <span className="adp-trace-step__entities">
                        {s.ontology.map((o) => (
                          <Tag key={o} type="outline" size="sm" title={`Fabric IQ ontology entity ${o}`}>
                            {ontologyLabel(o)}
                          </Tag>
                        ))}
                      </span>
                    )}
                    {s.regulatory.length > 0 && (
                      <span className="adp-queue__dim adp-trace-step__reg" title={s.regulatory.join("\n")}>
                        {s.regulatory.length} regulatory basis {s.regulatory.length === 1 ? "reference" : "references"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {busy && steps.length < 4 && (
            <div className="adp-trace-step adp-trace-step--pending">
              <SkeletonText width="40%" />
            </div>
          )}
        </div>
      </Column>

      <Column lg={6} md={8} sm={4}>
        <h3 className="adp-section-title">Your judgment</h3>

        {runState.openGate ? (
          <Tile className="adp-gate-panel">
            <Tag type="magenta">Human review required</Tag>
            <h4 className="adp-gate-panel__title">
              {runState.openGate.label} paused at {pct(runState.openGate.confidence)} confidence
            </h4>
            <p className="adp-trace-step__output">{runState.openGate.outputSummary}</p>
            <p className="adp-queue__dim">
              Gate {runState.openGate.hitlGateId} fired because the platform knew what it did not know. Your decision
              is journaled immutably alongside the agent steps.
            </p>
            <div className="adp-gate-panel__actions">
              {runState.hitlOptions.map((opt) => (
                <Button
                  key={opt.optionId}
                  kind={opt.appearance === "primary" ? "primary" : "secondary"}
                  disabled={runState.hitlBusy}
                  onClick={() => runState.resolveGate(opt)}
                >
                  {opt.label}
                </Button>
              ))}
              {runState.hitlOptions.length === 0 && <InlineLoading description="Loading options" />}
            </div>
          </Tile>
        ) : (
          <Tile className="adp-side-card">
            <p className="adp-queue__dim">
              {busy
                ? "No gate open. The digital worker escalates here the moment confidence drops below threshold."
                : "Nothing needs your judgment right now. Gates appear here in real time when a step's confidence drops below threshold."}
            </p>
          </Tile>
        )}

        {runState.trace && !busy && !runState.openGate && (
          <Tile className={`adp-side-card${operatorStep ? "" : " adp-action-card"}`}>
            <h4 className="adp-side-card__title">Governed action</h4>
            {operatorStep ? (
              <>
                <Tag type="purple" size="sm" renderIcon={User}>Journaled</Tag>
                <p className="adp-trace-step__output">{operatorStep.output}</p>
                <p className="adp-queue__dim">
                  Recorded immutably on trace {runState.trace.traceId} as {operatorStep.agentId}.
                </p>
                {nextStage && (
                  <Button
                    kind="tertiary"
                    size="md"
                    renderIcon={Play}
                    onClick={() => setStageOverride(selectedIdx + 1)}
                  >
                    Continue to {nextStage.stage}
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="adp-queue__dim adp-action-card__lede">
                  The worker's recommendation from step "{finalAgentStep?.label}":
                </p>
                <p className="adp-trace-step__output">{finalAgentStep?.output}</p>
                <div className="adp-gate-panel__actions">
                  <Button
                    size="md"
                    onClick={() => setPendingAction({ actionId: "approve-execute", label: "Approve and execute", danger: false })}
                  >
                    Approve action
                  </Button>
                  <Button
                    size="md"
                    kind="danger--tertiary"
                    onClick={() => setPendingAction({ actionId: "decline-route-back", label: "Decline and route back", danger: true })}
                  >
                    Decline
                  </Button>
                </div>
              </>
            )}
            {actionDone && operatorStep && (
              <p className="adp-queue__dim adp-action-card__done">"{actionDone}" journaled just now.</p>
            )}
          </Tile>
        )}

        {journey && journey.traces.length > 0 && (
          <Tile className="adp-side-card">
            <h4 className="adp-side-card__title">Journey</h4>
            {journey.traces.map((t) => (
              <div key={t.traceId} className="adp-journey-row">
                <span className={`adp-journey-row__dot adp-journey-row__dot--${t.status}`} />
                <span className="adp-journey-row__stage">{stageName(t.packageId)}</span>
                <span className="adp-queue__dim">
                  {t.status === "completed" ? pct(t.avgConfidence) : t.status}
                  {t.operatorActions > 0 ? " · operator" : ""}
                </span>
                <span className="adp-journey-row__time">{relativeTime(t.lastActivityAt)}</span>
              </div>
            ))}
          </Tile>
        )}

        {evidence && evidence.files.length > 0 && (
          <Tile className="adp-side-card">
            <h4 className="adp-side-card__title">Submitted evidence</h4>
            <div className="adp-evidence-panel__grid">
              {evidence.files
                .filter((f) => f.contentType.startsWith("image/"))
                .map((f) => (
                  <a
                    key={f.name}
                    href={evidenceFileUrl(evidence.groupId, f.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="adp-report__photo-thumb"
                    title={f.name}
                  >
                    <img src={evidenceFileUrl(evidence.groupId, f.name)} alt={`Evidence ${f.name}`} />
                  </a>
                ))}
            </div>
            {evidence.files.some((f) => !f.contentType.startsWith("image/")) && (
              <div className="adp-report__doc-list">
                {evidence.files
                  .filter((f) => !f.contentType.startsWith("image/"))
                  .map((f) => (
                    <a
                      key={f.name}
                      className="adp-report__doc-chip"
                      href={evidenceFileUrl(evidence.groupId, f.name)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {f.name}
                    </a>
                  ))}
              </div>
            )}
            {evidenceAssessment ? (
              <p className="adp-queue__dim adp-evidence-panel__assessment">
                <strong>Vision assessment at intake (GPT-4o):</strong> {evidenceAssessment}
              </p>
            ) : (
              <p className="adp-queue__dim">
                {evidence.files.length} photo{evidence.files.length === 1 ? "" : "s"} submitted by the member at FNOL.
              </p>
            )}
          </Tile>
        )}

        {(steps.length > 0 || runState.trace) && (
          <Tile className="adp-side-card">
            <h4 className="adp-side-card__title">Grounding: the IQ federation</h4>
            <p>
              <strong>{groundedCount}/{steps.length || (runState.trace?.steps.length ?? 0)}</strong> steps grounded in
              retrieved context
            </p>
            {federation.bySource.map(([sourceId, count]) => {
              const sys = sourceSystem(sourceId);
              return (
                <div key={sourceId} className="adp-federation-row" title={sys.description}>
                  {sourceId === "FabricIQ" ? (
                    <img src={MS_ICONS.fabric} alt="" className="adp-federation-row__mark" />
                  ) : sourceId === "FoundryIQ" ? (
                    <img src={MS_ICONS.aiFoundry} alt="" className="adp-federation-row__mark" />
                  ) : (
                    <PeopleTeam20Regular className="adp-federation-row__icon" />
                  )}
                  <Tag type={sys.tagType} size="sm">{sys.label}</Tag>
                  <span className="adp-queue__dim">{count} citation{count === 1 ? "" : "s"}</span>
                </div>
              );
            })}
            {federation.entities.length > 0 && (
              <p className="adp-queue__dim adp-federation-note" title={federation.entities.join(", ")}>
                {federation.entities.length} ontology entities touched (Fabric IQ)
              </p>
            )}
            {federation.regulatory.length > 0 && (
              <p className="adp-queue__dim adp-federation-note" title={federation.regulatory.join("\n")}>
                {federation.regulatory.length} regulatory references implemented
              </p>
            )}
          </Tile>
        )}

        {runState.trace && (
          <Tile className="adp-side-card">
            <h4 className="adp-side-card__title">Digital worker</h4>
            <p>
              {runState.trace.package.id} v{runState.trace.package.version}
            </p>
            <p className="adp-queue__dim">
              {runState.trace.package.agentCount} agents · {runState.trace.package.skillCount} skills ·{" "}
              {runState.trace.package.toolCount} tools
            </p>
            {runState.trace.slos.length > 0 && (
              <>
                <h4 className="adp-side-card__title adp-side-card__title--spaced">SLOs</h4>
                {runState.trace.slos.map((s) => (
                  <p key={s.metric} className="adp-queue__dim">
                    {s.metric} {s.target} over {s.window}
                  </p>
                ))}
              </>
            )}
          </Tile>
        )}
      </Column>

      <Modal
        open={pendingAction !== null}
        modalLabel={subjectId}
        modalHeading="Action preview"
        primaryButtonText={actionBusy ? "Journaling..." : (pendingAction?.label ?? "Confirm")}
        secondaryButtonText="Cancel"
        danger={pendingAction?.danger}
        primaryButtonDisabled={actionBusy}
        onRequestClose={() => {
          if (!actionBusy) {
            setPendingAction(null);
            setActionError(null);
          }
        }}
        onRequestSubmit={confirmAction}
      >
        <p className="adp-modal-lede">
          You are about to execute the governed action <strong>{pendingAction?.label}</strong> on{" "}
          <strong>{subjectId}</strong>.
        </p>
        <div className="adp-modal-preview">
          <p className="adp-queue__dim">Worker recommendation being acted on:</p>
          <p className="adp-trace-step__output">{finalAgentStep?.output}</p>
        </div>
        <TextArea
          id="action-rationale"
          labelText="Rationale (journaled with the action)"
          placeholder="Why you are approving or declining this recommendation"
          rows={3}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          disabled={actionBusy}
        />
        <p className="adp-queue__dim adp-modal-note">
          This writes an immutable operator entry onto trace {runState.trace?.traceId} (actor human.operator). It
          cannot be edited or deleted afterwards: that is the audit story.
        </p>
        {actionError && (
          <InlineNotification kind="error" title="Action failed" subtitle={actionError} lowContrast hideCloseButton />
        )}
      </Modal>
    </Grid>
  );
}
