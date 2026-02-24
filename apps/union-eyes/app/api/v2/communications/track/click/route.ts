/**
 * GET POST /api/communications/track/click
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
      summary: 'GET click',
      description: 'Proxied to Django: /api/notifications/campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/campaigns/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Communications', 'Django Proxy'],
      summary: 'POST click',
      description: 'Proxied to Django: /api/notifications/campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/campaigns/', { method: 'POST' });
    return response;
  },
);
