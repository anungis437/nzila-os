/**
 * GET POST /api/reconciliation/upload
 * → Django: /api/billing/remittance-approvals/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Reconciliation', 'Django Proxy'],
      summary: 'GET upload',
      description: 'Proxied to Django: /api/billing/remittance-approvals/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/remittance-approvals/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Reconciliation', 'Django Proxy'],
      summary: 'POST upload',
      description: 'Proxied to Django: /api/billing/remittance-approvals/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/remittance-approvals/', { method: 'POST' });
    return response;
  },
);
