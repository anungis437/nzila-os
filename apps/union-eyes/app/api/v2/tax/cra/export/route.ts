/**
 * GET /api/tax/cra/export
 * → Django: /api/billing/per-capita-remittances/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Tax', 'Django Proxy'],
      summary: 'GET export',
      description: 'Proxied to Django: /api/billing/per-capita-remittances/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/');
    return response;
  },
);
