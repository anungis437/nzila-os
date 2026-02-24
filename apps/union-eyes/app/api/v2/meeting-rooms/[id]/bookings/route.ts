/**
 * GET PATCH DELETE /api/meeting-rooms/[id]/bookings
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
      summary: 'GET bookings',
      description: 'Proxied to Django: /api/unions/meeting-rooms/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/meeting-rooms/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Meeting-rooms', 'Django Proxy'],
      summary: 'PATCH bookings',
      description: 'Proxied to Django: /api/unions/meeting-rooms/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/meeting-rooms/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Meeting-rooms', 'Django Proxy'],
      summary: 'DELETE bookings',
      description: 'Proxied to Django: /api/unions/meeting-rooms/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/meeting-rooms/', { method: 'DELETE' });
    return response;
  },
);
