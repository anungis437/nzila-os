/**
 * GET PATCH DELETE /api/deadlines/[id]/extend
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
      summary: 'GET extend',
      description: 'Proxied to Django: /api/grievances/claim-deadlines/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claim-deadlines/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Deadlines', 'Django Proxy'],
      summary: 'PATCH extend',
      description: 'Proxied to Django: /api/grievances/claim-deadlines/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claim-deadlines/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Deadlines', 'Django Proxy'],
      summary: 'DELETE extend',
      description: 'Proxied to Django: /api/grievances/claim-deadlines/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claim-deadlines/', { method: 'DELETE' });
    return response;
  },
);
