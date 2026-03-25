/**
 * test action endpoint for organizationMembers
 */
import { withApi } from '@/lib/api/framework';

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
  async ({ request }) => {
    await request.json().catch(() => ({}));
    return { action: 'test', status: 'accepted' };
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
    return [];
  },
);
