/**
 * switch action endpoint for organizationMembers
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ["Members"],
      summary: 'switch action',
      description: 'Performs the switch action.',
    },
  },
  async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    return { data: { action: 'switch', status: 'accepted', ...body } };
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Members"],
      summary: 'switch status',
      description: 'Returns switch status.',
    },
  },
  async () => {
    return { data: [] };
  },
);
