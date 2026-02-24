/**
 * GET POST /api/storage/cleanup
 * → Django: /api/content/cms-media-library/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Storage', 'Django Proxy'],
      summary: 'GET cleanup',
      description: 'Proxied to Django: /api/content/cms-media-library/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/cms-media-library/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Storage', 'Django Proxy'],
      summary: 'POST cleanup',
      description: 'Proxied to Django: /api/content/cms-media-library/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/cms-media-library/', { method: 'POST' });
    return response;
  },
);
