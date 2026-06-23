// Theme-aware inline-SVG architecture diagrams for the ADP docs portal.
// Each diagram is a React component that reads the active theme mode and adapts colors.
import type { ReactElement } from "react";
import { useThemeMode } from "../ThemeContext";
import {
  FunctionsIcon, CosmosIcon, SignalRIcon, AISearchIcon, FabricIcon, FoundryIcon,
  OpenAIIcon, EventHubsIcon, EventGridIcon, SwaIcon, ContainerAppsIcon,
  KeyVaultIcon, EntraIcon, SqlIcon, StorageIcon, LogAnalyticsIcon,
  BicepIcon, ReactIcon, DotnetIcon, DurableIcon, GraphIcon,
} from "./icons";

function palette(mode: "light" | "dark") {
  if (mode === "light") {
    return {
      bg: "#FAFBFC",
      card: "#FFFFFF",
      cardAccent: "#F2F6FC",
      stroke: "#D8DEE8",
      strokeStrong: "#9FAFC4",
      text: "#1A2233",
      textMuted: "#5A6B83",
      brand: "#0078D4",
      brandDark: "#005A9E",
      purple: "#5C2D91",
      green: "#107C10",
      amber: "#B47600",
      red: "#A4262C",
      fabricGreen: "#22a06b",
      foundryViolet: "#7B5FC7",
      workTeal: "#1E8E8C",
      separator: "#E1E6EE",
    };
  }
  return {
    bg: "#0b1220",
    card: "#10182a",
    cardAccent: "#1d2a44",
    stroke: "#2a3a5c",
    strokeStrong: "#3d5380",
    text: "#e6edf7",
    textMuted: "#9aa6bd",
    brand: "#2b88d8",
    brandDark: "#0078D4",
    purple: "#7b5fc7",
    green: "#3fb950",
    amber: "#d4a64a",
    red: "#e35d6a",
    fabricGreen: "#22a06b",
    foundryViolet: "#9d6cd6",
    workTeal: "#3aa3ab",
    separator: "#1c2640",
  };
}

const FF = "'Segoe UI', system-ui, sans-serif";

