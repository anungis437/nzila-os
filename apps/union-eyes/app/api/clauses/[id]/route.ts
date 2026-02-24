/**
 * Clause API Routes - Individual clause operations
 * GET /api/clauses/[id] - Get clause by ID
 * PATCH /api/clauses/[id] - Update clause
 * DELETE /api/clauses/[id] - Delete clause
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  getClauseById, 
  updateClause, 
  deleteClause,
  getClauseHierarchy
} from "@/lib/services/clause-service";
import { withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = async (request: NextRequest, { params }: { params: { id: string } }) => {
  return withRoleAuth('member', async (request, context) => {
    const _user = { id: context.userId, organizationId: context.organizationId };

  try {
      const { id } = params;
      const { searchParams } = new URL(request.url);

      const includeHierarchy = searchParams.get("includeHierarchy") === "true";

      if (includeHierarchy) {
        const hierarchy = await getClauseHierarchy(id);
        
        if (!hierarchy.clause) {
          return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Clause not found'
    );
        }

        return NextResponse.json(hierarchy);
      }

      // Fetch clause
      const clause = await getClauseById(id);

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

export const PATCH = async (request: NextRequest, { params }: { params: { id: string } }) => {
  return withRoleAuth('member', async (request, context) => {
    const _user = { id: context.userId, organizationId: context.organizationId };

  try {
      const { id } = params;
      const body = await request.json();

      // Update clause
      const updatedClause = await updateClause(id, body);

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

export const DELETE = async (request: NextRequest, { params }: { params: { id: string } }) => {
  return withRoleAuth('member', async (request, context) => {
    const _user = { id: context.userId, organizationId: context.organizationId };

  try {
      const { id } = params;

      const success = await deleteClause(id);
      
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
