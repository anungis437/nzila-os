/**
 * CBA API Routes - Individual CBA operations
 * GET /api/cbas/[id] - Get CBA by ID with related data
 * PATCH /api/cbas/[id] - Update CBA
 * DELETE /api/cbas/[id] - Delete CBA (soft delete)
 */

import { NextResponse } from "next/server";
import { 
  getCbaForOrganization,
  updateCbaAudited,
  archiveCbaAudited,
} from "@/lib/services/cba-audited-service";
import { getClausesByCBAId } from "@/lib/services/clause-service";
import { getBargainingNotesByCBA } from "@/lib/services/bargaining-notes-service";
import { z } from "zod";
import { withApi } from '@/lib/api/framework';
import { logger } from "@/lib/logger";

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

// A malformed id is a client error here, never a database fault handed back as a 500.
const isCbaId = (id: string) => z.guid().safeParse(id).success;

// The agreement, its clauses and its bargaining notes are read in the caller organization's tenant transaction (`rlsOrgContext`).
export const GET = withApi(
  {
    auth: { minRole: 'member' },
    rlsOrgContext: true,
    openapi: { tags: ['CBAs'], summary: 'Read a collective agreement with its clauses and bargaining notes' },
  },
  async ({ request, userId, organizationId: organization, params }) => {
  const organizationId = organization!;
  try {
      const { id } = params;
      if (!isCbaId(id)) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'CBA id must be a valid id');
      }
      const { searchParams } = new URL(request.url);

      const includeClauses = searchParams.get("includeClauses") === "true";
      const includeNotes = searchParams.get("includeNotes") === "true";

      // Fetch CBA within the caller's organization
      const cba = await getCbaForOrganization(organizationId, id, { countView: false });

      if (!cba) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'CBA not found'
    );
      }

      const response: Record<string, unknown> = { cba };

      // Optionally fetch clauses
      if (includeClauses) {
        const clauses = await getClausesByCBAId(id, organizationId);
        response.clauses = clauses;
        response.clauseCount = clauses.length;
      }

      // Optionally fetch bargaining notes; privileged session notes are not embedded for every member.
      if (includeNotes) {
        const notes = (await getBargainingNotesByCBA(id, organizationId)).filter(
          (note) =>
            !note.confidentialityLevel ||
            ['public', 'internal'].includes(note.confidentialityLevel) ||
            note.createdBy === userId,
        );
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
  },
);


const cbasSchema = z.object({
  status: z.enum(['active', 'expired', 'under_negotiation', 'ratified_pending', 'archived']).optional(),
  title: z.string().max(500).optional(),
  jurisdiction: z.enum(['federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei', 'newfoundland', 'northwest_territories', 'yukon', 'nunavut']).optional(),
  language: z.enum(['en', 'fr', 'bilingual']).optional(),
  employerName: z.string().max(300).optional(),
  employerId: z.string().max(100).optional(),
  unionName: z.string().max(300).optional(),
  unionLocal: z.string().max(100).optional(),
  unionId: z.string().max(100).optional(),
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  signedDate: z.coerce.date().optional(),
  ratificationDate: z.coerce.date().optional(),
  industrySector: z.string().max(200).optional(),
  sector: z.string().max(200).optional(),
  employeeCoverage: z.number().int().optional(),
  bargainingUnitDescription: z.string().optional(),
  documentUrl: z.string().url().optional(),
});

// The audited update opens its own tenant transaction and writes its audit record in it, so the wrapper opens none.
export const PATCH = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['CBAs'], summary: 'Update a collective agreement' },
  },
  async ({ request, userId: actor, organizationId: organization, params }) => {
    const userId = actor!;
    const organizationId = organization!;

  try {
      const { id } = params;
      if (!isCbaId(id)) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'CBA id must be a valid id');
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
      }
    // Publishing an agreement outside the organization is not a steward-level decision.
    if (body && typeof body === 'object' && 'isPublic' in body) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Changing agreement visibility is not permitted here');
    }
    // Validate request body
    const validation = cbasSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

    const result = await updateCbaAudited({ organizationId, userId }, id, validation.data);

    if (result.kind === 'not_found') {
      return standardErrorResponse(
        ErrorCode.RESOURCE_NOT_FOUND,
        'CBA not found'
      );
    }
    if (result.kind === 'conflict') {
      return standardErrorResponse(
        ErrorCode.CONFLICT,
        'CBA status changed concurrently; reload and retry'
      );
    }

    return NextResponse.json({ cba: result.cba });
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
  },
);

// The audited archive opens its own tenant transaction and writes its audit record in it, so the wrapper opens none.
export const DELETE = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['CBAs'], summary: 'Archive a collective agreement (never a hard delete)' },
  },
  async ({ userId: actor, organizationId: organization, params }) => {
  const userId = actor!;
  const organizationId = organization!;
  try {
      const { id } = params;
      if (!isCbaId(id)) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'CBA id must be a valid id');
      }
      // A "hard" delete request is not honoured: an agreement is only ever archived, so its clauses and notes survive.

      const result = await archiveCbaAudited({ organizationId, userId }, id);

      if (result === 'not_found') {
        return standardErrorResponse(
          ErrorCode.RESOURCE_NOT_FOUND,
          'CBA not found'
        );
      }
      if (result === 'already_archived') {
        return standardErrorResponse(ErrorCode.CONFLICT, 'CBA is already archived');
      }

      return NextResponse.json({ 
        message: "CBA archived successfully",
        deleted: true 
      });
    } catch (error) {
      logger.error("Error deleting CBA", error as Error);
      return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
  },
);
