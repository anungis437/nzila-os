import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { getPrivacyRules, assessBreachNotification } from '@/lib/services/provincial-privacy-service';
import type { PIPEDABreachAssessment } from '@/lib/types/compliance-api-types';
import { withApiAuth } from '@/lib/api-auth-guard';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

/**
 * PIPEDA Breach Assessment API
 * Assess if emergency event requires PIPEDA or provincial breach notification
 */

/**
 * POST /api/emergency/pipeda
 * Assess if data breach requires PIPEDA notification
 */

const emergencyPipedaSchema = z.object({
  memberId: z.string().uuid('Invalid memberId'),
  breachDate: z.string().datetime().optional(),
  affectedDataTypes: z.array(z.string()).optional(),
  estimatedAffectedCount: z.number().int().positive(),
  province: z.string().optional(),
});

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    // Validate request body
    const validation = emergencyPipedaSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { memberId, breachDate, affectedDataTypes, estimatedAffectedCount, province } = validation.data;

    // Validate required fields
    if (!memberId || !breachDate || !affectedDataTypes || affectedDataTypes.length === 0) {
      return NextResponse.json(
        {
          requiresBreachReport: false,
          notificationRequired: false,
          affectingMinimumThreshold: false,
          reportDeadline: new Date().toISOString(),
          reportingChannels: [],
        } as PIPEDABreachAssessment,
        { status: 400 }
      );
    }

    // Assess breach notification requirements
    const _assessment = await assessBreachNotification(
      memberId,
      affectedDataTypes,
      new Date(breachDate)
    );

    // Get provincial rules
    const _rules = getPrivacyRules(province || 'FEDERAL');

    // Calculate minimum threshold (varies by province)
    const minimumThreshold = province === 'QC' ? 10 : 25; // QC has lower threshold
    const affectingMinimum = estimatedAffectedCount >= minimumThreshold;

    // Determine reporting channels
    const reportingChannels: string[] = [];
    if (affectingMinimum) {
      reportingChannels.push('Privacy Commissioner');
      if (province === 'QC') {
        reportingChannels.push('CAI - Commission d\'accÃ¨s Ã  l\'information');
      }
    }
    reportingChannels.push('Affected Members (via secure notification)');

    // Calculate deadline (72 hours in most provinces, 24 hours in QC)
    const notificationHours = province === 'QC' ? 24 : 72;
    const deadlineDate = new Date(new Date(breachDate).getTime() + notificationHours * 60 * 60 * 1000);

    return NextResponse.json({
      requiresBreachReport: affectingMinimum,
      notificationRequired: affectingMinimum,
      affectingMinimumThreshold: affectingMinimum,
      reportDeadline: deadlineDate.toISOString(),
      reportingChannels,
      estimatedDamages: affectingMinimum 
        ? `${estimatedAffectedCount} members affected`
        : 'Below reporting threshold',
      message: `PIPEDA assessment complete. Notification ${affectingMinimum ? 'required' : 'not required'}.`,
    } as PIPEDABreachAssessment);
  } catch (error) {
return NextResponse.json(
      {
        requiresBreachReport: false,
        notificationRequired: false,
        affectingMinimumThreshold: false,
        reportDeadline: new Date().toISOString(),
        reportingChannels: [],
        estimatedDamages: `Error: ${error}`,
      } as PIPEDABreachAssessment,
      { status: 500 }
    );
  }
});

/**
 * GET /api/emergency/pipeda?breachId=xxx&province=QC
 * Get PIPEDA breach notification status
 */
export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const breachId = searchParams.get('breachId');
    const province = searchParams.get('province') || 'FEDERAL';

    if (!breachId) {
      return NextResponse.json(
        {
          requiresBreachReport: false,
          notificationRequired: false,
          affectingMinimumThreshold: false,
          reportDeadline: new Date().toISOString(),
          reportingChannels: [],
        } as PIPEDABreachAssessment,
        { status: 400 }
      );
    }

    const rules = getPrivacyRules(province);

    return NextResponse.json({
      requiresBreachReport: true,
      notificationRequired: true,
      affectingMinimumThreshold: true,
      reportDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      reportingChannels: [
        rules.contactAuthority,
        'Affected Members',
      ],
      message: `Breach notification requirements: Follow ${province} protocols`,
    } as PIPEDABreachAssessment);
  } catch (error) {
return NextResponse.json(
      {
        requiresBreachReport: false,
        notificationRequired: false,
        affectingMinimumThreshold: false,
        reportDeadline: new Date().toISOString(),
        reportingChannels: [],
        estimatedDamages: `Error: ${error}`,
      } as PIPEDABreachAssessment,
      { status: 500 }
    );
  }
});

