/**
 * GET POST /api/v1/claims
 * → Django: /api/grievances/claims/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['V1', 'Django Proxy'],
      summary: 'GET claims',
      description: 'Proxied to Django: /api/grievances/claims/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claims/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['V1', 'Django Proxy'],
      summary: 'POST claims',
      description: 'Proxied to Django: /api/grievances/claims/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claims/', { method: 'POST' });
    return response;
  },
);
