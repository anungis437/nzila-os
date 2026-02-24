/**
 * GET POST /api/ml/monitoring/drift
 * → Django: /api/ai_core/ml-predictions/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Ml', 'Django Proxy'],
      summary: 'GET drift',
      description: 'Proxied to Django: /api/ai_core/ml-predictions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/ml-predictions/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Ml', 'Django Proxy'],
      summary: 'POST drift',
      description: 'Proxied to Django: /api/ai_core/ml-predictions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/ai_core/ml-predictions/', { method: 'POST' });
    return response;
  },
);
