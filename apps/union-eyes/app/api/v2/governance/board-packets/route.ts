/**
 * GET POST /api/governance/board-packets
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
      summary: 'GET board-packets',
      description: 'Proxied to Django: /api/compliance/data-classification-policy/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/data-classification-policy/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Governance', 'Django Proxy'],
      summary: 'POST board-packets',
      description: 'Proxied to Django: /api/compliance/data-classification-policy/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/data-classification-policy/', { method: 'POST' });
    return response;
  },
);
