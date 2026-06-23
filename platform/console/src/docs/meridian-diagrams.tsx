// Meridian-specific AS-IS vs TO-BE diagrams.
// Theme-aware. Style matches adp-portal gradient + shadow aesthetic.
import { useThemeMode } from "../ThemeContext";

const FF = "'Segoe UI', system-ui, sans-serif";

function meridianPalette(mode: "light" | "dark") {
  return mode === "light"
    ? {
        bg: "#FAFBFC", card: "#FFFFFF", cardAccent: "#F3F6FB",
        stroke: "#D8DEE8", strokeStrong: "#9FAFC4", text: "#1A2233", textMuted: "#5A6B83",
        ibmBlue: "#0f62fe", ibmBlueLight: "#4589ff", ibmPurple: "#742774", ibmPurpleLight: "#8A3FFC",
        teal: "#009d9a", tealLight: "#00B5AE", orange: "#D83B01", orangeLight: "#F47820",
        red: "#A4262C", green: "#107C10", amber: "#B47600", grey: "#393939", greyLight: "#525252",
      }
    : {
        bg: "#0b1220", card: "#10182a", cardAccent: "#1d2a44",
        stroke: "#2a3a5c", strokeStrong: "#3d5380", text: "#e6edf7", textMuted: "#9aa6bd",
        ibmBlue: "#4589ff", ibmBlueLight: "#7AAEFF", ibmPurple: "#8A3FFC", ibmPurpleLight: "#A569FF",
        teal: "#00B5AE", tealLight: "#33CFC8", orange: "#F47820", orangeLight: "#FF9447",
        red: "#E35D6A", green: "#3fb950", amber: "#d4a64a", grey: "#525252", greyLight: "#6B6B6B",
      };
}

