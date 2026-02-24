/**
 * GET POST /api/messaging/campaigns
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
      summary: 'GET campaigns',
      description: 'Proxied to Django: /api/notifications/message-threads/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/message-threads/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Messaging', 'Django Proxy'],
      summary: 'POST campaigns',
      description: 'Proxied to Django: /api/notifications/message-threads/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/message-threads/', { method: 'POST' });
    return response;
  },
);
