import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Column,
  Grid,
  InlineNotification,
  SkeletonText,
  Tag,
  Tile,
} from "@carbon/react";
import { ArrowRight } from "@carbon/icons-react";
import {
  ArrowTrending20Regular,
  Book20Regular,
  Book24Regular,
  Bot20Regular,
  DocumentBulletList20Regular,
  Gauge24Regular,
  Person24Regular,
  Search24Regular,
  ShieldTask20Regular,
  Wrench20Regular,
} from "@fluentui/react-icons";
import { fetchDecisions, type DecisionsResponse, type PackageSummary } from "../services/decisionsClient";
import { fetchOutcomes, type AggregateOutcomes } from "../services/outcomesClient";
import { MS_ICONS, type MsIconKey } from "../assets/msIcons";
import heroIllustration from "../assets/ibm/ai-model-iso.jpg";
import { pct } from "../lib/format";

// The platform story: one decision platform, N use cases. Everything on this page is
// read from the API (packages + journal state); nothing is hardcoded to an industry.

const PIPELINE = [
  { step: "Declare", Icon: DocumentBulletList20Regular, text: "A use case arrives as an agent package: agents, skills, tools, gates, SLOs, declared in a typed DSL." },
  { step: "Compile", Icon: Wrench20Regular, text: "The platform validates, plans, and signs the package into executable agent definitions." },
  { step: "Decide", Icon: Bot20Regular, text: "Agents run on GPT-4o via Microsoft Agent Framework, grounded by Foundry IQ knowledge, the Fabric IQ Data Agent, and Work IQ context." },
  { step: "Gate", Icon: ShieldTask20Regular, text: "Confidence below threshold pauses the run for human judgment; the resolution is journaled with the trace." },
  { step: "Journal", Icon: Book20Regular, text: "Every step lands in an immutable decision journal: output, confidence, citations, origin, actor." },
  { step: "Learn", Icon: ArrowTrending20Regular, text: "Outcomes aggregate into the operations view; the journal is the audit trail and the improvement loop." },
];

// The experience registry: which client-branded portal fronts each industry.
const PORTALS: Record<string, { path: string; label: string }> = {
  insurance: { path: "/member", label: "Open the member experience" },
  banking: { path: "/bank", label: "Open the borrower experience" },
};

// The honest stack, dual-branded per the DT Offering convention: official Microsoft product
// marks with the Azure brand blue; IBM items carry Carbon. The console itself is that story:
// IBM Consulting engineering on the Microsoft agentic stack.
const STACK: { label: string; vendor: "microsoft" | "ibm"; icon?: MsIconKey }[] = [
  { label: "Azure Container Apps", vendor: "microsoft", icon: "containerApps" },
  { label: "Durable Functions", vendor: "microsoft", icon: "functions" },
  { label: "GPT-4o · Azure OpenAI", vendor: "microsoft", icon: "azureOpenAI" },
  { label: "Azure AI Foundry", vendor: "microsoft", icon: "aiFoundry" },
  { label: "Azure AI Search RAG", vendor: "microsoft", icon: "aiSearch" },
  { label: "Microsoft Fabric IQ", vendor: "microsoft", icon: "fabric" },
  { label: "Cosmos DB journal", vendor: "microsoft", icon: "cosmosDb" },
  { label: "Event Hubs", vendor: "microsoft", icon: "eventHubs" },
  { label: "Azure Static Web Apps", vendor: "microsoft", icon: "staticWebApps" },
  { label: "IBM Carbon Design System", vendor: "ibm" },
  { label: "IBM Consulting engineering", vendor: "ibm" },
];

interface UseCaseView {
  useCase: string;
  industry: string;
  workers: PackageSummary[];
  subjects: number;
  decided: number;
  avgConfidence: number;
}