// =============== 1. System Overview ===============
export function SystemOverviewDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  return (
    <svg viewBox="0 0 1180 460" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1180" height="460" fill={C.bg} />
      <defs>
        <marker id="so-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.strokeStrong} />
        </marker>
        <marker id="so-arr-brand" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.brand} />
        </marker>
        <marker id="so-arr-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.amber} />
        </marker>
      </defs>
      <text x={40} y={32} fontSize="13" fontWeight="700" fill={C.textMuted} letterSpacing="2">BUILD-TIME · COMPILE</text>
      {[
        { x: 30, y: 56, label: "Agent Package", sub: "declarative JSON · DSL", det: "agents · skills · tools · context bindings · HITL gates · invariants" },
        { x: 230, y: 56, label: "Compile Pipeline", sub: "adpc compile · 4 stages", det: "schema · semantic · plan · sign · ~400ms" },
        { x: 430, y: 56, label: "Signed Bundle", sub: "package.zip", det: "manifest + provenance + plan + JSON" },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={180} height={86} rx={6} fill={C.card} stroke={C.amber} />
          <text x={b.x + 90} y={b.y + 26} textAnchor="middle" fontSize="14" fontWeight="600" fill={C.text}>{b.label}</text>
          <text x={b.x + 90} y={b.y + 46} textAnchor="middle" fontSize="11" fill={C.textMuted}>{b.sub}</text>
          <foreignObject x={b.x + 6} y={b.y + 54} width={168} height={28}>
            <div style={{ fontSize: "10px", color: C.textMuted, textAlign: "center", lineHeight: 1.4 }}>{b.det}</div>
          </foreignObject>
        </g>
      ))}
      {[210, 410].map((x) => (
        <line key={x} x1={x} y1={99} x2={x + 20} y2={99} stroke={C.amber} strokeWidth={1.5} markerEnd="url(#so-arr-amber)" />
      ))}

      {/* dividing line */}
      <line x1={30} y1={170} x2={1150} y2={170} stroke={C.separator} strokeDasharray="4 4" />
      <text x={40} y={200} fontSize="13" fontWeight="700" fill={C.textMuted} letterSpacing="2">RUN-TIME · EXECUTE</text>

      {/* Operator */}
      <g>
        <rect x={30} y={220} width={160} height={92} rx={8} fill={C.card} stroke={C.brand} />
        <foreignObject x={42} y={232} width={36} height={36}>
          <SwaIcon size={32} />
        </foreignObject>
        <text x={86} y={244} fontSize="13" fontWeight="700" fill={C.text}>Operator Console</text>
        <text x={86} y={260} fontSize="11" fill={C.textMuted}>SWA Free · React 19</text>
        <text x={42} y={284} fontSize="10" fill={C.textMuted}>Run / Approve / Live tail</text>
        <text x={42} y={300} fontSize="10" fill={C.textMuted}>HITL Approve · Escalate</text>
      </g>

      {/* Runtime — large central box */}
      <rect x={230} y={210} width={620} height={220} rx={10} fill={C.cardAccent} stroke={C.brand} strokeWidth={2.5} />
      <text x={540} y={236} textAnchor="middle" fontSize="14" fontWeight="700" fill={C.brand} letterSpacing="2">ADP PLATFORM RUNTIME</text>
      <text x={540} y={252} textAnchor="middle" fontSize="11" fill={C.textMuted}>Azure Functions Flex Consumption · .NET 10 isolated</text>
      {[
        { x: 246, y: 270, w: 140, h: 60, icon: <FunctionsIcon size={24} />, t: "RunFnol HTTP", s: "POST /api/runs" },
        { x: 396, y: 270, w: 140, h: 60, icon: <DurableIcon size={24} />, t: "FnolOrchestrator", s: "Durable Functions" },
        { x: 546, y: 270, w: 140, h: 60, icon: <FoundryIcon size={24} />, t: "Step Runner", s: "Agent + L5 + Tools" },
        { x: 696, y: 270, w: 140, h: 60, icon: <DurableIcon size={24} />, t: "HITL Gate", s: "WaitForExternalEvent" },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={C.card} stroke={C.stroke} />
          <foreignObject x={b.x + 6} y={b.y + 6} width={24} height={24}>{b.icon}</foreignObject>
          <text x={b.x + 36} y={b.y + 22} fontSize="12" fontWeight="600" fill={C.text}>{b.t}</text>
          <text x={b.x + 36} y={b.y + 38} fontSize="10" fill={C.textMuted}>{b.s}</text>
        </g>
      ))}
      <text x={246} y={362} fontSize="11" fontWeight="600" fill={C.textMuted} letterSpacing="1">L5 CONTEXT FEDERATION (parallel)</text>
      {[
        { x: 246, y: 372, icon: <FoundryIcon size={20} />, label: "Foundry IQ" },
        { x: 388, y: 372, icon: <FabricIcon size={20} />, label: "Fabric IQ" },
        { x: 520, y: 372, icon: <GraphIcon size={20} />, label: "Work IQ" },
        { x: 652, y: 372, icon: <OpenAIIcon size={20} />, label: "Azure OpenAI" },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={s.y} width={130} height={36} rx={4} fill={C.card} stroke={C.stroke} />
          <foreignObject x={s.x + 6} y={s.y + 8} width={20} height={20}>{s.icon}</foreignObject>
          <text x={s.x + 32} y={s.y + 22} fontSize="11" fontWeight="500" fill={C.text}>{s.label}</text>
        </g>
      ))}
      <text x={246} y={420} fontSize="10" fill={C.textMuted} fontStyle="italic">Output → Decision Sink → Cosmos · Event Hubs · SignalR</text>

      {/* Persistence (right side) */}
      <g>
        <rect x={880} y={210} width={270} height={104} rx={8} fill={C.card} stroke={C.workTeal} />
        <text x={1015} y={232} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.workTeal} letterSpacing="1">DECISION JOURNAL</text>
        {[
          { x: 890, y: 250, icon: <CosmosIcon size={20} />, t: "Cosmos · dw-state" },
          { x: 890, y: 278, icon: <EventHubsIcon size={20} />, t: "Event Hubs · Kafka" },
        ].map((d, i) => (
          <g key={i}>
            <foreignObject x={d.x} y={d.y} width={20} height={20}>{d.icon}</foreignObject>
            <text x={d.x + 28} y={d.y + 14} fontSize="11" fill={C.text}>{d.t}</text>
          </g>
        ))}

        <rect x={880} y={326} width={270} height={104} rx={8} fill={C.card} stroke={C.brand} />
        <text x={1015} y={348} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.brand} letterSpacing="1">LIVE OBSERVABILITY</text>
        {[
          { x: 890, y: 366, icon: <SignalRIcon size={20} />, t: "SignalR · fnoltrace" },
          { x: 890, y: 394, icon: <LogAnalyticsIcon size={20} />, t: "App Insights · traces" },
        ].map((d, i) => (
          <g key={i}>
            <foreignObject x={d.x} y={d.y} width={20} height={20}>{d.icon}</foreignObject>
            <text x={d.x + 28} y={d.y + 14} fontSize="11" fill={C.text}>{d.t}</text>
          </g>
        ))}
      </g>

      {/* Arrows */}
      <line x1={190} y1={266} x2={230} y2={266} stroke={C.brand} strokeWidth={1.8} markerEnd="url(#so-arr-brand)" />
      <line x1={850} y1={266} x2={880} y2={266} stroke={C.brand} strokeWidth={1.8} markerEnd="url(#so-arr-brand)" />
      <line x1={850} y1={376} x2={880} y2={376} stroke={C.brand} strokeWidth={1.8} markerEnd="url(#so-arr-brand)" />
      <path d="M 880 380 C 600 460 350 460 190 300" fill="none" stroke={C.amber} strokeDasharray="6 4" strokeWidth={1.5} markerEnd="url(#so-arr-amber)" />
      <text x={500} y={452} textAnchor="middle" fontSize="10" fill={C.amber} fontStyle="italic">SignalR live tail back to operator (live HITL surface)</text>

      {/* Build to run bridge */}
      <line x1={520} y1={150} x2={540} y2={210} stroke={C.amber} strokeDasharray="4 4" strokeWidth={1.5} markerEnd="url(#so-arr-amber)" />
      <text x={550} y={185} fontSize="10" fill={C.amber} fontStyle="italic">bundle copies into Resources/</text>
    </svg>
  );
}

// =============== 2. Ten platform layers ===============
const LAYERS = [
  { n: "L1", name: "Identity & Governance", icon: "entra", detail: "Per-workload + per-agent identity, audit propagation, future Defender / Sentinel hooks", services: "Entra ID · Entra Agent ID · Defender for AI ⏸ · Purview ⏸ · Sentinel ⏸" },
  { n: "L2", name: "Experience", icon: "swa", detail: "Operator surface — live tail, HITL approve / escalate, docs portal SPA", services: "Operator Console · Docs Portal · SignalR live tail · SWA Free" },
  { n: "L3", name: "Agent Runtime", icon: "foundry", detail: "LLM adapter abstraction, function-calling loop, per-agent identity propagation", services: "FoundryAdapter · LegacyOpenAIAdapter · MCP tools · A2A ⏸" },
  { n: "L4", name: "Orchestration", icon: "durable", detail: "Per-step execution, HITL pause/resume, multi-agent cascade, retry policies", services: "Durable Functions · FnolOrchestrator · 3 activities" },
  { n: "L5", name: "Context (L5 Trio)", icon: "foundry", detail: "Federated knowledge / data / collaboration access via named primitives", services: "Foundry IQ · Fabric IQ · Work IQ · AI Search vector backbone" },
  { n: "L6", name: "State & Events", icon: "cosmos", detail: "Persistent state, event bus, live push surface", services: "Cosmos DB dw-state · Event Hubs Kafka · SignalR · Event Grid" },
  { n: "L7", name: "Data Substrate", icon: "fabric", detail: "Domain entities, procedural docs, AI model endpoint", services: "Fabric Lakehouse adp (5 Delta tables) · Azure SQL fallback · Azure OpenAI gpt-4o" },
  { n: "L8", name: "Compute & Hosting", icon: "functions", detail: "Run-time hosts for workloads", services: "Azure Functions FC1 · Container Apps env · SWA Free" },
  { n: "L9", name: "IaC & Automation", icon: "bicep", detail: "Provision + reproduce in a clean tenant", services: "13 Bicep modules · PowerShell scripts · az CLI" },
  { n: "L10", name: "Observability", icon: "logs", detail: "What happened, when, why", services: "App Insights · Log Analytics · Decision Journal · Live tail" },
] as const;

