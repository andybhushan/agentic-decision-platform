import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Column,
  ContentSwitcher,
  Dropdown,
  Grid,
  InlineNotification,
  SkeletonText,
  Switch,
  Tag,
  Tile,
} from "@carbon/react";
import { Printer } from "@carbon/icons-react";
import { CheckmarkCircle24Regular, Gauge24Regular, Search24Regular, Warning24Regular } from "@fluentui/react-icons";
import StatTile from "../components/StatTile";
import { StackedBarChart, LineChart, DonutChart, SimpleBarChart } from "@carbon/charts-react";
import { Alignments, ChartTheme, ScaleTypes } from "@carbon/charts";
import type { BarChartOptions, DonutChartOptions, LineChartOptions } from "@carbon/charts";
import "@carbon/charts/styles.css";
import {
  fetchCycleTime,
  fetchInsights,
  fetchOutcomes,
  fetchTimeline,
  type AggregateOutcomes,
  type CycleTimeResponse,
  type InsightsResponse,
  type TimelineResponse,
} from "../services/outcomesClient";
import { fetchDecisions, lifecycleStages, type DecisionsResponse } from "../services/decisionsClient";
import { fetchAgents, type AgentsResponse } from "../services/agentsClient";
import { packageColorScale, ACCENT_DARK, ACCENT_LIGHT } from "../theme/chartPalette";
import { useTheme } from "../theme/ThemeContext";
import { pct, relativeTime } from "../lib/format";

const WINDOWS = [
  { id: "24h", label: "24 hours", bucket: "1h" },
  { id: "7d", label: "7 days", bucket: "1d" },
  { id: "30d", label: "30 days", bucket: "1d" },
] as const;

type WindowId = (typeof WINDOWS)[number]["id"];

interface RunDatum {
  group: string;
  date: string;
  value: number;
}

interface ConfDatum {
  group: string;
  date: string;
  value: number;
}

