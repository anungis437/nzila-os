/**
 * GET POST /api/executive/metrics
 * → Django: /api/unions/federation-executives/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Executive', 'Django Proxy'],
      summary: 'GET metrics',
      description: 'Proxied to Django: /api/unions/federation-executives/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/federation-executives/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Executive', 'Django Proxy'],
      summary: 'POST metrics',
      description: 'Proxied to Django: /api/unions/federation-executives/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/federation-executives/', { method: 'POST' });
    return response;
  },
);
