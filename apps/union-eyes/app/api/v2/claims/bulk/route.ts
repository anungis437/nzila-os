/**
 * bulk action endpoint for claims
 */
import { withApi } from '@/lib/api/framework';

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
  async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    return { data: { action: 'bulk', status: 'accepted', ...body } };
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
    return { data: [] };
  },
);
