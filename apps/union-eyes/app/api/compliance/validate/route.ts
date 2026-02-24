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
      const daysDiff = Math.ceil(
        (new Date(arbitrationDate).getTime() - new Date(grievanceDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      let maxDays = 30;
      try {
        const rulesUrl = new URL('/api/jurisdiction-rules', request.nextUrl.origin);
        rulesUrl.searchParams.set('jurisdiction', jurisdiction);
        rulesUrl.searchParams.set('category', 'arbitration_deadline');

        const deadlineRule = await fetch(rulesUrl.toString()).then((r) => r.json());
        const rule = deadlineRule?.data?.[0];
        if (rule?.parameters?.deadline_days) {
          maxDays = rule.parameters.deadline_days;
        }

        if (daysDiff <= maxDays) {
          checks.push({
            id: 'arbitration-deadline',
            ruleName: rule?.ruleName || 'Arbitration Deadline',
            ruleCategory: 'arbitration_deadline',
            status: 'compliant',
            message: `Arbitration scheduled within ${maxDays}-day deadline (${daysDiff} days)`,
            legalReference: rule?.legalReference,
            severity: 'low',
          });
        } else {
          checks.push({
            id: 'arbitration-deadline',
            ruleName: rule?.ruleName || 'Arbitration Deadline',
            ruleCategory: 'arbitration_deadline',
            status: 'violation',
            message: `Arbitration deadline exceeded: ${daysDiff} days (max: ${maxDays})`,
            legalReference: rule?.legalReference,
            recommendation: 'File extension request or expedited arbitration',
            severity: 'critical',
          });
        }
      } catch (_error) {
}
    }

    const totalMembersValue = data.totalMembers;
    const votesCaseValue = data.votesCase;

    if (shouldRun('strike_vote') && totalMembersValue && votesCaseValue) {
      const totalMembers = Number(totalMembersValue);
      const votesCast = Number(votesCaseValue);

      if (!Number.isNaN(totalMembers) && totalMembers > 0 && !Number.isNaN(votesCast)) {
        const turnout = (votesCast / totalMembers) * 100;

        checks.push({
          id: 'strike-vote-quorum',
          ruleName: 'Strike Vote Quorum',
          ruleCategory: 'strike_vote',
          status: turnout >= 50 ? 'compliant' : 'violation',
          message:
            turnout >= 50
              ? `Quorum met: ${turnout.toFixed(1)}% turnout`
              : `Quorum not met: ${turnout.toFixed(1)}% turnout (minimum 50%)`,
          severity: turnout >= 50 ? 'low' : 'critical',
        });
      }
    }

    const signedCardsValue = data.signedCards;
    const bargainingUnitValue = data.bargainingUnit;

    if (shouldRun('certification') && signedCardsValue && bargainingUnitValue) {
      const signedCards = Number(signedCardsValue);
      const bargainingUnit = Number(bargainingUnitValue);

      if (!Number.isNaN(signedCards) && !Number.isNaN(bargainingUnit) && bargainingUnit > 0) {
        const cardPercentage = (signedCards / bargainingUnit) * 100;

        let thresholds: { automatic?: number; vote?: number } = {};
        if (jurisdiction === 'CA-FED') {
          thresholds = { vote: 35, automatic: 50 };
        } else if (jurisdiction === 'CA-ON') {
          thresholds = { vote: 40, automatic: 55 };
        } else if (jurisdiction === 'CA-QC') {
          thresholds = { vote: 35 };
        }

        if (thresholds.automatic && cardPercentage >= thresholds.automatic) {
          checks.push({
            id: 'certification-cards',
            ruleName: 'Certification Card Threshold',
            ruleCategory: 'certification',
            status: 'compliant',
            message: `Automatic certification available: ${cardPercentage.toFixed(1)}% cards (${thresholds.automatic}% required)`,
            severity: 'low',
          });
        } else if (thresholds.vote && cardPercentage >= thresholds.vote) {
          checks.push({
            id: 'certification-cards',
            ruleName: 'Certification Card Threshold',
            ruleCategory: 'certification',
            status: 'warning',
            message: `Vote required: ${cardPercentage.toFixed(1)}% cards (${thresholds.vote}%-${thresholds.automatic || 100}% range)`,
            severity: 'medium',
          });
        } else if (thresholds.vote) {
          checks.push({
            id: 'certification-cards',
            ruleName: 'Certification Card Threshold',
            ruleCategory: 'certification',
            status: 'violation',
            message: `Insufficient cards: ${cardPercentage.toFixed(1)}% (minimum ${thresholds.vote}%)`,
            recommendation: 'Continue organizing campaign to reach minimum threshold',
            severity: 'high',
          });
        }
      }
    }

    return NextResponse.json({ checks });
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
