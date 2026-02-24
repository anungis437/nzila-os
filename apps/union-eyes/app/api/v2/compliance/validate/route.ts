/**
 * POST /api/compliance/validate
 * Migrated to withApi() framework
 */
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const complianceValidateSchema = z.object({
  jurisdiction: z.boolean().optional(),
  checksToPerform: z.unknown().optional(),
  data: z.unknown().optional(),
});

export const POST = withApi(
  {
    auth: { required: true },
    body: complianceValidateSchema,
    openapi: {
      tags: ['Compliance'],
      summary: 'POST validate',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {
    // TODO: migrate handler body
    throw ApiError.internal('Route not yet migrated');
  },
);
