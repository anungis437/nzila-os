/**
 * Quebec Break-Policy Defaults
 *
 * Generates LNT-minimum break policies for Quebec organizations.
 * These are meant to be inserted into the `break_policies` table when an
 * organization in QC is on-boarded and no CBA-specific break clause exists.
 *
 * @module quebec-break-defaults
 */

import type { NewBreakPolicy } from '@/db/schema';
import { LNT_BREAK_RULES, type LNTBreakRule } from './labour-law-engine';

/**
 * Convert an LNT rule to a break-policy insert row.
 * All values reflect the statutory MINIMUM — CBA-negotiated policies should
 * override them once uploaded.
 */
function lntRuleToPolicy(
  rule: LNTBreakRule,
  orgId: string,
): NewBreakPolicy {
  return {
    organizationId: orgId,
    name: rule.type === 'meal'
      ? 'LNT — Pause-repas obligatoire (art. 79)'
      : 'LNT — Repos hebdomadaire (art. 78)',
    breakType: rule.type === 'meal' ? 'meal' : 'rest',
    durationMinutes: rule.durationMinutes,
    compensation: rule.paid ? 'paid' : 'unpaid',
    frequencyPerShift: 1,
    minHoursForEligibility: rule.consecutiveHoursTrigger,
    notes: `${rule.descriptionFr}\n\nStatutory reference: ${rule.article}`,
    cbaClauseRef: null,
    isActive: true,
  };
}

/**
 * Build an array of default LNT break-policy rows for a Quebec org.
 * Call once during org on-boarding; stewards can later override per CBA.
 */
export function buildQuebecDefaultBreakPolicies(
  organizationId: string,
): NewBreakPolicy[] {
  return LNT_BREAK_RULES.map((rule) => lntRuleToPolicy(rule, organizationId));
}
