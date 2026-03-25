/**
 * submit action endpoint for organizationMembers
 */
import { withApi } from '@/lib/api/framework';

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
  async ({ request }) => {
    await request.json().catch(() => ({}));
    return { action: 'submit', status: 'accepted' };
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
    return [];
  },
);

