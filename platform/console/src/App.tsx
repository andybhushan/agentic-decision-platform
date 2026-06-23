import { useEffect, useState } from "react";
import {
  Badge,
  Body1,
  Body1Strong,
  Button,
  Card,
  CardHeader,
  Caption1,
  Divider,
  Dropdown,
  Option,
  Spinner,
  Subtitle1,
  Subtitle2,
  Title2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircle20Filled,
  Warning20Filled,
  PersonClock20Regular,
  Flow20Regular,
  ArrowSync20Regular,
  Play20Regular,
  PersonClock20Filled,
} from "@fluentui/react-icons";
import type { Trace, TraceStep, Origin, StepStatus } from "./types";
import { fetchTrace, type TraceFetchResult } from "./traceClient";
import { startRun, pollUntilTerminal, resolveHitl, type RunStatus } from "./runClient";
import { subscribeLiveTail, type LiveStepEvent, type LiveTailConnection } from "./liveTail";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
  },
  header: {
    padding: "20px 32px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  brand: { color: "#0078D4", letterSpacing: "0.5px" },
  body: {
    padding: "24px 32px",
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
  },
  traceCol: { display: "flex", flexDirection: "column", gap: "12px" },
  step: { padding: "12px 16px" },
  stepHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  stepRow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" },
  meta: { color: tokens.colorNeutralForeground3 },
  sidebar: { display: "flex", flexDirection: "column", gap: "12px" },
  hitlBanner: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    border: `1px solid ${tokens.colorPaletteYellowBorderActive}`,
    padding: "12px 16px",
    borderRadius: tokens.borderRadiusMedium,
  },
  hitlActions: { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" },
  toolCalls: {
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: `1px dashed ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  toolCall: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: tokens.colorNeutralForeground2,
    fontFamily: "Consolas, monospace",
  },
  toolArgs: {
    color: tokens.colorNeutralForeground3,
    fontSize: "11px",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  toolOk: { color: tokens.colorPaletteGreenForeground1, fontWeight: 600 },
  toolFail: { color: tokens.colorPaletteRedForeground1, fontWeight: 600 },
  // v1.1: ontology + regulatory + structured-citation chips
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
    marginTop: "6px",
  },
  chipLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: tokens.colorNeutralForeground3,
    marginRight: "2px",
  },
  ontologyChip: {
    padding: "2px 8px",
    fontSize: "11px",
    fontFamily: "Consolas, monospace",
    color: tokens.colorPaletteBlueForeground2,
    backgroundColor: tokens.colorPaletteBlueBackground2,
    borderRadius: "10px",
  },
  regulatoryChip: {
    padding: "2px 8px",
    fontSize: "11px",
    color: tokens.colorPaletteDarkOrangeForeground1,
    backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
    borderRadius: "10px",
    maxWidth: "560px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  citationChip: {
    padding: "2px 8px",
    fontSize: "11px",
    fontFamily: "Consolas, monospace",
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "10px",
  },
  sourceChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "10px",
    fontFamily: tokens.fontFamilyBase,
    cursor: "pointer",
    userSelect: "none",
  },
  sourceLive: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  sourceDemo: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorPaletteYellowForeground1,
  },
  topBar: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  runRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    flexWrap: "wrap",
  },
  runField: { display: "flex", flexDirection: "column", gap: "4px" },
  runLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  optBody: { display: "flex", flexDirection: "column", gap: "2px", padding: "4px 0" },
});

function shorten(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

// Package catalogue — packages the Function holds in Resources/.
// Each package declares its DWs, the agent at which "Run with HITL" forces a pause,
// and the subject pool the operator can pick from.
interface PackageEntry {
  id: string;
  label: string;
  industry: "insurance" | "banking";
  description: string;
  forceHitlAgentId: string;
  subjects: { id: string; label: string }[];
}

const PACKAGES: PackageEntry[] = [
  {
    id: "fnol-handler",
    label: "FNOL Handler · Meridian",
    industry: "insurance",
    description: "4 agents: claim-intake · coverage-verification · initial-triage · assignment-routing",
    forceHitlAgentId: "agent.initial-triage",
    subjects: [
      { id: "CLM-2026-10000", label: "CLM-2026-10000 · single-vehicle collision · IL" },
      { id: "CLM-2026-10001", label: "CLM-2026-10001 · multi-vehicle · TX" },
      { id: "CLM-2026-10002", label: "CLM-2026-10002 · rideshare/TNC · CA" },
      { id: "CLM-2026-10003", label: "CLM-2026-10003 · hit & run · FL" },
      { id: "CLM-2026-10004", label: "CLM-2026-10004 · weather/comprehensive · GA" },
      { id: "CLM-2026-10005", label: "CLM-2026-10005 · parking lot · NY" },
      { id: "CLM-2026-10006", label: "CLM-2026-10006 · rear-end · OH" },
      { id: "CLM-2026-10007", label: "CLM-2026-10007 · uninsured motorist · CA" },
    ],
  },
  {
    id: "damage-handler",
    label: "Damage Handler · Meridian",
    industry: "insurance",
    description: "4 agents: damage-intake · categorize · repair-estimate · shop-routing · HITL on total-loss",
    forceHitlAgentId: "agent.damage-categorize",
    subjects: [
      { id: "CLM-2026-10000", label: "CLM-2026-10000" },
      { id: "CLM-2026-10001", label: "CLM-2026-10001" },
      { id: "CLM-2026-10002", label: "CLM-2026-10002" },
      { id: "CLM-2026-10003", label: "CLM-2026-10003" },
      { id: "CLM-2026-10004", label: "CLM-2026-10004" },
      { id: "CLM-2026-10005", label: "CLM-2026-10005" },
      { id: "CLM-2026-10006", label: "CLM-2026-10006" },
      { id: "CLM-2026-10007", label: "CLM-2026-10007" },
    ],
  },
  {
    id: "fraud-handler",
    label: "Fraud Handler · Meridian",
    industry: "insurance",
    description: "4 agents · 5-pass bounded reasoning zone · mandatory HITL on siu-priority band",
    forceHitlAgentId: "agent.fraud-score",
    subjects: [
      { id: "CLM-2026-10000", label: "CLM-2026-10000" },
      { id: "CLM-2026-10001", label: "CLM-2026-10001" },
      { id: "CLM-2026-10002", label: "CLM-2026-10002" },
      { id: "CLM-2026-10003", label: "CLM-2026-10003" },
      { id: "CLM-2026-10004", label: "CLM-2026-10004" },
      { id: "CLM-2026-10005", label: "CLM-2026-10005" },
      { id: "CLM-2026-10006", label: "CLM-2026-10006" },
      { id: "CLM-2026-10007", label: "CLM-2026-10007" },
    ],
  },
  {
    id: "settlement-handler",
    label: "Settlement Handler · Meridian",
    industry: "insurance",
    description: "4 agents · state-aware disclosure · HITL on >$25K + full-denial",
    forceHitlAgentId: "agent.settlement-calculation",
    subjects: [
      { id: "CLM-2026-10000", label: "CLM-2026-10000" },
      { id: "CLM-2026-10001", label: "CLM-2026-10001" },
      { id: "CLM-2026-10002", label: "CLM-2026-10002" },
      { id: "CLM-2026-10003", label: "CLM-2026-10003" },
      { id: "CLM-2026-10004", label: "CLM-2026-10004" },
      { id: "CLM-2026-10005", label: "CLM-2026-10005" },
      { id: "CLM-2026-10006", label: "CLM-2026-10006" },
      { id: "CLM-2026-10007", label: "CLM-2026-10007" },
    ],
  },
  {
    id: "loan-handler",
    label: "Loan Handler · Banking",
    industry: "banking",
    description: "3 agents: intake · eligibility · decision-letter (FCRA + ECOA + state overlay)",
    forceHitlAgentId: "agent.loan-eligibility",
    subjects: [
      { id: "LOAN-2026-50001", label: "LOAN-50001 · Sarah Chen · CA · clean-approve tier-A" },
      { id: "LOAN-2026-50002", label: "LOAN-50002 · Maria Hernandez · TX · approve w/ cosign · Spanish" },
      { id: "LOAN-2026-50003", label: "LOAN-50003 · Devon Park · AZ · decline FICO + DTI" },
      { id: "LOAN-2026-50004", label: "LOAN-50004 · James Walker · OH · refer high-amount HE" },
      { id: "LOAN-2026-50005", label: "LOAN-50005 · Priya Patel · WA · clean-approve consolidation" },
      { id: "LOAN-2026-50006", label: "LOAN-50006 · Linda Foster · IL · refer no-employment-income" },
      { id: "LOAN-2026-50007", label: "LOAN-50007 · Robert Kim · NY · clean-approve tier-B" },
      { id: "LOAN-2026-50008", label: "LOAN-50008 · Emma Wilson · MA · approve w/ Spanish co-sign" },
      { id: "LOAN-2026-50009", label: "LOAN-50009 · Mei Lin · CA · approve CA 30-day window" },
      { id: "LOAN-2026-50010", label: "LOAN-50010 · Joseph Mbeki · MD · approve home-equity" },
      { id: "LOAN-2026-50011", label: "LOAN-50011 · Olivia Roberts · TN · refer tier-C short tenure" },
      { id: "LOAN-2026-50012", label: "LOAN-50012 · Aisha Mohammed · TX · decline FICO-D" },
    ],
  },
];

export function App() {
  const styles = useStyles();
  const [fetchResult, setFetchResult] = useState<TraceFetchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(PACKAGES[0].id);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(PACKAGES[0].subjects[0].id);

  const selectedPackage = PACKAGES.find((p) => p.id === selectedPackageId) ?? PACKAGES[0];

  // Reset subject when package changes
  const onPackageChange = (pkgId: string) => {
    setSelectedPackageId(pkgId);
    const pkg = PACKAGES.find((p) => p.id === pkgId);
    if (pkg && pkg.subjects.length > 0) {
      setSelectedSubjectId(pkg.subjects[0].id);
      void refresh(pkg.subjects[0].id);
    }
  };

  const onSubjectChange = (subjId: string) => {
    setSelectedSubjectId(subjId);
    void refresh(subjId);
  };

  const refresh = async (subject?: string) => {
    setLoading(true);
    const result = await fetchTrace(subject);
    setFetchResult(result);
    setLoading(false);
  };

  const runNewClaim = async (opts?: { withHitl?: boolean }) => {
    const packageId = selectedPackageId;
    const forceHitlAtAgentId = opts?.withHitl ? selectedPackage.forceHitlAgentId : undefined;
    setRunError(null);
    const subject = selectedSubjectId;
    setRunStatus({ runId: "starting…", status: "Pending" });
    setLiveState("connecting");
    setActiveRunId(null);

    // Reset the trace view to a blank shell for this subject so live events have something to mutate.
    setFetchResult({
      source: "live",
      trace: {
        traceId: "(pending)",
        subject,
        package: { id: packageId, version: "0.1.0", schemaVersion: "v1", agentCount: 0, skillCount: 0, toolCount: 0 },
        steps: [],
        hitlOptions: [],
        slos: fetchResult?.trace.slos ?? [],
        startedAt: new Date().toISOString(),
      },
    });

    // Open SignalR live tail — each emitted DecisionEvent will push a "step" message.
    let tail: LiveTailConnection | null = null;
    try {
      tail = await subscribeLiveTail(
        subject,
        (evt) => appendLiveStep(evt),
        (state) => setLiveState(state),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLiveState(`disconnected (${msg})`);
    }

    try {
      const started = await startRun(subject, packageId, forceHitlAtAgentId);
      setRunStatus({ runId: started.runId, status: "Pending" });
      setActiveRunId(started.runId);
      const final = await pollUntilTerminal(
        started.runId,
        (s) => setRunStatus(s),
        { intervalMs: 4000, timeoutMs: 600_000 },   // 10 min — accommodates HITL wait
      );
      setRunStatus(final);
      setActiveRunId(null);
      if (final.status === "Completed") {
        await refresh(started.subjectId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunError(msg);
      setRunStatus(null);
      setActiveRunId(null);
    } finally {
      if (tail) {
        await tail.stop();
        setLiveState("closed");
      }
    }
  };

  const onHitlApprove = async (optionId: string, overrideOutput: string) => {
    if (!activeRunId) {
      // Fallback: local-only override (offline / no active orchestration)
      applyLocalOverride(overrideOutput);
      return;
    }
    setRunError(null);
    try {
      await resolveHitl(activeRunId, optionId, overrideOutput);
      // Don't mutate UI here — the orchestrator's ResolveHitlActivity will publish a fresh step
      // via SignalR which the live-tail handler will use to replace the blocked step.
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunError(`resolve-hitl failed: ${msg}; applied local override only`);
      applyLocalOverride(overrideOutput);
    }
  };

  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const [liveState, setLiveState] = useState<string>("idle");

  const appendLiveStep = (evt: LiveStepEvent) => {
    setFetchResult((prev) => {
      const base: Trace = prev?.trace ?? {
        traceId: evt.traceId,
        subject: "",
        package: { id: "fnol-handler", version: "0.1.0", schemaVersion: "v1", agentCount: 0, skillCount: 0, toolCount: 0 },
        steps: [],
        hitlOptions: [],
        slos: [],
        startedAt: new Date().toISOString(),
      };
      const incoming: TraceStep = {
        stepId: evt.stepId,
        agentId: evt.agentId,
        label: evt.label,
        confidence: evt.confidence,
        status: evt.status as StepStatus,
        origin: evt.origin as Origin,
        output: evt.outputSummary,
        durationMs: evt.durationMs,
        hitlGateId: evt.hitlGateId ?? undefined,
      };
      const existingIdx = base.steps.findIndex((s) => s.stepId === incoming.stepId);
      const nextSteps = [...base.steps];
      if (existingIdx >= 0) nextSteps[existingIdx] = { ...nextSteps[existingIdx], ...incoming };
      else nextSteps.push(incoming);
      nextSteps.sort((a, b) => a.stepId.localeCompare(b.stepId));
      return {
        source: "live",
        endpoint: prev?.endpoint,
        trace: { ...base, traceId: evt.traceId, steps: nextSteps },
      };
    });
  };

  useEffect(() => { void refresh(); }, []);

  if (!fetchResult || loading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <Caption1 className={styles.brand}>PROJECT ADP / V1</Caption1>
          <Title2>Operator Console</Title2>
        </header>
        <div className={styles.body}>
          <Spinner label="Loading trace…" />
        </div>
      </div>
    );
  }

  const trace = fetchResult.trace;
  const blockingStep = trace.steps.find((s) => s.status === "needs-human-review");

  // Fallback when no active orchestration (offline or pre-D8b style).
  const applyLocalOverride = (overrideOutput: string) => {
    if (!blockingStep) return;
    const nextSteps: TraceStep[] = trace.steps.map((s) =>
      s.stepId === blockingStep.stepId
        ? { ...s, status: "completed", confidence: Math.max(s.confidence, 0.93), origin: "GROUNDED", output: overrideOutput }
        : s,
    );
    setFetchResult({ ...fetchResult, trace: { ...trace, steps: nextSteps } });
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Caption1 className={styles.brand}>PROJECT ADP / V1</Caption1>
        <div className={styles.topBar}>
          <Title2>Operator Console</Title2>
          <span
            className={`${styles.sourceChip} ${fetchResult.source === "live" ? styles.sourceLive : styles.sourceDemo}`}
            title={fetchResult.endpoint ?? "bundled demo"}
            onClick={() => void refresh()}
          >
            {fetchResult.source === "live" ? "● LIVE" : "● DEMO"}
            <ArrowSync20Regular style={{ width: 14, height: 14 }} />
          </span>
          {runStatus && runStatus.status !== "Pending" && runStatus.status !== "Running" && (
            <Caption1 className={styles.meta}>
              last run: {runStatus.status}
              {runStatus.result && ` · ${runStatus.result.stepCount} steps · ${runStatus.result.hitlGatesOpen} HITL`}
            </Caption1>
          )}
          {liveState !== "idle" && (
            <Caption1 className={styles.meta}>· live: {liveState}</Caption1>
          )}
          {runError && <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>run error: {runError}</Caption1>}
        </div>

        <div className={styles.runRow}>
          <div className={styles.runField}>
            <Caption1 className={styles.runLabel}>Package</Caption1>
            <Dropdown
              value={selectedPackage.label}
              selectedOptions={[selectedPackageId]}
              onOptionSelect={(_, data) => data.optionValue && onPackageChange(data.optionValue)}
              disabled={runStatus?.status === "Pending" || runStatus?.status === "Running"}
              style={{ minWidth: 240 }}
            >
              {PACKAGES.map((p) => (
                <Option key={p.id} value={p.id} text={p.label}>
                  <div className={styles.optBody}>
                    <Body1Strong>{p.label}</Body1Strong>
                    <Caption1 className={styles.meta}>{p.description}</Caption1>
                  </div>
                </Option>
              ))}
            </Dropdown>
          </div>

          <div className={styles.runField}>
            <Caption1 className={styles.runLabel}>Subject</Caption1>
            <Dropdown
              value={selectedPackage.subjects.find((s) => s.id === selectedSubjectId)?.label ?? selectedSubjectId}
              selectedOptions={[selectedSubjectId]}
              onOptionSelect={(_, data) => data.optionValue && onSubjectChange(data.optionValue)}
              disabled={runStatus?.status === "Pending" || runStatus?.status === "Running"}
              style={{ minWidth: 340 }}
            >
              {selectedPackage.subjects.map((s) => (
                <Option key={s.id} value={s.id} text={s.label}>{s.label}</Option>
              ))}
            </Dropdown>
          </div>

          <Button
            icon={<Play20Regular />}
            appearance="primary"
            disabled={runStatus?.status === "Pending" || runStatus?.status === "Running"}
            onClick={() => void runNewClaim()}
            title={`Run ${selectedPackage.label} on subject ${selectedSubjectId}`}
          >
            {runStatus?.status === "Pending" || runStatus?.status === "Running" ? `Running… (${runStatus.status})` : "Run"}
          </Button>

          <Button
            icon={<PersonClock20Filled />}
            appearance="secondary"
            disabled={runStatus?.status === "Pending" || runStatus?.status === "Running"}
            onClick={() => void runNewClaim({ withHitl: true })}
            title={`Force a HITL pause at ${selectedPackage.forceHitlAgentId} so you can exercise Approve/Escalate`}
          >
            Run with HITL
          </Button>
        </div>

        <Body1 className={styles.meta}>
          {fetchResult.source === "demo" && fetchResult.error?.includes("404") ? (
            <>
              No trace yet for subject <code>{selectedSubjectId}</code> — pick a package and click <b>Run</b>. The selected subject hasn't been processed before; below is a bundled demo trace for reference.
            </>
          ) : (
            <>
              Package <code>{trace.package.id}@{trace.package.version}</code> · Subject {trace.subject} · Trace {trace.traceId}
              {fetchResult.error && !fetchResult.error.includes("404") && <span style={{ marginLeft: 8 }}>· {fetchResult.error}</span>}
            </>
          )}
        </Body1>
      </header>

      <div className={styles.body}>
        <div className={styles.traceCol}>
          <Subtitle1>Decision Trace</Subtitle1>
          {trace.steps.map((s) => (
            <Card key={s.stepId} className={styles.step}>
              <div className={styles.stepHeader}>
                <Body1Strong>
                  <Flow20Regular style={{ verticalAlign: "-4px", marginRight: 6 }} />
                  {s.label}
                </Body1Strong>
                {s.status === "completed" ? (
                  <Badge appearance="filled" color="success" icon={<CheckmarkCircle20Filled />}>completed</Badge>
                ) : s.status === "needs-human-review" ? (
                  <Badge appearance="filled" color="warning" icon={<Warning20Filled />}>needs human review</Badge>
                ) : (
                  <Badge appearance="outline">{s.status}</Badge>
                )}
              </div>
              <Body1 className={styles.meta}>{s.agentId}</Body1>
              <Body1 style={{ marginTop: 8 }}>{s.output}</Body1>
              <div className={styles.stepRow}>
                <Badge appearance="outline" color={s.origin === "GROUNDED" ? "informative" : "subtle"}>{s.origin}</Badge>
                <Badge appearance="outline">confidence {s.confidence.toFixed(2)}</Badge>
                <Caption1 className={styles.meta}>{s.durationMs} ms</Caption1>
                {s.hitlGateId && <Caption1 className={styles.meta}>· gate {s.hitlGateId}</Caption1>}
                {s.toolCalls && s.toolCalls.length > 0 && (
                  <Caption1 className={styles.meta}>· {s.toolCalls.length} tool call(s)</Caption1>
                )}
              </div>
              {s.toolCalls && s.toolCalls.length > 0 && (
                <div className={styles.toolCalls}>
                  {s.toolCalls.map((tc, idx) => (
                    <div key={idx} className={styles.toolCall}>
                      <code>{tc.toolId}</code>
                      <span className={styles.toolArgs}>{shorten(tc.arguments, 80)}</span>
                      <span className={tc.success ? styles.toolOk : styles.toolFail}>{tc.success ? "✓" : "✗"}</span>
                      <Caption1 className={styles.meta}>{tc.durationMs}ms</Caption1>
                    </div>
                  ))}
                </div>
              )}
              {s.citedSources && s.citedSources.length > 0 && (
                <div className={styles.chipRow}>
                  <span className={styles.chipLabel}>Cited</span>
                  {s.citedSources.map((c, idx) => (
                    <span
                      key={idx}
                      className={styles.citationChip}
                      title={`${c.title} · score ${c.score.toFixed(2)} · via ${c.sourceId}`}>
                      {c.docId}
                    </span>
                  ))}
                </div>
              )}
              {s.ontologyBindings && s.ontologyBindings.length > 0 && (
                <div className={styles.chipRow}>
                  <span className={styles.chipLabel}>Ontology</span>
                  {s.ontologyBindings.map((ob, idx) => (
                    <span
                      key={idx}
                      className={styles.ontologyChip}
                      title="Auto Claims Ontology v2.4 entity (acl:* namespace)">
                      {ob}
                    </span>
                  ))}
                </div>
              )}
              {s.regulatoryBasis && s.regulatoryBasis.length > 0 && (
                <div className={styles.chipRow}>
                  <span className={styles.chipLabel}>Regulatory basis</span>
                  {s.regulatoryBasis.map((r, idx) => (
                    <span key={idx} className={styles.regulatoryChip} title={r}>
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>

        <aside className={styles.sidebar}>
          <Card>
            <CardHeader header={<Subtitle2>Package</Subtitle2>} />
            <div style={{ padding: "0 16px 12px" }}>
              <Body1Strong>{trace.package.id}</Body1Strong>
              <Body1 className={styles.meta}>v{trace.package.version} · schema {trace.package.schemaVersion}</Body1>
              <Divider style={{ margin: "8px 0" }} />
              <Body1>
                {trace.package.agentCount} agents · {trace.package.skillCount} skills · {trace.package.toolCount} tools
              </Body1>
              <Caption1 className={styles.meta}>Trace started {new Date(trace.startedAt).toLocaleString()}</Caption1>
            </div>
          </Card>

          {blockingStep && (
            <div className={styles.hitlBanner}>
              <Body1Strong>
                <PersonClock20Regular style={{ verticalAlign: "-4px", marginRight: 6 }} />
                HITL gate open
              </Body1Strong>
              <Body1 style={{ marginTop: 6 }}>
                {blockingStep.hitlGateId && <><code>{blockingStep.hitlGateId}</code> · </>}
                Step <em>{blockingStep.label}</em> · confidence {blockingStep.confidence.toFixed(2)}
              </Body1>
              <div className={styles.hitlActions}>
                {(trace.hitlOptions.length > 0 ? trace.hitlOptions : [
                  { optionId: "approve-as-is", label: "Approve as-is", appearance: "primary" as const, overrideOutput: `Operator approved step output for ${blockingStep.label}.` },
                  { optionId: "escalate",      label: "Escalate to senior", appearance: "secondary" as const, overrideOutput: `Operator escalated ${blockingStep.label} to a senior reviewer.` },
                ]).map((opt) => (
                  <Button
                    key={opt.optionId}
                    appearance={opt.appearance === "primary" ? "primary" : "secondary"}
                    onClick={() => void onHitlApprove(opt.optionId, opt.overrideOutput)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              {activeRunId && (
                <Caption1 className={styles.meta} style={{ marginTop: 6, display: "block" }}>
                  resolves orchestration <code>{activeRunId.slice(0, 8)}…</code>
                </Caption1>
              )}
            </div>
          )}

          <Card>
            <CardHeader header={<Subtitle2>SLOs (declared)</Subtitle2>} />
            <div style={{ padding: "0 16px 12px" }}>
              {trace.slos.map((s) => (
                <Body1 key={s.metric}>
                  <code>{s.metric}</code> {s.target} · {s.window}
                </Body1>
              ))}
              <Caption1 className={styles.meta} style={{ marginTop: 6, display: "block" }}>
                Live metrics land on D7.
              </Caption1>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
