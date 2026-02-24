/**
 * GET POST /api/calendar-sync/microsoft/callback
 * → Django: /api/unions/external-calendar-connections/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendar-sync', 'Django Proxy'],
      summary: 'GET callback',
      description: 'Proxied to Django: /api/unions/external-calendar-connections/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/external-calendar-connections/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendar-sync', 'Django Proxy'],
      summary: 'POST callback',
      description: 'Proxied to Django: /api/unions/external-calendar-connections/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/external-calendar-connections/', { method: 'POST' });
    return response;
  },
);
