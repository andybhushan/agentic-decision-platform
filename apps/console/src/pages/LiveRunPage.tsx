import { useEffect, useState } from "react";
import {
  Button,
  Column,
  Dropdown,
  Grid,
  InlineLoading,
  InlineNotification,
  Tag,
  TextInput,
  Tile,
} from "@carbon/react";
import { resolveApiBase } from "../services/config";
import { fetchHealth, type HealthStatus } from "../services/healthClient";
import { fetchDecisions, type PackageSummary } from "../services/decisionsClient";
import { useDecisionRun } from "../hooks/useDecisionRun";
import { pct, secs } from "../lib/format";

// Lab: the engineer's diagnostic surface. Free-form subject/package/forced-gate inputs
// against the raw API, sitting on the same useDecisionRun driver as Decision Mode.

export default function LiveRunPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [subject, setSubject] = useState("CLM-2026-10005");
  const [packageId, setPackageId] = useState("fnol-handler");
  const [forceAgent, setForceAgent] = useState("");
  const [packages, setPackages] = useState<PackageSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchDecisions()
      .then((d) => { if (!cancelled) setPackages(d.packages); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const runState = useDecisionRun(subject.trim());
  const apiBase = resolveApiBase();
  const busy = runState.phase === "starting" || runState.phase === "streaming";

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((h) => { if (!cancelled) setHealth(h); })
      .catch((e) => { if (!cancelled) setHealthError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Grid fullWidth>
      <Column lg={16} md={8} sm={4}>
        <div className="adp-page-head">
          <div>
            <h2>Lab</h2>
            <p className="adp-page-head__sub">
              Raw platform access for testing: any subject, any bundled package, optional forced gate. Same run driver
              as Decision Mode.
            </p>
          </div>
        </div>

        <Tile>
          <div className="adp-run-controls">
            <TextInput
              id="lab-subject"
              labelText="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
              className="adp-input-md"
            />
            <Dropdown
              id="lab-package"
              titleText="Package"
              label="fnol-handler"
              items={packages.length > 0 ? packages.map((p) => p.packageId) : ["fnol-handler"]}
              itemToString={(id) => {
                const p = packages.find((x) => x.packageId === id);
                return p?.stage ? `${id} (${p.stage})` : (id ?? "");
              }}
              selectedItem={packageId}
              onChange={({ selectedItem }) => setPackageId(selectedItem ?? "fnol-handler")}
              disabled={busy}
              className="adp-input-md"
            />
            <TextInput
              id="lab-force"
              labelText="Force HITL at agent id (optional)"
              placeholder="agent.coverage-verify"
              value={forceAgent}
              onChange={(e) => setForceAgent(e.target.value)}
              disabled={busy}
              className="adp-input-md"
            />
            <Button
              onClick={() => runState.start(packageId.trim() || "fnol-handler", forceAgent.trim() || undefined)}
              disabled={busy || !subject.trim()}
            >
              {busy ? "Running" : "Start run"}
            </Button>
            {busy && (
              <InlineLoading
                description={runState.phase === "starting" ? "Starting orchestration" : `Streaming (${runState.runStatus?.status ?? "Running"})`}
              />
            )}
          </div>
          <p className="adp-endpoint adp-endpoint--spaced">
            API {apiBase} ·{" "}
            {healthError ? `offline (${healthError})` : health ? `${health.service} ${health.status}` : "checking"}
            {" · "}live tail: {runState.tailState}
            {runState.run ? ` · run ${runState.run.runId}` : ""}
          </p>
        </Tile>

        {runState.error && (
          <InlineNotification kind="error" title="Run problem" subtitle={runState.error} lowContrast className="adp-notification" />
        )}

        {runState.openGate && (
          <Tile className="adp-gate-panel adp-notification">
            <h4>Gate open: {runState.openGate.hitlGateId}</h4>
            <p className="adp-trace-step__output">
              {runState.openGate.agentId} at {pct(runState.openGate.confidence)}: {runState.openGate.outputSummary}
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
        )}

        {runState.liveSteps.length > 0 && (
          <>
            <h3 className="adp-section-title">Live steps</h3>
            {runState.liveSteps.map((s) => (
              <div className="adp-live-step" key={`${s.traceId}-${s.stepId}`}>
                <span className="adp-live-step__label">{s.label}</span>
                <span className="adp-live-step__agent">{s.agentId}</span>
                <Tag type={s.origin === "GROUNDED" ? "green" : "cool-gray"} size="sm">{s.origin}</Tag>
                <Tag type={s.status === "needs-human-review" ? "magenta" : "teal"} size="sm">{s.status}</Tag>
                <Tag type="outline" size="sm">{pct(s.confidence)}</Tag>
                <span className="adp-live-step__meta">
                  {s.toolCallCount ? `${s.toolCallCount} tool calls · ` : ""}
                  {secs(s.durationMs)}
                </span>
              </div>
            ))}
          </>
        )}

        {runState.trace && (
          <>
            <h3 className="adp-section-title">
              Trace <Tag type="green">live</Tag>
            </h3>
            <p className="adp-endpoint">
              {runState.trace.traceId} · {runState.trace.package.id} v{runState.trace.package.version} ·{" "}
              {runState.trace.package.agentCount} agents / {runState.trace.package.skillCount} skills /{" "}
              {runState.trace.package.toolCount} tools · started {runState.trace.startedAt}
            </p>
            {runState.trace.steps.map((step) => (
              <div className="adp-trace-step" key={step.stepId}>
                <div className="adp-trace-step__head">
                  <strong>{step.label}</strong>
                  <span className="adp-live-step__agent">{step.agentId}</span>
                  <Tag type={step.origin === "GROUNDED" ? "green" : "cool-gray"} size="sm">{step.origin}</Tag>
                  <Tag type="outline" size="sm">{pct(step.confidence)}</Tag>
                  {step.hitlGateId && <Tag type="magenta" size="sm">gate {step.hitlGateId}</Tag>}
                </div>
                <p className="adp-trace-step__output">{step.output}</p>
                {step.citedSources && step.citedSources.length > 0 && (
                  <div className="adp-citations">
                    {step.citedSources.map((c) => (
                      <Tag key={c.sourceId + c.docId} type="blue" size="sm">{c.docId}</Tag>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </Column>
    </Grid>
  );
}
