/**
 * GET /api/voting/sessions/[id]/results
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
      tags: ['Voting', 'Django Proxy'],
      summary: 'GET results',
      description: 'Proxied to Django: /api/unions/voting-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/voting-sessions/');
    return response;
  },
);
