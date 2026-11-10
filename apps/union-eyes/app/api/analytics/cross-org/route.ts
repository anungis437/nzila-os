/**
 * GET /api/analytics/cross-org
 *
 * Refused for every caller. The route aggregated every organization's analytics metrics (counts, totals, averages, and the minimum and
 * maximum, which with two contributing organizations are each organization's own figure) for anyone holding the platform_lead title. Those
 * metrics are each organization's content: a platform title is no authority over them, nor is the platform-staff fact, even as an aggregate
 * (issues #1116, #1118; DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY), and cross-organization grants are not built, so it is denied. No table is
 * read. An organization's own analytics are served by /api/organizations/[id]/analytics under that organization's RLS context.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'platform_lead' },
    openapi: { tags: ['Analytics'], summary: 'Cross-organization analytics (refused: no cross-organization grant exists)' },
  },
  async () => {
    throw ApiError.forbidden(
      'Analytics across organizations are not available: each organization\'s metrics are its own content, and no cross-organization grant exists.',
    );
  },
);
