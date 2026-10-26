/**
 * Clause API Routes - Individual clause operations
 * GET /api/clauses/[id] - Get clause by ID
 * PATCH /api/clauses/[id] - Update clause
 * DELETE /api/clauses/[id] - Delete clause
 *
 * Every operation is scoped to the caller's organization; a clause in another organization is a 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getClauseForOrganization,
  getClauseHierarchyForOrganization,
  updateClauseAudited,
  deleteClauseAudited,
} from "@/lib/services/clause-audited-service";
import { withRoleAuth } from '@/lib/api-auth-guard';
import { clauseTypeEnum } from '@/db/schema';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const updateClauseSchema = z.object({
  clauseNumber: z.string().min(1).max(50).optional(),
  clauseType: z.enum(clauseTypeEnum.enumValues).optional(),
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  contentPlainText: z.string().optional(),
  pageNumber: z.number().int().optional(),
  articleNumber: z.string().max(50).optional(),
  sectionHierarchy: z.array(z.string()).optional(),
  orderIndex: z.number().int().optional(),
  keyTerms: z.array(z.string()).optional(),
  interpretationNotes: z.string().optional(),
}).strict();

export const GET = async (request: NextRequest, { params: pendingParams }: { params: Promise<{ id: string }> }) => {
  // Next 16 supplies route params as a Promise.
  const params = await pendingParams;
  return withRoleAuth('member', async (request, context) => {
    const { organizationId } = context;
    if (!organizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'No active organization');
    }

  try {
      const { id } = params;
      const { searchParams } = new URL(request.url);

      const includeHierarchy = searchParams.get("includeHierarchy") === "true";

      if (includeHierarchy) {
        const hierarchy = await getClauseHierarchyForOrganization(organizationId, id);
        
        if (!hierarchy) {
          return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Clause not found'
    );
        }

        return NextResponse.json(hierarchy);
      }

      // Fetch clause
      const clause = await getClauseForOrganization(organizationId, id, { countView: true });

      if (!clause) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Clause not found'
    );
      }

      return NextResponse.json({ clause });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
    })(request, { params });
};

export const PATCH = async (request: NextRequest, { params: pendingParams }: { params: Promise<{ id: string }> }) => {
  // Next 16 supplies route params as a Promise.
  const params = await pendingParams;
  return withRoleAuth('steward', async (request, context) => {
    const { organizationId, userId } = context;
    if (!organizationId || !userId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'No active organization');
    }

  try {
      const { id } = params;
      const body = await request.json();
      const validation = updateClauseSchema.safeParse(body);
      if (!validation.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid request data',
          validation.error.issues
        );
      }

      // Update clause
      const updatedClause = await updateClauseAudited({ organizationId, userId }, id, validation.data);

      if (!updatedClause) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Clause not found'
    );
      }

      return NextResponse.json({ clause: updatedClause });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
    })(request, { params });
};

export const DELETE = async (request: NextRequest, { params: pendingParams }: { params: Promise<{ id: string }> }) => {
  // Next 16 supplies route params as a Promise.
  const params = await pendingParams;
  return withRoleAuth('steward', async (_request, context) => {
    const { organizationId, userId } = context;
    if (!organizationId || !userId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'No active organization');
    }

  try {
      const { id } = params;

      const success = await deleteClauseAudited({ organizationId, userId }, id);
      
      if (!success) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Clause not found'
    );
      }

      return NextResponse.json({ 
        message: "Clause deleted successfully",
        deleted: true 
      });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
    })(request, { params });
};
