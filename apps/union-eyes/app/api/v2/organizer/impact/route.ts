/**
 * GET POST /api/organizer/impact
 * → Django: /api/unions/organizer-tasks/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizer', 'Django Proxy'],
      summary: 'GET impact',
      description: 'Proxied to Django: /api/unions/organizer-tasks/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/organizer-tasks/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizer', 'Django Proxy'],
      summary: 'POST impact',
      description: 'Proxied to Django: /api/unions/organizer-tasks/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/organizer-tasks/', { method: 'POST' });
    return response;
  },
);
