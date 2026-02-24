/**
 * GET POST /api/portal/documents
 * → Django: /api/content/cms-pages/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Portal', 'Django Proxy'],
      summary: 'GET documents',
      description: 'Proxied to Django: /api/content/cms-pages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/cms-pages/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Portal', 'Django Proxy'],
      summary: 'POST documents',
      description: 'Proxied to Django: /api/content/cms-pages/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/cms-pages/', { method: 'POST' });
    return response;
  },
);
