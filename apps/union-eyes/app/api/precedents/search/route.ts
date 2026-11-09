/**
 * Precedent Search API Route
 * POST /api/precedents/search - Search precedents
 */

import { NextResponse } from "next/server";
import { searchPrecedents } from "@/lib/services/precedent-service";
import { z } from "zod";
import { toPublicPrecedentSummary } from "@/lib/precedents/public-decision-view";
import { withApi } from '@/lib/api/framework';
import { logger } from '@/lib/logger';
import { db } from '@/db/db';
import { resolvePrecedentJurisdictions } from '@/lib/precedents/jurisdiction-preference-resolver';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const precedentSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  // Only the filters the search reads, each a bounded list of bounded strings; their values are checked against the column's declared values.
  filters: z
    .object({
      precedentValue: z.array(z.string().max(50)).max(10),
      tribunal: z.array(z.string().max(50)).max(20),
      jurisdiction: z.array(z.string().min(2).max(20)).max(16),
    })
    .partial()
    .strict()
    .prefault({}),
  limit: z.number().int().min(1).max(100).default(50),
});

// The search reads the tenant-scoped decisions table in the caller organization's tenant transaction (`rlsOrgContext`).
export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    rlsOrgContext: true,
    openapi: { tags: ['Precedents'], summary: 'Search arbitration precedents' },
  },
  async ({ request, organizationId, userId }) => {
  try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
      }
      
      // Validate request body
      const validation = precedentSearchSchema.safeParse(body);
      if (!validation.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid search request',
          validation.error.issues
        );
      }

      const { query, filters, limit } = validation.data;
      const jurisdictionPreference = await resolvePrecedentJurisdictions(db, {
        organizationId: organizationId!,
        userId: userId!,
        requestOverride: filters.jurisdiction,
      });

      const results = await searchPrecedents(query, {
        ...filters,
        jurisdiction: jurisdictionPreference.applied ? jurisdictionPreference.jurisdictions : undefined,
      }, limit);

      return NextResponse.json({ 
        precedents: results.map(toPublicPrecedentSummary),
        count: results.length,
        jurisdictionPreference,
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'INVALID_PRECEDENT_FILTER') {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, (error as Error).message);
      }
      logger.error('Failed to search the precedents', { error });
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Internal server error',
        error
      );
    }
  },
);
