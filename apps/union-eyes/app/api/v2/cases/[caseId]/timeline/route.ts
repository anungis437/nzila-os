/**
 * GET /api/cases/[caseId]/timeline
 * → Django: /api/grievances/grievance-timeline/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cases', 'Django Proxy'],
      summary: 'GET timeline',
      description: 'Proxied to Django: /api/grievances/grievance-timeline/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/grievance-timeline/');
    return response;
  },
);
