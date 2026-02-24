/**
 * GET POST /api/cba/clauses/compare
 * → Django: /api/bargaining/collective-agreements/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cba', 'Django Proxy'],
      summary: 'GET compare',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cba', 'Django Proxy'],
      summary: 'POST compare',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/', { method: 'POST' });
    return response;
  },
);
