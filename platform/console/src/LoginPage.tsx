import { useState, type FormEvent } from "react";
import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Title2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Person24Regular,
  LockClosed24Regular,
  ArrowRight20Regular,
  ShieldError16Regular,
} from "@fluentui/react-icons";
import { useAuth } from "./AuthContext";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    backgroundColor: "#000000",
  },
  // ── Left brand panel — cinematic hero ──────────────────────────
  brandPanel: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    minHeight: "100vh",
    backgroundColor: "#0b1220",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandBg: {
    position: "absolute",
    inset: 0,
    backgroundImage: "url('/images/adp/pi-poster2.webp')",
    backgroundSize: "contain",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
    backgroundColor: "#0b1220",
    zIndex: 0,
    opacity: 1,
  },
  brandOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(11,18,32,0.10) 0%, rgba(11,18,32,0.05) 50%, rgba(11,18,32,0.45) 100%)",
    zIndex: 1,
  },
  brandContent: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "48px",
    maxWidth: "640px",
  },
  brandLogo: {
    width: "104px",
    height: "104px",
    objectFit: "cover",
    borderRadius: "20px",
    marginBottom: "28px",
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  brandEyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.92)",
    padding: "5px 14px",
    border: "1px solid rgba(255,255,255,0.4)",
    borderRadius: "14px",
    marginBottom: "20px",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  brandTitle: {
    fontSize: "52px",
    fontWeight: 800,
    color: "#FFFFFF",
    letterSpacing: "-1px",
    lineHeight: 1.05,
    marginBottom: "16px",
  },
  brandLead: {
    fontSize: "17px",
    color: "rgba(255,255,255,0.92)",
    lineHeight: 1.55,
    maxWidth: "520px",
  },
  brandFooter: {
    position: "absolute",
    bottom: "24px",
    left: 0,
    right: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    fontSize: "11px",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    fontWeight: 600,
    flexWrap: "wrap",
  },
  brandFooterTile: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    backgroundColor: "#FFFFFF",
    borderRadius: "6px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
  },
  brandFooterLogo: { height: "18px", objectFit: "contain", display: "block" },
  restrictedRibbon: {
    position: "absolute",
    top: "24px",
    right: "24px",
    padding: "6px 14px",
    backgroundColor: "rgba(218, 30, 40, 0.92)",
    color: "#FFFFFF",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow8,
    backdropFilter: "blur(6px)",
    zIndex: 3,
  },
  // ── Right form panel ───────────────────────────────────────────
  formPanel: {
    width: "480px",
    minWidth: "360px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "48px",
    backgroundColor: tokens.colorNeutralBackground1,
    position: "relative",
    boxShadow: "-16px 0 48px rgba(0,0,0,0.25)",
  },
  accentStripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "4px",
    background: `linear-gradient(180deg, ${tokens.colorBrandBackground} 0%, #8A3FFC 100%)`,
  },
  formContent: { maxWidth: "360px", width: "100%" },
  coBrandPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "36px",
    padding: "6px 14px",
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorBrandStroke2}`,
    borderRadius: tokens.borderRadiusCircular,
  },
  coBrandDivider: { color: tokens.colorNeutralStroke2, fontSize: "14px", fontWeight: 200 },
  versionBadge: {
    display: "inline-block",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: tokens.colorPaletteGreenForeground1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
    padding: "3px 10px",
    borderRadius: "12px",
    marginLeft: "10px",
    verticalAlign: "middle",
  },
  subtitleBlue: { color: tokens.colorBrandForeground1, fontWeight: tokens.fontWeightSemibold },
  formFields: { display: "flex", flexDirection: "column", gap: "20px", marginBottom: "24px" },
  fullWidthInput: { width: "100%" },
  continueButton: { width: "100%", marginTop: "8px" },
  footerNote: {
    marginTop: "36px",
    paddingTop: "16px",
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
});

// Hide the brand panel on mobile (Griffel doesn't compose @media nicely with classnames)
const responsiveCss = `
  @media (max-width: 900px) {
    .adp-v1-brand-panel { display: none !important; }
    .adp-v1-form-panel { width: 100% !important; min-width: unset !important; box-shadow: none !important; }
  }
