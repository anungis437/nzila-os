/**
 * POST /api/members/appointments
 * → Django: /api/unions/appointments/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'POST appointments',
      description: 'Proxied to Django: /api/unions/appointments/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/appointments/', { method: 'POST' });
    return response;
  },
);
