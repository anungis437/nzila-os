/**
 * GET /api/deadlines/dashboard
 * Dashboard summary with counts and metrics
 */

import { NextResponse } from 'next/server';
import { getDeadlineDashboardSummary } from '@/db/queries/deadline-queries';
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

  // A failing query fails the request: zeroed counts would tell an officer that no deadline is overdue.
  return NextResponse.json(await getDeadlineDashboardSummary(organizationId));
});

