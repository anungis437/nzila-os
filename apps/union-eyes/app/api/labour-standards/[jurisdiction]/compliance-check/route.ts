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
import {
  BREAK_RULES,
  OVERTIME_RULES,
  TERMINATION_NOTICE,
  STATUTORY_HOLIDAYS,
  hasAntiScabLaw,
  hasProactivePayEquity,
  calculateOvertime,
  calculateTerminationNotice,
  type CanadianJurisdiction,
} from '@/lib/canadian-labour-standards';

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
    throw new ApiError(400, `Invalid jurisdiction: "${params.jurisdiction}"`);
  }

  const jurisdiction = code as CanadianJurisdiction;
  const findings: ComplianceFinding[] = [];

  // ── Break rules ───────────────────────────────────────────────────────
  const breakRules = BREAK_RULES[jurisdiction] ?? [];
  const mealRule = breakRules.find((r) => r.type === 'meal');

  if (mealRule && body.dailyHours != null) {
    if (body.dailyHours >= mealRule.consecutiveHoursTrigger) {
      if (body.mealBreakProvided === false) {
        findings.push({
          severity: 'violation',
          category: 'breaks',
          message: `Meal break required after ${mealRule.consecutiveHoursTrigger} consecutive hours (${mealRule.durationMinutes} min minimum)`,
          legalReference: `${mealRule.statute}, ${mealRule.article}`,
        });
      } else if (body.mealBreakMinutes != null && body.mealBreakMinutes < mealRule.durationMinutes) {
        findings.push({
          severity: 'violation',
          category: 'breaks',
          message: `Meal break must be at least ${mealRule.durationMinutes} minutes; ${body.mealBreakMinutes} provided`,
          legalReference: `${mealRule.statute}, ${mealRule.article}`,
        });
      }
    }
  }

  // ── Overtime ──────────────────────────────────────────────────────────
  const overtimeRule = OVERTIME_RULES[jurisdiction];
  if (overtimeRule && body.weeklyHours != null) {
    const result = calculateOvertime(jurisdiction, body.dailyHours ?? 0, body.weeklyHours);
    if (result.overtimeHours > 0) {
      findings.push({
        severity: 'info',
        category: 'overtime',
        message: `${result.overtimeHours.toFixed(1)} overtime hours at ${overtimeRule.multiplier}× rate`,
        legalReference: `${overtimeRule.statute}, ${overtimeRule.article}`,
      });
    }
  }

  // ── Termination notice ────────────────────────────────────────────────
  if (body.tenureYears != null && body.terminationNoticeWeeks != null) {
    const required = calculateTerminationNotice(jurisdiction, body.tenureYears);
    if (body.terminationNoticeWeeks < required.weeksRequired) {
      const schedule = TERMINATION_NOTICE[jurisdiction];
      findings.push({
        severity: 'violation',
        category: 'termination_notice',
        message: `${required.weeksRequired} weeks notice required for ${body.tenureYears} years tenure; ${body.terminationNoticeWeeks} given`,
        legalReference: `${schedule.statute}, ${schedule.article}`,
      });
    }
  }

  // ── Statutory holidays ────────────────────────────────────────────────
  const holidays = STATUTORY_HOLIDAYS[jurisdiction] ?? [];
  if (body.statutoryHolidaysObserved != null && body.statutoryHolidaysObserved < holidays.length) {
    findings.push({
      severity: 'warning',
      category: 'statutory_holidays',
      message: `${holidays.length} statutory holidays required; only ${body.statutoryHolidaysObserved} observed`,
    });
  }

  // ── Anti-scab ─────────────────────────────────────────────────────────
  if (body.usingReplacementWorkers && hasAntiScabLaw(jurisdiction)) {
    findings.push({
      severity: 'violation',
      category: 'anti_scab',
      message: `Replacement workers prohibited during strikes/lockouts in ${jurisdiction}`,
    });
  }

  // ── Pay equity ────────────────────────────────────────────────────────
  if (body.payEquityCompleted === false && hasProactivePayEquity(jurisdiction)) {
    findings.push({
      severity: 'warning',
      category: 'pay_equity',
      message: `Proactive pay equity exercise required in ${jurisdiction}`,
    });
  }

  return {
    jurisdiction,
    totalFindings: findings.length,
    violations: findings.filter((f) => f.severity === 'violation').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
    findings,
  };
});
