/**
 * GET PATCH DELETE /api/support/tickets/[id]/comments
 * → Django: /api/notifications/in-app-notifications/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Support', 'Django Proxy'],
      summary: 'GET comments',
      description: 'Proxied to Django: /api/notifications/in-app-notifications/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Support', 'Django Proxy'],
      summary: 'PATCH comments',
      description: 'Proxied to Django: /api/notifications/in-app-notifications/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Support', 'Django Proxy'],
      summary: 'DELETE comments',
      description: 'Proxied to Django: /api/notifications/in-app-notifications/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'DELETE' });
    return response;
  },
);
