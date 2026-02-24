/**
 * GET POST /api/jurisdiction/clc-compliance
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
      tags: ['Jurisdiction', 'Django Proxy'],
      summary: 'GET clc-compliance',
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
      tags: ['Jurisdiction', 'Django Proxy'],
      summary: 'POST clc-compliance',
      description: 'Proxied to Django: /api/unions/bargaining-units/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/bargaining-units/', { method: 'POST' });
    return response;
  },
);
