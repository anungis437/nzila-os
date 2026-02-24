/**
 * GET POST /api/messages/notifications
 * → Django: /api/notifications/messages/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Messages', 'Django Proxy'],
      summary: 'GET notifications',
      description: 'Proxied to Django: /api/notifications/messages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/messages/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Messages', 'Django Proxy'],
      summary: 'POST notifications',
      description: 'Proxied to Django: /api/notifications/messages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/messages/', { method: 'POST' });
    return response;
  },
);
