import { NextResponse } from 'next/server';
/**
 * POST /api/precedents/search
 * Migrated to withApi() framework
 */
import { searchPrecedents } from "@/lib/services/precedent-service";
 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const precedentSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  filters: z.record(z.string(), z.unknown()).default({}),
  limit: z.number().int().min(1).max(100).default(50),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: precedentSearchSchema,
    openapi: {
      tags: ['Precedents'],
      summary: 'POST search',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          // Validate request body
          const { query: searchQuery, filters, limit } = body;
          const results = await searchPrecedents(searchQuery, filters, limit);
          return NextResponse.json({ 
            precedents: results,
            count: results.length
          });
  },
);
