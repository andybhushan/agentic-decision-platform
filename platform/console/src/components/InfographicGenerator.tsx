// Reusable component that generates an infographic via the GenerateInfographic Function.
// Drop it on any page; optionally pass a defaultPrompt, presets, defaultSize, etc.
//
// Usage:
//   <InfographicGenerator
//     title="Architecture poster"
//     defaultPrompt="..."
//     presets={[{ label: "...", prompt: "..." }]}
//     defaultSize="1536x1024"
//   />
//
// Requires OPENAI_API_KEY to be set as a Function app setting.

import { useState } from "react";
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  Dropdown,
  Option,
  Spinner,
  Textarea,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowDownload20Regular,
  Wand20Regular,
  ArrowReset20Regular,
  ImageMultiple20Regular,
  ErrorCircle20Regular,
} from "@fluentui/react-icons";

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
export type ImageQuality = "low" | "medium" | "high" | "auto";

export interface PromptPreset {
  label: string;
  prompt: string;
  description?: string;
  size?: ImageSize;
  quality?: ImageQuality;
}

export interface InfographicGeneratorProps {
  /** Section title shown above the studio. */
  title?: string;
  /** One-paragraph description shown under the title. */
  description?: string;
  /** Optional starting prompt the textarea opens with. */
  defaultPrompt?: string;
  /** Default size selection. */
  defaultSize?: ImageSize;
  /** Default quality selection. */
  defaultQuality?: ImageQuality;
  /** Optional preset library — click a preset to populate the prompt. */
  presets?: PromptPreset[];
  /** Filename stem for the download button (no extension). */
  downloadFilenameStem?: string;
  /** Override the API base URL (defaults to VITE_TRACES_API or the production Function). */
  apiBase?: string;
  /** Compact layout — collapses the description and uses smaller controls. */
  compact?: boolean;
}

interface GenerateResult {
  imageBase64: string;
  format: string;
  size: string;
  quality: string;
  generatedAt: number;
  durationMs: number;
}

const DEFAULT_API_BASE =
  (import.meta.env.VITE_TRACES_API as string | undefined) ??
  "https://func-adp-v1-fnol.azurewebsites.net/api";

const SIZE_OPTIONS: { id: ImageSize; label: string; hint: string }[] = [
  { id: "1024x1024", label: "Square · 1024 × 1024", hint: "social posts, thumbnails" },
  { id: "1024x1536", label: "Portrait · 1024 × 1536", hint: "report covers, posters" },
  { id: "1536x1024", label: "Landscape · 1536 × 1024", hint: "architecture posters, hero banners" },
  { id: "auto", label: "Auto", hint: "let the model choose" },
];

const QUALITY_OPTIONS: { id: ImageQuality; label: string; hint: string }[] = [
  { id: "low", label: "Low", hint: "fastest, draft quality" },
  { id: "medium", label: "Medium", hint: "balanced" },
  { id: "high", label: "High", hint: "production-ready" },
  { id: "auto", label: "Auto", hint: "let the model choose" },
];

