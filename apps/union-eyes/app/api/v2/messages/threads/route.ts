/**
 * GET POST /api/messages/threads
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
      summary: 'GET threads',
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
      summary: 'POST threads',
      description: 'Proxied to Django: /api/notifications/messages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/messages/', { method: 'POST' });
    return response;
  },
);
