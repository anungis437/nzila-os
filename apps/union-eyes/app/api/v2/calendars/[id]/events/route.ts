/**
 * GET PATCH DELETE /api/calendars/[id]/events
 * → Django: /api/unions/calendars/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendars', 'Django Proxy'],
      summary: 'GET events',
      description: 'Proxied to Django: /api/unions/calendars/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendars/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendars', 'Django Proxy'],
      summary: 'PATCH events',
      description: 'Proxied to Django: /api/unions/calendars/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendars/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendars', 'Django Proxy'],
      summary: 'DELETE events',
      description: 'Proxied to Django: /api/unions/calendars/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendars/', { method: 'DELETE' });
    return response;
  },
);
