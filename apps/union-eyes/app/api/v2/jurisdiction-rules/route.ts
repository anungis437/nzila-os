/**
 * GET /api/v2/jurisdiction-rules
 * Returns jurisdiction-specific labour standards rules.
 */
import {
  type CanadianJurisdiction,
  BREAK_RULES,
  OVERTIME_RULES,
  TERMINATION_NOTICE,
  WCB_BOARDS,
  getClaimDeadlineDays,
} from '@/lib/canadian-labour-standards';

import { withApi, ApiError, z } from '@/lib/api/framework';

/** Map jurisdiction code from ISO-style "CA-XX" to our module's format */
function parseJurisdictionCode(code: string): CanadianJurisdiction {
  const mapping: Record<string, CanadianJurisdiction> = {
    'CA-FED': 'federal', 'CA-AB': 'AB', 'CA-BC': 'BC', 'CA-MB': 'MB',
    'CA-NB': 'NB', 'CA-NL': 'NL', 'CA-NS': 'NS', 'CA-NT': 'NT',
    'CA-NU': 'NU', 'CA-ON': 'ON', 'CA-PE': 'PE', 'CA-QC': 'QC',
    'CA-SK': 'SK', 'CA-YT': 'YT',
  };
  const mapped = mapping[code];
  if (!mapped) throw ApiError.badRequest(`Unknown jurisdiction: ${code}`);
  return mapped;
}

function buildRulesForJurisdiction(jur: CanadianJurisdiction) {
  const rules: Array<{ ruleName: string; ruleCategory: string; legalReference: string; parameters: Record<string, unknown> }> = [];

  const wcb = WCB_BOARDS[jur];
  if (wcb) {
    rules.push({
      ruleName: 'WCB Claim Filing Deadline',
      ruleCategory: 'arbitration_deadline',
      legalReference: wcb.statute,
      parameters: { deadline_days: getClaimDeadlineDays(jur) ?? 30 },
    });
  }

  const breaks = BREAK_RULES[jur];
  if (breaks) {
    for (const br of breaks) {
      rules.push({
        ruleName: br.description,
        ruleCategory: 'break_rule',
        legalReference: `${br.statute}, ${br.article}`,
        parameters: { duration_minutes: br.durationMinutes, paid: br.paid, trigger_hours: br.consecutiveHoursTrigger },
      });
    }
  }

  const ot = OVERTIME_RULES[jur];
  if (ot) {
    rules.push({
      ruleName: 'Overtime Threshold',
      ruleCategory: 'overtime',
      legalReference: `${ot.statute}, ${ot.article}`,
      parameters: { daily_hours: ot.dailyThresholdHours, weekly_hours: ot.weeklyThresholdHours, multiplier: ot.multiplier },
    });
  }

  const tn = TERMINATION_NOTICE[jur];
  if (tn) {
    rules.push({
      ruleName: 'Termination Notice Schedule',
      ruleCategory: 'termination_notice',
      legalReference: `${tn.statute}, ${tn.article}`,
      parameters: { tiers: tn.tiers },
    });
  }

  return rules;
}

const querySchema = z.object({
  jurisdiction: z.string().default('CA-FED'),
  category: z.string().optional(),
});

export const GET = withApi(
  {
    auth: { required: true },
    query: querySchema,
    openapi: {
      tags: ['Jurisdiction-rules'],
      summary: 'GET jurisdiction-rules',
    },
  },
  async ({ query }) => {
    const jur = parseJurisdictionCode(query.jurisdiction);
    const allRules = buildRulesForJurisdiction(jur);
    const rules = query.category
      ? allRules.filter((r) => r.ruleCategory === query.category)
      : allRules;
    return { success: true, jurisdiction: query.jurisdiction, data: rules };
  },
);
