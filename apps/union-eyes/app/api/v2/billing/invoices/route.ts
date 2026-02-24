/**
 * GET POST /api/billing/invoices
 * → Django: /api/core/external-invoices/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Billing', 'Django Proxy'],
      summary: 'GET invoices',
      description: 'Proxied to Django: /api/core/external-invoices/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/core/external-invoices/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Billing', 'Django Proxy'],
      summary: 'POST invoices',
      description: 'Proxied to Django: /api/core/external-invoices/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/core/external-invoices/', { method: 'POST' });
    return response;
  },
);
