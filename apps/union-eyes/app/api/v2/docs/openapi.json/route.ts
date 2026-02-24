/**
 * GET /api/docs/openapi.json
 * Migrated to withApi() framework
 */
 
 
 
 
 
 
 
import { withApi, ApiError } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Docs'],
      summary: 'GET openapi.json',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
  },
);
