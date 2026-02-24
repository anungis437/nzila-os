/**
 * GET PATCH DELETE /api/messaging/campaigns/[id]
 * → Django: /api/notifications/message-threads/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Messaging', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/notifications/message-threads/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/message-threads/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Messaging', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/notifications/message-threads/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/message-threads/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Messaging', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/notifications/message-threads/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/message-threads/', { method: 'DELETE' });
    return response;
  },
);