export default function OutcomesPage() {
  const navigate = useNavigate();
  const { mode } = useTheme();
  const chartTheme = mode === "dark" ? ChartTheme.G100 : ChartTheme.WHITE;
  const accent = mode === "dark" ? ACCENT_DARK : ACCENT_LIGHT;
  const [windowId, setWindowId] = useState<WindowId>("7d");
  const [useCaseLens, setUseCaseLens] = useState<string>("all");
  const [queueData, setQueueData] = useState<DecisionsResponse | null>(null);
  const [agents, setAgents] = useState<AgentsResponse | null>(null);
  const [outcomes, setOutcomes] = useState<AggregateOutcomes | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [cycle, setCycle] = useState<CycleTimeResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const allPackages = queueData?.packages ?? [];

  useEffect(() => {
    let cancelled = false;
    fetchDecisions()
      .then((d) => { if (!cancelled) setQueueData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAgents(windowId)
      .then((a) => { if (!cancelled) setAgents(a); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [windowId]);

  const lensUseCases = useMemo(() => [...new Set(allPackages.map((p) => p.useCase))], [allPackages]);
  const lensPackages = useMemo(
    () =>
      useCaseLens === "all"
        ? undefined
        : allPackages.filter((p) => p.useCase === useCaseLens).map((p) => p.packageId),
    [useCaseLens, allPackages],
  );

  const load = useCallback(async (w: WindowId, packages?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const win = WINDOWS.find((x) => x.id === w)!;
      const [agg, tl, ct, ins] = await Promise.all([
        fetchOutcomes(w, packages),
        fetchTimeline(w, win.bucket, packages),
        fetchCycleTime(w, packages).catch(() => null),
        fetchInsights(w, packages).catch(() => null),
      ]);
      setOutcomes(agg);
      setTimeline(tl);
      setCycle(ct);
      setInsights(ins);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(windowId, lensPackages);
  }, [load, windowId, lensPackages]);

  const packageIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of timeline?.buckets ?? []) for (const k of Object.keys(b.tracesByPackage)) set.add(k);
    return [...set].sort();
  }, [timeline]);

  const colorScale = useMemo(() => packageColorScale(packageIds, mode), [packageIds, mode]);

  const runData: RunDatum[] = useMemo(() => {
    const rows: RunDatum[] = [];
    for (const b of timeline?.buckets ?? []) {
      for (const pkg of packageIds) {
        const v = b.tracesByPackage[pkg] ?? 0;
        if (v > 0) rows.push({ group: pkg, date: b.start, value: v });
      }
    }
    return rows;
  }, [timeline, packageIds]);

  const confData: ConfDatum[] = useMemo(
    () =>
      (timeline?.buckets ?? [])
        .filter((b) => b.traces > 0)
        .map((b) => ({ group: "Avg confidence", date: b.start, value: b.avgConfidence })),
    [timeline],
  );

  const runOptions: BarChartOptions = useMemo(
    () => ({
      title: "Decision runs by digital worker",
      height: "320px",
      theme: chartTheme,
      axes: {
        bottom: { title: "", mapsTo: "date", scaleType: ScaleTypes.TIME },
        left: { title: "runs", mapsTo: "value", includeZero: true },
      },
      color: { scale: colorScale },
      grid: { x: { enabled: false } },
      bars: { maxWidth: 24 },
      timeScale: { addSpaceOnEdges: 1 },
      toolbar: { enabled: false },
    }),
    [colorScale, chartTheme],
  );

  // Human oversight over time: steps that paused for judgment, per bucket.
  const oversightData = useMemo(
    () =>
      (timeline?.buckets ?? [])
        .filter((b) => b.needsReview > 0)
        .map((b) => ({ group: "Needed human review", date: b.start, value: b.needsReview })),
    [timeline],
  );

  const oversightOptions: BarChartOptions = useMemo(
    () => ({
      title: "Where humans were pulled in",
      height: "300px",
      theme: chartTheme,
      axes: {
        bottom: { title: "", mapsTo: "date", scaleType: ScaleTypes.TIME },
        left: { title: "steps paused for review", mapsTo: "value", includeZero: true },
      },
      color: { scale: { "Needed human review": mode === "dark" ? "#ee5396" : "#d02670" } },
      legend: { enabled: false },
      grid: { x: { enabled: false } },
      bars: { maxWidth: 24 },
      timeScale: { addSpaceOnEdges: 1 },
      toolbar: { enabled: false },
    }),
    [chartTheme, mode],
  );

  // Lifecycle progress: how far the book of subjects has traveled, per use case.
  const lifecycleProgress = useMemo(() => {
    if (!queueData) return [];
    const cases = useCaseLens === "all" ? lensUseCases : [useCaseLens];
    return cases
      .map((uc) => {
        const stages = lifecycleStages(queueData.packages, uc);
        const subjects = queueData.decisions.filter((d) => d.useCase === uc);
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
  }, [queueData, useCaseLens, lensUseCases]);

  // Worker performance from the governance registry, scoped to the lens.
  const workerRows = useMemo(
    () =>
      (agents?.workers ?? [])
        .filter((w) => useCaseLens === "all" || w.useCase === useCaseLens)
        .filter((w) => w.stats && w.stats.runs > 0)
        .sort((a, b) => (b.stats?.runs ?? 0) - (a.stats?.runs ?? 0)),
    [agents, useCaseLens],
  );

  const confOptions: LineChartOptions = useMemo(
    () => ({
      title: "Average step confidence per run day",
      height: "320px",
      theme: chartTheme,
      axes: {
        bottom: { title: "", mapsTo: "date", scaleType: ScaleTypes.TIME },
        left: {
          title: "confidence",
          mapsTo: "value",
          domain: [0, 1],
          ticks: { formatter: (v: number | Date) => pct(Number(v)) },
        },
      },
      color: { scale: { "Avg confidence": accent } },
      legend: { enabled: false },
      points: { radius: 4 },
      grid: { x: { enabled: false } },
      timeScale: { addSpaceOnEdges: 1 },
      toolbar: { enabled: false },
    }),
    [accent, chartTheme],
  );
  // Evidence mix: which IQ system produced the citations behind the window's decisions.
  const sourceColors: Record<string, string> = useMemo(
    () =>
      mode === "dark"
        ? { "Foundry IQ": "#4589ff", "Fabric IQ": "#1192e8", "Fabric IQ Data Agent": "#08bdba", "Work IQ": "#d2a106" }
        : { "Foundry IQ": "#0f62fe", "Fabric IQ": "#1192e8", "Fabric IQ Data Agent": "#009d9a", "Work IQ": "#b28600" },
    [mode],
  );

  const evidenceMixData = useMemo(
    () =>
      Object.entries(insights?.citationsBySource ?? {})
        .map(([group, value]) => ({ group, value }))
        .sort((a, b) => b.value - a.value),
    [insights],
  );

  const evidenceMixOptions: DonutChartOptions = useMemo(
    () => ({
      title: "Evidence mix: the IQ federation",
      height: "320px",
      theme: chartTheme,
      resizable: false,
      color: { scale: sourceColors },
      donut: {
        center: { label: "citations" },
        alignment: Alignments.CENTER,
      },
      toolbar: { enabled: false },
    }),
    [chartTheme, sourceColors],
  );

  // Confidence calibration: the distribution that explains WHERE the gates sit.
  const confHistData = useMemo(
    () =>
      (insights?.confidenceBins ?? [])
        .map((v, i) => ({ group: "steps", bin: `${i * 10}-${i * 10 + 10}%`, value: v }))
        .filter((d, i) => d.value > 0 || i >= 4),
    [insights],
  );

  const confHistOptions: BarChartOptions = useMemo(
    () => ({
      title: "Confidence calibration (all steps)",
      height: "320px",
      theme: chartTheme,
      axes: {
        bottom: { title: "calibrated confidence", mapsTo: "bin", scaleType: ScaleTypes.LABELS },
        left: { title: "steps", mapsTo: "value", includeZero: true },
      },
      color: { scale: { steps: accent } },
      legend: { enabled: false },
      grid: { x: { enabled: false } },
      bars: { maxWidth: 40 },
      toolbar: { enabled: false },
    }),
    [chartTheme, accent],
  );

  const judgment = insights?.gateOutcomes;
  const stp = insights?.straightThrough;

  return (
    <Grid fullWidth>
      <Column lg={16} md={8} sm={4}>
        <div className="adp-page-head">
          <div>
            <h2>Outcomes</h2>
            <p className="adp-page-head__sub">
              The platform's decision journal, aggregated: throughput, grounding discipline, and where human judgment
              was pulled in. Straight from the immutable trace store.
            </p>
          </div>
          <div className="adp-outcomes-controls">
            <Button
              kind="ghost"
              renderIcon={Printer}
              onClick={() => navigate(`/outcomes/report?window=${windowId}`)}
            >
              Report
            </Button>
            <Dropdown
              id="usecase-lens"
              titleText=""
              label="All use cases"
              size="md"
              items={["all", ...lensUseCases]}
              itemToString={(i) => (i === "all" ? "All use cases" : (i ?? ""))}
              selectedItem={useCaseLens}
              onChange={({ selectedItem }) => setUseCaseLens(selectedItem ?? "all")}
            />
            <ContentSwitcher
              size="md"
              selectedIndex={WINDOWS.findIndex((w) => w.id === windowId)}
              onChange={({ index }) => setWindowId(WINDOWS[index ?? 0].id)}
            >
              {WINDOWS.map((w) => (
                <Switch key={w.id} name={w.id} text={w.label} />
              ))}
            </ContentSwitcher>
          </div>
        </div>

        {error && (
          <InlineNotification kind="error" title="Dashboard unavailable" subtitle={error} lowContrast className="adp-notification" />
        )}

        <Grid narrow className="adp-stat-row">
          <Column lg={4} md={2} sm={2}>
            <StatTile
              icon={<CheckmarkCircle24Regular />}
              value={loading ? <SkeletonText width="3rem" /> : outcomes?.claimsHandled ?? 0}
              label="Subjects decided"
              note={`${outcomes?.tracesRecorded ?? 0} runs journaled`}
            />
          </Column>
          <Column lg={4} md={2} sm={2}>
            <StatTile
              icon={<Search24Regular />}
              alert={(outcomes?.groundedStepRate ?? 0) < 0.95}
              value={loading ? <SkeletonText width="3rem" /> : pct(outcomes?.groundedStepRate ?? 0)}
              label="Grounded steps"
              note={outcomes ? `${Math.round(outcomes.groundedStepRate * outcomes.stepsTotal)} of ${outcomes.stepsTotal} steps cite knowledge` : ""}
            />
          </Column>
          <Column lg={4} md={2} sm={2}>
            <StatTile
              icon={<Gauge24Regular />}
              value={loading ? <SkeletonText width="3rem" /> : outcomes?.avgConfidence ? pct(outcomes.avgConfidence) : "-"}
              label="Avg confidence"
              note={outcomes?.avgStepDurationMs ? `${(outcomes.avgStepDurationMs / 1000).toFixed(1)}s avg step` : ""}
            />
          </Column>
          <Column lg={4} md={2} sm={2}>
            <StatTile
              icon={<Warning24Regular />}
              alert={(outcomes?.stepsNeedingHumanReview ?? 0) > 0}
              value={loading ? <SkeletonText width="3rem" /> : outcomes?.stepsNeedingHumanReview ?? 0}
              label="Steps needing review"
              note="open HITL gates in window"
            />
          </Column>
        </Grid>

        <Grid narrow>
          <Column lg={8} md={8} sm={4}>
            <Tile className="adp-chart-card">
              {loading ? (
                <SkeletonText paragraph lineCount={8} />
              ) : runData.length > 0 ? (
                <StackedBarChart data={runData} options={runOptions} />
              ) : (
                <p className="adp-queue__dim">No runs in this window. Start one from the Decision Queue.</p>
              )}
            </Tile>
          </Column>
          <Column lg={8} md={8} sm={4}>
            <Tile className="adp-chart-card">
              {loading ? (
                <SkeletonText paragraph lineCount={8} />
              ) : confData.length > 0 ? (
                <LineChart data={confData} options={confOptions} />
              ) : (
                <p className="adp-queue__dim">No confidence data in this window.</p>
              )}
            </Tile>
          </Column>

          <Column lg={8} md={8} sm={4}>
            <Tile className="adp-chart-card">
              {loading ? (
                <SkeletonText paragraph lineCount={8} />
              ) : oversightData.length > 0 ? (
                <StackedBarChart data={oversightData} options={oversightOptions} />
              ) : (
                <>
                  <h4 className="adp-side-card__title">Where humans were pulled in</h4>
                  <p className="adp-queue__dim">
                    No step paused for human review in this window: every decision cleared its confidence thresholds.
                  </p>
                </>
              )}
            </Tile>
          </Column>

          <Column lg={8} md={8} sm={4}>
            <Tile className="adp-chart-card">
              <h4 className="adp-side-card__title">Lifecycle progress</h4>
              <p className="adp-queue__dim adp-lifebar-sub">
                How far the book of subjects has traveled through each use case's declared stages.
              </p>
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
              {lifecycleProgress.length === 0 && <p className="adp-queue__dim">No lifecycle data yet.</p>}
            </Tile>
          </Column>
        </Grid>

        <h3 className="adp-section-title">Governance insights</h3>
        <Grid narrow>
          <Column lg={5} md={4} sm={4}>
            <Tile className="adp-chart-card">
              {loading ? (
                <SkeletonText paragraph lineCount={8} />
              ) : evidenceMixData.length > 0 ? (
                <>
                  <DonutChart data={evidenceMixData} options={evidenceMixOptions} />
                  <p className="adp-queue__dim adp-insight-note">
                    Every citation behind this window's decisions, by the IQ system that produced it.
                  </p>
                </>
              ) : (
                <p className="adp-queue__dim">No citations journaled in this window.</p>
              )}
            </Tile>
          </Column>
          <Column lg={6} md={4} sm={4}>
            <Tile className="adp-chart-card">
              {loading ? (
                <SkeletonText paragraph lineCount={8} />
              ) : confHistData.length > 0 ? (
                <>
                  <SimpleBarChart data={confHistData} options={confHistOptions} />
                  <p className="adp-queue__dim adp-insight-note">
                    The distribution behind the gate policy: the low tail is exactly what goes to humans.
                  </p>
                </>
              ) : (
                <p className="adp-queue__dim">No scored steps in this window.</p>
              )}
            </Tile>
          </Column>
          <Column lg={5} md={8} sm={4}>
            <Tile className="adp-chart-card adp-judgment">
              <h4 className="adp-side-card__title">Human judgment outcomes</h4>
              {loading || !judgment || !stp ? (
                <SkeletonText paragraph lineCount={6} />
              ) : (
                <>
                  <p className="adp-judgment__stp">
                    {pct(stp.rate)}
                    <span> straight-through: {stp.untouched} of {stp.traces} runs needed no human at all</span>
                  </p>
                  {judgment.resolved > 0 ? (
                    <>
                      <div className="adp-judgment__bar" role="img" aria-label={`${judgment.approvedAsIs} approved as-is, ${judgment.overridden} overridden`}>
                        <span
                          className="adp-judgment__bar-approve"
                          style={{ width: `${Math.round((judgment.approvedAsIs / judgment.resolved) * 100)}%` }}
                        />
                      </div>
                      <div className="adp-judgment__legend">
                        <span><i className="adp-judgment__dot adp-judgment__dot--approve" /> Agent proposal approved as-is · {judgment.approvedAsIs}</span>
                        <span><i className="adp-judgment__dot adp-judgment__dot--override" /> Overridden or redirected · {judgment.overridden}</span>
                      </div>
                      <p className="adp-queue__dim adp-insight-note">
                        When gates opened, specialists agreed with the agent {pct(judgment.resolved ? judgment.approvedAsIs / judgment.resolved : 0)} of the
                        time. Agreement builds trust; overrides retrain the thresholds.
                      </p>
                    </>
                  ) : (
                    <p className="adp-queue__dim adp-insight-note">
                      No gates were resolved in this window{judgment.opened > 0 ? `; ${judgment.opened} currently open` : ""}.
                    </p>
                  )}
                </>
              )}
            </Tile>
          </Column>
        </Grid>

        {workerRows.length > 0 && (
          <Tile className="adp-worker-card adp-worker-perf">
            <h4 className="adp-side-card__title">Digital worker performance ({WINDOWS.find((w) => w.id === windowId)?.label})</h4>
            <div className="adp-agent-rows">
              {workerRows.map((w) => (
                <div key={w.packageId} className="adp-agent-row">
                  <span className="adp-agent-row__id">{w.workerName}</span>
                  {w.stage && <Tag type="teal" size="sm">{w.stage}</Tag>}
                  <span className="adp-queue__dim">{w.stats!.runs} runs · {w.stats!.steps} steps</span>
                  <span className="adp-queue__dim">
                    {w.stats!.gatesFired} gate{w.stats!.gatesFired === 1 ? "" : "s"} · {w.stats!.operatorActions} operator judgment{w.stats!.operatorActions === 1 ? "" : "s"}
                  </span>
                  {(() => {
                    const ct = cycle?.packages.find((c) => c.packageId === w.packageId);
                    return ct && ct.runs > 0 ? (
                      <span
                        className="adp-queue__dim"
                        title={`Decision cycle time: median ${(ct.p50Ms / 1000).toFixed(1)}s, 90th percentile ${(ct.p90Ms / 1000).toFixed(1)}s`}
                      >
                        p50 {(ct.p50Ms / 1000).toFixed(1)}s · p90 {(ct.p90Ms / 1000).toFixed(1)}s
                      </span>
                    ) : null;
                  })()}
                  <span className="adp-agent-row__stats">
                    <span className="adp-confidence">
                      <span className={`adp-confidence__bar adp-confidence__bar--${w.stats!.avgConfidence >= 0.8 ? "high" : w.stats!.avgConfidence >= 0.6 ? "medium" : "low"}`}>
                        <span style={{ width: pct(w.stats!.avgConfidence) }} />
                      </span>
                      {pct(w.stats!.avgConfidence)}
                    </span>
                    <span className="adp-queue__dim">active {relativeTime(w.stats!.lastActivityAt)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Tile>
        )}
      </Column>
    </Grid>
  );
}
