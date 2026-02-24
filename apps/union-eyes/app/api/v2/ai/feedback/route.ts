/**
 * GET POST /api/ai/feedback
 * → Django: /api/ai_core/knowledge-base/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Ai', 'Django Proxy'],
      summary: 'GET feedback',
      description: 'Proxied to Django: /api/ai_core/knowledge-base/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/knowledge-base/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Ai', 'Django Proxy'],
      summary: 'POST feedback',
      description: 'Proxied to Django: /api/ai_core/knowledge-base/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/knowledge-base/', { method: 'POST' });
    return response;
  },
);
