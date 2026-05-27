/**
 * ARTIFACT TYPE: Revenue Architecture
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * ICRA Revenue Tiers — organizational naming, not SaaS vocabulary.
 *
 * Three tiers reflect organizational seriousness rather than feature ladders.
 * The free tier (Free Readiness Check) is designed to awaken, not to satisfy.
 * Gating is calm and non-coercive. No scarcity language. No urgency tactics.
 *
 * Report delivery is via conversation (contact form) in this sprint.
 * Stripe integration is a future phase.
 */

import type { ReportTierId } from './types';

export interface ReportTierDefinition {
  id: ReportTierId;
  name: string;
  tagline: string;
  priceLabel: string;
  /** What the free tier includes */
  includes: string[];
  /** What is gated (shown as locked sections in the profile) */
  excludes: string[];
  ctaLabel: string;
  ctaHref: string;
}

export const REPORT_TIERS: Record<ReportTierId, ReportTierDefinition> = {
  continuity_reflection: {
    id: 'continuity_reflection',
    name: 'Free Readiness Check',
    tagline: 'A structured look at where your organization stands.',
    priceLabel: 'Free',
    includes: [
      'Continuity Band (OCI level) and Operational Pattern sublabel',
      'Composite Continuity Indicator',
      'Cross-dimensional continuity insights (2–3)',
      'Continuity Signals Observed',
      'Stewardship Signals',
      'Continuity Burden Index score and interpretation',
      'Section observations summary',
      'First recommended next step',
      'OCI organizational motif',
    ],
    excludes: [
      'Governance Entropy Analysis',
      'Continuity Debt Analysis',
      'Organizational Dependency Review',
      'Modernization Risk Layer',
      'Full Transformation Recommendations',
      'Executive Stewardship Reflections',
      'Full Continuity Burden Index — human compensation indicators',
    ],
    ctaLabel: 'Take the 10-minute readiness check',
    ctaHref: '/continuity-assessment/start',
  },

  executive_continuity_brief: {
    id: 'executive_continuity_brief',
    name: 'Leadership Briefing Report',
    tagline:
      'An evidence-backed report for leadership conversations that need more than a gut feel.',
    priceLabel: '$1,200 CAD',
    includes: [
      'Everything in the Free Readiness Check',
      'Governance Entropy Analysis — continuity drift indicators and governance inconsistency patterns',
      'Continuity Debt Analysis — invisible continuity burden and reconstruction risk',
      'Organizational Dependency Review — operational dependency concentration and knowledge holder map',
      'Modernization Risk Layer — continuity-safe modernization review and fragmentation risk profile',
      'Full Transformation Recommendations — immediate, medium-term, and transformational',
      'Executive Stewardship Reflections — organizational obligations and governance posture',
      'Full Continuity Burden Index with human compensation indicators',
    ],
    excludes: [
      'Facilitated leadership review session',
      'Governance continuity workshop',
      'Operational lineage mapping',
      'Organizational dependency interviews',
      'Executive continuity briefing presentation',
    ],
    ctaLabel: 'Request the Leadership Briefing Report',
    ctaHref: '/contact?topic=executive-continuity-brief',
  },

  institutional_continuity_diagnostic: {
    id: 'institutional_continuity_diagnostic',
    name: 'Full Diagnostic & Action Plan',
    tagline:
      'A guided review for organizations ready to act on what they’ve learned.',
    priceLabel: '$6,500 CAD',
    includes: [
      'Everything in the Leadership Briefing Report',
      'Facilitated leadership continuity review session',
      'Governance continuity workshop with governance body',
      'Operational lineage mapping — organizational memory and continuity chain',
      'Organizational dependency analysis — structured review of continuity holders',
      'Executive continuity briefing — deliverable for board presentation',
    ],
    excludes: [],
    ctaLabel: 'Start a Full Diagnostic conversation',
    ctaHref: '/contact?topic=institutional-continuity-diagnostic',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// P2 — Governance Entropy Workbook™ tiers
// Canonical per docs/oci/oci-product-ladder.md. Pricing is flat; no ranges.
// ─────────────────────────────────────────────────────────────────────────────

export type WorkbookTierId =
  | 'workbook_self_guided'
  | 'workbook_facilitated'
  | 'workbook_enterprise';

export interface WorkbookTierDefinition {
  id: WorkbookTierId;
  name: string;
  tagline: string;
  priceLabel: string;
  amountCents: number | null;
  currency: 'CAD';
  includes: string[];
  ctaLabel: string;
  ctaHref: string;
  /** Self-serve checkout supported. Enterprise/Facilitated are sales-led. */
  selfServe: boolean;
}

export const WORKBOOK_TIERS: Record<WorkbookTierId, WorkbookTierDefinition> = {
  workbook_self_guided: {
    id: 'workbook_self_guided',
    name: 'Governance Entropy Workbook — Self-Guided',
    tagline:
      'Map your organization\u2019s continuity terrain at your own pace. Begins with the people who carry the organization.',
    priceLabel: '$2,400 CAD',
    amountCents: 240000,
    currency: 'CAD',
    includes: [
      'Six-module continuity mapping workbook',
      'Organizational Memory Holders module \u2014 fully unlocked',
      'Stewardship Density Index\u2122 analysis',
      'Continuity Burden Map\u2122 visualization',
      'Executive PDF export with cover, table of contents, and unlocked chapters',
      'Workbook claimable to your account post-purchase',
      'Other five modules visible and reserved for the Facilitated Edition',
    ],
    ctaLabel: 'Begin Workbook',
    ctaHref: '/workbook/start',
    selfServe: true,
  },

  workbook_facilitated: {
    id: 'workbook_facilitated',
    name: 'Governance Entropy Workbook — Facilitated Organizational Edition',
    tagline:
      'A facilitated mapping engagement that unlocks all six modules with a stewardship lead.',
    priceLabel: '$8,500 CAD',
    amountCents: 850000,
    currency: 'CAD',
    includes: [
      'Everything in the Self-Guided Workbook',
      'All six modules unlocked: Continuity Landscape, Memory Holders, Governance Lineage, Continuity Breakpoints, Modernization Alignment, Transformation Roadmap',
      'Two facilitated continuity mapping sessions with a stewardship lead',
      'Governance Entropy Scale\u2122 calibration',
      'Continuity Survivability Matrix\u2122 review',
      'Executive PDF export with all chapters and stewardship commentary',
    ],
    ctaLabel: 'Speak with a stewardship lead',
    ctaHref: '/contact?topic=workbook-facilitated',
    selfServe: false,
  },

  workbook_enterprise: {
    id: 'workbook_enterprise',
    name: 'Governance Entropy Workbook — Enterprise Continuity Mapping',
    tagline:
      'A full continuity mapping engagement for organizations with federated structures or distributed stewardship.',
    priceLabel: '$18,000 \u2013 $45,000 CAD',
    amountCents: null,
    currency: 'CAD',
    includes: [
      'Everything in the Facilitated Edition',
      'Multi-unit continuity mapping across federated or distributed structures',
      'On-site or hybrid facilitation',
      'Reconstruction Burden Index\u2122 quantification',
      'Board-ready executive briefing',
      'Transition into the OCI Diagnostic (P3) where appropriate',
    ],
    ctaLabel: 'Discuss continuity mapping engagement',
    ctaHref: '/contact?topic=workbook-enterprise',
    selfServe: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Gating helpers — used by ICRAProfile and ICRAReportGate
// ─────────────────────────────────────────────────────────────────────────────

/** Section IDs visible in Free Readiness Check (free) */
export const REFLECTION_SECTIONS = [
  'insights',
  'continuity_signals',
  'stewardship_signals',
  'burden_index_summary',
  'band_and_composite',
  'section_observations',
  'first_recommendation',
] as const;

/** Sections unlocked in Leadership Briefing Report */
export const BRIEF_SECTIONS = [
  ...REFLECTION_SECTIONS,
  'governance_entropy',
  'continuity_debt',
  'dependency_review',
  'modernization_risk',
  'full_recommendations',
  'stewardship_reflections',
  'burden_index_full',
] as const;

export type ReflectionSection = (typeof REFLECTION_SECTIONS)[number];
export type BriefSection = (typeof BRIEF_SECTIONS)[number];

export function isSectionVisible(
  section: string,
  tierId: ReportTierId,
): boolean {
  if (tierId === 'institutional_continuity_diagnostic') return true;
  if (tierId === 'executive_continuity_brief')
    return (BRIEF_SECTIONS as readonly string[]).includes(section);
  return (REFLECTION_SECTIONS as readonly string[]).includes(section);
}

export function getCtaForTier(tierId: ReportTierId): { label: string; href: string } {
  const tier = REPORT_TIERS[tierId];
  return { label: tier.ctaLabel, href: tier.ctaHref };
}
