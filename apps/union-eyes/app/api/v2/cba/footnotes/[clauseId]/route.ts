/**
 * GET PATCH DELETE /api/cba/footnotes/[clauseId]
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
      summary: 'GET [clauseId]',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cba', 'Django Proxy'],
      summary: 'PATCH [clauseId]',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cba', 'Django Proxy'],
      summary: 'DELETE [clauseId]',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/', { method: 'DELETE' });
    return response;
  },
);
