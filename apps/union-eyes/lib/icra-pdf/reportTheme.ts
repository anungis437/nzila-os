/**
 * ARTIFACT TYPE: PDF Design System
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * Executive Continuity Brief — Report Theme
 *
 * Institutional palette. Editorial hierarchy. Calm materiality.
 *
 * Visual references: public inquiry reports, governance briefings,
 * editorial strategic publications, calm public-interest design.
 *
 * NOT: startup gradients, dashboard exports, analytics aesthetics.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Color System — institutional, trustworthy, calm
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  // Text hierarchy — warm near-blacks, not cold pure blacks
  ink: '#1C1917',         // Primary text — stone-900
  ink60: '#57534E',       // Secondary text — stone-600
  ink40: '#78716C',       // Tertiary text — stone-500
  ink20: '#A8A29E',       // Muted text — stone-400

  // Structural — surfaces and dividers
  paper: '#FAFAF8',       // Page background — warm off-white
  surface: '#F5F5F4',     // Section background — stone-100
  surfaceDark: '#E7E5E4', // Subtle block — stone-200
  border: '#D6D3D1',      // Divider — stone-300
  borderLight: '#E7E5E4', // Subtle divider — stone-200

  // Brand — institutional, not startup
  navy: '#1B3A5C',        // Deep institutional blue — headings, emphasis
  navyLight: '#2D5382',   // Lighter navy — pull quotes
  teal: '#6B8F87',        // Muted teal — positive indicators, bars
  tealLight: '#A8C4BF',   // Light teal — low-emphasis bars

  // Risk/burden palette — muted, not alarming
  rust: '#7D5A5A',        // Muted rust — elevated burden, risk signals
  rustLight: '#C4A4A4',   // Light rust — low-risk indicators
  amber: '#8A7840',       // Warm amber — moderate attention signals
  amberLight: '#C5B87A',  // Light amber — moderate bars

  // Accent — used sparingly
  gold: '#9A8A6A',        // Warm gold — section ornaments, page footers
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography — editorial hierarchy, institutional readability
// ─────────────────────────────────────────────────────────────────────────────

/** Built-in React-PDF fonts — reliable, zero external dependency */
export const FONTS = {
  serif: 'Times-Roman',
  serifBold: 'Times-Bold',
  serifItalic: 'Times-Italic',
  sans: 'Helvetica',
  sansBold: 'Helvetica-Bold',
  sansOblique: 'Helvetica-Oblique',
} as const;

export const TYPE = {
  // Cover page
  coverOciLabel: { fontSize: 9, letterSpacing: 2 },
  coverTitle: { fontSize: 34 },
  coverSubtitle: { fontSize: 13 },
  coverInstitution: { fontSize: 20 },
  coverBand: { fontSize: 16 },
  coverPattern: { fontSize: 10 },
  coverMotif: { fontSize: 11 },

  // Section structure
  sectionLabel: { fontSize: 8, letterSpacing: 1.8 },  // caps label
  sectionHeading: { fontSize: 18 },
  subsectionHeading: { fontSize: 12 },
  pullQuote: { fontSize: 13 },

  // Body
  body: { fontSize: 10, lineHeight: 1.6 },
  bodySmall: { fontSize: 9, lineHeight: 1.5 },
  caption: { fontSize: 8, lineHeight: 1.4 },

  // Specialized
  compositeScore: { fontSize: 52 },
  bandLabel: { fontSize: 14 },
  signalLabel: { fontSize: 9.5 },
  footerText: { fontSize: 7.5 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing — generous whitespace, calm pacing
// ─────────────────────────────────────────────────────────────────────────────

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
  section: 32,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Page geometry — A4, institutional margins
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE = {
  size: 'A4' as const,
  marginTop: 52,
  marginBottom: 52,
  marginLeft: 56,
  marginRight: 56,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Burden level → visual color mapping
// ─────────────────────────────────────────────────────────────────────────────

export function burdenColor(score: number): string {
  if (score >= 75) return COLORS.rust;
  if (score >= 50) return COLORS.amber;
  if (score >= 30) return COLORS.teal;
  return COLORS.tealLight;
}

export function burdenLabel(score: number): string {
  if (score >= 75) return 'Elevated';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Managed';
  return 'Low';
}

/** Score (0–100) → bar fill color for dimension spectrums */
export function dimensionBarColor(score: number): string {
  if (score >= 70) return COLORS.teal;
  if (score >= 45) return COLORS.amber;
  return COLORS.rust;
}

/** Dimension name → readable label for the PDF */
export const DIMENSION_LABELS: Record<string, string> = {
  institutional_continuity: 'Institutional Continuity',
  governance_fragility: 'Governance Fragility',
  trust_debt: 'Evidence & Traceability',
  operational_memory: 'Operational Memory',
  transition_readiness: 'Transition Readiness',
};

/** Section name → readable label for the PDF */
export const SECTION_LABELS: Record<string, string> = {
  organizational_context: 'Organizational Context',
  operational_dependency: 'Operational Dependency',
  governance_visibility: 'Governance Visibility',
  institutional_memory: 'Institutional Memory',
  transition_readiness: 'Transition Readiness',
  operational_coordination: 'Operational Coordination',
  explainability_trust: 'Explainability & Trust',
  sovereignty_governance: 'Sovereignty & Governance',
};
