/**
 * Precedent Search API Route
 * POST /api/precedents/search - Search precedents
 */

import { NextResponse } from "next/server";
import { searchPrecedents } from "@/lib/services/precedent-service";
import { z } from "zod";
import { toPublicPrecedentSummary } from "@/lib/precedents/public-decision-view";
import { withRoleAuth } from '@/lib/api-auth-guard';

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
    })
    .partial()
    .strict()
    .prefault({}),
  limit: z.number().int().min(1).max(100).default(50),
});
export const POST = withRoleAuth('steward', async (request, _context) => {
  try {
      const body = await request.json();
      
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

      const results = await searchPrecedents(query, filters, limit);

      return NextResponse.json({ 
        precedents: results.map(toPublicPrecedentSummary),
        count: results.length
      });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'INVALID_PRECEDENT_FILTER') {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, (error as Error).message);
      }
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});

