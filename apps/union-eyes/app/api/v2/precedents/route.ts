import { NextResponse } from 'next/server';
/**
 * GET POST /api/precedents
 * Migrated to withApi() framework
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
 
 
 
 
 
 
 
 
 
 
import {
  listPrecedents,
  createPrecedent,
  getPrecedentStatistics,
  getMostCitedPrecedents,
  getPrecedentsByIssueType,
} from '@/lib/services/precedent-service';

const precedentsSchema = z.object({
  caseNumber: z.unknown().optional(),
  caseTitle: z.string().min(1, 'caseTitle is required'),
  tribunal: z.unknown().optional(),
  decisionType: z.boolean().optional(),
  decisionDate: z.boolean().optional(),
  arbitrator: z.unknown().optional(),
  union: z.unknown().optional(),
  employer: z.unknown().optional(),
  outcome: z.unknown().optional(),
  precedentValue: z.unknown().optional(),
  fullText: z.unknown().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Precedents'],
      summary: 'GET precedents',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

          const { searchParams } = new URL(request.url);
          // Check for special modes
          const statistics = searchParams.get("statistics") === "true";
          const mostCited = searchParams.get("mostCited") === "true";
          const issueType = searchParams.get("issueType");
          // Return statistics
          if (statistics) {
            const stats = await getPrecedentStatistics();
            return stats;
          }
          // Return most cited
          if (mostCited) {
            const limit = parseInt(searchParams.get("limit") || "10");
            const precedents = await getMostCitedPrecedents(limit);
            return NextResponse.json({ precedents });
          }
          // Return by issue type
          if (issueType) {
            const limit = parseInt(searchParams.get("limit") || "20");
            const precedents = await getPrecedentsByIssueType(issueType, limit);
            return NextResponse.json({ precedents, count: precedents.length });
          }
          // Build filters
          const filters: Record<string, unknown> = {};
          const tribunal = searchParams.get("tribunal");
          if (tribunal) {
            filters.tribunal = tribunal.split(",");
          }
          const decisionType = searchParams.get("decisionType");
          if (decisionType) {
            filters.decisionType = decisionType.split(",");
          }
          const outcome = searchParams.get("outcome");
          if (outcome) {
            filters.outcome = outcome.split(",");
          }
          const precedentValue = searchParams.get("precedentValue");
          if (precedentValue) {
            filters.precedentValue = precedentValue.split(",");
          }
          const arbitrator = searchParams.get("arbitrator");
          if (arbitrator) {
            filters.arbitrator = arbitrator;
          }
          const union = searchParams.get("union");
          if (union) {
            filters.union = union;
          }
          const employer = searchParams.get("employer");
          if (employer) {
            filters.employer = employer;
          }
          const jurisdiction = searchParams.get("jurisdiction");
          if (jurisdiction) {
            filters.jurisdiction = jurisdiction;
          }
          const sector = searchParams.get("sector");
          if (sector) {
            filters.sector = sector;
          }
          const searchQuery = searchParams.get("searchQuery");
          if (searchQuery) {
            filters.searchQuery = searchQuery;
          }
          // Date filters
          const dateFrom = searchParams.get("dateFrom");
          if (dateFrom) {
            filters.dateFrom = new Date(dateFrom);
          }
          const dateTo = searchParams.get("dateTo");
          if (dateTo) {
            filters.dateTo = new Date(dateTo);
          }
          // Pagination
          const page = parseInt(searchParams.get("page") || "1");
          const limit = parseInt(searchParams.get("limit") || "20");
          const sortBy = searchParams.get("sortBy") || "decisionDate";
          const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
          const result = await listPrecedents(filters, { page, limit, sortBy, sortOrder });
          return result;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: precedentsSchema,
    openapi: {
      tags: ['Precedents'],
      summary: 'POST precedents',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          // Validate request body
        // Validate required fields
          if (!body.caseNumber) {
            throw ApiError.internal('caseNumber is required'
        );
          }
          if (!body.caseTitle) {
            throw ApiError.internal('caseTitle is required'
        );
          }
          if (!body.tribunal) {
            throw ApiError.internal('tribunal is required'
        );
          }
          if (!body.decisionType) {
            throw ApiError.internal('decisionType is required'
        );
          }
          if (!body.decisionDate) {
            throw ApiError.internal('decisionDate is required'
        );
          }
          if (!body.arbitrator) {
            throw ApiError.internal('arbitrator is required'
        );
          }
          if (!body.union) {
            throw ApiError.internal('union is required'
        );
          }
          if (!body.employer) {
            throw ApiError.internal('employer is required'
        );
          }
          if (!body.outcome) {
            throw ApiError.internal('outcome is required'
        );
          }
          if (!body.precedentValue) {
            throw ApiError.internal('precedentValue is required'
        );
          }
          if (!body.fullText) {
            throw ApiError.internal('fullText is required'
        );
          }
          // Create precedent
          const precedent = await createPrecedent(body as unknown as Parameters<typeof createPrecedent>[0]);
          return {  precedent  };
  },
);