const LAYER_ICON_MAP: Record<string, ReactElement> = {
  entra: <EntraIcon size={24} />,
  swa: <SwaIcon size={24} />,
  foundry: <FoundryIcon size={24} />,
  durable: <DurableIcon size={24} />,
  cosmos: <CosmosIcon size={24} />,
  fabric: <FabricIcon size={24} />,
  functions: <FunctionsIcon size={24} />,
  bicep: <BicepIcon size={24} />,
  logs: <LogAnalyticsIcon size={24} />,
};

export function TenLayersDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  const h = 60;
  const gap = 8;
  const totalH = LAYERS.length * (h + gap) + 40;
  return (
    <svg viewBox={`0 0 1080 ${totalH}`} xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1080" height={totalH} fill={C.bg} />
      {LAYERS.map((l, i) => {
        const y = 20 + i * (h + gap);
        return (
          <g key={l.n}>
            <rect x={20} y={y} width={1040} height={h} rx={6} fill={C.card} stroke={C.stroke} />
            <rect x={20} y={y} width={6} height={h} fill={C.brand} rx={3} />
            <foreignObject x={40} y={y + (h - 24) / 2} width={24} height={24}>
              {LAYER_ICON_MAP[l.icon]}
            </foreignObject>
            <text x={78} y={y + 22} fontSize="13" fontWeight="700" fill={C.brand} letterSpacing="1">{l.n}</text>
            <text x={78} y={y + 42} fontSize="13" fontWeight="600" fill={C.text}>{l.name}</text>
            <text x={250} y={y + 22} fontSize="12" fill={C.textMuted}>{l.detail}</text>
            <text x={250} y={y + 42} fontSize="11" fill={C.textMuted} fontStyle="italic">{l.services}</text>
          </g>
        );
      })}
    </svg>
  );
}

// =============== 3. L5 Federation ===============
export function L5FederationDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  return (
    <svg viewBox="0 0 1180 500" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1180" height="500" fill={C.bg} />
      <defs>
        <marker id="l5-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.strokeStrong} />
        </marker>
        <marker id="l5-arr-violet" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.foundryViolet} />
        </marker>
        <marker id="l5-arr-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.fabricGreen} />
        </marker>
        <marker id="l5-arr-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.workTeal} />
        </marker>
      </defs>

      {/* Agent step header */}
      <rect x={460} y={20} width={260} height={68} rx={8} fill={C.cardAccent} stroke={C.brand} strokeWidth={2} />
      <foreignObject x={476} y={34} width={32} height={32}><DotnetIcon size={32} /></foreignObject>
      <text x={520} y={46} fontSize="14" fontWeight="700" fill={C.brand}>Agent Step</text>
      <text x={520} y={64} fontSize="11" fill={C.textMuted}>StepRunner.RunStepAsync</text>
      <text x={520} y={80} fontSize="10" fill={C.textMuted}>request: intent + dimensions + subject</text>

      {/* ContextRouter */}
      <rect x={420} y={130} width={340} height={84} rx={8} fill={C.card} stroke={C.brand} strokeWidth={2} />
      <text x={590} y={156} textAnchor="middle" fontSize="15" fontWeight="700" fill={C.text}>ContextRouter</text>
      <text x={590} y={178} textAnchor="middle" fontSize="11" fill={C.textMuted}>fan-out to all 3 sources in parallel · merge by docId</text>
      <text x={590} y={196} textAnchor="middle" fontSize="11" fill={C.textMuted}>dedupe · score · tag GROUNDED / DERIVED</text>

      {/* Three sources */}
      {[
        {
          x: 30, color: C.foundryViolet, label: "Foundry IQ", icon: <AISearchIcon size={28} />, resource: "srch-adp-v1",
          backing: "Azure AI Search · vector + hybrid", embed: "text-embedding-3-large · 3072-d",
          primitives: ["semantic search over knowledge docs"], industries: "industry-filtered (insurance · banking)",
        },
        {
          x: 410, color: C.fabricGreen, label: "Fabric IQ", icon: <FabricIcon size={28} />, resource: "workspace adp-v1 · Lakehouse adp",
          backing: "Microsoft Fabric Lakehouse · SQL endpoint", embed: "Microsoft.Data.SqlClient + AAD",
          primitives: ["policyholder-history", "similar-claims", "vehicle-history", "entity-history (schema-aware)", "severity-distribution-by-state", "hour-of-day-concentration", "state-loss-ratio", "incident-type-mix-by-state"], industries: "Meridian (3 tables) · Banking (2 tables)",
        },
        {
          x: 790, color: C.workTeal, label: "Work IQ", icon: <GraphIcon size={28} />, resource: "WorkIqSource · MicrosoftGraphWorkIqSource",
          backing: "synthetic (cloud) + delegated Graph (local)", embed: "Mail.Read · Files.Read.All · Calendars.Read",
          primitives: ["triage-supervisor-thread", "adjuster-availability", "damage-photo-thread", "shop-collab-history", "siu-consult-channel", "policyholder-contact-channel", "payment-ops-signal"], industries: "WORKIQ_BACKEND env var routes",
        },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={250} width={360} height={230} rx={8} fill={C.card} stroke={s.color} strokeWidth={2} />
          <rect x={s.x} y={250} width={8} height={230} fill={s.color} rx={3} />
          <foreignObject x={s.x + 20} y={266} width={32} height={32}>{s.icon}</foreignObject>
          <text x={s.x + 60} y={284} fontSize="16" fontWeight="700" fill={s.color}>{s.label}</text>
          <text x={s.x + 20} y={314} fontSize="11" fontWeight="600" fill={C.text}>{s.backing}</text>
          <text x={s.x + 20} y={332} fontSize="11" fill={C.textMuted} fontStyle="italic">{s.embed}</text>
          <text x={s.x + 20} y={356} fontSize="10" fontWeight="700" fill={C.textMuted} letterSpacing="1">PRIMITIVES</text>
          <foreignObject x={s.x + 20} y={360} width={320} height={86}>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: C.textMuted, lineHeight: 1.5 }}>
              {s.primitives.slice(0, 5).map((p) => <li key={p}><code style={{ fontFamily: "Consolas, monospace" }}>{p}</code></li>)}
              {s.primitives.length > 5 && <li style={{ fontStyle: "italic" }}>+{s.primitives.length - 5} more</li>}
            </ul>
          </foreignObject>
          <text x={s.x + 20} y={468} fontSize="10" fill={C.textMuted} fontStyle="italic">{s.industries}</text>
        </g>
      ))}

      <line x1={590} y1={88} x2={590} y2={130} stroke={C.brand} strokeWidth={1.8} markerEnd="url(#l5-arr)" />
      <line x1={500} y1={214} x2={210} y2={250} stroke={C.foundryViolet} strokeWidth={1.8} markerEnd="url(#l5-arr-violet)" />
      <line x1={590} y1={214} x2={590} y2={250} stroke={C.fabricGreen} strokeWidth={1.8} markerEnd="url(#l5-arr-green)" />
      <line x1={680} y1={214} x2={970} y2={250} stroke={C.workTeal} strokeWidth={1.8} markerEnd="url(#l5-arr-teal)" />
    </svg>
  );
}

