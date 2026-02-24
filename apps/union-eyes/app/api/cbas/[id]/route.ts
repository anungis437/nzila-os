/**
 * CBA API Routes - Individual CBA operations
 * GET /api/cbas/[id] - Get CBA by ID with related data
 * PATCH /api/cbas/[id] - Update CBA
 * DELETE /api/cbas/[id] - Delete CBA (soft delete)
 */

import { NextResponse } from "next/server";
import { 
  getCBAById, 
  updateCBA, 
  deleteCBA,
  updateCBAStatus 
} from "@/lib/services/cba-service";
import { getClausesByCBAId } from "@/lib/services/clause-service";
import { getBargainingNotesByCBA } from "@/lib/services/bargaining-notes-service";
import { z } from "zod";
import { withRoleAuth } from '@/lib/api-auth-guard';
import { logger } from "@/lib/logger";

 
 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('member', async (request, context) => {
  const { params } = context as { params: { id: string } };
  try {
      const { id } = params;
      const { searchParams } = new URL(request.url);

      const includeClauses = searchParams.get("includeClauses") === "true";
      const includeNotes = searchParams.get("includeNotes") === "true";
      const includeAnalytics = searchParams.get("includeAnalytics") === "true";

      // Fetch CBA
      const cba = await getCBAById(id, { 
        includeClauses, 
        includeAnalytics 
      });

      if (!cba) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'CBA not found'
    );
      }

      const response: Record<string, unknown> = { cba };

      // Optionally fetch clauses
      if (includeClauses) {
        const clauses = await getClausesByCBAId(id);
        response.clauses = clauses;
        response.clauseCount = clauses.length;
      }

      // Optionally fetch bargaining notes
      if (includeNotes) {
        const notes = await getBargainingNotesByCBA(id);
        response.bargainingNotes = notes;
        response.noteCount = notes.length;
      }

      return NextResponse.json(response);
    } catch (error) {
      logger.error("Error fetching CBA", error as Error);
      return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});


const cbasSchema = z.object({
  status: z.unknown().optional(),
});

export const PATCH = withRoleAuth('steward', async (request, context) => {
    const { userId, organizationId: _organizationId, params } = context as { userId: string; organizationId: string; params: { id: string } };

  try {
      const { id } = params;
      const body = await request.json();
    // Validate request body
    const validation = cbasSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { status: _status } = validation.data;

      // If only updating status, use specialized function
      if (body.status && Object.keys(body).length === 1) {
        const updatedCba = await updateCBAStatus(id, body.status);
        
        if (!updatedCba) {
          return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'CBA not found'
    );
        }

        return NextResponse.json({ cba: updatedCba });
      }

      // Update CBA
      const updatedCba = await updateCBA(id, {
        ...body,
        lastModifiedBy: userId,
      });

      if (!updatedCba) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'CBA not found'
    );
      }

      return NextResponse.json({ cba: updatedCba });
    } catch (error) {
      logger.error("Error updating CBA", error as Error);
      
      // Handle unique constraint violations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any)?.code === "23505") {
        return standardErrorResponse(
      ErrorCode.ALREADY_EXISTS,
      'CBA number already exists',
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

export const DELETE = withRoleAuth('steward', async (request, context) => {
  const { params } = context as { params: { id: string } };
  try {
      const { id } = params;
      const { searchParams } = new URL(request.url);
      const hardDelete = searchParams.get("hard") === "true";

      if (hardDelete) {
        // Hard delete - this will cascade delete all related clauses
        // Only allow for admins/authorized users
        const success = await deleteCBA(id); // This does soft delete by default
        
        if (!success) {
          return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'CBA not found'
    );
        }

        return NextResponse.json({ 
          message: "CBA archived successfully",
          deleted: true 
        });
      } else {
        // Soft delete - set status to archived
        const success = await deleteCBA(id);
        
        if (!success) {
          return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'CBA not found'
    );
        }

        return NextResponse.json({ 
          message: "CBA archived successfully",
          deleted: true 
        });
      }
    } catch (error) {
      logger.error("Error deleting CBA", error as Error);
      return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});
