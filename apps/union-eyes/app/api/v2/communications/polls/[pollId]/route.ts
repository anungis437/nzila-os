/**
 * GET PATCH DELETE /api/communications/polls/[pollId]
 * → Django: /api/notifications/campaigns/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Communications', 'Django Proxy'],
      summary: 'GET [pollId]',
      description: 'Proxied to Django: /api/notifications/campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/campaigns/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Communications', 'Django Proxy'],
      summary: 'PATCH [pollId]',
      description: 'Proxied to Django: /api/notifications/campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/campaigns/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Communications', 'Django Proxy'],
      summary: 'DELETE [pollId]',
      description: 'Proxied to Django: /api/notifications/campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/campaigns/', { method: 'DELETE' });
    return response;
  },
);
