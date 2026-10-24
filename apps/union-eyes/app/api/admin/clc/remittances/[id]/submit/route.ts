/**
 * submit action endpoint for organizationMembers
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ["Members"],
      summary: 'submit action',
      description: 'Performs the submit action.',
    },
  },
  async () => {
    throw ApiError.notImplemented('CLC remittance submission is not implemented: nothing was submitted to the CLC.');
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Members"],
      summary: 'submit status',
      description: 'Returns submit status.',
    },
  },
  async () => {
    throw ApiError.notImplemented('CLC remittance submission is not implemented: there is no submission status to report.');
  },
);

