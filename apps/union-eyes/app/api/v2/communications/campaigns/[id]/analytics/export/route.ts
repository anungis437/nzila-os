/**
 * export action endpoint for campaigns
 */
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ["Notifications"],
      summary: 'export action',
      description: 'Performs the export action.',
    },
  },
  async ({ request }) => {
    await request.json().catch(() => ({}));
    return { action: 'export', status: 'accepted' };
  },
);

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Notifications"],
      summary: 'export status',
      description: 'Returns export status.',
    },
  },
  async () => {
    return [];
  },
);

