import { NextResponse } from 'next/server';
/**
 * GET /api/admin/clc/analytics/forecast
 * Migrated to withApi() framework
 */
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { forecastRemittances } from '@/services/clc/compliance-reports';
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'president' as const },
    openapi: {
      tags: ['Admin'],
      summary: 'GET forecast',
    },
  },
  async ({ request, userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

            const searchParams = request.nextUrl.searchParams;
            const monthsAhead = parseInt(searchParams.get('months') || '12');
            if (monthsAhead < 1 || monthsAhead > 24) {
              logApiAuditEvent({
                timestamp: new Date().toISOString(), userId: userId ?? undefined,
                endpoint: '/api/admin/clc/analytics/forecast',
                method: 'GET',
                eventType: 'validation_failed',
                severity: 'low',
                details: { reason: 'Invalid months parameter', monthsAhead },
              });
              throw ApiError.badRequest('Invalid months parameter. Must be between 1 and 24'
        );
            }
            const forecast = await forecastRemittances(monthsAhead);
            logApiAuditEvent({
              timestamp: new Date().toISOString(), userId: userId ?? undefined,
              endpoint: '/api/admin/clc/analytics/forecast',
              method: 'GET',
              eventType: 'success',
              severity: 'low',
              details: { dataType: 'ANALYTICS', monthsAhead },
            });
            return NextResponse.json(forecast, {
              headers: {
                'Cache-Control': 'public, max-age=7200' // Cache for 2 hours
              }
            });
  },
);
