/**
 * Pilot Status API
 *
 * GET /api/admin/pilot-status
 *
 * PR-060: Returns the CUPE pilot health check + status summary.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';
import { buildPilotStatus, type PilotConfiguration } from '@/lib/pilot-admin';
import type { CaseRow } from '@/lib/dashboard-metrics';

const logger = createLogger('admin:pilot-status');

export const GET = withApiAuth(async (_request: NextRequest) => {
  try {
    const canAccess = await hasMinRole('platform_lead');
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // PILOT SCAFFOLD: these flags are hardcoded — they are NOT measured from
    // the database. An admin hitting this endpoint sees a green health report
    // regardless of actual pilot state. Surface loudly until each flag is
    // backed by a real query.
    logger.warn('admin/pilot-status: returning hardcoded pilot configuration flags; values are NOT measured from the database', {});
    const config: PilotConfiguration = {
      vocabularyLoaded: true,
      orgConfigured: true,
      usersInvited: 0,
      worksitesConfigured: 0,
      slaThresholdsSet: true,
      auditTrailActive: true,
    };

    const cases: CaseRow[] = [];

    const status = buildPilotStatus(config, cases);

    logger.info('Pilot status check', { status: status.health.status });

    return NextResponse.json(status);
  } catch (error) {
    logger.error('[/api/admin/pilot-status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve pilot status' },
      { status: 500 },
    );
  }
});
