/**
 * Workbook \u2192 HubSpot property mapper.
 *
 * ANTI-SURVEILLANCE CONTRACT
 * ---------------------------
 * Only deterministic, aggregated continuity intelligence flows to CRM.
 * Holder names, responsibilities, and notes NEVER leave the workbook DB.
 * Every property below is a count, band, score, or stage identifier.
 *
 * If you find yourself wanting to add `oci_holder_*` fields, stop. That
 * would breach Product 2\u2019s positioning and the network-tier consent model.
 */

import type { CartographyResult } from '@/lib/workbook/engines/stewardshipCartography';

export const WORKBOOK_TIER_LABELS = {
  workbook_self_guided: 'Self-Guided Workbook',
  workbook_facilitated: 'Facilitated Workbook',
  workbook_enterprise: 'Enterprise Continuity Engagement',
} as const;

export type WorkbookTierKey = keyof typeof WORKBOOK_TIER_LABELS;

/** Internal deal-stage keys. Map to env-driven HubSpot stage ids in syncWorkbookPurchase. */
export const WORKBOOK_DEAL_STAGE_LABELS = {
  workbook_self_guided_purchased: 'Self-Guided Workbook \u2014 Purchased',
  workbook_facilitated_interest: 'Facilitated Workbook \u2014 Interest',
  workbook_enterprise_inquiry: 'Enterprise Continuity \u2014 Inquiry',
} as const;

export type WorkbookDealStageKey = keyof typeof WORKBOOK_DEAL_STAGE_LABELS;

/** Resolve HubSpot stage ids from env, with safe fallback identifiers. */
export const WORKBOOK_DEAL_STAGES: Record<WorkbookDealStageKey, string> = {
  workbook_self_guided_purchased:
    process.env.HUBSPOT_PIPELINE_STAGE_WORKBOOK_SELF_GUIDED_PURCHASED ??
    'workbook_self_guided_purchased',
  workbook_facilitated_interest:
    process.env.HUBSPOT_PIPELINE_STAGE_WORKBOOK_FACILITATED_INTEREST ??
    'workbook_facilitated_interest',
  workbook_enterprise_inquiry:
    process.env.HUBSPOT_PIPELINE_STAGE_WORKBOOK_ENTERPRISE_INQUIRY ??
    'workbook_enterprise_inquiry',
};

export interface WorkbookAttribution {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
}

/**
 * Build CONTACT-level properties for a workbook buyer.
 * All values are strings (HubSpot custom property convention).
 */
export function buildWorkbookContactProperties(input: {
  tier: WorkbookTierKey;
  attribution?: WorkbookAttribution;
}): Record<string, string> {
  const props: Record<string, string> = {
    oci_workbook_tier: WORKBOOK_TIER_LABELS[input.tier],
  };
  if (input.attribution?.source) props.oci_utm_source = input.attribution.source;
  if (input.attribution?.medium) props.oci_utm_medium = input.attribution.medium;
  if (input.attribution?.campaign) props.oci_utm_campaign = input.attribution.campaign;
  return props;
}

/**
 * Build COMPANY-level properties from cartography aggregates.
 * Called once a workbook has been claimed AND has cartography results.
 */
export function buildWorkbookCompanyProperties(input: {
  cartography: CartographyResult;
  modulesComplete: number;
  totalModules: number;
  lastActivityAt?: Date | null;
}): Record<string, string> {
  const { density } = input.cartography;
  const props: Record<string, string> = {
    oci_stewardship_concentration_index: density.index.toFixed(2),
    oci_stewardship_concentration_band: density.band.id,
    oci_continuity_carrier_count: String(density.totalCarriers),
    oci_load_bearing_carriers: String(density.loadBearingCount),
    oci_load_bearing_without_successor: String(density.unsuccessedLoadBearingCount),
    oci_institution_critical_carriers: String(density.institutionCriticalCount),
    oci_institution_critical_without_successor: String(density.unsuccessedInstitutionCriticalCount),
    oci_workbook_modules_complete: `${input.modulesComplete} / ${input.totalModules}`,
  };
  if (input.lastActivityAt) {
    props.oci_workbook_last_activity_at = input.lastActivityAt.toISOString();
  }
  return props;
}

/** Resolve the deal-stage for a workbook tier purchase. */
export function workbookTierToStage(tier: WorkbookTierKey): WorkbookDealStageKey {
  switch (tier) {
    case 'workbook_self_guided':
      return 'workbook_self_guided_purchased';
    case 'workbook_facilitated':
      return 'workbook_facilitated_interest';
    case 'workbook_enterprise':
    default:
      return 'workbook_enterprise_inquiry';
  }
}
