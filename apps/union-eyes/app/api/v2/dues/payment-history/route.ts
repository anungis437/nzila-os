/**
 * GET POST /api/dues/payment-history
 * → Django: /api/billing/per-capita-remittances/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Dues', 'Django Proxy'],
      summary: 'GET payment-history',
      description: 'Proxied to Django: /api/billing/per-capita-remittances/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Dues', 'Django Proxy'],
      summary: 'POST payment-history',
      description: 'Proxied to Django: /api/billing/per-capita-remittances/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/per-capita-remittances/', { method: 'POST' });
    return response;
  },
);