// =============== AS-IS Meridian Claim Process ===============
export function MeridianAsIsDiagram() {
  const { mode } = useThemeMode();
  const C = meridianPalette(mode);
  return (
    <svg viewBox="0 0 1180 640" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <defs>
        <linearGradient id="as-grey" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.greyLight} />
          <stop offset="100%" stopColor={C.grey} />
        </linearGradient>
        <linearGradient id="as-orange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.orangeLight} />
          <stop offset="100%" stopColor={C.orange} />
        </linearGradient>
        <linearGradient id="as-red" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF6B6B" />
          <stop offset="100%" stopColor={C.red} />
        </linearGradient>
        <filter id="as-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dy="2" result="off" />
          <feFlood floodColor="#000" floodOpacity="0.18" />
          <feComposite in2="off" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="as-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.strokeStrong} />
        </marker>
        <marker id="as-arr-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.red} />
        </marker>
      </defs>
      <rect width="1180" height="640" fill={C.bg} />
      <text x={40} y={32} fontSize="14" fontWeight="700" fill={C.red} letterSpacing="2">AS-IS · TODAY AT MERIDIAN</text>
      <text x={40} y={52} fontSize="12" fill={C.textMuted}>Siloed systems · manual handoffs · disconnected reasoning · audit chain assembled retrospectively</text>

      {/* Top swimlane: Channels */}
      <text x={40} y={86} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">CHANNELS</text>
      {[
        { x: 30, label: "Mobile App", sub: "policyholder" },
        { x: 200, label: "Web Portal", sub: "policyholder · agent" },
        { x: 370, label: "Call Centre", sub: "CSR-assisted" },
      ].map((c, i) => (
        <g key={i} filter="url(#as-shadow)">
          <rect x={c.x} y={94} width={160} height={56} rx={8} fill="url(#as-grey)" />
          <text x={c.x + 80} y={120} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{c.label}</text>
          <text x={c.x + 80} y={138} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.85)">{c.sub}</text>
        </g>
      ))}

      {/* Process flow */}
      <text x={40} y={186} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">MANUAL CLAIM HANDLING PROCESS</text>
      {[
        { x: 30, t: "FNOL Capture", sub: "CSR types into Duck Creek", pain: "10–20 min per call" },
        { x: 200, t: "Coverage Check", sub: "Manual policy lookup", pain: "0.5–2% error rate" },
        { x: 370, t: "Triage", sub: "Adjuster judgement", pain: "Severity inconsistency" },
        { x: 540, t: "Assignment", sub: "Workload spreadsheet", pain: "Hours of latency" },
        { x: 710, t: "Damage Assess", sub: "Field adjuster + photos", pain: "Subjective bands" },
        { x: 880, t: "Settlement", sub: "Excel + letter template", pain: "Days of delay" },
      ].map((s, i) => (
        <g key={i} filter="url(#as-shadow)">
          <rect x={s.x} y={196} width={150} height={92} rx={8} fill="url(#as-orange)" />
          <text x={s.x + 75} y={220} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{s.t}</text>
          <text x={s.x + 75} y={238} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.9)">{s.sub}</text>
          <line x1={s.x + 10} y1={250} x2={s.x + 140} y2={250} stroke="rgba(255,255,255,0.35)" />
          <text x={s.x + 75} y={268} textAnchor="middle" fontSize="10" fontStyle="italic" fill="rgba(255,255,255,0.95)">{s.pain}</text>
        </g>
      ))}
      {[180, 350, 520, 690, 860].map((x) => (
        <line key={x} x1={x} y1={242} x2={x + 20} y2={242} stroke={C.strokeStrong} strokeWidth={1.5} markerEnd="url(#as-arr)" />
      ))}

      {/* AS-IS systems row */}
      <text x={40} y={324} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">UNDERLYING SYSTEMS (siloed)</text>
      {[
        { x: 30, t: "Duck Creek", sub: "Policy + claims", role: "system of record" },
        { x: 200, t: "PeopleSoft", sub: "Adjuster roster", role: "HR" },
        { x: 370, t: "Oracle EBS", sub: "Finance + payments", role: "back-office" },
        { x: 540, t: "ServiceNow", sub: "Service management", role: "IT/ops" },
        { x: 710, t: "Email / Excel", sub: "Tribal knowledge", role: "ad-hoc" },
        { x: 880, t: "SIU Spreadsheet", sub: "Fraud cases", role: "siloed" },
      ].map((s, i) => (
        <g key={i} filter="url(#as-shadow)">
          <rect x={s.x} y={334} width={150} height={86} rx={8} fill="url(#as-grey)" />
          <text x={s.x + 75} y={358} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{s.t}</text>
          <text x={s.x + 75} y={376} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.9)">{s.sub}</text>
          <text x={s.x + 75} y={400} textAnchor="middle" fontSize="9" fontStyle="italic" fill="rgba(255,255,255,0.8)">{s.role}</text>
        </g>
      ))}

      {/* Pain points panel on the right */}
      <rect x={1040} y={196} width={130} height={224} rx={8} fill="url(#as-red)" filter="url(#as-shadow)" />
      <text x={1105} y={220} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" letterSpacing="1">PAIN</text>
      {[
        "Cycle time",
        "weeks",
        "",
        "Manual",
        "everywhere",
        "",
        "Audit chain",
        "fragmented",
        "",
        "Fraud caught",
        "late",
      ].map((t, i) => (
        <text key={i} x={1105} y={240 + i * 16} textAnchor="middle" fontSize="10" fill="#fff">{t}</text>
      ))}

      {/* Bottom: outcome problems */}
      <text x={40} y={456} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">BUSINESS OUTCOMES TODAY</text>
      {[
        { x: 30, t: "Days to first contact", v: "1–3 days", c: C.red },
        { x: 200, t: "Settlement cycle", v: "21–45 days", c: C.red },
        { x: 370, t: "Coverage decision error", v: "0.5–2%", c: C.amber },
        { x: 540, t: "Fraud detected", v: "post-pay (after loss)", c: C.red },
        { x: 710, t: "Adjuster workload variance", v: "30–60%", c: C.amber },
        { x: 880, t: "Complaint rate", v: "rising YoY", c: C.red },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={468} width={150} height={70} rx={6} fill={C.card} stroke={s.c} strokeWidth={2} />
          <text x={s.x + 75} y={490} textAnchor="middle" fontSize="11" fill={C.textMuted}>{s.t}</text>
          <text x={s.x + 75} y={518} textAnchor="middle" fontSize="14" fontWeight="700" fill={s.c}>{s.v}</text>
        </g>
      ))}

      {/* Big call-out: why this matters */}
      <rect x={30} y={560} width={1140} height={60} rx={8} fill={C.cardAccent} stroke={C.red} strokeWidth={2} strokeDasharray="4 4" />
      <text x={50} y={588} fontSize="12" fontWeight="700" fill={C.red} letterSpacing="1">WHY THIS MATTERS</text>
      <text x={50} y={608} fontSize="12" fill={C.text}>Every reasoning step is a human-and-spreadsheet step. Decisions are not auditable as they happen — they're reconstructed from emails, Excel, and adjuster memory. The platform that fixes this has to be agentic, federated, and grounded by default.</text>
    </svg>
  );
}

