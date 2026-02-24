/**
 * GET POST /api/notifications/test
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
      tags: ['Notifications', 'Django Proxy'],
      summary: 'GET test',
      description: 'Proxied to Django: /api/notifications/in-app-notifications/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'POST test',
      description: 'Proxied to Django: /api/notifications/in-app-notifications/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'POST' });
    return response;
  },
);
