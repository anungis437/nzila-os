/**
 * GET POST /api/meeting-rooms
 * → Django: /api/unions/meeting-rooms/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Meeting-rooms', 'Django Proxy'],
      summary: 'GET meeting-rooms',
      description: 'Proxied to Django: /api/unions/meeting-rooms/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/meeting-rooms/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Meeting-rooms', 'Django Proxy'],
      summary: 'POST meeting-rooms',
      description: 'Proxied to Django: /api/unions/meeting-rooms/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/meeting-rooms/', { method: 'POST' });
    return response;
  },
);