const useStyles = makeStyles({
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: "12px",
    padding: "24px 26px",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  wrapCompact: { padding: "16px 18px", gap: "12px" },
  header: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" },
  headerIcon: {
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  headerText: { display: "flex", flexDirection: "column", gap: "2px", flex: 1 },
  description: { color: tokens.colorNeutralForeground2, fontSize: "13px", lineHeight: 1.55 },
  presetRow: { display: "flex", flexWrap: "wrap", gap: "8px" },
  presetChip: {
    fontSize: "12px",
    padding: "6px 12px",
    borderRadius: "14px",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    border: `1px solid ${tokens.colorBrandStroke2}`,
    cursor: "pointer",
    fontWeight: 500,
    transition: "background 80ms ease, transform 80ms ease",
    "&:hover": {
      backgroundColor: tokens.colorBrandBackgroundHover,
      transform: "translateY(-1px)",
    },
  },
  promptArea: { width: "100%" },
  controlRow: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" },
  controlField: { display: "flex", flexDirection: "column", gap: "4px", minWidth: "180px" },
  controlLabel: {
    fontSize: "10px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontWeight: 600,
    color: tokens.colorNeutralForeground3,
  },
  actionRow: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" },
  status: { display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: tokens.colorNeutralForeground3 },
  imageFrame: {
    marginTop: "8px",
    padding: "12px",
    borderRadius: "10px",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  image: {
    width: "100%",
    height: "auto",
    borderRadius: "6px",
    display: "block",
    backgroundColor: "#0b1220",
  },
  imageMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
    color: tokens.colorNeutralForeground3,
    fontSize: "11px",
  },
  errorBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "8px",
    backgroundColor: tokens.colorPaletteRedBackground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    color: tokens.colorPaletteRedForeground1,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  costNote: {
    fontSize: "11px",
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
});

function downloadBase64Png(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function InfographicGenerator(props: InfographicGeneratorProps) {
  const styles = useStyles();
  const apiBase = props.apiBase ?? DEFAULT_API_BASE;
  const [prompt, setPrompt] = useState<string>(props.defaultPrompt ?? "");
  const [size, setSize] = useState<ImageSize>(props.defaultSize ?? "1536x1024");
  const [quality, setQuality] = useState<ImageQuality>(props.defaultQuality ?? "high");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);

  const charCount = prompt.length;

  const generate = async () => {
    if (!prompt.trim()) {
      setError({ kind: "validation", message: "Prompt is required." });
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    const startedAt = Date.now();
    try {
      const resp = await fetch(`${apiBase}/generate/infographic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size, quality }),
      });
      const body = await resp.json().catch(() => ({ message: resp.statusText }));
      if (!resp.ok) {
        setError({
          kind: body?.error ?? `http_${resp.status}`,
          message: typeof body?.message === "string" ? body.message : JSON.stringify(body),
        });
        return;
      }
      if (!body?.imageBase64) {
        setError({ kind: "empty_response", message: "Function returned no image payload." });
        return;
      }
      setResult({
        imageBase64: body.imageBase64,
        format: body.format ?? "png",
        size: body.size ?? size,
        quality: body.quality ?? quality,
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt,
      });
    } catch (e) {
      setError({ kind: "network", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: PromptPreset) => {
    setPrompt(preset.prompt);
    if (preset.size) setSize(preset.size);
    if (preset.quality) setQuality(preset.quality);
    setError(null);
  };

  const clearAll = () => {
    setPrompt(props.defaultPrompt ?? "");
    setSize(props.defaultSize ?? "1536x1024");
    setQuality(props.defaultQuality ?? "high");
    setResult(null);
    setError(null);
  };

  const sizeOption = SIZE_OPTIONS.find((o) => o.id === size);
  const qualityOption = QUALITY_OPTIONS.find((o) => o.id === quality);
  const filenameStem = props.downloadFilenameStem ?? "infographic";

  return (
    <Card className={`${styles.wrap} ${props.compact ? styles.wrapCompact : ""}`}>
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <ImageMultiple20Regular />
        </div>
        <div className={styles.headerText}>
          <Title3>{props.title ?? "Infographic Studio"}</Title3>
          {!props.compact && (
            <Caption1 className={styles.description}>
              {props.description ??
                "Generate an infographic with OpenAI gpt-image-1. The prompt is sent through the Function app's GenerateInfographic endpoint so the API key stays server-side."}
            </Caption1>
          )}
        </div>
      </div>

      {props.presets && props.presets.length > 0 && (
        <div>
          <Caption1 className={styles.controlLabel} style={{ marginBottom: 6, display: "block" }}>
            Presets — click to load
          </Caption1>
          <div className={styles.presetRow}>
            {props.presets.map((p) => (
              <span
                key={p.label}
                className={styles.presetChip}
                onClick={() => applyPreset(p)}
                title={p.description ?? p.prompt.slice(0, 200) + "…"}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <Caption1 className={styles.controlLabel} style={{ marginBottom: 6, display: "block" }}>
          Prompt
        </Caption1>
        <Textarea
          className={styles.promptArea}
          value={prompt}
          onChange={(_, data) => setPrompt(data.value)}
          rows={props.compact ? 4 : 8}
          resize="vertical"
          placeholder="Describe the infographic — composition, palette, labels, style modifiers…"
          disabled={loading}
        />
        <Caption1 className={styles.costNote}>
          {charCount} / 4000 characters · gpt-image-1 · ~$0.25–0.50 per high-quality landscape image
        </Caption1>
      </div>

      <div className={styles.controlRow}>
        <div className={styles.controlField}>
          <Caption1 className={styles.controlLabel}>Size</Caption1>
          <Dropdown
            value={sizeOption?.label ?? size}
            selectedOptions={[size]}
            onOptionSelect={(_, data) => data.optionValue && setSize(data.optionValue as ImageSize)}
            disabled={loading}
          >
            {SIZE_OPTIONS.map((opt) => (
              <Option key={opt.id} value={opt.id} text={opt.label}>
                <div style={{ display: "flex", flexDirection: "column", padding: "2px 0" }}>
                  <Body1>{opt.label}</Body1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{opt.hint}</Caption1>
                </div>
              </Option>
            ))}
          </Dropdown>
        </div>

        <div className={styles.controlField}>
          <Caption1 className={styles.controlLabel}>Quality</Caption1>
          <Dropdown
            value={qualityOption?.label ?? quality}
            selectedOptions={[quality]}
            onOptionSelect={(_, data) => data.optionValue && setQuality(data.optionValue as ImageQuality)}
            disabled={loading}
          >
            {QUALITY_OPTIONS.map((opt) => (
              <Option key={opt.id} value={opt.id} text={opt.label}>
                <div style={{ display: "flex", flexDirection: "column", padding: "2px 0" }}>
                  <Body1>{opt.label}</Body1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{opt.hint}</Caption1>
                </div>
              </Option>
            ))}
          </Dropdown>
        </div>
      </div>

      <div className={styles.actionRow}>
        <Button
          appearance="primary"
          icon={loading ? <Spinner size="tiny" /> : <Wand20Regular />}
          onClick={generate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? "Generating…" : result ? "Regenerate" : "Generate"}
        </Button>
        <Button
          appearance="secondary"
          icon={<ArrowReset20Regular />}
          onClick={clearAll}
          disabled={loading}
        >
          Reset
        </Button>
        {result && (
          <Button
            appearance="secondary"
            icon={<ArrowDownload20Regular />}
            onClick={() => downloadBase64Png(result.imageBase64, `${filenameStem}-${result.size}-${result.quality}.png`)}
          >
            Download PNG
          </Button>
        )}
        {loading && (
          <div className={styles.status}>
            <Spinner size="tiny" />
            <span>~30–90 seconds for high quality at {size}…</span>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.errorBox}>
          <ErrorCircle20Regular style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <Body1 style={{ fontWeight: 600, marginBottom: 4 }}>Generation failed · {error.kind}</Body1>
            <Body1>{error.message}</Body1>
          </div>
        </div>
      )}

      {result && (
        <div className={styles.imageFrame}>
          <img
            src={`data:image/${result.format};base64,${result.imageBase64}`}
            alt="Generated infographic"
            className={styles.image}
          />
          <div className={styles.imageMeta}>
            <Badge appearance="outline" size="small">gpt-image-1</Badge>
            <Badge appearance="outline" size="small">{result.size}</Badge>
            <Badge appearance="outline" size="small">{result.quality}</Badge>
            <span>·</span>
            <span>Generated in {formatMs(result.durationMs)}</span>
            <span>·</span>
            <span>{new Date(result.generatedAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
