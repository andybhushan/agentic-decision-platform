import { useEffect, useState } from "react";
import { Column, Grid, InlineNotification, SkeletonText, Tag, Tile } from "@carbon/react";
import { Bot } from "@carbon/icons-react";
import { fetchAgents, RUNTIME_LABELS, type AgentsResponse } from "../services/agentsClient";
import { pct, relativeTime } from "../lib/format";
import { ontologyLabel } from "../lib/evidence";

// The governance view: every digital worker and agent on the platform, from the signed
// packages (identity, model, guardrails, SLOs) joined with what the immutable journal has
// actually observed. The Agent-365-shaped control surface.

export default function AgentsPage() {
  const [data, setData] = useState<AgentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAgents("30d")
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Grid fullWidth>
      <Column lg={16} md={8} sm={4}>
        <div className="adp-page-head">
          <div>
            <h2>Agents</h2>
            <p className="adp-page-head__sub">
              Every digital worker and agent on this platform: declared identity and guardrails from the signed
              package, observed behavior from the immutable journal (last {data ? Math.round(data.windowHours / 24) : 30} days).
            </p>
          </div>
          {data && (
            <span className="adp-stack-chip" title={`AGENT_BACKEND=${data.runtime}`}>
              Runtime: {RUNTIME_LABELS[data.runtime] ?? data.runtime}
            </span>
          )}
        </div>

        {error && (
          <InlineNotification kind="error" title="Registry unavailable" subtitle={error} lowContrast className="adp-notification" />
        )}
        {!data && !error && <SkeletonText paragraph lineCount={6} />}

        {data?.workers.map((w) => (
          <Tile key={w.packageId} className="adp-worker-card">
            <div className="adp-worker-card__head">
              <Bot size={20} />
              <h3 className="adp-worker-card__name">{w.workerName}</h3>
              <Tag type="outline" size="sm">{w.packageId} v{w.version}</Tag>
              {w.stage && <Tag type="teal" size="sm">{w.stage}</Tag>}
              <Tag type={w.industry === "banking" ? "purple" : "blue"} size="sm">{w.useCase}</Tag>
              {w.entraAgentId ? (
                <Tag type="green" size="sm" title={w.entraAgentId}>Entra Agent ID</Tag>
              ) : (
                <Tag type="cool-gray" size="sm" title="Declared in the package; registration pending">identity pending</Tag>
              )}
            </div>

            {w.stats ? (
              <div className="adp-worker-card__stats">
                <span><strong>{w.stats.runs}</strong> runs</span>
                <span><strong>{w.stats.steps}</strong> steps</span>
                <span><strong>{pct(w.stats.avgConfidence)}</strong> avg confidence</span>
                <span><strong>{w.stats.gatesFired}</strong> gates fired</span>
                <span><strong>{w.stats.operatorActions}</strong> operator judgments</span>
                <span className="adp-queue__dim">active {relativeTime(w.stats.lastActivityAt)}</span>
              </div>
            ) : (
              <p className="adp-queue__dim adp-worker-card__stats">No journaled activity in this window.</p>
            )}

            <div className="adp-agent-rows">
              {w.agents.map((a) => (
                <div key={a.agentId} className="adp-agent-row">
                  <span className="adp-agent-row__id">{a.agentId}</span>
                  <span className="adp-queue__dim adp-agent-row__cap">{a.capability}</span>
                  <Tag type="outline" size="sm">{a.model}</Tag>
                  <span className="adp-queue__dim">{a.skillCount} skills</span>
                  {a.lowThreshold != null && (
                    <Tag type="magenta" size="sm" title={`Human gate fires below ${pct(a.lowThreshold)} confidence`}>
                      gate &lt; {pct(a.lowThreshold)}
                    </Tag>
                  )}
                  {a.ontologyBindings && a.ontologyBindings.length > 0 && (
                    <span
                      className="adp-queue__dim adp-agent-row__ont"
                      title={a.ontologyBindings.join(", ")}
                    >
                      {a.ontologyBindings.slice(0, 3).map(ontologyLabel).join(", ")}
                      {a.ontologyBindings.length > 3 ? ` +${a.ontologyBindings.length - 3}` : ""}
                    </span>
                  )}
                  <span className="adp-agent-row__stats">
                    {a.stats ? (
                      <>
                        <span className="adp-confidence">
                          <span className={`adp-confidence__bar adp-confidence__bar--${a.stats.avgConfidence >= 0.8 ? "high" : a.stats.avgConfidence >= 0.6 ? "medium" : "low"}`}>
                            <span style={{ width: pct(a.stats.avgConfidence) }} />
                          </span>
                          {pct(a.stats.avgConfidence)}
                        </span>
                        <span className="adp-queue__dim">
                          {a.stats.steps} steps{a.stats.gatesFired > 0 ? ` · ${a.stats.gatesFired} gates` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="adp-queue__dim">not yet observed</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {w.slos.length > 0 && (
              <p className="adp-queue__dim adp-worker-card__slos">
                Declared SLOs: {w.slos.map((s) => `${s.metric} ${s.target} over ${s.window}`).join(" · ")}
              </p>
            )}
          </Tile>
        ))}
      </Column>
    </Grid>
  );
}
