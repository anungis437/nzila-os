/**
 * GET /api/test-auth
 * Migrated to withApi() framework
 */
 
 
 
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Test-auth'],
      summary: 'GET test-auth',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        const DJANGO = process.env.DJANGO_URL;
        const r = await fetch(`${DJANGO}/api/auth_core/health/`, { cache: 'no-store' });
        const healthStatus = r.status;
        const healthBody = await r.json();
        return { healthStatus, healthBody };
  },
);
