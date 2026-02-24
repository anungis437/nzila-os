/**
 * CLC Analytics - Forecasting API
 * 
 * GET /api/admin/clc/analytics/forecast
 * 
 * Returns forecasted remittance data with confidence intervals
 */

import { NextResponse } from 'next/server';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { forecastRemittances } from '@/services/clc/compliance-reports';
import { withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('admin', async (request, context) => {
    const { userId } = context as { userId: string };

  try {
        const searchParams = request.nextUrl.searchParams;
        const monthsAhead = parseInt(searchParams.get('months') || '12');

        if (monthsAhead < 1 || monthsAhead > 24) {
          logApiAuditEvent({
            timestamp: new Date().toISOString(), userId,
            endpoint: '/api/admin/clc/analytics/forecast',
            method: 'GET',
            eventType: 'validation_failed',
            severity: 'low',
            details: { reason: 'Invalid months parameter', monthsAhead },
          });
          return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid months parameter. Must be between 1 and 24'
    );
        }

        const forecast = await forecastRemittances(monthsAhead);

        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
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

      } catch (error) {
        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: '/api/admin/clc/analytics/forecast',
          method: 'GET',
          eventType: 'unauthorized_access',
          severity: 'high',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to generate forecast',
      error
    );
      }
});

