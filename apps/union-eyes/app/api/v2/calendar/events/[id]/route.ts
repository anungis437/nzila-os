/**
 * GET PATCH DELETE /api/calendar/events/[id]
 * → Django: /api/unions/calendar-events/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendar', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/unions/calendar-events/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendar-events/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendar', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/unions/calendar-events/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendar-events/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendar', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/unions/calendar-events/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendar-events/', { method: 'DELETE' });
    return response;
  },
);
