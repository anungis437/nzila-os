/**
 * bulk action endpoint for claims
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ["Claims"],
      summary: 'bulk action',
      description: 'Performs the bulk action.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Bulk claim operations are not implemented: no claim was changed.');
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Claims"],
      summary: 'bulk status',
      description: 'Returns bulk status.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Bulk claim operations are not implemented: there is no status to report.');
  },
);
