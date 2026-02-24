/**
 * GET POST /api/cope/canvassing
 * → Django: /api/billing/donation-campaigns/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cope', 'Django Proxy'],
      summary: 'GET canvassing',
      description: 'Proxied to Django: /api/billing/donation-campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/donation-campaigns/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cope', 'Django Proxy'],
      summary: 'POST canvassing',
      description: 'Proxied to Django: /api/billing/donation-campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/donation-campaigns/', { method: 'POST' });
    return response;
  },
);
