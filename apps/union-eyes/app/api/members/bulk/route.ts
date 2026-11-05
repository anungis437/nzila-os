/**
 * bulk action endpoint for organizationMembers
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ["Members"],
      summary: 'bulk action',
      description: 'Performs the bulk action.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Bulk member operations are not implemented: no member was changed.');
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Members"],
      summary: 'bulk status',
      description: 'Returns bulk status.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Bulk member operations are not implemented: there is no status to report.');
  },
);
