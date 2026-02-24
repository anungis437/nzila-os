/**
 * GET PATCH DELETE /api/governance/board-packets/[id]
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
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/compliance/data-classification-policy/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/data-classification-policy/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Governance', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/compliance/data-classification-policy/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/data-classification-policy/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Governance', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/compliance/data-classification-policy/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/data-classification-policy/', { method: 'DELETE' });
    return response;
  },
);
