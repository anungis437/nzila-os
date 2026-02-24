/**
 * GET POST /api/calendar/events
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
      summary: 'GET events',
      description: 'Proxied to Django: /api/unions/calendar-events/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendar-events/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendar', 'Django Proxy'],
      summary: 'POST events',
      description: 'Proxied to Django: /api/unions/calendar-events/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendar-events/', { method: 'POST' });
    return response;
  },
);
