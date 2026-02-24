/**
 * GET POST /api/onboarding
 * → Django: /api/auth_core/pending-profiles/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Onboarding', 'Django Proxy'],
      summary: 'GET onboarding',
      description: 'Proxied to Django: /api/auth_core/pending-profiles/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/pending-profiles/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Onboarding', 'Django Proxy'],
      summary: 'POST onboarding',
      description: 'Proxied to Django: /api/auth_core/pending-profiles/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/pending-profiles/', { method: 'POST' });
    return response;
  },
);
