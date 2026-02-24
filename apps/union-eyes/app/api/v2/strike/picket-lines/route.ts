/**
 * GET POST /api/strike/picket-lines
 * → Django: /api/unions/voting-sessions/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Strike', 'Django Proxy'],
      summary: 'GET picket-lines',
      description: 'Proxied to Django: /api/unions/voting-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/voting-sessions/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Strike', 'Django Proxy'],
      summary: 'POST picket-lines',
      description: 'Proxied to Django: /api/unions/voting-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/voting-sessions/', { method: 'POST' });
    return response;
  },
);
