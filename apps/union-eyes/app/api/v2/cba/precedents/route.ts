/**
 * GET POST /api/cba/precedents
 * → Django: /api/bargaining/collective-agreements/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cba', 'Django Proxy'],
      summary: 'GET precedents',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cba', 'Django Proxy'],
      summary: 'POST precedents',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/', { method: 'POST' });
    return response;
  },
);
