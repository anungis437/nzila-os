/**
 * GET PATCH DELETE /api/organizing/sequences/[id]
 * → Django: /api/unions/organizing-campaigns/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizing', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/unions/organizing-campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/organizing-campaigns/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizing', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/unions/organizing-campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/organizing-campaigns/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizing', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/unions/organizing-campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/organizing-campaigns/', { method: 'DELETE' });
    return response;
  },
);
