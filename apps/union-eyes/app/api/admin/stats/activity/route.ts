/**
 * GET /api/admin/stats/activity
 *
 * Refused for every caller. The feed listed the latest member additions across every organization (a name, a role and the organization),
 * which is tenant content: platform-staff authority and a platform title are no standing entitlement to it (issues #1116, #1118), and
 * cross-organization grants are not built, so it is denied. No table is read.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async () => {
    throw ApiError.forbidden(
      'Recent member activity across organizations is not available: it is tenant content, and no cross-organization grant exists.',
    );
  },
);
