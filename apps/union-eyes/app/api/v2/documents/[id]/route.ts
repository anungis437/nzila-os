/**
 * GET PATCH DELETE /api/documents/[id]
 * → Django: /api/content/documents/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Documents', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/content/documents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/documents/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Documents', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/content/documents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/documents/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Documents', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/content/documents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/documents/', { method: 'DELETE' });
    return response;
  },
);