`;

export function LoginPage() {
  const styles = useStyles();
  const { login } = useAuth();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Small artificial delay so the auth check feels deliberate.
    setTimeout(() => {
      const ok = login(user, pass);
      if (!ok) {
        setError("Invalid username or password.");
        setLoading(false);
        return;
      }
      // Force navigation to the welcome page BEFORE letting the parent re-render.
      // Setting the hash here fires hashchange and is already in place when
      // Shell unmounts the LoginPage and mounts the ProjectPortal.
      window.location.hash = "project/hub";
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      setLoading(false);
    }, 350);
  };

  return (
    <div className={styles.root}>
      <div className={`${styles.brandPanel} adp-v1-brand-panel`}>
        <div className={styles.brandBg} />
        <div className={styles.brandOverlay} />
        <div className={styles.restrictedRibbon}>IBM Internal · Restricted</div>
      </div>

      <div className={`${styles.formPanel} adp-v1-form-panel`}>
        <div className={styles.accentStripe} />

        <div className={styles.formContent}>
          <div className={styles.coBrandPill}>
            <img src="/images/ibm-logo.png" alt="IBM" style={{ height: "14px" }} />
            <span className={styles.coBrandDivider}>|</span>
            <img src="/images/ms-logo.png" alt="Microsoft" style={{ height: "12px" }} />
          </div>

          <Title2 as="h2" block style={{ marginBottom: "6px" }}>
            Sign in
          </Title2>
          <Body1 block style={{ marginBottom: "6px" }}>
            Project <span className={styles.subtitleBlue}>ADP</span>
            <span className={styles.versionBadge}>v1.0</span>
          </Body1>
          <Caption1 block style={{ marginBottom: "32px", color: tokens.colorNeutralForeground3 }}>
            Operator console · Docs portal · Project portal · Studio
          </Caption1>

          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formFields}>
              <Field label="Username" required size="large">
                <Input
                  type="text"
                  value={user}
                  onChange={(_, data) => setUser(data.value)}
                  placeholder="Enter your username"
                  contentBefore={<Person24Regular />}
                  autoFocus
                  required
                  size="large"
                  className={styles.fullWidthInput}
                  disabled={loading}
                />
              </Field>

              <Field label="Password" required size="large">
                <Input
                  type="password"
                  value={pass}
                  onChange={(_, data) => setPass(data.value)}
                  placeholder="Enter your password"
                  contentBefore={<LockClosed24Regular />}
                  required
                  size="large"
                  className={styles.fullWidthInput}
                  disabled={loading}
                />
              </Field>
            </div>

            {error && (
              <MessageBar intent="error" style={{ marginBottom: "16px" }}>
                <MessageBarBody>
                  <ShieldError16Regular style={{ verticalAlign: "text-bottom", marginRight: "6px" }} />
                  {error}
                </MessageBarBody>
              </MessageBar>
            )}

            <Button
              type="submit"
              appearance="primary"
              size="large"
              disabled={loading || !user.trim() || !pass}
              icon={loading ? <Spinner size="tiny" /> : <ArrowRight20Regular />}
              iconPosition="after"
              className={styles.continueButton}
            >
              {loading ? "Signing in…" : "Continue"}
            </Button>
          </form>

          <div className={styles.footerNote}>
            <Caption1 block style={{ color: tokens.colorNeutralForeground3, lineHeight: 1.55 }}>
              Access is restricted to the Project ADP working group. Solo-built reference build
              of the platform thesis — anything you drive here is real, running, and logged. Use
              responsibly.
            </Caption1>
          </div>
        </div>
      </div>

      <style>{responsiveCss}</style>
    </div>
  );
}
