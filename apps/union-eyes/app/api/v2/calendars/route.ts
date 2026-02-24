/**
 * GET POST /api/calendars
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
      summary: 'GET calendars',
      description: 'Proxied to Django: /api/unions/calendars/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendars/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Calendars', 'Django Proxy'],
      summary: 'POST calendars',
      description: 'Proxied to Django: /api/unions/calendars/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/calendars/', { method: 'POST' });
    return response;
  },
);
