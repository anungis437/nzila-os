/**
 * GET PATCH DELETE /api/precedents/[id]
 * → Django: /api/bargaining/arbitration-precedents/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Precedents', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/bargaining/arbitration-precedents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/arbitration-precedents/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Precedents', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/bargaining/arbitration-precedents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/arbitration-precedents/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Precedents', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/bargaining/arbitration-precedents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/arbitration-precedents/', { method: 'DELETE' });
    return response;
  },
);
