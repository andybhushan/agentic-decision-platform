import { ReactNode } from "react";
import { Badge, Body1, Caption1, Card, makeStyles, tokens, Title2, Title3 } from "@fluentui/react-components";
import { useThemeMode } from "../ThemeContext";
import { ServiceIcon, IconKey } from "./icons";

export const useDocsStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: "28px", maxWidth: "1180px" },
  hero: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingBottom: "12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  pageEyebrow: {
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: tokens.colorBrandForeground1,
  },
  pageTitle: { fontSize: "32px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.4px" },
  pageLead: {
    fontSize: "16px",
    lineHeight: 1.55,
    color: tokens.colorNeutralForeground2,
    maxWidth: "900px",
  },
  section: { display: "flex", flexDirection: "column", gap: "12px" },
  sectionTitle: { fontSize: "20px", fontWeight: 700, color: tokens.colorNeutralForeground1, marginTop: "6px" },
  sectionLead: { fontSize: "14px", lineHeight: 1.55, color: tokens.colorNeutralForeground2 },
  callout: {
    padding: "14px 18px",
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground2,
    fontSize: "13px",
    lineHeight: 1.55,
    borderRadius: "0 6px 6px 0",
  },
  calloutWarn: {
    padding: "14px 18px",
    borderLeft: `3px solid ${tokens.colorPaletteYellowBorderActive}`,
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorNeutralForeground1,
    fontSize: "13px",
    lineHeight: 1.55,
    borderRadius: "0 6px 6px 0",
  },
  diagramWrap: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "8px",
    backgroundColor: tokens.colorNeutralBackground1,
    padding: "16px 20px",
    overflow: "auto",
  },
  componentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "12px",
  },
  componentCard: {
    padding: "14px 16px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  componentHead: { display: "flex", alignItems: "center", gap: "10px" },
  componentName: { fontSize: "14px", fontWeight: 600, color: tokens.colorNeutralForeground1 },
  componentRole: { fontSize: "11px", color: tokens.colorBrandForeground1, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" },
  componentBody: { fontSize: "12px", color: tokens.colorNeutralForeground2, lineHeight: 1.55 },
  componentResource: { fontFamily: "Consolas, monospace", fontSize: "11px", color: tokens.colorNeutralForeground3 },
  narrativePara: { fontSize: "14px", lineHeight: 1.65, color: tokens.colorNeutralForeground2, marginBottom: "8px" },
  diagramCaption: { fontSize: "12px", color: tokens.colorNeutralForeground3, marginTop: "10px", fontStyle: "italic" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  threeCol: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" },
  fourCol: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" },
  card: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: "8px" },
  cardLabel: {
    fontSize: "10px", color: tokens.colorBrandForeground1, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 700,
  },
  cardTitle: { fontSize: "16px", fontWeight: 600, color: tokens.colorNeutralForeground1, lineHeight: 1.3 },
  cardBody: { fontSize: "13px", color: tokens.colorNeutralForeground2, lineHeight: 1.55 },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    fontSize: "13px",
    "& th": {
      textAlign: "left",
      fontWeight: 600,
      padding: "8px 12px",
      borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
      color: tokens.colorNeutralForeground2,
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "1px",
    },
    "& td": {
      padding: "10px 12px",
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
      verticalAlign: "top",
      color: tokens.colorNeutralForeground1,
      lineHeight: 1.5,
    },
    "& td code": {
      fontSize: "12px",
      backgroundColor: tokens.colorNeutralBackground3,
      padding: "1px 6px",
      borderRadius: "4px",
    },
  },
  inlineCode: {
    fontFamily: "Consolas, 'Cascadia Code', monospace",
    fontSize: "12px",
    backgroundColor: tokens.colorNeutralBackground3,
    padding: "1px 6px",
    borderRadius: "4px",
  },
  codeBlock: {
    fontFamily: "Consolas, 'Cascadia Code', monospace",
    fontSize: "12px",
    backgroundColor: "#0b1220",
    color: "#e6edf7",
    padding: "16px 20px",
    borderRadius: "6px",
    lineHeight: 1.6,
    overflow: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    whiteSpace: "pre",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
  },
  stat: { padding: "16px 18px", borderLeft: `3px solid ${tokens.colorBrandStroke1}`, display: "flex", flexDirection: "column", gap: "4px" },
  statN: { fontSize: "26px", fontWeight: 700, lineHeight: 1.05 },
  statL: { fontSize: "11px", color: tokens.colorNeutralForeground3, textTransform: "uppercase", letterSpacing: "1px" },
  chips: { display: "flex", flexWrap: "wrap", gap: "6px" },
  chip: {
    fontSize: "11px",
    padding: "3px 10px",
    borderRadius: "12px",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: 500,
  },
});

