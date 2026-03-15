/**
 * GET POST /api/workbench/assign
 * -> Django ai_core: /api/ai_core/knowledge-base/
 * NOTE: auto-resolved from workbench/assign
 * Auto-migrated by scripts/migrate_routes.py
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Workbench', 'Django Proxy'],
      summary: 'GET assign case',
      description: 'Proxied to Django: /api/ai_core/knowledge-base/',
    },
  },
  async ({ request }) => {
    return djangoProxy(request, '/api/ai_core/knowledge-base/');
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Workbench', 'Django Proxy'],
      summary: 'POST assign case',
      description: 'Proxied to Django: /api/ai_core/knowledge-base/',
    },
  },
  async ({ request }) => {
    return djangoProxy(request, '/api/ai_core/knowledge-base/', { method: 'POST' });
  },
);

