/**
 * merge action endpoint for organizationMembers
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ["Members"],
      summary: 'merge action',
      description: 'Performs the merge action.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Member merge is not implemented: no records were merged.');
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Members"],
      summary: 'merge status',
      description: 'Returns merge status.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Member merge is not implemented: there is no merge status to report.');
  },
);