// =============== TO-BE Meridian Process on ADP ===============
export function MeridianToBeDiagram() {
  const { mode } = useThemeMode();
  const C = meridianPalette(mode);
  return (
    <svg viewBox="0 0 1180 680" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <defs>
        <linearGradient id="tb-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.ibmBlueLight} />
          <stop offset="100%" stopColor={C.ibmBlue} />
        </linearGradient>
        <linearGradient id="tb-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.ibmPurpleLight} />
          <stop offset="100%" stopColor={C.ibmPurple} />
        </linearGradient>
        <linearGradient id="tb-teal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.tealLight} />
          <stop offset="100%" stopColor={C.teal} />
        </linearGradient>
        <linearGradient id="tb-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3fb950" />
          <stop offset="100%" stopColor={C.green} />
        </linearGradient>
        <filter id="tb-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dy="2" result="off" />
          <feFlood floodColor="#000" floodOpacity="0.18" />
          <feComposite in2="off" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="tb-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.strokeStrong} />
        </marker>
        <marker id="tb-arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={C.green} />
        </marker>
      </defs>
      <rect width="1180" height="680" fill={C.bg} />
      <text x={40} y={32} fontSize="14" fontWeight="700" fill={C.green} letterSpacing="2">TO-BE · ON PROJECT ADP</text>
      <text x={40} y={52} fontSize="12" fill={C.textMuted}>Agentic claim lifecycle · federated L5 context · HITL on consequential moments · auditable by construction</text>

      {/* Top: Operator surface */}
      <text x={40} y={86} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">UNIFIED OPERATOR SURFACE</text>
      <rect x={30} y={94} width={1120} height={56} rx={8} fill="url(#tb-blue)" filter="url(#tb-shadow)" />
      <text x={50} y={120} fontSize="13" fontWeight="700" fill="#fff">Operator Console (SWA · Fluent UI · React 19)</text>
      <text x={50} y={138} fontSize="11" fill="rgba(255,255,255,0.85)">SignalR live tail · Approve / Escalate · trace inspection · one surface for adjuster + supervisor + SIU</text>

      {/* Middle: 4 Digital Workers cascade */}
      <text x={40} y={186} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">FOUR DIGITAL WORKERS · AGENTIC PROCESS</text>
      {[
        { x: 30, t: "FNOL Handler", sub: "intake · coverage · triage · assignment", gain: "minutes, not days", grad: "tb-purple" },
        { x: 230, t: "Damage Handler", sub: "intake · categorize · estimate · shop", gain: "consistent bands", grad: "tb-purple" },
        { x: 430, t: "Fraud Handler", sub: "intake · pattern-scan · score · SIU", gain: "fraud caught early", grad: "tb-purple" },
        { x: 630, t: "Settlement Handler", sub: "intake · calculate · disclose · disburse", gain: "state-aware letters", grad: "tb-purple" },
      ].map((d, i) => (
        <g key={i} filter="url(#tb-shadow)">
          <rect x={d.x} y={196} width={180} height={108} rx={8} fill={`url(#${d.grad})`} />
          <text x={d.x + 90} y={220} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{d.t}</text>
          <foreignObject x={d.x + 8} y={228} width={164} height={36}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.9)", textAlign: "center", lineHeight: 1.4 }}>{d.sub}</div>
          </foreignObject>
          <line x1={d.x + 16} y1={272} x2={d.x + 164} y2={272} stroke="rgba(255,255,255,0.3)" />
          <text x={d.x + 90} y={290} textAnchor="middle" fontSize="11" fontStyle="italic" fontWeight="600" fill="#fff">{d.gain}</text>
        </g>
      ))}
      {[210, 410, 610].map((x) => (
        <line key={x} x1={x} y1={250} x2={x + 20} y2={250} stroke={C.strokeStrong} strokeWidth={1.5} markerEnd="url(#tb-arr)" />
      ))}

      {/* Right side: HITL */}
      <rect x={840} y={196} width={310} height={108} rx={8} fill="url(#tb-green)" filter="url(#tb-shadow)" />
      <text x={995} y={222} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">HITL · Durable Pause/Resume</text>
      <text x={995} y={244} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.9)">8 gates · 3 trigger types</text>
      <text x={995} y={264} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.9)">confidence · field-value · mandatory band</text>
      <text x={995} y={286} textAnchor="middle" fontSize="10" fontStyle="italic" fill="rgba(255,255,255,0.85)">orchestrator awaits external event</text>

      {/* Middle: L5 Federation */}
      <text x={40} y={336} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">L5 CONTEXT FEDERATION · FED TO EVERY AGENT STEP</text>
      {[
        { x: 30, t: "Foundry IQ", sub: "Azure AI Search · 21 docs · 3072-d", role: "procedural + regulatory", grad: "tb-purple" },
        { x: 410, t: "Fabric IQ", sub: "Lakehouse · 5 Delta tables · 8 primitives", role: "entities + aggregates", grad: "tb-teal" },
        { x: 790, t: "Work IQ", sub: "Microsoft Graph delegated + synthetic", role: "collaboration signals", grad: "tb-blue" },
      ].map((s, i) => (
        <g key={i} filter="url(#tb-shadow)">
          <rect x={s.x} y={346} width={360} height={94} rx={8} fill={`url(#${s.grad})`} />
          <text x={s.x + 180} y={372} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">{s.t}</text>
          <text x={s.x + 180} y={394} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.9)">{s.sub}</text>
          <text x={s.x + 180} y={418} textAnchor="middle" fontSize="11" fontStyle="italic" fill="rgba(255,255,255,0.85)">{s.role}</text>
        </g>
      ))}

      {/* Bottom: New AS-IS systems become L7 substrate */}
      <text x={40} y={476} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">L7 DATA SUBSTRATE · MICROSOFT-NATIVE</text>
      {[
        { x: 30, t: "Fabric Lakehouse", sub: "5 Delta tables · 1K rows ea." },
        { x: 230, t: "Cosmos DB", sub: "dw-state · /subjectId" },
        { x: 430, t: "Event Hubs Kafka", sub: "Decision Journal" },
        { x: 630, t: "Azure OpenAI", sub: "gpt-4o · embed-3-large" },
        { x: 830, t: "AI Search", sub: "adp-knowledge vector" },
      ].map((s, i) => (
        <g key={i} filter="url(#tb-shadow)">
          <rect x={s.x} y={486} width={180} height={68} rx={8} fill="url(#tb-blue)" />
          <text x={s.x + 90} y={508} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{s.t}</text>
          <text x={s.x + 90} y={528} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.85)">{s.sub}</text>
        </g>
      ))}

      {/* Business outcomes */}
      <text x={40} y={584} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">EXPECTED OUTCOMES ON ADP</text>
      {[
        { x: 30, t: "First contact", v: "minutes", c: C.green },
        { x: 200, t: "Settlement cycle", v: "≤15 days target", c: C.green },
        { x: 370, t: "Coverage decision error", v: "≤ 0.5% SLO", c: C.green },
        { x: 540, t: "Fraud", v: "scored at intake", c: C.green },
        { x: 710, t: "Workload variance", v: "balanced via roster MCP", c: C.green },
        { x: 880, t: "Every decision", v: "auditable · cited", c: C.green },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={596} width={150} height={70} rx={6} fill={C.card} stroke={s.c} strokeWidth={2} />
          <text x={s.x + 75} y={618} textAnchor="middle" fontSize="11" fill={C.textMuted}>{s.t}</text>
          <text x={s.x + 75} y={646} textAnchor="middle" fontSize="13" fontWeight="700" fill={s.c}>{s.v}</text>
        </g>
      ))}
    </svg>
  );
}

