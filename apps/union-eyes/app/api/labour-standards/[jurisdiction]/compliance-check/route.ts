/**
 * Canadian Labour Standards — Compliance Check
 *
 * POST /api/labour-standards/[jurisdiction]/compliance-check
 *
 * Accepts org practices and returns violations/warnings against
 * the jurisdiction's employment standards.
 */
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { resolveStatutoryRules } from '@/lib/canadian-labour-standards/rule-resolver';

export const dynamic = 'force-dynamic';

const VALID_JURISDICTIONS = new Set<string>([
  'federal', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);

const complianceBodySchema = z.object({
  /** Daily hours worked */
  dailyHours: z.number().optional(),
  /** Weekly hours worked */
  weeklyHours: z.number().optional(),
  /** Whether meal breaks are provided */
  mealBreakProvided: z.boolean().optional(),
  /** Meal break duration in minutes */
  mealBreakMinutes: z.number().optional(),
  /** Employee tenure in years (for termination notice checks) */
  tenureYears: z.number().optional(),
  /** Termination notice given in weeks */
  terminationNoticeWeeks: z.number().optional(),
  /** Number of statutory holidays observed */
  statutoryHolidaysObserved: z.number().optional(),
  /** Is the org using replacement workers during a strike? */
  usingReplacementWorkers: z.boolean().optional(),
  /** Has the org completed a pay equity exercise? */
  payEquityCompleted: z.boolean().optional(),
  /** Date on which the represented facts occurred; rules are resolved at this instant. */
  eventDate: z.coerce.date(),
});

interface ComplianceFinding {
  severity: 'violation' | 'warning' | 'info';
  category: string;
  message: string;
  legalReference?: string;
}

export const POST = withApi({
  auth: { minRole: 'steward' },
  body: complianceBodySchema,
  openapi: {
    tags: ['Labour Standards'],
    summary: 'Check org practices against jurisdiction labour standards',
  },
}, async ({ body, params }) => {
  const code = params.jurisdiction?.toUpperCase() === 'FEDERAL'
    ? 'federal'
    : params.jurisdiction?.toUpperCase();

  if (!code || !VALID_JURISDICTIONS.has(code)) {
    throw ApiError.badRequest(`Invalid jurisdiction: "${params.jurisdiction}"`);
  }

  const jurisdiction = code;
  const findings: ComplianceFinding[] = [];
  const resolved = await resolveStatutoryRules(jurisdiction, body.eventDate);
  if (resolved.status === 'unknown') {
    return {
      jurisdiction,
      eventDate: body.eventDate.toISOString(),
      ruleStatus: 'unknown',
      reason: resolved.reason,
      totalFindings: 0,
      violations: 0,
      warnings: 0,
      info: 0,
      findings: [],
    };
  }

  const numberField = (payload: Record<string, unknown>, key: string): number | null =>
    typeof payload[key] === 'number' && Number.isFinite(payload[key]) ? payload[key] as number : null;
  const mealRule = resolved.rules.find((rule) => rule.category === 'break_rule' && rule.payload.type === 'meal');

  if (mealRule && body.dailyHours != null) {
    const trigger = numberField(mealRule.payload, 'consecutiveHoursTrigger');
    const duration = numberField(mealRule.payload, 'durationMinutes');
    if (trigger != null && duration != null && body.dailyHours >= trigger) {
      if (body.mealBreakProvided === false) {
        findings.push({
          severity: 'violation',
          category: 'breaks',
          message: `Reviewed rule version ${mealRule.version} requires a meal break after ${trigger} consecutive hours (${duration} min minimum)`,
          legalReference: mealRule.source.uri,
        });
      } else if (body.mealBreakMinutes != null && body.mealBreakMinutes < duration) {
        findings.push({
          severity: 'violation',
          category: 'breaks',
          message: `Reviewed rule version ${mealRule.version} requires at least ${duration} minutes; ${body.mealBreakMinutes} provided`,
          legalReference: mealRule.source.uri,
        });
      }
    }
  }

  const overtimeRule = resolved.rules.find((rule) => rule.category === 'overtime');
  if (overtimeRule && body.weeklyHours != null) {
    const weekly = numberField(overtimeRule.payload, 'weeklyThresholdHours');
    const daily = numberField(overtimeRule.payload, 'dailyThresholdHours');
    const multiplier = numberField(overtimeRule.payload, 'multiplier');
    const weeklyOvertime = weekly == null ? 0 : Math.max(0, body.weeklyHours - weekly);
    const dailyOvertime = daily == null ? 0 : Math.max(0, (body.dailyHours ?? 0) - daily);
    const overtimeHours = Math.max(weeklyOvertime, dailyOvertime);
    if (overtimeHours > 0 && multiplier != null) {
      findings.push({
        severity: 'info',
        category: 'overtime',
        message: `${overtimeHours.toFixed(1)} overtime hours at ${multiplier}× rate under reviewed rule version ${overtimeRule.version}`,
        legalReference: overtimeRule.source.uri,
      });
    }
  }

  if (body.tenureYears != null && body.terminationNoticeWeeks != null) {
    const schedule = resolved.rules.find((rule) => rule.category === 'termination_notice');
    const tiers = Array.isArray(schedule?.payload.tiers) ? schedule.payload.tiers as Array<Record<string, unknown>> : [];
    const applicable = tiers.filter((tier) => typeof tier.minYears === 'number' && body.tenureYears! >= tier.minYears)
      .sort((a, b) => Number(b.minYears) - Number(a.minYears))[0];
    const requiredWeeks = applicable && typeof applicable.weeks === 'number' ? applicable.weeks : null;
    if (schedule && requiredWeeks != null && body.terminationNoticeWeeks < requiredWeeks) {
      findings.push({
        severity: 'violation',
        category: 'termination_notice',
        message: `${requiredWeeks} weeks notice required by reviewed rule version ${schedule.version}; ${body.terminationNoticeWeeks} given`,
        legalReference: schedule.source.uri,
      });
    }
  }

  const holidayRule = resolved.rules.find((rule) => rule.category === 'statutory_holidays');
  const requiredHolidays = holidayRule ? numberField(holidayRule.payload, 'requiredCount') : null;
  if (holidayRule && requiredHolidays != null && body.statutoryHolidaysObserved != null && body.statutoryHolidaysObserved < requiredHolidays) {
    findings.push({
      severity: 'warning',
      category: 'statutory_holidays',
      message: `${requiredHolidays} statutory holidays required by reviewed rule version ${holidayRule.version}; only ${body.statutoryHolidaysObserved} observed`,
      legalReference: holidayRule.source.uri,
    });
  }

  const antiScab = resolved.rules.find((rule) => rule.category === 'anti_scab' && rule.payload.prohibited === true);
  if (body.usingReplacementWorkers && antiScab) {
    findings.push({
      severity: 'violation',
      category: 'anti_scab',
      message: `Replacement workers are prohibited by reviewed rule version ${antiScab.version}`,
      legalReference: antiScab.source.uri,
    });
  }

  const payEquity = resolved.rules.find((rule) => rule.category === 'pay_equity' && rule.payload.proactive === true);
  if (body.payEquityCompleted === false && payEquity) {
    findings.push({
      severity: 'warning',
      category: 'pay_equity',
      message: `A proactive pay equity exercise is required by reviewed rule version ${payEquity.version}`,
      legalReference: payEquity.source.uri,
    });
  }

  return {
    jurisdiction,
    eventDate: body.eventDate.toISOString(),
    ruleStatus: 'governed',
    totalFindings: findings.length,
    violations: findings.filter((f) => f.severity === 'violation').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
    findings,
  };
});
