/**
 * GET /api/admin/stats/activity
 * Returns recent activity across organizations (latest member additions) for platform administrators.
 *
 * Authorized by platform-staff authority, not a role title; runs under the system role with its audit record in the same transaction; gives an
 * abbreviated name and no e-mail address (lib/platform/user-directory.ts).
 */
import { withApi } from '@/lib/api/framework';
import { performAtomicPlatformRead } from '@/lib/audit/audited-platform-read';
import { requirePlatformStaffAuthority } from '@/lib/platform/platform-staff';
import { recentMemberActivity } from '@/lib/platform/user-directory';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async (ctx) => {
    const actor = await requirePlatformStaffAuthority(ctx, 'platform.member_activity.read');
    const url = new URL(ctx.request.url);
    const requested = Number(url.searchParams.get('limit') ?? '10');
    const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 50) : 10;

    return performAtomicPlatformRead(
      actor,
      {
        action: 'platform.member_activity.read',
        resourceType: 'organization_members',
        details: { limit },
        resultDetails: (rows: unknown[]) => ({ returned: rows.length }),
      },
      (tx) => recentMemberActivity(tx, limit),
    );
  },
);