/**
 * GET PATCH DELETE /api/messages/threads/[threadId]
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
      summary: 'GET [threadId]',
      description: 'Proxied to Django: /api/notifications/messages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/messages/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Messages', 'Django Proxy'],
      summary: 'PATCH [threadId]',
      description: 'Proxied to Django: /api/notifications/messages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/messages/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Messages', 'Django Proxy'],
      summary: 'DELETE [threadId]',
      description: 'Proxied to Django: /api/notifications/messages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/messages/', { method: 'DELETE' });
    return response;
  },
);
