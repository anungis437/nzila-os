/**
 * test action endpoint for organizationMembers
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ["Members"],
      summary: 'test action',
      description: 'Performs the test action.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Alert test execution is not implemented: no alert was evaluated or delivered.');
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Members"],
      summary: 'test status',
      description: 'Returns test status.',
    },
  },
  async () => {
    throw ApiError.notImplemented('Alert test execution is not implemented: there is no execution status to report.');
  },
);
