/**
 * GET POST /api/clauses
 * → Django: /api/bargaining/cba-clauses/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Clauses', 'Django Proxy'],
      summary: 'GET clauses',
      description: 'Proxied to Django: /api/bargaining/cba-clauses/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/cba-clauses/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Clauses', 'Django Proxy'],
      summary: 'POST clauses',
      description: 'Proxied to Django: /api/bargaining/cba-clauses/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/cba-clauses/', { method: 'POST' });
    return response;
  },
);
