/**
 * GET /api/reports/datasources
 * Migrated to withApi() framework
 */

 
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Reports'],
      summary: 'GET datasources',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
  },
);
