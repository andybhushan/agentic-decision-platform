// Categorical chart palette: one slot per digital worker, fixed order, never cycled.
// Both modes validated with the dataviz six-checks script on 2026-07-12
// (light on white, dark on #161616): lightness band, chroma floor, CVD adjacent
// separation >= 12, contrast vs surface >= 3:1 all PASS.

export const CATEGORICAL_LIGHT = ["#6929c4", "#1192e8", "#198038", "#9f1853", "#fa4d56"];
export const CATEGORICAL_DARK = ["#8a3ffc", "#1192e8", "#24a148", "#ee5396", "#fa4d56"];

// Single-series accent (trend lines): Carbon blue 60 / blue 50.
export const ACCENT_LIGHT = "#0f62fe";
export const ACCENT_DARK = "#4589ff";

// Color follows the entity: slots are assigned to package ids in stable sorted order,
// so a filter or a new window never repaints an existing series.
export function packageColorScale(packageIds: string[], mode: "light" | "dark" = "light"): Record<string, string> {
  const palette = mode === "dark" ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  const scale: Record<string, string> = {};
  [...packageIds].sort().forEach((id, i) => {
    scale[id] = palette[i % palette.length];
  });
  return scale;
}
