/**
 * Precedents API Routes - Main endpoints for arbitration decisions
 * GET /api/precedents - List precedents with filtering
 * POST /api/precedents - Create a new precedent
 */

import { NextResponse } from "next/server";
import { 
  listPrecedents, 
  createPrecedent,
  getPrecedentStatistics,
  getMostCitedPrecedents,
  getPrecedentsByIssueType
} from "@/lib/services/precedent-service";
import { z } from "zod";
import { withRoleAuth } from '@/lib/api-auth-guard';

 
 
 
 
 
 
 
 
 
 
 
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('member', async (request, _context) => {
  try {
      const { searchParams } = new URL(request.url);
      
      // Check for special modes
      const statistics = searchParams.get("statistics") === "true";
      const mostCited = searchParams.get("mostCited") === "true";
      const issueType = searchParams.get("issueType");

      // Return statistics
      if (statistics) {
        const stats = await getPrecedentStatistics();
        return NextResponse.json(stats);
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
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
      const sortBy = searchParams.get("sortBy") || "decisionDate";
      const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

      const result = await listPrecedents(filters, { page, limit, sortBy, sortOrder });

      return NextResponse.json(result);
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});


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

export const POST = withRoleAuth('steward', async (request, _context) => {
  try {
      const body = await request.json();
    // Validate request body
    const validation = precedentsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { caseNumber: _caseNumber, caseTitle: _caseTitle, tribunal: _tribunal, decisionType: _decisionType, decisionDate: _decisionDate, arbitrator: _arbitrator, union: _union, employer: _employer, outcome: _outcome, precedentValue: _precedentValue, fullText: _fullText } = validation.data;

      // Validate required fields
      if (!body.caseNumber) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'caseNumber is required'
    );
      }

      if (!body.caseTitle) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'caseTitle is required'
    );
      }

      if (!body.tribunal) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'tribunal is required'
    );
      }

      if (!body.decisionType) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'decisionType is required'
    );
      }

      if (!body.decisionDate) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'decisionDate is required'
    );
      }

      if (!body.arbitrator) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'arbitrator is required'
    );
      }

      if (!body.union) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'union is required'
    );
      }

      if (!body.employer) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'employer is required'
    );
      }

      if (!body.outcome) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'outcome is required'
    );
      }

      if (!body.precedentValue) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'precedentValue is required'
    );
      }

      if (!body.fullText) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'fullText is required'
    );
      }

      // Create precedent
      const precedent = await createPrecedent(body);

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