// =============== 4. Runtime Sequence ===============
export function RuntimeSequenceDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  const lanes = [
    { x: 90, label: "Operator", icon: <SwaIcon size={24} />, color: C.brand },
    { x: 240, label: "SWA Console", icon: <ReactIcon size={24} />, color: C.brand },
    { x: 380, label: "Function App", icon: <FunctionsIcon size={24} />, color: C.brand },
    { x: 520, label: "Durable", icon: <DurableIcon size={24} />, color: C.purple },
    { x: 680, label: "Activity", icon: <DotnetIcon size={24} />, color: C.brand },
    { x: 820, label: "L5 + LLM", icon: <FoundryIcon size={24} />, color: C.foundryViolet },
    { x: 970, label: "Persistence", icon: <CosmosIcon size={24} />, color: C.fabricGreen },
  ];
  const msgs = [
    { from: 0, to: 1, y: 130, label: "click Run · pick subject", color: C.text },
    { from: 1, to: 2, y: 160, label: "POST /api/runs { subjectId }", color: C.text },
    { from: 2, to: 3, y: 190, label: "Schedule FnolOrchestrator", color: C.brand },
    { from: 3, to: 4, y: 220, label: "PrepareRunActivity (load package zip)", color: C.brand },
    { from: 3, to: 4, y: 250, label: "loop: RunStepActivity per agent", color: C.brand },
    { from: 4, to: 5, y: 280, label: "ContextRouter (3 sources in parallel)", color: C.foundryViolet },
    { from: 5, to: 4, y: 310, label: "merged fragments + citations", color: C.foundryViolet },
    { from: 4, to: 5, y: 340, label: "Adapter.InvokeAsync · gpt-4o + tools", color: C.foundryViolet },
    { from: 5, to: 4, y: 370, label: "AgentResult { output, confidence }", color: C.foundryViolet },
    { from: 4, to: 6, y: 400, label: "CompositeDecisionSink (Cosmos + SignalR + EH)", color: C.fabricGreen },
    { from: 6, to: 1, y: 430, label: "SignalR live-tail step push", color: C.fabricGreen },
    { from: 3, to: 0, y: 460, label: "if HITL: pause; operator clicks Approve", color: C.amber },
    { from: 0, to: 2, y: 490, label: "POST /resolve-hitl → RaiseEvent", color: C.amber },
    { from: 3, to: 1, y: 520, label: "RunResult; GET /api/traces (reconcile)", color: C.text },
  ];
  const totalH = 560;
  return (
    <svg viewBox={`0 0 1080 ${totalH}`} xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1080" height={totalH} fill={C.bg} />
      <defs>
        {[
          { id: "rs-arr", color: C.text },
          { id: "rs-arr-brand", color: C.brand },
          { id: "rs-arr-amber", color: C.amber },
          { id: "rs-arr-violet", color: C.foundryViolet },
          { id: "rs-arr-green", color: C.fabricGreen },
        ].map((m) => (
          <marker key={m.id} id={m.id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={m.color} />
          </marker>
        ))}
      </defs>
      {lanes.map((l) => (
        <g key={l.label}>
          <rect x={l.x - 65} y={28} width={130} height={70} rx={6} fill={C.card} stroke={l.color} />
          <foreignObject x={l.x - 12} y={36} width={24} height={24}>{l.icon}</foreignObject>
          <text x={l.x} y={82} textAnchor="middle" fontSize="11" fontWeight="600" fill={l.color}>{l.label}</text>
          <line x1={l.x} y1={102} x2={l.x} y2={totalH - 16} stroke={C.separator} strokeDasharray="4 4" />
        </g>
      ))}
      {msgs.map((m, i) => {
        const x1 = lanes[m.from].x;
        const x2 = lanes[m.to].x;
        const markerId = m.color === C.amber ? "rs-arr-amber" : m.color === C.foundryViolet ? "rs-arr-violet" : m.color === C.fabricGreen ? "rs-arr-green" : m.color === C.brand ? "rs-arr-brand" : "rs-arr";
        return (
          <g key={i}>
            <line x1={x1} y1={m.y} x2={x2} y2={m.y} stroke={m.color} strokeWidth={1.4} markerEnd={`url(#${markerId})`} />
            <text x={Math.min(x1, x2) + Math.abs(x2 - x1) / 2} y={m.y - 5} fontSize="10" textAnchor="middle" fill={m.color}>{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// =============== 5. Deployment Topology ===============
export function DeploymentTopologyDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  const groups = [
    {
      title: "Compute & Hosting", color: C.brand,
      x: 50, y: 90, w: 320, h: 220,
      items: [
        { icon: <FunctionsIcon size={20} />, n: "func-adp-v1-fnol", s: "Flex Consumption · .NET 10" },
        { icon: <SwaIcon size={20} />, n: "swa-adp-v1-console", s: "SWA Free · operator + docs" },
        { icon: <ContainerAppsIcon size={20} />, n: "cae-adp-v1", s: "Container Apps env · idle" },
      ],
    },
    {
      title: "AI & Knowledge", color: C.foundryViolet,
      x: 390, y: 90, w: 320, h: 220,
      items: [
        { icon: <FoundryIcon size={20} />, n: "ai-adp-v1", s: "Foundry account + project" },
        { icon: <OpenAIIcon size={20} />, n: "dt-navigator-openai", s: "Foundry-connected AOAI · gpt-4o" },
        { icon: <AISearchIcon size={20} />, n: "srch-adp-v1", s: "AI Search · 21 docs · eastus" },
      ],
    },
    {
      title: "Data Substrate", color: C.fabricGreen,
      x: 730, y: 90, w: 320, h: 220,
      items: [
        { icon: <FabricIcon size={20} />, n: "Fabric workspace adp-v1", s: "Lakehouse adp · 5 Delta tables" },
        { icon: <SqlIcon size={20} />, n: "sql-adp-v1", s: "Azure SQL Basic · fallback" },
        { icon: <StorageIcon size={20} />, n: "stadpv1", s: "Function deployment + WebJobs" },
      ],
    },
    {
      title: "State & Events", color: C.workTeal,
      x: 50, y: 330, w: 320, h: 220,
      items: [
        { icon: <CosmosIcon size={20} />, n: "cdb-adp-v1", s: "Serverless · dw-state container" },
        { icon: <EventHubsIcon size={20} />, n: "evh-adp-v1", s: "Kafka API · adp-v1-decisions" },
        { icon: <SignalRIcon size={20} />, n: "signalr-adp-v1", s: "Free_F1 · hub fnoltrace" },
        { icon: <EventGridIcon size={20} />, n: "egt-adp-v1-fanout", s: "Topic · idle (v1.5)" },
      ],
    },
    {
      title: "Identity & Secrets", color: C.amber,
      x: 390, y: 330, w: 320, h: 220,
      items: [
        { icon: <EntraIcon size={20} />, n: "6 user-assigned MIs", s: "orchestrator · ingest · router · 3 MCP" },
        { icon: <KeyVaultIcon size={20} />, n: "kv-adp-v1", s: "Key Vault · reserved (idle)" },
      ],
    },
    {
      title: "Observability", color: C.brand,
      x: 730, y: 330, w: 320, h: 220,
      items: [
        { icon: <LogAnalyticsIcon size={20} />, n: "log-adp-v1", s: "Log Analytics workspace" },
        { icon: <LogAnalyticsIcon size={20} />, n: "appi-adp-v1", s: "Application Insights · traces" },
      ],
    },
  ];
  return (
    <svg viewBox="0 0 1100 600" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1100" height="600" fill={C.bg} />
      <rect x={20} y={30} width={1060} height={550} rx={10} fill="none" stroke={C.stroke} strokeDasharray="8 4" />
      <text x={50} y={56} fontSize="13" fontWeight="600" fill={C.textMuted} letterSpacing="2">RESOURCE GROUP · rg-adp-v1 · eastus2</text>
      {groups.map((g, i) => (
        <g key={i}>
          <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={8} fill={C.card} stroke={g.color} strokeWidth={2} />
          <rect x={g.x} y={g.y} width={6} height={g.h} fill={g.color} rx={3} />
          <text x={g.x + 22} y={g.y + 26} fontSize="13" fontWeight="700" fill={g.color} letterSpacing="1">{g.title.toUpperCase()}</text>
          {g.items.map((it, j) => (
            <g key={j} transform={`translate(${g.x + 18},${g.y + 48 + j * 42})`}>
              <foreignObject x={0} y={0} width={20} height={20}>{it.icon}</foreignObject>
              <text x={30} y={11} fontSize="11" fontWeight="600" fill={C.text}>{it.n}</text>
              <text x={30} y={26} fontSize="10" fill={C.textMuted}>{it.s}</text>
            </g>
          ))}
        </g>
      ))}
      <text x={550} y={575} textAnchor="middle" fontSize="11" fontStyle="italic" fill={C.textMuted}>tenant ibmalliance.onmicrosoft.com · subscription Project-IBMMSOFFERINGSPOC · ~$3.50/day idle</text>
    </svg>
  );
}

// =============== 6. Claim Workflow ===============
export function ClaimWorkflowDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  const dws = [
    { label: "DW-1 · FNOL HANDLER", x: 30, color: C.brand, steps: ["claim-intake", "coverage-verification", "initial-triage · HITL low-confidence", "assignment-routing"] },
    { label: "DW-2 · DAMAGE HANDLER", x: 290, color: C.brand, steps: ["damage-intake", "damage-categorization · HITL total-loss", "repair-estimation", "shop-routing"] },
    { label: "DW-3 · FRAUD HANDLER", x: 550, color: C.amber, steps: ["fraud-intake", "fraud-pattern-scan · 5-pass bounded zone", "fraud-score · HITL priority-band", "siu-routing"] },
    { label: "DW-4 · SETTLEMENT HANDLER", x: 810, color: C.fabricGreen, steps: ["settlement-intake", "settlement-calculation · HITL >$25K", "settlement-disclosure (state-aware)", "settlement-disbursement · HITL denial"] },
  ];
  return (
    <svg viewBox="0 0 1090 330" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1090" height="330" fill={C.bg} />
      <defs>
        <marker id="cw-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.strokeStrong} />
        </marker>
      </defs>
      {dws.map((d, i) => (
        <g key={i}>
          <rect x={d.x} y={30} width={230} height={250} rx={8} fill={C.card} stroke={d.color} strokeWidth={2} />
          <rect x={d.x} y={30} width={230} height={36} rx={8} fill={d.color} />
          <rect x={d.x} y={58} width={230} height={8} fill={d.color} />
          <text x={d.x + 115} y={54} textAnchor="middle" fontSize="12" fontWeight="700" fill={mode === "light" ? "#fff" : C.bg} letterSpacing="1">{d.label}</text>
          {d.steps.map((s, j) => (
            <g key={j}>
              <text x={d.x + 18} y={98 + j * 42} fontSize="10" fontWeight="700" fill={d.color} letterSpacing="1">STEP {j + 1}</text>
              <text x={d.x + 18} y={116 + j * 42} fontSize="11" fill={C.text}>{s}</text>
            </g>
          ))}
          {i < dws.length - 1 && (
            <line x1={d.x + 232} y1={155} x2={d.x + 260} y2={155} stroke={C.strokeStrong} strokeWidth={2} markerEnd="url(#cw-arr)" />
          )}
        </g>
      ))}
      <text x={545} y={310} textAnchor="middle" fontSize="11" fontStyle="italic" fill={C.textMuted}>Decisions cascade: FNOL → Damage → Fraud → Settlement · 16 agent steps · 8 HITL gates across 3 trigger types</text>
    </svg>
  );
}

// =============== 7. Boundary ===============
export function BoundaryDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  return (
    <svg viewBox="0 0 1080 380" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1080" height="380" fill={C.bg} />
      <defs>
        <marker id="b-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.green} />
        </marker>
      </defs>
      {/* Platform */}
      <rect x={30} y={40} width={400} height={300} rx={10} fill={C.card} stroke={C.brand} strokeWidth={2} />
      <text x={50} y={65} fontSize="13" fontWeight="700" fill={C.brand} letterSpacing="1">PLATFORM · platform/src/</text>
      <text x={50} y={82} fontSize="11" fill={C.textMuted}>zero industry vocabulary · zero use-case imports</text>
      {["PackageModel · schema types", "PackageCompiler · adpc CLI", "Agents · 3 adapters + factory", "ContextLayer · L5 federation (largest)", "Orchestration · StepRunner + HITL", "ToolRuntime · contracts only", "DecisionIngest · Cosmos + EH + SignalR", "TracesApi · Durable Functions worker"].map((p, i) => (
        <g key={i}>
          <rect x={50} y={100 + i * 28} width={360} height={24} rx={4} fill={C.cardAccent} stroke={C.stroke} />
          <text x={60} y={117 + i * 28} fontSize="11" fill={C.text}>{p}</text>
        </g>
      ))}
      {/* CI box */}
      <rect x={460} y={150} width={160} height={88} rx={8} fill={C.cardAccent} stroke={C.amber} strokeWidth={2} strokeDasharray="6 4" />
      <text x={540} y={178} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.amber}>CI BOUNDARY</text>
      <text x={540} y={196} textAnchor="middle" fontSize="11" fill={C.textMuted}>check-boundary.mjs</text>
      <text x={540} y={212} textAnchor="middle" fontSize="11" fill={C.textMuted}>blocks all imports</text>
      <text x={540} y={228} textAnchor="middle" fontSize="11" fill={C.textMuted}>except tool kits (v0.6)</text>
      {/* Use cases */}
      <rect x={650} y={40} width={400} height={300} rx={10} fill={C.card} stroke={C.fabricGreen} strokeWidth={2} />
      <text x={670} y={65} fontSize="13" fontWeight="700" fill={C.fabricGreen} letterSpacing="1">USE CASES · usecases/</text>
      <text x={670} y={82} fontSize="11" fill={C.textMuted}>per-industry contributions</text>
      <text x={670} y={108} fontSize="12" fontWeight="600" fill={C.text}>meridian-pnc-auto-claims/</text>
      {["packages/ · 4 JSON (fnol, damage, fraud, settlement)", "knowledge/ · 19 PAC-* markdown docs", "data/ · claims-1k.json synthetic corpus", "tools/MeridianTools.csproj · 4 MCP tools"].map((p, i) => (
        <text key={i} x={690} y={126 + i * 18} fontSize="10" fill={C.textMuted}>· {p}</text>
      ))}
      <text x={670} y={222} fontSize="12" fontWeight="600" fill={C.text}>banking-loan-origination/</text>
      {["packages/loan-handler.json · 2 agents", "knowledge/ · 2 BANK-* docs", "data/borrowers-30.json · 30 + 40 apps", "tools/BankingTools.csproj · 2 MCP tools"].map((p, i) => (
        <text key={i} x={690} y={240 + i * 18} fontSize="10" fill={C.textMuted}>· {p}</text>
      ))}
      {/* Arrows showing contracts */}
      <line x1={430} y1={130} x2={650} y2={130} stroke={C.green} strokeWidth={1.5} strokeDasharray="4 4" markerEnd="url(#b-arr)" />
      <text x={540} y={124} textAnchor="middle" fontSize="10" fill={C.green}>contracts only (IContextSource, IMcpTool, IAgentAdapter)</text>
      <line x1={650} y1={310} x2={430} y2={310} stroke={C.green} strokeWidth={1.5} strokeDasharray="4 4" markerEnd="url(#b-arr)" />
      <text x={540} y={330} textAnchor="middle" fontSize="10" fill={C.green}>tool kits referenced by TracesApi + PackageCompiler (ADR-0001 v0.6 exception)</text>
    </svg>
  );
}

// =============== 8. Application Architecture ===============
export function ApplicationArchitectureDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  return (
    <svg viewBox="0 0 1180 580" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1180" height="580" fill={C.bg} />
      <defs>
        <marker id="aa-arr-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={C.amber} /></marker>
        <marker id="aa-arr-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={C.brand} /></marker>
      </defs>
      <text x={40} y={32} fontSize="13" fontWeight="700" fill={C.amber} letterSpacing="2">BUILD-TIME</text>
      <text x={40} y={50} fontSize="11" fill={C.textMuted}>adpc compile · 4 stages · emits signed package zip</text>
      {[
        { x: 30, label: "Agent Package", sub: "JSON · DSL", icon: <DotnetIcon size={20} /> },
        { x: 260, label: "Schema Validate", sub: "JSON Schema 2020-12", icon: <DotnetIcon size={20} /> },
        { x: 490, label: "Semantic Validate", sub: "reference checks", icon: <DotnetIcon size={20} /> },
        { x: 720, label: "Plan Generate", sub: "stage order · provenance", icon: <DotnetIcon size={20} /> },
        { x: 950, label: "Sign & Bundle", sub: "Resources/<id>.zip", icon: <DotnetIcon size={20} /> },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={70} width={200} height={66} rx={6} fill={C.card} stroke={C.amber} />
          <foreignObject x={b.x + 10} y={80} width={20} height={20}>{b.icon}</foreignObject>
          <text x={b.x + 100} y={95} textAnchor="middle" fontSize="12" fontWeight="600" fill={C.text}>{b.label}</text>
          <text x={b.x + 100} y={114} textAnchor="middle" fontSize="10" fill={C.textMuted}>{b.sub}</text>
        </g>
      ))}
      {[230, 460, 690, 920].map((x) => (
        <line key={x} x1={x} y1={103} x2={x + 30} y2={103} stroke={C.amber} strokeWidth={1.5} markerEnd="url(#aa-arr-a)" />
      ))}

      <line x1={20} y1={170} x2={1160} y2={170} stroke={C.separator} strokeDasharray="4 4" />
      <text x={40} y={196} fontSize="13" fontWeight="700" fill={C.brand} letterSpacing="2">RUN-TIME</text>
      <text x={40} y={214} fontSize="11" fill={C.textMuted}>Function App · Durable Orchestrator · ContextRouter · Decision Sink · Live Tail</text>

      {[
        { x: 30, label: "Console SPA", sub: "Vite + React 19 + Fluent v9", icon: <SwaIcon size={22} />, c: C.brand },
        { x: 260, label: "RunFnol Function", sub: "POST /api/runs", icon: <FunctionsIcon size={22} />, c: C.brand },
        { x: 490, label: "FnolOrchestrator", sub: "Durable Functions", icon: <DurableIcon size={22} />, c: C.purple },
        { x: 720, label: "RunStepActivity", sub: "per agent", icon: <DotnetIcon size={22} />, c: C.brand },
        { x: 950, label: "StepRunner", sub: "single-step engine", icon: <DotnetIcon size={22} />, c: C.brand },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={234} width={200} height={70} rx={6} fill={C.card} stroke={b.c} />
          <foreignObject x={b.x + 12} y={246} width={22} height={22}>{b.icon}</foreignObject>
          <text x={b.x + 100} y={262} textAnchor="middle" fontSize="12" fontWeight="600" fill={b.c}>{b.label}</text>
          <text x={b.x + 100} y={284} textAnchor="middle" fontSize="11" fill={C.textMuted}>{b.sub}</text>
        </g>
      ))}
      {[230, 460, 690, 920].map((x) => (
        <line key={x} x1={x} y1={269} x2={x + 30} y2={269} stroke={C.brand} strokeWidth={1.5} markerEnd="url(#aa-arr-b)" />
      ))}

      {/* StepRunner branches */}
      {[
        { x: 30, label: "ContextRouter", sub: "L5 federation", icon: <FoundryIcon size={22} />, c: C.foundryViolet },
        { x: 260, label: "IAgentAdapter", sub: "Foundry · Legacy · Stub", icon: <OpenAIIcon size={22} />, c: C.brand },
        { x: 490, label: "IndustryAwareToolRegistry", sub: "Meridian · Banking", icon: <DotnetIcon size={22} />, c: C.fabricGreen },
        { x: 720, label: "HitlGateEvaluator", sub: "confidence + field-value", icon: <DurableIcon size={22} />, c: C.amber },
        { x: 950, label: "CompositeDecisionSink", sub: "Cosmos · EH · SignalR", icon: <CosmosIcon size={22} />, c: C.workTeal },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={368} width={200} height={70} rx={6} fill={C.card} stroke={b.c} />
          <foreignObject x={b.x + 12} y={380} width={22} height={22}>{b.icon}</foreignObject>
          <text x={b.x + 100} y={396} textAnchor="middle" fontSize="12" fontWeight="600" fill={b.c}>{b.label}</text>
          <text x={b.x + 100} y={418} textAnchor="middle" fontSize="11" fill={C.textMuted}>{b.sub}</text>
        </g>
      ))}
      <line x1={1050} y1={304} x2={1050} y2={350} stroke={C.brand} strokeWidth={1.5} markerEnd="url(#aa-arr-b)" />
      <line x1={1050} y1={345} x2={130} y2={345} stroke={C.brand} strokeWidth={1.5} />
      {[130, 360, 590, 820, 1050].map((x) => (
        <line key={x} x1={x} y1={345} x2={x} y2={368} stroke={C.brand} strokeWidth={1.5} markerEnd="url(#aa-arr-b)" />
      ))}

      {/* Persistence */}
      {[
        { x: 30, label: "Cosmos · dw-state", icon: <CosmosIcon size={20} />, c: C.workTeal },
        { x: 260, label: "Event Hubs · Kafka", icon: <EventHubsIcon size={20} />, c: C.workTeal },
        { x: 490, label: "SignalR · live tail", icon: <SignalRIcon size={20} />, c: C.workTeal },
        { x: 720, label: "AI Search · citations", icon: <AISearchIcon size={20} />, c: C.foundryViolet },
        { x: 950, label: "App Insights · traces", icon: <LogAnalyticsIcon size={20} />, c: C.brand },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={478} width={200} height={56} rx={6} fill={C.cardAccent} stroke={b.c} />
          <foreignObject x={b.x + 12} y={494} width={20} height={20}>{b.icon}</foreignObject>
          <text x={b.x + 100} y={510} textAnchor="middle" fontSize="12" fontWeight="600" fill={b.c}>{b.label}</text>
        </g>
      ))}
      <line x1={1050} y1={438} x2={1050} y2={478} stroke={C.workTeal} strokeWidth={1.5} markerEnd="url(#aa-arr-b)" />
      <text x={580} y={560} textAnchor="middle" fontSize="11" fontStyle="italic" fill={C.textMuted}>From operator click to live trace card in {`<`}1 second per step · full claim cycle ~60-90s (no HITL)</text>
    </svg>
  );
}

