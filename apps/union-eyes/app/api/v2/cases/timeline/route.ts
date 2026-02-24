/**
 * GET POST /api/cases/timeline
 * → Django: /api/grievances/grievances/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cases', 'Django Proxy'],
      summary: 'GET timeline',
      description: 'Proxied to Django: /api/grievances/grievances/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/grievances/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cases', 'Django Proxy'],
      summary: 'POST timeline',
      description: 'Proxied to Django: /api/grievances/grievances/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/grievances/', { method: 'POST' });
    return response;
  },
);
