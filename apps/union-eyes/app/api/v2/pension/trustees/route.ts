/**
 * GET POST /api/pension/trustees
 * → Django: /api/billing/per-capita-remittances/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Pension'],
      summary: 'GET trustees',
      description: 'List pension trustees',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Pension'],
      summary: 'POST trustees',
      description: 'Add a new pension trustee',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/', { method: 'POST' });
    return response;
  },
);
