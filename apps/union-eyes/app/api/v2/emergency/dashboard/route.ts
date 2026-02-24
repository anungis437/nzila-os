/**
 * GET /api/emergency/dashboard
 * Migrated to withApi() framework
 */
import { getPrivacyRules, generateComplianceReport } from '@/lib/services/provincial-privacy-service';
 
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Emergency'],
      summary: 'GET dashboard',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

        const searchParams = request.nextUrl.searchParams;
        const province = searchParams.get('province') || 'FEDERAL';
        // Get provincial privacy rules
        const rules = getPrivacyRules(province);
        // Get compliance report
        const _complianceReport = await generateComplianceReport(province);
        return { province,
          emergencyStatus: {
            activeEmergencies: 0,
            preparednessLevel: 'HIGH',
            lastDrill: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            nextScheduledDrill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          geofencePrivacy: {
            backgroundTrackingBlocked: true,
            dataEncrypted: true,
            retentionPolicy: '30 days maximum',
            memberConsentRequired: true,
            optOutAvailable: true,
          },
          complianceStatus: {
            breachNotificationCompliant: true,
            pipedasafe: true,
            datencyCompliant: true,
            lastAudit: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            nextAuditDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          },
          privacyRules: rules,
          recommendations: [
            'Review emergency response procedures quarterly',
            'Conduct location privacy consent audit',
            'Update breach notification templates',
            'Test geofence failover mechanisms',
          ],
          message: `Emergency dashboard for ${province} - All systems operational`, };
  },
);