// =============== 9. Compile Pipeline ===============
export function CompilePipelineDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  return (
    <svg viewBox="0 0 1080 240" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1080" height="240" fill={C.bg} />
      <defs>
        <marker id="cp-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.amber} />
        </marker>
      </defs>
      {[
        { n: 1, label: "Schema Validate", sub: "JSON Schema 2020-12 · field presence + types + regex" },
        { n: 2, label: "Semantic Validate", sub: "cross-references · skill→agent · tool ids · intents" },
        { n: 3, label: "Plan Generate", sub: "stage order · provenance map · gate index" },
        { n: 4, label: "Sign & Bundle", sub: "manifest + provenance + plan + json" },
      ].map((s, i) => {
        const x = 30 + i * 260;
        return (
          <g key={i}>
            <rect x={x} y={50} width={240} height={140} rx={8} fill={C.card} stroke={C.amber} />
            <circle cx={x + 30} cy={80} r={20} fill={C.amber} />
            <text x={x + 30} y={86} textAnchor="middle" fontSize="14" fontWeight="700" fill={mode === "light" ? "#fff" : C.bg}>{s.n}</text>
            <text x={x + 64} y={86} fontSize="14" fontWeight="700" fill={C.text}>{s.label}</text>
            <foreignObject x={x + 16} y={108} width={210} height={76}>
              <div style={{ fontSize: "11px", color: C.textMuted, lineHeight: 1.55 }}>{s.sub}</div>
            </foreignObject>
            {i < 3 && (
              <line x1={x + 240} y1={120} x2={x + 260} y2={120} stroke={C.amber} strokeWidth={1.5} markerEnd="url(#cp-arr)" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// =============== 10. HITL State Machine ===============
export function HitlStateMachineDiagram() {
  const { mode } = useThemeMode();
  const C = palette(mode);
  return (
    <svg viewBox="0 0 1080 360" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <rect width="1080" height="360" fill={C.bg} />
      <defs>
        {[
          { id: "h-arr", c: C.strokeStrong },
          { id: "h-arr-a", c: C.amber },
          { id: "h-arr-g", c: C.green },
        ].map((d) => (
          <marker key={d.id} id={d.id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={d.c} />
          </marker>
        ))}
      </defs>
      <circle cx={120} cy={170} r={56} fill={C.card} stroke={C.brand} strokeWidth={2.5} />
      <text x={120} y={166} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.brand}>Running</text>
      <text x={120} y={184} textAnchor="middle" fontSize="10" fill={C.textMuted}>step.RunAsync</text>
      <circle cx={320} cy={170} r={56} fill={C.card} stroke={C.brand} strokeWidth={2.5} />
      <text x={320} y={166} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.brand}>Evaluate</text>
      <text x={320} y={184} textAnchor="middle" fontSize="10" fill={C.textMuted}>gates + invariants</text>
      <circle cx={540} cy={80} r={56} fill={C.card} stroke={C.amber} strokeWidth={2.5} />
      <text x={540} y={76} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.amber}>Paused</text>
      <text x={540} y={94} textAnchor="middle" fontSize="10" fill={C.textMuted}>WaitForExternalEvent</text>
      <rect x={690} y={50} width={200} height={64} rx={8} fill={C.cardAccent} stroke={C.amber} />
      <text x={790} y={78} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.amber}>Operator action</text>
      <text x={790} y={98} textAnchor="middle" fontSize="11" fill={C.textMuted}>Approve · Escalate · Override</text>
      <circle cx={540} cy={270} r={56} fill={C.card} stroke={C.green} strokeWidth={2.5} />
      <text x={540} y={266} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.green}>Resumed</text>
      <text x={540} y={284} textAnchor="middle" fontSize="10" fill={C.textMuted}>ResolveHitlActivity</text>
      <circle cx={790} cy={270} r={56} fill={C.card} stroke={C.green} strokeWidth={2.5} />
      <text x={790} y={273} textAnchor="middle" fontSize="13" fontWeight="700" fill={C.green}>Next Step</text>
      <line x1={176} y1={170} x2={264} y2={170} stroke={C.strokeStrong} strokeWidth={1.8} markerEnd="url(#h-arr)" />
      <line x1={360} y1={140} x2={500} y2={100} stroke={C.amber} strokeWidth={1.8} markerEnd="url(#h-arr-a)" />
      <text x={398} y={106} fontSize="11" fill={C.amber}>gate trips</text>
      <line x1={360} y1={200} x2={500} y2={250} stroke={C.green} strokeWidth={1.8} markerEnd="url(#h-arr-g)" />
      <text x={395} y={250} fontSize="11" fill={C.green}>no gate</text>
      <line x1={596} y1={80} x2={690} y2={80} stroke={C.amber} strokeWidth={1.8} markerEnd="url(#h-arr-a)" />
      <line x1={790} y1={114} x2={580} y2={220} stroke={C.amber} strokeDasharray="4 4" strokeWidth={1.5} markerEnd="url(#h-arr-a)" />
      <text x={690} y={185} fontSize="11" fill={C.amber}>POST /resolve-hitl</text>
      <line x1={596} y1={270} x2={734} y2={270} stroke={C.green} strokeWidth={1.8} markerEnd="url(#h-arr-g)" />
      <path d="M 790 326 Q 600 360 120 230" fill="none" stroke={C.green} strokeWidth={1.5} strokeDasharray="6 4" markerEnd="url(#h-arr-g)" />
      <text x={410} y={345} fontSize="11" fill={C.green}>loop until all agents complete</text>
    </svg>
  );
}
