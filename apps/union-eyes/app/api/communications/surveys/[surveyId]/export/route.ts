/**
 * export action endpoint for campaigns
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ["Notifications"],
      summary: 'export action',
      description: 'Performs the export action.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Survey results export is not implemented: no export was produced.');
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Notifications"],
      summary: 'export status',
      description: 'Returns export status.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Survey results export is not implemented: there is no export status to report.');
  },
);

