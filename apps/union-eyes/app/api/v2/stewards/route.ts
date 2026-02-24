/**
 * GET POST /api/stewards
 * → Django: /api/unions/steward-assignments/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Stewards', 'Django Proxy'],
      summary: 'GET stewards',
      description: 'Proxied to Django: /api/unions/steward-assignments/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/steward-assignments/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Stewards', 'Django Proxy'],
      summary: 'POST stewards',
      description: 'Proxied to Django: /api/unions/steward-assignments/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/steward-assignments/', { method: 'POST' });
    return response;
  },
);
