/**
 * GET POST /api/bargaining/tentative-agreements
 * → Django: /api/bargaining/tentative-agreements/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'GET tentative-agreements',
      description: 'Proxied to Django: /api/bargaining/tentative-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/tentative-agreements/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'POST tentative-agreements',
      description: 'Proxied to Django: /api/bargaining/tentative-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/tentative-agreements/', { method: 'POST' });
    return response;
  },
);