export default function PlatformPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DecisionsResponse | null>(null);
  const [proof, setProof] = useState<AggregateOutcomes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDecisions()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    fetchOutcomes("30d")
      .then((o) => { if (!cancelled) setProof(o); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const useCases: UseCaseView[] = useMemo(() => {
    if (!data) return [];
    const byUseCase = new Map<string, UseCaseView>();
    for (const p of data.packages) {
      const existing = byUseCase.get(p.useCase);
      if (existing) {
        existing.workers.push(p);
      } else {
        byUseCase.set(p.useCase, {
          useCase: p.useCase,
          industry: p.industry,
          workers: [p],
          subjects: 0,
          decided: 0,
          avgConfidence: 0,
        });
      }
    }
    for (const uc of byUseCase.values()) {
      const decisions = data.decisions.filter((d) => d.useCase === uc.useCase);
      uc.subjects = decisions.length;
      const traced = decisions.filter((d) => d.latestTrace);
      uc.decided = traced.length;
      uc.avgConfidence = traced.length
        ? traced.reduce((a, d) => a + (d.latestTrace?.avgConfidence ?? 0), 0) / traced.length
        : 0;
    }
    return [...byUseCase.values()];
  }, [data]);

  return (
    <Grid fullWidth>
      <Column lg={16} md={8} sm={4}>
        <div className="adp-hero adp-hero--full">
          <img src={heroIllustration} alt="" aria-hidden="true" className="adp-hero__bg" />
          <div className="adp-hero__scrim" aria-hidden="true" />
          <div className="adp-hero__copy">
            <p className="adp-hero__kicker">Agentic Decision Platform</p>
            <h1 className="adp-hero__title">One decision platform. Any regulated decision.</h1>
            <p className="adp-hero__sub">
              ADP executes governed, grounded, explainable agentic decisions. The use case is a package the platform
              runs, not a product it becomes: the same console, agents, journal, and gates below are running claims
              for Meridian Mutual and loan origination for a bank, live.
            </p>
            <div className="adp-hero__ctas">
              <Button onClick={() => navigate("/decisions")}>Work the decision queue</Button>
              <Button kind="tertiary" onClick={() => window.dispatchEvent(new Event("adp:open-narrator"))}>
                Run the guided demo
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <InlineNotification kind="error" title="Platform data unavailable" subtitle={error} lowContrast className="adp-notification" />
        )}

        {proof && proof.tracesRecorded > 0 && (
          <div className="adp-proof">
            <div className="adp-proof__item">
              <span className="adp-stat__badge" aria-hidden="true"><Book24Regular /></span>
              <strong>{proof.tracesRecorded}</strong>
              <span>decision runs journaled, last 30 days</span>
            </div>
            <div className="adp-proof__item">
              <span className="adp-stat__badge" aria-hidden="true"><Search24Regular /></span>
              <strong>{pct(proof.groundedStepRate)}</strong>
              <span>of agent steps grounded in cited evidence</span>
            </div>
            <div className="adp-proof__item">
              <span className="adp-stat__badge" aria-hidden="true"><Gauge24Regular /></span>
              <strong>{pct(proof.avgConfidence)}</strong>
              <span>average calibrated confidence</span>
            </div>
            <div className="adp-proof__item">
              <span className="adp-stat__badge" aria-hidden="true"><Person24Regular /></span>
              <strong>{proof.stepsNeedingHumanReview}</strong>
              <span>decisions awaiting human judgment right now</span>
            </div>
            <p className="adp-proof__note">Live from the immutable decision journal, not a slide.</p>
          </div>
        )}

        <h3 className="adp-section-title">Use cases on this instance</h3>
        <Grid narrow>
          {!data && !error && (
            <Column lg={8} md={8} sm={4}>
              <Tile className="adp-usecase-card"><SkeletonText paragraph lineCount={4} /></Tile>
            </Column>
          )}
          {useCases.map((uc) => (
            <Column key={uc.useCase} lg={8} md={8} sm={4}>
              <Tile className={`adp-usecase-card adp-usecase-card--${uc.industry === "banking" ? "banking" : "insurance"}`}>
                <div className="adp-usecase-card__head">
                  <Tag type={uc.industry === "banking" ? "purple" : "blue"}>{uc.industry}</Tag>
                  <h4 className="adp-usecase-card__title">{uc.useCase}</h4>
                </div>
                <p className="adp-queue__dim">
                  {uc.workers.length} digital worker{uc.workers.length === 1 ? "" : "s"} ·{" "}
                  {uc.workers.reduce((a, w) => a + w.agentCount, 0)} agents · {uc.subjects} subjects
                  {uc.decided > 0 ? ` · ${uc.decided} decided at ${pct(uc.avgConfidence)} avg confidence` : " · not yet run"}
                </p>
                <div className="adp-usecase-card__workers">
                  {uc.workers.map((w) => (
                    <Tag key={w.packageId} type="outline" size="sm" title={`v${w.version} · ${w.agentCount} agents`}>
                      {w.workerName}
                    </Tag>
                  ))}
                </div>
                <div className="adp-usecase-card__actions">
                  <Button
                    kind="tertiary"
                    size="md"
                    renderIcon={ArrowRight}
                    onClick={() => navigate(`/decisions?useCase=${encodeURIComponent(uc.useCase)}`)}
                  >
                    Work this use case
                  </Button>
                  {PORTALS[uc.industry] && (
                    <Button kind="ghost" size="md" onClick={() => navigate(PORTALS[uc.industry].path)}>
                      {PORTALS[uc.industry].label}
                    </Button>
                  )}
                </div>
              </Tile>
            </Column>
          ))}
        </Grid>

        <h3 className="adp-section-title">How a decision happens</h3>
        <div className="adp-pipeline">
          {PIPELINE.map((p, i) => (
            <div key={p.step} className="adp-pipeline__step">
              <div className="adp-pipeline__num">{i + 1}</div>
              <div>
                <div className="adp-pipeline__name">
                  <p.Icon className="adp-pipeline__icon" /> {p.step}
                </div>
                <p className="adp-pipeline__text">{p.text}</p>
              </div>
            </div>
          ))}
        </div>

        <h3 className="adp-section-title">Running on</h3>
        <div className="adp-stack-row">
          {STACK.map((s) => (
            <span key={s.label} className={`adp-stack-chip adp-stack-chip--${s.vendor}`}>
              {s.icon && <img src={MS_ICONS[s.icon]} alt="" className="adp-stack-chip__icon" />}
              {s.label}
            </span>
          ))}
        </div>
      </Column>
    </Grid>
  );
}
