/**
 * GET PATCH /api/admin/feature-flags
 * Migrated to withApi() framework
 */
 
 
 
 
 
 
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const toggleFlagSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    openapi: {
      tags: ['Admin'],
      summary: 'GET feature-flags',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    body: toggleFlagSchema,
    openapi: {
      tags: ['Admin'],
      summary: 'PATCH feature-flags',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
  },
);
