/**
 * POST /api/upload
 * → Django: /api/content/cms-media-library/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Upload', 'Django Proxy'],
      summary: 'POST upload',
      description: 'Proxied to Django: /api/content/cms-media-library/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/cms-media-library/', { method: 'POST' });
    return response;
  },
);
