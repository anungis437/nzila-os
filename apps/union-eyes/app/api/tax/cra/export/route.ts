/**
 * export action endpoint for perCapitaRemittances
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ["Billing"],
      summary: 'export action',
      description: 'Performs the export action.',
    },
  },
  async () => {
    throw ApiError.notImplemented('CRA tax export is not implemented: no filing export was produced.');
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Billing"],
      summary: 'export status',
      description: 'Returns export status.',
    },
  },
  async () => {
    throw ApiError.notImplemented('CRA tax export is not implemented: there is no export status to report.');
  },
);
