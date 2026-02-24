/**
 * GET POST /api/locals
 * → Django: /api/unions/bargaining-units/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Locals', 'Django Proxy'],
      summary: 'GET locals',
      description: 'Proxied to Django: /api/unions/bargaining-units/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/bargaining-units/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Locals', 'Django Proxy'],
      summary: 'POST locals',
      description: 'Proxied to Django: /api/unions/bargaining-units/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/bargaining-units/', { method: 'POST' });
    return response;
  },
);
