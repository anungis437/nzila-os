/**
 * ARTIFACT TYPE: Revenue Architecture
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * ICRA Revenue Tiers — institutional naming, not SaaS vocabulary.
 *
 * Three tiers reflect institutional seriousness rather than feature ladders.
 * The free tier (Continuity Reflection) is designed to awaken, not to satisfy.
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
    name: 'Continuity Reflection',
    tagline: 'A structured look at where your institution stands.',
    priceLabel: 'Complimentary',
    includes: [
      'Continuity Band (OCI level) and Operational Pattern sublabel',
      'Composite Continuity Indicator',
      'Cross-dimensional continuity insights (2–3)',
      'Continuity Signals Observed',
      'Stewardship Signals',
      'Continuity Burden Index score and interpretation',
      'Section observations summary',
      'First recommended next step',
      'OCI institutional motif',
    ],
    excludes: [
      'Governance Entropy Analysis',
      'Continuity Debt Analysis',
      'Institutional Dependency Review',
      'Modernization Risk Layer',
      'Full Transformation Recommendations',
      'Executive Stewardship Reflections',
      'Full Continuity Burden Index — human compensation indicators',
    ],
    ctaLabel: 'Assess Institutional Continuity Risk',
    ctaHref: '/continuity-assessment/start',
  },

  executive_continuity_brief: {
    id: 'executive_continuity_brief',
    name: 'Executive Continuity Brief',
    tagline:
      'A board-grade analysis of your continuity posture, for leadership conversations that require evidence.',
    priceLabel: '$750–$1,500 CAD',
    includes: [
      'Everything in the Continuity Reflection',
      'Governance Entropy Analysis — continuity drift indicators and governance inconsistency patterns',
      'Continuity Debt Analysis — invisible continuity burden and reconstruction risk',
      'Institutional Dependency Review — operational dependency concentration and knowledge holder map',
      'Modernization Risk Layer — continuity-safe modernization review and fragmentation risk profile',
      'Full Transformation Recommendations — immediate, medium-term, and transformational',
      'Executive Stewardship Reflections — institutional obligations and governance posture',
      'Full Continuity Burden Index with human compensation indicators',
    ],
    excludes: [
      'Facilitated leadership review session',
      'Governance continuity workshop',
      'Operational lineage mapping',
      'Institutional dependency interviews',
      'Executive continuity briefing presentation',
    ],
    ctaLabel: 'Request the Executive Continuity Brief',
    ctaHref: '/contact?topic=executive-continuity-brief',
  },

  institutional_continuity_diagnostic: {
    id: 'institutional_continuity_diagnostic',
    name: 'Institutional Continuity Diagnostic',
    tagline:
      'A facilitated institutional review for organizations ready to act on what they have learned.',
    priceLabel: '$3,500–$7,500 CAD',
    includes: [
      'Everything in the Executive Continuity Brief',
      'Facilitated leadership continuity review session',
      'Governance continuity workshop with governance body',
      'Operational lineage mapping — institutional memory and continuity chain',
      'Institutional dependency analysis — structured review of continuity holders',
      'Executive continuity briefing — deliverable for board presentation',
    ],
    excludes: [],
    ctaLabel: 'Open an Institutional Continuity Diagnostic conversation',
    ctaHref: '/contact?topic=institutional-continuity-diagnostic',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Gating helpers — used by ICRAProfile and ICRAReportGate
// ─────────────────────────────────────────────────────────────────────────────

/** Section IDs visible in Continuity Reflection (free) */
export const REFLECTION_SECTIONS = [
  'insights',
  'continuity_signals',
  'stewardship_signals',
  'burden_index_summary',
  'band_and_composite',
  'section_observations',
  'first_recommendation',
] as const;

/** Sections unlocked in Executive Continuity Brief */
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
