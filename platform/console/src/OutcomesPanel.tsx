import { useEffect, useState } from "react";
import { Card, Caption1, Body1, Body1Strong, Title3, tokens, makeStyles, Skeleton, SkeletonItem } from "@fluentui/react-components";

const TRACES_API = (import.meta.env.VITE_TRACES_API as string | undefined) ?? "https://func-adp-v1-fnol.azurewebsites.net/api";

interface OutcomesAggregate {
  windowHours: number;
  claimsHandled: number;
  tracesRecorded: number;
  stepsTotal: number;
  stepsCompleted: number;
  stepsNeedingHumanReview: number;
  groundedStepRate: number;
  avgConfidence: number;
  avgStepDurationMs: number;
  runsByPackage: Record<string, number>;
}

const useStyles = makeStyles({
  panel: {
    padding: "20px 24px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "12px",
  },
  metric: {
    padding: "12px 14px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: "6px",
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  metricValue: {
    fontSize: "26px",
    fontWeight: 600,
    lineHeight: 1.1,
    color: tokens.colorNeutralForeground1,
  },
  metricLabel: { color: tokens.colorNeutralForeground3, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" },
  packagesRow: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" },
  packageBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: "12px",
    fontWeight: 500,
  },
  meta: { color: tokens.colorNeutralForeground3, fontSize: "12px" },
});

export function OutcomesPanel(props: { windowHours?: number; compact?: boolean }) {
  const styles = useStyles();
  const [data, setData] = useState<OutcomesAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const window = props.windowHours ?? 24;

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const resp = await fetch(`${TRACES_API}/aggregate/outcomes?window=${window}h`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json: OutcomesAggregate = await resp.json();
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [window]);

  if (error) {
    return (
      <Card className={styles.panel}>
        <Title3>Live status (last {window}h)</Title3>
        <Body1>Could not load outcomes: {error}. Endpoint will be live after the next cloud deploy.</Body1>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className={styles.panel}>
        <Title3>Live status (last {window}h)</Title3>
        <Skeleton><SkeletonItem size={48} /><SkeletonItem size={48} /></Skeleton>
      </Card>
    );
  }

  // Defensive: backend might return PascalCase or camelCase; accept either.
  // Also default to 0 if a field is missing so the panel renders even on partial responses.
  const d: Record<string, unknown> = data as unknown as Record<string, unknown>;
  const num = (camel: string, pascal: string): number => {
    const v = d[camel] ?? d[pascal];
    return typeof v === "number" ? v : 0;
  };
  const dict = (camel: string, pascal: string): Record<string, number> => {
    const v = d[camel] ?? d[pascal];
    return (v && typeof v === "object") ? (v as Record<string, number>) : {};
  };

  const claimsHandled = num("claimsHandled", "ClaimsHandled");
  const tracesRecorded = num("tracesRecorded", "TracesRecorded");
  const stepsTotal = num("stepsTotal", "StepsTotal");
  const stepsNeedingHumanReview = num("stepsNeedingHumanReview", "StepsNeedingHumanReview");
  const groundedStepRate = num("groundedStepRate", "GroundedStepRate");
  const avgConfidence = num("avgConfidence", "AvgConfidence");
  const avgStepDurationMs = num("avgStepDurationMs", "AvgStepDurationMs");
  const windowHoursActual = num("windowHours", "WindowHours") || window;
  const runsByPackage = dict("runsByPackage", "RunsByPackage");

  const metrics = [
    { label: "Claims handled", value: claimsHandled.toString() },
    { label: "Decision traces", value: tracesRecorded.toString() },
    { label: "Agent steps", value: stepsTotal.toString() },
    { label: "Grounded rate", value: `${Math.round(groundedStepRate * 100)}%` },
    { label: "Avg confidence", value: avgConfidence.toFixed(2) },
    { label: "HITL paused", value: stepsNeedingHumanReview.toString() },
    { label: "Avg step ms", value: Math.round(avgStepDurationMs).toString() },
  ];

  return (
    <Card className={styles.panel}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Title3>Live operational status</Title3>
        <Caption1 className={styles.meta}>last {Math.round(windowHoursActual)}h • auto-refresh 30s</Caption1>
      </div>
      <div className={styles.grid}>
        {metrics.map((m) => (
          <div key={m.label} className={styles.metric}>
            <span className={styles.metricValue}>{m.value}</span>
            <span className={styles.metricLabel}>{m.label}</span>
          </div>
        ))}
      </div>
      {!props.compact && Object.keys(runsByPackage).length > 0 && (
        <div>
          <Body1Strong>Runs by package</Body1Strong>
          <div className={styles.packagesRow}>
            {Object.entries(runsByPackage).map(([pkg, count]) => (
              <span key={pkg} className={styles.packageBadge}>{pkg} · {count}</span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
