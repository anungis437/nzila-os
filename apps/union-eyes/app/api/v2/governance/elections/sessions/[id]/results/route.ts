/**
 * GET /api/governance/elections/sessions/[id]/results
 * → Django: /api/compliance/data-classification-policy/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Governance', 'Django Proxy'],
      summary: 'GET results',
      description: 'Proxied to Django: /api/compliance/data-classification-policy/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/data-classification-policy/');
    return response;
  },
);
