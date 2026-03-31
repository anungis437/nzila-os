/**
 * Canadian Labour Standards — Unified Break-Policy Defaults
 *
 * Generates statutory-minimum break policies for any Canadian jurisdiction.
 * Used during org on-boarding when no CBA-specific break clause exists.
 *
 * @module canadian-labour-standards/break-defaults
 */

import type { NewBreakPolicy } from '@/db/schema';
import type { BreakRule, CanadianJurisdiction } from './types';
import { BREAK_RULES } from './break-rules';

/**
 * Convert a jurisdiction break rule to a break-policy insert row.
 */
function ruleToPolicy(
  rule: BreakRule,
  orgId: string,
  jurisdiction: CanadianJurisdiction,
): NewBreakPolicy {
  return {
    organizationId: orgId,
    name: `${rule.statute} — ${rule.description.slice(0, 60)}`,
    breakType: rule.type === 'meal' ? 'meal' : 'rest',
    durationMinutes: rule.durationMinutes,
    compensation: rule.paid ? 'paid' : 'unpaid',
    frequencyPerShift: 1,
    minHoursForEligibility: rule.consecutiveHoursTrigger,
    notes: `${rule.description}\n\nStatutory reference: ${rule.statute}, ${rule.article}\nJurisdiction: ${jurisdiction}`,
    cbaClauseRef: null,
    isActive: true,
  };
}

/**
 * Build an array of statutory-minimum break-policy rows for an organization
 * in the given Canadian jurisdiction. Call once during org on-boarding;
 * stewards can later override per CBA.
 */
export function buildDefaultBreakPolicies(
  jurisdiction: CanadianJurisdiction,
  organizationId: string,
): NewBreakPolicy[] {
  const rules = BREAK_RULES[jurisdiction];
  if (!rules || rules.length === 0) {
    return [];
  }
  return rules.map((rule) => ruleToPolicy(rule, organizationId, jurisdiction));
}
