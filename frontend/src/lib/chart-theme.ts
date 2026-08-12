/**
 * Colours for recharts.
 *
 * Charts are drawn into SVG by a library that takes colour strings, not CSS
 * classes, so this is the second and last place in the frontend allowed to
 * hold a hex value — the first being the HTML emails, for the same underlying
 * reason (CLAUDE.md, ข้อห้าม 17).
 *
 * **These must stay identical to the tokens in globals.css.** If a token
 * changes there, change it here in the same commit.
 */
export const CHART_COLORS = {
  /** --color-primary */
  primary: "#1E3A5C",
  /** --color-secondary */
  secondary: "#C9A063",
  /** --color-border */
  grid: "#E5E7EB",
  /** --color-subtle */
  axis: "#9CA3AF",
  /** --color-card */
  surface: "#FFFFFF",
  /** --color-foreground */
  text: "#111827",
} as const;

/** Shared axis and grid props, so every chart in the system reads the same. */
export const CHART_AXIS_STYLE = {
  fontSize: 12,
  fill: CHART_COLORS.axis,
} as const;

/**
 * Tooltip chrome: a thin border and a flat surface, never a shadow
 * (CLAUDE.md, หัวข้อ 4).
 */
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.grid}`,
  borderRadius: 8,
  fontSize: 12,
  color: CHART_COLORS.text,
  boxShadow: "none",
} as const;