export interface PageHeroProps {
  eyebrow: string;
  title: string;
  lead: string;
  badges?: { label: string; color?: "brand" | "warning" | "success" | "danger" }[];
}

export function PageHero({ eyebrow, title, lead, badges }: PageHeroProps) {
  const s = useDocsStyles();
  return (
    <div className={s.hero}>
      <span className={s.pageEyebrow}>{eyebrow}</span>
      <h1 className={s.pageTitle}>{title}</h1>
      <p className={s.pageLead}>{lead}</p>
      {badges && badges.length > 0 && (
        <div className={s.chips}>
          {badges.map((b) => (
            <Badge key={b.label} size="small" appearance="outline" color={b.color ?? "brand"}>{b.label}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const s = useDocsStyles();
  return (
    <section className={s.section}>
      <Title3 className={s.sectionTitle}>{title}</Title3>
      {lead && <p className={s.sectionLead}>{lead}</p>}
      {children}
    </section>
  );
}

export function Diagram({ children, caption }: { children: ReactNode; caption?: string }) {
  const s = useDocsStyles();
  return (
    <div>
      <div className={s.diagramWrap}>{children}</div>
      {caption && <div className={s.diagramCaption}>{caption}</div>}
    </div>
  );
}

export function Callout({ children, variant = "info" }: { children: ReactNode; variant?: "info" | "warn" }) {
  const s = useDocsStyles();
  return <div className={variant === "warn" ? s.calloutWarn : s.callout}>{children}</div>;
}

export function StatCard({ n, label }: { n: string; label: string }) {
  const s = useDocsStyles();
  return (
    <Card className={s.stat}>
      <span className={s.statN}>{n}</span>
      <span className={s.statL}>{label}</span>
    </Card>
  );
}

export function InfoCard({ label, title, children }: { label?: string; title: string; children: ReactNode }) {
  const s = useDocsStyles();
  return (
    <Card className={s.card}>
      {label && <span className={s.cardLabel}>{label}</span>}
      <Title3 className={s.cardTitle}>{title}</Title3>
      <Body1 className={s.cardBody}>{children}</Body1>
    </Card>
  );
}

export { Title2, Body1, Caption1 };
export { useThemeMode };

export interface ComponentSpec {
  icon?: IconKey;
  role: string;
  name: string;
  resource?: string;
  body: ReactNode;
}

export function ComponentsGrid({ items }: { items: ComponentSpec[] }) {
  const s = useDocsStyles();
  return (
    <div className={s.componentGrid}>
      {items.map((c) => (
        <div key={c.name} className={s.componentCard}>
          <div className={s.componentHead}>
            {c.icon ? <ServiceIcon name={c.icon} size={32} /> : (
              <div style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: tokens.colorBrandBackground, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>·</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span className={s.componentRole}>{c.role}</span>
              <span className={s.componentName}>{c.name}</span>
            </div>
          </div>
          <div className={s.componentBody}>{c.body}</div>
          {c.resource && <div className={s.componentResource}>{c.resource}</div>}
        </div>
      ))}
    </div>
  );
}

export function Narrative({ children }: { children: ReactNode }) {
  const s = useDocsStyles();
  return <div className={s.narrativePara}>{children}</div>;
}

// =============== Cinematic Home Hero ===============
const useHeroStyles = makeStyles({
  wrap: {
    position: "relative",
    margin: "-32px -48px 28px",
    minHeight: "360px",
    padding: "64px 64px 56px",
    color: "#FFFFFF",
    overflow: "hidden",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  bg: {
    position: "absolute",
    inset: 0,
    backgroundImage: "url('/images/adp/hero1.webp')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "saturate(1.05)",
    zIndex: 0,
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(135deg, rgba(15,98,254,0.85) 0%, rgba(92,46,145,0.85) 60%, rgba(0,157,154,0.75) 100%)",
    zIndex: 1,
  },
  inner: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "920px",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "12px",
  },
  brandBadge: {
    padding: "4px 12px",
    borderRadius: "14px",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    border: "1px solid rgba(255,255,255,0.35)",
  },
  brandLogo: {
    height: "32px",
    width: "auto",
    objectFit: "contain",
  },
  title: { fontSize: "48px", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-1px", color: "#FFFFFF" },
  lead: { fontSize: "18px", lineHeight: 1.55, color: "rgba(255,255,255,0.95)", maxWidth: "780px", marginTop: "10px" },
  chips: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "20px" },
  chip: {
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 500,
    backgroundColor: "rgba(255,255,255,0.16)",
    color: "#FFFFFF",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.32)",
  },
  partnerRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "22px",
    paddingTop: "16px",
    borderTop: "1px solid rgba(255,255,255,0.22)",
    flexWrap: "wrap",
  },
  partnerLabel: { fontSize: "11px", color: "rgba(255,255,255,0.85)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: 600 },
  partnerTile: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 14px",
    backgroundColor: "#FFFFFF",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  },
  partnerLogo: { height: "22px", width: "auto", objectFit: "contain", display: "block" },
});

export interface HomeHeroProps {
  eyebrow: string;
  title: string;
  lead: string;
  chips?: string[];
}

export function HomeHero({ eyebrow, title, lead, chips }: HomeHeroProps) {
  const h = useHeroStyles();
  return (
    <div className={h.wrap}>
      <div className={h.bg} />
      <div className={h.overlay} />
      <div className={h.inner}>
        <div className={h.brandRow}>
          <span className={h.brandBadge}>{eyebrow}</span>
          <img src="/images/adp/adp-logo.webp" alt="" className={h.brandLogo} />
        </div>
        <h1 className={h.title}>{title}</h1>
        <p className={h.lead}>{lead}</p>
        {chips && chips.length > 0 && (
          <div className={h.chips}>
            {chips.map((c) => <span key={c} className={h.chip}>{c}</span>)}
          </div>
        )}
        <div className={h.partnerRow}>
          <span className={h.partnerLabel}>Co-built by</span>
          <span className={h.partnerTile}>
            <img src="/images/ibm-logo.png" alt="IBM Consulting" className={h.partnerLogo} />
          </span>
          <span className={h.partnerTile}>
            <img src="/images/ms-logo.png" alt="Microsoft" className={h.partnerLogo} />
          </span>
        </div>
      </div>
    </div>
  );
}

// =============== Theme-aware image (light/dark variants) ===============
export function ThemeImage({ light, dark, alt }: { light: string; dark: string; alt: string }) {
  const { mode } = useThemeMode();
  return (
    <img
      src={mode === "dark" ? dark : light}
      alt={alt}
      style={{ width: "100%", height: "auto", borderRadius: "8px", display: "block", border: `1px solid ${tokens.colorNeutralStroke2}` }}
    />
  );
}

// =============== Footer ===============
const useFooterStyles = makeStyles({
  wrap: {
    marginTop: "60px",
    paddingTop: "28px",
    paddingBottom: "20px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    alignItems: "center",
  },
  row: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", justifyContent: "center" },
  logoTile: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 12px",
    borderRadius: "6px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  logo: { height: "18px", width: "auto", objectFit: "contain", display: "block" },
  text: { fontSize: "11px", color: tokens.colorNeutralForeground3, letterSpacing: "0.5px" },
});

export function DocsFooter() {
  const f = useFooterStyles();
  return (
    <div className={f.wrap}>
      <div className={f.row}>
        <span className={f.logoTile}>
          <img src="/images/ibm-logo.png" alt="IBM" className={f.logo} />
        </span>
        <span className={f.text}>Project ADP · v1.0 · 2026-05-29</span>
        <span className={f.logoTile}>
          <img src="/images/ms-logo.png" alt="Microsoft" className={f.logo} />
        </span>
      </div>
      <div className={f.text}>Co-built by IBM Consulting + Microsoft · Microsoft-native agentic platform for frontier insurance firms</div>
    </div>
  );
}
