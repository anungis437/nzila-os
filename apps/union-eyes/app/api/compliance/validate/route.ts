import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
interface ComplianceCheck {
  id: string;
  ruleName: string;
  ruleCategory: string;
  status: 'compliant' | 'warning' | 'violation' | 'info';
  message: string;
  legalReference?: string;
  recommendation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const COMPLIANCE_CHECKS = ['arbitration_deadline', 'strike_vote', 'certification'] as const;
export const COMPLIANCE_JURISDICTIONS = ['CA-FED', 'CA-AB', 'CA-BC', 'CA-MB', 'CA-NB', 'CA-NL', 'CA-NS', 'CA-NT', 'CA-NU', 'CA-ON', 'CA-PE', 'CA-QC', 'CA-SK', 'CA-YT'] as const;

// Dates are calendar dates, not JavaScript's permissive Date.parse inputs (which normalize impossible days).
// Do not infer jurisdictional deadlines from these caller-supplied dates.
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO calendar date')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    // Date.UTC remaps years 00–99 to 1900–1999; setUTCFullYear preserves the supplied year.
    const parsed = new Date(0);
    parsed.setUTCHours(0, 0, 0, 0);
    parsed.setUTCFullYear(year, month - 1, day);
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, 'must be a real calendar date');
// Counts are integers from an untrusted caller, never legal or membership attestations.
const countLike = z.union([
  z.number().int().nonnegative().finite(),
  z.string().regex(/^(0|[1-9]\d{0,14})$/, 'must be a nonnegative integer'),
]).refine((value) => Number.isSafeInteger(Number(value)), 'must be a safe integer');

const validateCountPair = (
  data: { totalMembers?: number | string; votesCase?: number | string; signedCards?: number | string; bargainingUnit?: number | string },
  part: 'votesCase' | 'signedCards',
  whole: 'totalMembers' | 'bargainingUnit',
  ctx: z.RefinementCtx,
) => {
  if (data[part] === undefined || data[whole] === undefined) return;
  const numerator = Number(data[part]);
  const denominator = Number(data[whole]);
  if (denominator === 0 || numerator > denominator) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [part], message: 'count cannot exceed a positive population' });
  }
};

// The body is parsed, not cast: an unknown jurisdiction or check name is a 400 instead of silently producing no check, and a date that
// is not a date is refused instead of being passed to Date.
export const complianceValidateSchema = z.object({
  jurisdiction: z.enum(COMPLIANCE_JURISDICTIONS).optional(),
  checksToPerform: z.array(z.enum(COMPLIANCE_CHECKS)).max(10).optional(),
  data: z.object({
    arbitrationDate: dateText.optional(),
    grievanceDate: dateText.optional(),
    totalMembers: countLike.optional(),
    votesCase: countLike.optional(),
    signedCards: countLike.optional(),
    bargainingUnit: countLike.optional(),
  }).strict().superRefine((data, ctx) => {
    validateCountPair(data, 'votesCase', 'totalMembers', ctx);
    validateCountPair(data, 'signedCards', 'bargainingUnit', ctx);
  }).optional(),
}).strict();

// Error responses can contain caller-supplied validation details; never allow shared caches to retain them.
const privateError = (response: NextResponse): NextResponse => {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
};

async function handler(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return privateError(standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Authentication and organization context required'
    ));
    }

    // A malformed JSON document is not an empty compliance request. Fail closed before validation.
    const rawBody = await request.json().catch(() => null);
    if (rawBody === null) {
      return privateError(standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON request body'));
    }
    const parsed = complianceValidateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return privateError(standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid compliance validation request', parsed.error.issues.slice(0, 5)));
    }
    const body = parsed.data;
    const jurisdiction = body.jurisdiction || 'CA-FED';
    const checksToPerform: readonly string[] = body.checksToPerform ?? [];
    const data = (body.data || {}) as Record<string, unknown>;

    const shouldRun = (category: string) =>
      checksToPerform.length === 0 || checksToPerform.includes(category);

    const checks: ComplianceCheck[] = [];

    const arbitrationDate = typeof data.arbitrationDate === 'string' ? data.arbitrationDate : null;
    const grievanceDate = typeof data.grievanceDate === 'string' ? data.grievanceDate : null;

    if (shouldRun('arbitration_deadline') && arbitrationDate && grievanceDate) {
      // No jurisdiction-validated arbitration deadline rule exists here.
      // Never substitute workers-compensation reporting periods or 30 days.
      checks.push({
        id: 'arbitration-deadline',
        ruleName: 'Arbitration Deadline — Verification Required',
        ruleCategory: 'arbitration_deadline',
        status: 'info',
        message: 'No validated arbitration deadline is configured. Review the collective agreement, grievance procedure and applicable tribunal rules before relying on a deadline.',
        recommendation: 'Confirm the applicable deadline with authorized union counsel or an officer.',
        severity: 'medium',
      });
    }

    // The two checks below used to state a verdict (compliant, warning, violation) from numbers the caller typed, against thresholds
    // written into this file (50% turnout; 35 to 55% of cards by jurisdiction). No jurisdiction-validated rule exists here, so each check
    // reports only the arithmetic of what was supplied and says that the governing rule is not verified.
    const percentage = (part: unknown, whole: unknown): number | null => {
      const numerator = Number(part);
      const denominator = Number(whole);
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator < 0 || denominator <= 0) return null;
      return (numerator / denominator) * 100;
    };

    if (shouldRun('strike_vote') && data.totalMembers !== undefined && data.votesCase !== undefined) {
      const turnout = percentage(data.votesCase, data.totalMembers);
      if (turnout !== null) {
        checks.push({
          id: 'strike-vote-quorum',
          ruleName: 'Strike Vote Turnout — Verification Required',
          ruleCategory: 'strike_vote',
          status: 'info',
          message: `Reported turnout is ${turnout.toFixed(1)}% of the members supplied. No validated quorum rule is configured for ${jurisdiction}; the figures were typed by the caller and are not checked against a membership or ballot record.`,
          recommendation: 'Confirm the quorum and ballot rules in the constitution, the applicable labour statute and the ballot record.',
          severity: 'medium',
        });
      }
    }

    if (shouldRun('certification') && data.signedCards !== undefined && data.bargainingUnit !== undefined) {
      const cardPercentage = percentage(data.signedCards, data.bargainingUnit);
      if (cardPercentage !== null) {
        checks.push({
          id: 'certification-cards',
          ruleName: 'Certification Card Share — Verification Required',
          ruleCategory: 'certification',
          status: 'info',
          message: `Reported card share is ${cardPercentage.toFixed(1)}% of the unit size supplied. No validated certification threshold is configured for ${jurisdiction}; the figures were typed by the caller and are not checked against card records.`,
          recommendation: 'Confirm the certification thresholds with the labour board and counsel before relying on this figure.',
          severity: 'medium',
        });
      }
    }

    // An empty list is not a clean result: it means no check applied to what was supplied.
    return NextResponse.json({
      checks,
      evaluated: checks.length,
      ...(checks.length === 0 ? { notice: 'No check applied to the data supplied; this is not a finding of compliance.' } : {}),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
return privateError(standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Compliance validation failed',
      error
    ));
  }
}

export const POST = withApiAuth(handler);
