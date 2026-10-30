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

interface ComplianceRequestBody {
  jurisdiction?: string;
  checksToPerform?: string[];
  data?: Record<string, unknown>;
}

async function handler(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.organizationId) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Authentication and organization context required'
    );
    }

    const body = (await request.json().catch(() => ({}))) as ComplianceRequestBody;
    const jurisdiction = body.jurisdiction || 'CA-FED';
    const checksToPerform = Array.isArray(body.checksToPerform) ? body.checksToPerform : [];
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

    if (shouldRun('strike_vote') && data.totalMembers && data.votesCase) {
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

    if (shouldRun('certification') && data.signedCards && data.bargainingUnit) {
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
    });
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Compliance validation failed',
      error
    );
  }
}


const _complianceValidateSchema = z.object({
  jurisdiction: z.boolean().optional(),
  checksToPerform: z.unknown().optional(),
  data: z.unknown().optional(),
});


export const POST = withApiAuth(handler);
