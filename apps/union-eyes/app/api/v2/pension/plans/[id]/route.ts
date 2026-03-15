/**
 * GET PATCH DELETE /api/pension/plans/[id]
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
      summary: 'GET plan by ID',
      description: 'Get a single pension plan',
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
      summary: 'PATCH plan',
      description: 'Update a pension plan',
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
      summary: 'DELETE plan',
      description: 'Delete a pension plan',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/', { method: 'DELETE' });
    return response;
  },
);
