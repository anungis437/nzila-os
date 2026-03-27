/**
 * GET /api/deadlines/dashboard
 * Dashboard summary with counts and metrics
 */

import { NextResponse } from 'next/server';
import { getDashboardSummary } from '@/lib/deadline-service';
import { withApi } from '@/lib/api/framework';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Deadlines'],
      summary: 'Deadline dashboard summary for the current organization',
    },
  },
  async ({ organizationId }) => {
  if (!organizationId) {
    return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Organization ID required'
    );
  }
  
  try {
    const summary = await getDashboardSummary(organizationId);
    return NextResponse.json(summary);
  } catch (error) {
    const { logger: log } = await import('@/lib/logger');
    log.error('Deadlines dashboard query failed', { error: error instanceof Error ? error.message : 'Unknown' });
    // claim_deadlines table may lack expected columns — return zeroed defaults
    return NextResponse.json({
      activeDeadlines: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      criticalCount: 0,
      avgDaysOverdue: 0,
      onTimePercentage: 100,
    });
  }
});

