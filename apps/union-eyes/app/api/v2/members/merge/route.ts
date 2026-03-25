/**
 * merge action endpoint for organizationMembers
 */
import { withApi } from '@/lib/api/framework';

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
  async ({ request }) => {
    await request.json().catch(() => ({}));
    return { action: 'merge', status: 'accepted' };
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
    return [];
  },
);
