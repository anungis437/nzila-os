/**
 * GET PATCH DELETE /api/messages/threads/[threadId]/messages
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
      summary: 'GET messages',
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
      summary: 'PATCH messages',
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
      summary: 'DELETE messages',
      description: 'Proxied to Django: /api/notifications/messages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/messages/', { method: 'DELETE' });
    return response;
  },
);
