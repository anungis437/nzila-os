import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth-guard';
import {
  type CanadianJurisdiction,
  BREAK_RULES,
  OVERTIME_RULES,
  TERMINATION_NOTICE,
  WCB_BOARDS,
  getClaimDeadlineDays,
} from '@/lib/canadian-labour-standards';

/** Map jurisdiction code from ISO-style "CA-XX" to our module's format */
function parseJurisdictionCode(code: string): CanadianJurisdiction {
  const mapping: Record<string, CanadianJurisdiction> = {
    'CA-FED': 'federal', 'CA-AB': 'AB', 'CA-BC': 'BC', 'CA-MB': 'MB',
    'CA-NB': 'NB', 'CA-NL': 'NL', 'CA-NS': 'NS', 'CA-NT': 'NT',
    'CA-NU': 'NU', 'CA-ON': 'ON', 'CA-PE': 'PE', 'CA-QC': 'QC',
    'CA-SK': 'SK', 'CA-YT': 'YT',
  };
  return mapping[code] ?? (code as CanadianJurisdiction);
}

function buildRulesForJurisdiction(jur: CanadianJurisdiction) {
  const rules: Array<{ ruleName: string; ruleCategory: string; legalReference: string; parameters: Record<string, unknown> }> = [];

  // Arbitration / WCB deadline
  const wcb = WCB_BOARDS[jur];
  if (wcb) {
    rules.push({
      ruleName: 'WCB Claim Filing Deadline',
      ruleCategory: 'arbitration_deadline',
      legalReference: wcb.statute,
      parameters: { deadline_days: getClaimDeadlineDays(jur) ?? 30 },
    });
  }

  // Break rules
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

  // Overtime
  const ot = OVERTIME_RULES[jur];
  if (ot) {
    rules.push({
      ruleName: 'Overtime Threshold',
      ruleCategory: 'overtime',
      legalReference: `${ot.statute}, ${ot.article}`,
      parameters: { daily_hours: ot.dailyThresholdHours, weekly_hours: ot.weeklyThresholdHours, multiplier: ot.multiplier },
    });
  }

  // Termination notice
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

async function handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionParam = searchParams.get('jurisdiction') || 'CA-FED';
    const category = searchParams.get('category');

    const jur = parseJurisdictionCode(jurisdictionParam);
    const allRules = buildRulesForJurisdiction(jur);

    const rules = category
      ? allRules.filter((rule) => rule.ruleCategory === category)
      : allRules;

    return NextResponse.json({
      success: true,
      jurisdiction: jurisdictionParam,
      data: rules,
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jurisdiction rules' },
      { status: 500 }
    );
  }
}

export const GET = withApiAuth(handler);
