/**
 * GET PATCH DELETE /api/pension/trustees/[id]
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
      summary: 'GET trustee by ID',
      description: 'Get a single pension trustee',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Pension'],
      summary: 'PATCH trustee',
      description: 'Update a pension trustee',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Pension'],
      summary: 'DELETE trustee',
      description: 'Delete a pension trustee',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/', { method: 'DELETE' });
    return response;
  },
);
