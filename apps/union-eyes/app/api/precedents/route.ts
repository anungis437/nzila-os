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
import { toPublicPrecedentSummary } from "@/lib/precedents/public-decision-view";
import { withApi } from '@/lib/api/framework';
import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { resolvePrecedentJurisdictions } from '@/lib/precedents/jurisdiction-preference-resolver';

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

// A list filter must name declared values of its column: the database refuses anything else, and that must not come back as a server fault.
function declaredValues(raw: string, allowed: readonly string[]): string[] | null {
  const values = raw.split(",");
  return values.every((value) => allowed.includes(value)) ? values : null;
}

// The precedent reads run in the caller organization's tenant transaction (`rlsOrgContext`): the decisions table is tenant-scoped.
export const GET = withApi(
  {
    auth: { minRole: 'member' },
    rlsOrgContext: true,
    openapi: { tags: ['Precedents'], summary: 'List, filter and rank arbitration precedents' },
  },
  async ({ request, organizationId, userId }) => {
  try {
      const { searchParams } = new URL(request.url);
      const requestJurisdiction = searchParams.get('jurisdiction');
      const jurisdictionPreference = await resolvePrecedentJurisdictions(db, {
        organizationId: organizationId!,
        userId: userId!,
        requestOverride: requestJurisdiction ? [requestJurisdiction] : undefined,
      });
      
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
        const stats = await getPrecedentStatistics(jurisdictionPreference.jurisdictions);
        return NextResponse.json({ ...stats, jurisdictionPreference });
      }

      // Return most cited
      if (mostCited) {
        // Reuse validated, bounded collection limit.
        const precedents = await getMostCitedPrecedents(limit, jurisdictionPreference.jurisdictions);
        return NextResponse.json({ precedents: precedents.map(toPublicPrecedentSummary), jurisdictionPreference });
      }

      // Return by issue type
      if (issueType) {
        // Reuse validated, bounded collection limit.
        const precedents = await getPrecedentsByIssueType(issueType, limit, jurisdictionPreference.jurisdictions);
        return NextResponse.json({ precedents: precedents.map(toPublicPrecedentSummary), count: precedents.length, jurisdictionPreference });
      }

      // Build filters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: Record<string, any> = {};
      
      const tribunal = searchParams.get("tribunal");
      if (tribunal) {
        const values = declaredValues(tribunal, tribunalTypeEnum.enumValues);
        if (!values) return NextResponse.json({ error: "Invalid tribunal filter" }, { status: 400 });
        filters.tribunal = values;
      }

      const decisionType = searchParams.get("decisionType");
      if (decisionType) {
        const values = declaredValues(decisionType, decisionTypeEnum.enumValues);
        if (!values) return NextResponse.json({ error: "Invalid decisionType filter" }, { status: 400 });
        filters.decisionType = values;
      }

      const outcome = searchParams.get("outcome");
      if (outcome) {
        const values = declaredValues(outcome, outcomeEnum.enumValues);
        if (!values) return NextResponse.json({ error: "Invalid outcome filter" }, { status: 400 });
        filters.outcome = values;
      }

      const precedentValue = searchParams.get("precedentValue");
      if (precedentValue) {
        const values = declaredValues(precedentValue, precedentValueEnum.enumValues);
        if (!values) return NextResponse.json({ error: "Invalid precedentValue filter" }, { status: 400 });
        filters.precedentValue = values;
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

      if (jurisdictionPreference.applied) filters.jurisdiction = jurisdictionPreference.jurisdictions;

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
      if ([filters.dateFrom, filters.dateTo].some((date) => date instanceof Date && Number.isNaN(date.getTime()))) {
        return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
      }

      // Pagination
      // Reuse validated, bounded collection page and limit.
      const sortBy = searchParams.get("sortBy") || "decisionDate";
      const sortOrder = searchParams.get("sortOrder") || "desc";
      if (!["decisionDate", "citationCount", "createdAt"].includes(sortBy) || !["asc", "desc"].includes(sortOrder)) {
        return NextResponse.json({ error: "Invalid sort field or order" }, { status: 400 });
      }

      const result = await listPrecedents(filters, { page, limit, sortBy, sortOrder: sortOrder as "asc" | "desc" });

      return NextResponse.json({ ...result, precedents: result.precedents.map(toPublicPrecedentSummary), jurisdictionPreference });
    } catch (error) {
      logger.error('Failed to list the precedents', { error });
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Internal server error',
        error
      );
    }
  },
);


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

// Adding a precedent opens its own tenant transaction and writes its audit record in it (createPrecedentAudited), so the wrapper opens none.
export const POST = withApi(
  {
    auth: { minRole: 'content_manager' },
    openapi: { tags: ['Precedents'], summary: 'Create a precedent draft awaiting review' },
  },
  async ({ request, userId, organizationId }) => {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
    }
    const validation = precedentsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

      // Create a non-public draft. Publication requires an independent reviewed workflow. 
      const precedent = await createPrecedentAudited({ organizationId: organizationId!, userId: userId! }, validation.data);

      return standardSuccessResponse(
      { precedent, publicationStatus: 'pending_review', publiclyDiscoverable: false }
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

      logger.error('Failed to create the precedent', { error });
      return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
  },
);
