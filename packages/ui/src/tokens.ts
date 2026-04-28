/**
 * Nzila Design Language — canonical tokens.
 *
 * The single source of truth for spacing, type, radius, shadow, motion,
 * semantic color, chart palette, and per-product accent. Consumed in two
 * ways:
 *  1. As CSS variables exposed via `globals.css` (`@theme` + `:root`),
 *     so Tailwind utilities like `text-fg-muted` / `bg-surface-2`
 *     resolve consistently across every app.
 *  2. As TypeScript values for places that need numbers (chart libs,
 *     animation tweens, image sizing).
 *
 * Restraint rules — these tokens encode them:
 *  - One spacing scale (4-px base, 0..96).
 *  - One typography scale (eight steps).
 *  - Three radius sizes only.
 *  - Four elevation steps only.
 *  - Two motion durations (fast/normal) plus one hold-still option.
 *  - Six semantic surfaces (`bg`, `surface-1..3`, `overlay`, `inverse`).
 *  - Eight semantic foregrounds (default/muted/subtle/inverse/+4 status).
 *  - Eight chart slots designed for color-blind safe rotation.
 *
 * Anything beyond these tokens is a deliberate exception, not a default.
 */

export const space = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const

export const radius = {
  sm: '6px', // chips, badges
  md: '10px', // inputs, buttons
  lg: '14px', // cards, sheets
  xl: '20px', // dialogs
  full: '9999px',
} as const

export const elevation = {
  /** Inset / inline — no shadow, just a border. */
  flat: '0 0 0 1px rgb(0 0 0 / 0.05)',
  /** Default card. */
  low: '0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06)',
  /** Hover / popover / palette. */
  mid: '0 4px 6px -2px rgb(15 23 42 / 0.05), 0 8px 16px -4px rgb(15 23 42 / 0.08)',
  /** Modal / dialog. */
  high: '0 10px 15px -3px rgb(15 23 42 / 0.08), 0 20px 40px -10px rgb(15 23 42 / 0.16)',
} as const

export const motion = {
  /** Micro-interactions (hover, focus). Avoid for layout. */
  fast: '120ms',
  /** Standard transitions (panel show/hide, button press). */
  normal: '200ms',
  /** Easing — single curve, no bounce, no overshoot. */
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const

export const typography = {
  /** Inter for UI (display & body). System sans fallback. */
  fontSans:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  /** JetBrains Mono for code, IDs, numbers in tables. */
  fontMono:
    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  /** Tabular numerals for KPIs & money. Apply via class `tabular-nums`. */
  size: {
    xs: '11px', // metadata labels
    sm: '13px', // body small
    base: '14px', // body
    md: '16px', // section header lead
    lg: '18px', // page header lead
    xl: '24px', // KPI value
    '2xl': '32px', // hero KPI
    '3xl': '40px', // dashboard hero
  },
  /** Two weights only — Regular (450) and Semibold (600). */
  weight: { regular: 450, semibold: 600 },
  /** Compact line-heights — UI is a screen, not a book. */
  leading: { tight: 1.25, normal: 1.45, relaxed: 1.6 },
} as const

/**
 * Color-blind-safe categorical palette for charts and signal badges.
 * Order intentional: rotate sequentially. Tested against deuteranopia
 * (most common) so adjacent series stay distinguishable.
 */
export const chartPalette = [
  '#2563eb', // blue
  '#0891b2', // cyan
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#475569', // slate
  '#0f766e', // teal
] as const

/**
 * Semantic status colors. Use the *role*, never the hue. e.g. `text-status-warning`,
 * never `text-amber-600`. Mappings live in `globals.css` under `@theme`.
 */
export const statusRoles = ['ok', 'info', 'warning', 'critical', 'neutral'] as const
export type StatusRole = (typeof statusRoles)[number]

/**
 * Per-product accent layer. Each product keeps its identity through
 * `--accent` + `--accent-soft`. Apply with `data-product="zonga"` on
 * the root `<html>` (or the app's root layout `<div>`). The CSS layer
 * in `globals.css` flips the accent variables based on this attribute.
 *
 * Personality notes (from the portfolio brief):
 *  - hq:           executive premium — slate-900 with a single blue accent
 *  - console:      operator precision — neutral with a teal accent
 *  - union-eyes:   institutional credibility — deep navy
 *  - zonga:        vibrant cultural premium media — violet
 *  - veridian:     calm clinical trust — emerald
 *  - flow:         efficient commercial clarity — sky blue
 *  - agrimo:       grounded field confidence — moss/olive
 *  - first-stone:  procurement / governance — graphite + amber accent
 */
export const productAccent = {
  hq: { accent: '#1d4ed8', accentSoft: '#dbeafe' },
  console: { accent: '#0f766e', accentSoft: '#ccfbf1' },
  'union-eyes': { accent: '#1e3a8a', accentSoft: '#dbeafe' },
  zonga: { accent: '#7c3aed', accentSoft: '#ede9fe' },
  veridian: { accent: '#047857', accentSoft: '#d1fae5' },
  flow: { accent: '#0284c7', accentSoft: '#e0f2fe' },
  agrimo: { accent: '#4d7c0f', accentSoft: '#ecfccb' },
  'first-stone': { accent: '#b45309', accentSoft: '#fef3c7' },
} as const

export type ProductKey = keyof typeof productAccent

export const tokens = {
  space,
  radius,
  elevation,
  motion,
  typography,
  chartPalette,
  productAccent,
} as const

export type Tokens = typeof tokens
