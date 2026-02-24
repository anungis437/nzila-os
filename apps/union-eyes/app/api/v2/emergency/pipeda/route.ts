import { NextResponse } from 'next/server';
/**
 * GET POST /api/emergency/pipeda
 * Migrated to withApi() framework
 */
import { getPrivacyRules, assessBreachNotification } from '@/lib/services/provincial-privacy-service';
import type { PIPEDABreachAssessment } from '@/lib/types/compliance-api-types';
 
 
 
 
 
 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const emergencyPipedaSchema = z.object({
  memberId: z.string().uuid('Invalid memberId'),
  breachDate: z.string().datetime().optional(),
  affectedDataTypes: z.unknown().optional(),
  estimatedAffectedCount: z.number().int().positive(),
  province: z.unknown().optional(),
});

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Emergency'],
      summary: 'GET pipeda',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

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
  },
);

export const POST = withApi(
  {
    auth: { required: true },
    body: emergencyPipedaSchema,
    openapi: {
      tags: ['Emergency'],
      summary: 'POST pipeda',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

        // Validate request body
        const { memberId, breachDate, affectedDataTypes, province: rawProvince, estimatedAffectedCount } = body;
        const province = typeof rawProvince === 'string' ? rawProvince : undefined;
        // Validate required fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!memberId || !breachDate || !affectedDataTypes || (affectedDataTypes as any[]).length === 0) {
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
          affectedDataTypes as string[],
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
  },
);