// =============== Solution Architecture (TO-BE Stack) ===============
export function MeridianSolutionArchitectureDiagram() {
  const { mode } = useThemeMode();
  const C = meridianPalette(mode);
  return (
    <svg viewBox="0 0 1180 720" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", fontFamily: FF }}>
      <defs>
        <linearGradient id="sa-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.ibmBlueLight} />
          <stop offset="100%" stopColor={C.ibmBlue} />
        </linearGradient>
        <linearGradient id="sa-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.ibmPurpleLight} />
          <stop offset="100%" stopColor={C.ibmPurple} />
        </linearGradient>
        <linearGradient id="sa-teal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.tealLight} />
          <stop offset="100%" stopColor={C.teal} />
        </linearGradient>
        <linearGradient id="sa-orange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.orangeLight} />
          <stop offset="100%" stopColor={C.orange} />
        </linearGradient>
        <filter id="sa-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dy="2" result="off" />
          <feFlood floodColor="#000" floodOpacity="0.18" />
          <feComposite in2="off" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="1180" height="720" fill={C.bg} />

      {/* Top: User surface */}
      <rect x={30} y={30} width={1120} height={70} rx={10} fill="url(#sa-orange)" filter="url(#sa-shadow)" />
      <text x={590} y={56} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" letterSpacing="2">EXPERIENCE · OPERATOR + DOCS PORTAL</text>
      <text x={590} y={78} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.92)">Azure Static Web App · React 19 + Fluent UI v9 · SignalR live tail · hash-routed (operator · docs)</text>
      <text x={590} y={94} textAnchor="middle" fontSize="10" fontStyle="italic" fill="rgba(255,255,255,0.78)">Adjuster · Supervisor · SIU · Architect · Engineer · Stakeholder</text>

      {/* Layer 2: Agent runtime + orchestration */}
      <rect x={30} y={120} width={1120} height={120} rx={10} fill="url(#sa-purple)" filter="url(#sa-shadow)" />
      <text x={590} y={146} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" letterSpacing="2">AGENT RUNTIME · ORCHESTRATION · HITL</text>
      {[
        { x: 50, t: "FoundryAdapter", sub: "Persistent Agents SDK", note: "RBAC pending" },
        { x: 250, t: "LegacyOpenAIAdapter", sub: "chat-completions", note: "active default" },
        { x: 450, t: "FnolOrchestrator", sub: "Durable Functions", note: "WaitForExternalEvent" },
        { x: 650, t: "StepRunner", sub: "single-step engine", note: "shared by CLI + cloud" },
        { x: 850, t: "HitlGateEvaluator", sub: "confidence + field-value", note: "8 gates × 3 types" },
        { x: 50, t: "IndustryAwareToolRegistry", sub: "composes per-industry kits", note: "Meridian + Banking", row: 2 },
        { x: 250, t: "MCP Tools", sub: "4 Meridian + 2 banking", note: "callable by any agent", row: 2 },
        { x: 450, t: "AgentAdapterFactory", sub: "AGENT_BACKEND env", note: "foundry · legacy · stub", row: 2 },
        { x: 650, t: "Bounded Reasoning Zones", sub: "5-pass fraud · 3-pass disclosure", note: "guardrailed", row: 2 },
        { x: 850, t: "PlanExecutor", sub: "CLI loop", note: "adpc execute", row: 2 },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.row === 2 ? 198 : 160} width={180} height={36} rx={4} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.4)" />
          <text x={b.x + 90} y={b.row === 2 ? 218 : 180} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{b.t}</text>
          <text x={b.x + 90} y={b.row === 2 ? 232 : 194} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.78)">{b.sub} · {b.note}</text>
        </g>
      ))}

      {/* Layer 3: L5 Federation */}
      <rect x={30} y={260} width={1120} height={120} rx={10} fill="url(#sa-teal)" filter="url(#sa-shadow)" />
      <text x={590} y={286} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" letterSpacing="2">L5 FEDERATION · IQ TRIO + AI SEARCH BACKBONE</text>
      {[
        { x: 50, t: "Foundry IQ", sub: "Azure AI Search · adp-knowledge", note: "21 docs · 3072-d · industry-filtered" },
        { x: 350, t: "Fabric IQ", sub: "Lakehouse SQL endpoint · adp", note: "8 primitives over 5 Delta tables" },
        { x: 650, t: "Work IQ", sub: "synthetic + Microsoft Graph", note: "Teams · OneDrive · Outlook · Calendar" },
        { x: 950, t: "ContextRouter", sub: "fan-out · merge · score", note: "GROUNDED / DERIVED tag" },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={300} width={280} height={70} rx={6} fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.4)" />
          <text x={b.x + 140} y={326} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{b.t}</text>
          <text x={b.x + 140} y={344} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.86)">{b.sub}</text>
          <text x={b.x + 140} y={360} textAnchor="middle" fontSize="9" fontStyle="italic" fill="rgba(255,255,255,0.75)">{b.note}</text>
        </g>
      ))}

      {/* Layer 4: Compute / Data substrate */}
      <rect x={30} y={400} width={1120} height={130} rx={10} fill="url(#sa-blue)" filter="url(#sa-shadow)" />
      <text x={590} y={426} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" letterSpacing="2">COMPUTE + DATA SUBSTRATE · MICROSOFT-NATIVE</text>
      {[
        { x: 50, t: "Azure Functions FC1", sub: ".NET 10 isolated", note: "func-adp-v1-fnol" },
        { x: 230, t: "Cosmos DB Serverless", sub: "dw-state · /subjectId", note: "Decision Journal" },
        { x: 410, t: "Event Hubs Kafka", sub: "adp-v1-decisions", note: "1 TU Standard" },
        { x: 590, t: "SignalR Free_F1", sub: "fnoltrace hub", note: "Operator live tail" },
        { x: 770, t: "Fabric Lakehouse", sub: "adp workspace", note: "OneLake · 5 Delta tables" },
        { x: 950, t: "Azure OpenAI", sub: "dt-navigator-openai", note: "gpt-4o · 3-large embed" },
        { x: 50, t: "AI Search Basic", sub: "srch-adp-v1", note: "eastus · 21 docs", row: 2 },
        { x: 230, t: "Azure SQL Basic", sub: "sql-adp-v1 fallback", note: "SEMANTIC_BACKEND=sql", row: 2 },
        { x: 410, t: "Container Apps env", sub: "cae-adp-v1", note: "idle · v1.5 ready", row: 2 },
        { x: 590, t: "SWA Free", sub: "swa-adp-v1-console", note: "operator + docs", row: 2 },
        { x: 770, t: "Key Vault", sub: "kv-adp-v1", note: "reserved", row: 2 },
        { x: 950, t: "Storage Account", sub: "stadpv1", note: "function deployment", row: 2 },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.row === 2 ? 478 : 440} width={170} height={36} rx={4} fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.4)" />
          <text x={b.x + 85} y={b.row === 2 ? 498 : 460} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{b.t}</text>
          <text x={b.x + 85} y={b.row === 2 ? 510 : 472} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.78)">{b.sub} · {b.note}</text>
        </g>
      ))}

      {/* Layer 5: Identity + IaC + Observability */}
      <rect x={30} y={550} width={1120} height={70} rx={10} fill="url(#sa-orange)" filter="url(#sa-shadow)" />
      <text x={590} y={576} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" letterSpacing="2">IDENTITY · IaC · OBSERVABILITY</text>
      {[
        { x: 50, t: "Entra ID + 6 user-MIs", sub: "per-workload identity" },
        { x: 280, t: "Entra Agent ID", sub: "per-agent · post Foundry RBAC" },
        { x: 510, t: "Bicep · 13 modules", sub: "18 of 19 resources" },
        { x: 740, t: "App Insights + Log Analytics", sub: "traces · dependencies" },
        { x: 970, t: "Defender for AI · Purview · Sentinel", sub: "wiring v1.5 ⏸" },
      ].map((b, i) => (
        <g key={i}>
          <text x={b.x + 90} y={600} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{b.t}</text>
          <text x={b.x + 90} y={614} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.82)">{b.sub}</text>
        </g>
      ))}

      {/* Bottom: AS-IS systems wrapped */}
      <text x={40} y={650} fontSize="11" fontWeight="700" fill={C.textMuted} letterSpacing="1.5">MERIDIAN AS-IS SYSTEMS · INTERFACED VIA MCP TOOLS</text>
      {[
        { x: 30, t: "Duck Creek", sub: "claim store · policy" },
        { x: 230, t: "PeopleSoft", sub: "adjuster roster" },
        { x: 430, t: "Oracle EBS", sub: "settlement disburse" },
        { x: 630, t: "J.D. Power / NADA", sub: "vehicle lookup" },
        { x: 830, t: "ISO ClaimSearch", sub: "fraud cross-reference" },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={662} width={180} height={44} rx={6} fill={C.card} stroke={C.greyLight} strokeDasharray="4 4" />
          <text x={s.x + 90} y={680} textAnchor="middle" fontSize="11" fontWeight="600" fill={C.text}>{s.t}</text>
          <text x={s.x + 90} y={695} textAnchor="middle" fontSize="10" fontStyle="italic" fill={C.textMuted}>{s.sub}</text>
        </g>
      ))}
    </svg>
  );
}
