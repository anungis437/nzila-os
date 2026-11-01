/**
 * Platform Stats API
 *
 * Returns platform-wide counts and distributions from the database for the Nzila Ops Dashboard, Customer Success and other platform admin
 * pages.
 *
 * It reads every organization, so it is authorized by platform-staff authority (lib/platform/platform-staff.ts), not by a role title: an
 * organization's `platform_lead` title is authority inside that organization only. Without the authority the read is refused and the refusal
 * recorded. The statements run under the system role and the read is recorded in the same transaction (lib/queries/platform-stats.ts).
 *
 * @route GET /api/platform/stats
 * @auth Required: platform-staff authority
 */

import { getPlatformStatsFromDb } from '@/lib/queries/platform-stats';
import { requirePlatformStaffAuthority } from '@/lib/platform/platform-staff';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'platform_lead' },
    openapi: {
      tags: ['Platform', 'Admin'],
      summary: 'Platform-wide statistics from real database',
    },
  },
  async ({ userId, organizationId }) => {
    const actor = await requirePlatformStaffAuthority({ userId, organizationId }, 'platform.stats.read');
    const stats = await getPlatformStatsFromDb(actor);
    return stats as unknown as Record<string, unknown>;
  },
);