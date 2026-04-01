/**
 * PeopleFlow Onyx — Unified Design System Tokens
 * ================================================
 * Source: Google Stitch MCP "PeopleFlow Onyx" generation
 * Scope:  All Tenant Dashboard pages (billing, plans, API keys, settings)
 *
 * RULE: Every client-facing page under `(dashboard)/` MUST import from
 *       this single token file. Do NOT define inline `const T = {...}`.
 */

export const tokens = {
    /* ── Surface Hierarchy (Glass-on-deep-navy) ── */
    surface:                "#0d1322",
    surfaceContainer:       "#191f2f",
    surfaceContainerLow:    "#151b2b",
    surfaceContainerHigh:   "#242a3a",
    surfaceContainerHighest:"#2f3445",
    surfaceBright:          "#33394a",

    /* ── Text / On-Surface ── */
    onSurface:              "#dde2f7",
    onSurfaceVariant:       "#c1c6d7",

    /* ── Primary (Blue) ── */
    primary:                "#afc6ff",
    primaryContainer:       "#528dff",

    /* ── Secondary (Indigo) ── */
    secondary:              "#c0c1ff",
    secondaryContainer:     "#3131c0",

    /* ── Tertiary (Violet — Enterprise tier accents) ── */
    tertiary:               "#d0bcff",
    tertiaryContainer:      "#a078ff",

    /* ── Functional ── */
    outline:                "#8b90a0",
    outlineVariant:         "#414755",
    error:                  "#ffb4ab",
    errorContainer:         "#93000a",

    /* ── Status colors ── */
    success:                "#10B981",
    warning:                "#F59E0B",
    danger:                 "#EF4444",

    /* ── Amber (usage warnings) ── */
    amber:                  "#ffb695",
} as const;

/* ── Semantic shortcuts ── */
export type DesignTokens = typeof tokens;

/** Glassmorphism ambient shadow — use on cards and floating elements */
export const ambientShadow = "0 4px 20px 0 rgba(0,0,0,0.4), 0 0 1px 1px rgba(175,198,255,0.1)";

/** Subtle depth shadow — use on secondary cards */
export const depthShadow = "0 4px 20px 0 rgba(0,0,0,0.3)";

/** Ghost border for accessibility — outline-variant at controlled opacity */
export const ghostBorder = (opacity: number = 15) =>
    `1px solid ${tokens.outlineVariant}${Math.round((opacity / 100) * 255).toString(16).padStart(2, "0")}`;
