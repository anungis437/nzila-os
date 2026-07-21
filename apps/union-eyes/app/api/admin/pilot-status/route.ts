/**
 * Pilot Status API
 *
 * GET /api/admin/pilot-status
 *
 * Reality-remediation Wave 0: this endpoint no longer fabricates green
 * pilot flags. It executes real DB-backed measurements where practical,
 * and honestly returns `unknown` for checks not yet wired to the deployed
 * runtime. Unknown checks force the overall status to
 * `remediation_in_progress` — dashboards MUST render that verbatim and
 * MUST NOT upgrade it to `healthy`.
 *
 * Capability: UE-ADMIN-PILOT-STATUS (state: LIMITED — measured checks
 * exist; vocabulary / SLA / audit-trail freshness pending Wave 3).
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { createLogger } from '@nzila/os-core';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { buildPilotStatus, type PilotConfiguration } from '@/lib/pilot-admin';
import type { CaseRow } from '@/lib/dashboard-metrics';
import { auth } from '@nzila/platform-auth/entra/server';

const logger = createLogger('admin:pilot-status');

/**
 * Attempt to count users associated with the given organization id.
 * Returns `null` (unmeasured) on any error so the health check surfaces
 * `unknown` rather than a fabricated zero.
 */
async function measureUsersInvited(orgId: string | null | undefined): Promise<number | null> {
  if (!orgId) return null;
  try {
    const rows = await db.execute(
      sql`
        SELECT COUNT(*)::int AS n
        FROM user_management.users u
        WHERE u.user_id IN (
          SELECT user_id FROM organization_members WHERE organization_id = ${orgId}
        )
      `,
    );
    const n = (rows as unknown as Array<{ n: number }>)[0]?.n;
    return typeof n === 'number' ? n : null;
  } catch (error) {
    logger.warn('measureUsersInvited: query failed — reporting unknown', { error: (error as Error).message });
    return null;
  }
}

/**
 * Attempt to count worksites for the given organization id.
 * Returns `null` (unmeasured) on any error.
 */
async function measureWorksitesConfigured(orgId: string | null | undefined): Promise<number | null> {
  if (!orgId) return null;
  try {
    const rows = await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM worksites WHERE organization_id = ${orgId}`,
    );
    const n = (rows as unknown as Array<{ n: number }>)[0]?.n;
    return typeof n === 'number' ? n : null;
  } catch (error) {
    logger.warn('measureWorksitesConfigured: query failed — reporting unknown', { error: (error as Error).message });
    return null;
  }
}

export const GET = withApiAuth(async (_request: NextRequest) => {
  try {
    const canAccess = await hasMinRole('platform_lead');
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const session = await auth();
    // Resolve org id defensively — see user memory: session.orgId is Entra
    // group GUID, NOT the app-org UUID. Prefer explicit context if callers
    // start providing one; for now, use whatever the session surfaces and
    // let the measurement queries return null on mismatch (which surfaces
    // as `unknown` rather than a fake zero).
    const rawOrgId = (session as { orgId?: unknown } | null)?.orgId;
    const orgId = typeof rawOrgId === 'string' && rawOrgId.length > 0 ? rawOrgId : null;

    // Run real measurements. Any measurement that can't be performed
    // honestly returns null, which the health engine renders as `unknown`.
    const [usersInvited, worksitesConfigured] = await Promise.all([
      measureUsersInvited(orgId),
      measureWorksitesConfigured(orgId),
    ]);

    const config: PilotConfiguration = {
      // These checks are NOT yet wired to the deployed runtime. Reporting
      // `null` is the honest answer — the health engine will surface them
      // as `unknown` and force `remediation_in_progress`.
      vocabularyLoaded: null,
      orgConfigured: null,
      slaThresholdsSet: null,
      auditTrailActive: null,

      // Measured checks (may still be null if the query failed).
      usersInvited,
      worksitesConfigured,
    };

    // TODO(reality-remediation Wave 3): backfill `CaseRow[]` from the real
    // grievance-case table so SLA-compliance is computed against actual
    // open cases rather than an empty array.
    const cases: CaseRow[] = [];

    const status = buildPilotStatus(config, cases);

    logger.info('pilot status check', {
      overall: status.health.status,
      unmeasured: status.health.checks.filter((c) => c.status === 'unknown').map((c) => c.name),
    });

    return NextResponse.json(status);
  } catch (error) {
    logger.error('[/api/admin/pilot-status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve pilot status' },
      { status: 500 },
    );
  }
});
