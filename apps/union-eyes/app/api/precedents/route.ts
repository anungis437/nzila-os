/**
 * Precedents API Routes - Main endpoints for arbitration decisions
 * GET /api/precedents - List precedents with filtering
 * POST /api/precedents - Create a new precedent (platform content managers only)
 */

import { NextResponse } from "next/server";
import { 
  listPrecedents, 
  getPrecedentStatistics,
  getMostCitedPrecedents,
  getPrecedentsByIssueType
} from "@/lib/services/precedent-service";
import { createPrecedentAudited } from "@/lib/services/precedent-audited-service";
import { tribunalTypeEnum, decisionTypeEnum, outcomeEnum, precedentValueEnum } from "@/db/schema";
import { z } from "zod";
import { withRoleAuth } from '@/lib/api-auth-guard';

 
 
 
 
 
 
 
 
 
 
 
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
// DEF-0B11-PRP-PRECEDENT-COLLECTION-GET-TAKES-UNBOUNDED-LIMIT-AND-PAGE-FROM-THE-QUERY-STRING
// Reject rather than silently clamp invalid pagination: a caller must not request an unbounded scan.
function boundedPositiveInt(raw: string | null, fallback: number, max: number): number | null {
  if (raw === null) return fallback;
  if (!/^[1-9][0-9]{0,5}$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

export const GET = withRoleAuth('member', async (request, _context) => {
  try {
      const { searchParams } = new URL(request.url);
      
      const page = boundedPositiveInt(searchParams.get("page"), 1, 10000);
      const mostCited = searchParams.get("mostCited") === "true";
      const limit = boundedPositiveInt(searchParams.get("limit"), mostCited ? 10 : 20, 100);
      if (page === null || limit === null) {
        return NextResponse.json({ error: "Invalid pagination: page must be 1..10000 and limit 1..100" }, { status: 400 });
      }

      // Check for special modes
      const statistics = searchParams.get("statistics") === "true";
      const issueType = searchParams.get("issueType");

      // Return statistics
      if (statistics) {
        const stats = await getPrecedentStatistics();
        return NextResponse.json(stats);
      }

      // Return most cited
      if (mostCited) {
        // Reuse validated, bounded collection limit.
        const precedents = await getMostCitedPrecedents(limit);
        return NextResponse.json({ precedents });
      }

      // Return by issue type
      if (issueType) {
        // Reuse validated, bounded collection limit.
        const precedents = await getPrecedentsByIssueType(issueType, limit);
        return NextResponse.json({ precedents, count: precedents.length });
      }

      // Build filters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: Record<string, any> = {};
      
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
      // Reuse validated, bounded collection page and limit.
      const sortBy = searchParams.get("sortBy") || "decisionDate";
      const sortOrder = searchParams.get("sortOrder") || "desc";
      if (!["decisionDate", "citationCount", "createdAt"].includes(sortBy) || !["asc", "desc"].includes(sortOrder)) {
        return NextResponse.json({ error: "Invalid sort field or order" }, { status: 400 });
      }

      const result = await listPrecedents(filters, { page, limit, sortBy, sortOrder: sortOrder as "asc" | "desc" });

      return NextResponse.json(result);
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});


// The precedent library is shared across tenants, so only a platform-elevated role may add to it.
const precedentsSchema = z.object({
  caseNumber: z.string().min(1).max(100),
  caseTitle: z.string().min(1, 'caseTitle is required').max(500),
  tribunal: z.enum(tribunalTypeEnum.enumValues),
  decisionType: z.enum(decisionTypeEnum.enumValues),
  decisionDate: z.coerce.date(),
  filingDate: z.coerce.date().optional(),
  hearingDate: z.coerce.date().optional(),
  arbitrator: z.string().min(1).max(200),
  panelMembers: z.array(z.string()).optional(),
  grievor: z.string().max(300).optional(),
  union: z.string().min(1).max(300),
  employer: z.string().min(1).max(300),
  outcome: z.enum(outcomeEnum.enumValues),
  precedentValue: z.enum(precedentValueEnum.enumValues),
  keyFindings: z.array(z.string()).optional(),
  issueTypes: z.array(z.string()).optional(),
  fullText: z.string().min(1),
  summary: z.string().optional(),
  headnote: z.string().optional(),
  precedentSummary: z.string().optional(),
  reasoning: z.string().optional(),
  keyFacts: z.string().optional(),
  sector: z.string().max(100).optional(),
  jurisdiction: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
});

export const POST = withRoleAuth('content_manager', async (request, context) => {
  const { userId, organizationId } = context;
  if (!userId || !organizationId) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'No active organization');
  }
  try {
      const body = await request.json();
    const validation = precedentsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

      // Create precedent
      const precedent = await createPrecedentAudited({ organizationId, userId }, validation.data);

      return standardSuccessResponse(
      {  precedent  }
    );
    } catch (error) {
// Handle unique constraint violations
      if (error && typeof error === 'object' && 'code' in error && error.code === "23505") {
        return standardErrorResponse(
      ErrorCode.ALREADY_EXISTS,
      'Case number already exists',
      error
    );
      }

      return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});
