/**
 * GET POST /api/deadlines/upcoming
 * → Django: /api/grievances/claim-deadlines/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Deadlines', 'Django Proxy'],
      summary: 'GET upcoming',
      description: 'Proxied to Django: /api/grievances/claim-deadlines/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claim-deadlines/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Deadlines', 'Django Proxy'],
      summary: 'POST upcoming',
      description: 'Proxied to Django: /api/grievances/claim-deadlines/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claim-deadlines/', { method: 'POST' });
    return response;
  },
);
