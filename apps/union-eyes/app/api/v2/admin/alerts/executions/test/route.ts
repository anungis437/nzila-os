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
    const body = await request.json().catch(() => ({}));
    return { data: { action: 'test', status: 'accepted', ...body } };
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
    return { data: [] };
  },
);
