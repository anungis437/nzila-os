/**
 * GET PATCH DELETE /api/calendar-sync/connections/[id]/sync
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
      summary: 'GET sync',
      description: 'Proxied to Django: /api/unions/external-calendar-connections/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/external-calendar-connections/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendar-sync', 'Django Proxy'],
      summary: 'PATCH sync',
      description: 'Proxied to Django: /api/unions/external-calendar-connections/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/external-calendar-connections/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendar-sync', 'Django Proxy'],
      summary: 'DELETE sync',
      description: 'Proxied to Django: /api/unions/external-calendar-connections/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/external-calendar-connections/', { method: 'DELETE' });
    return response;
  },
);
