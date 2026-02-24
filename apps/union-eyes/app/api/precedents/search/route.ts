/**
 * Precedent Search API Route
 * POST /api/precedents/search - Search precedents
 */

import { NextResponse } from "next/server";
import { searchPrecedents } from "@/lib/services/precedent-service";
import { z } from "zod";
import { withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const precedentSearchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  filters: z.record(z.string(), z.unknown()).default({}),
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
          validation.error.errors
        );
      }

      const { query, filters, limit } = validation.data;

      const results = await searchPrecedents(query, filters, limit);

      return NextResponse.json({ 
        precedents: results,
        count: results.length
      });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});

