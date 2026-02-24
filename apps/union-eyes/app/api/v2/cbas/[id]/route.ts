import { NextResponse } from 'next/server';
/**
 * GET PATCH DELETE /api/cbas/[id]
 * Migrated to withApi() framework
 */
import { getClausesByCBAId } from "@/lib/services/clause-service";
import { getBargainingNotesByCBA } from "@/lib/services/bargaining-notes-service";
import { getCBAById, updateCBA, updateCBAStatus, deleteCBA } from "@/lib/services/cba-service";

 
 
 
 
 
 
 
 
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const cbasSchema = z.object({
  status: z.unknown().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Cbas'],
      summary: 'GET [id]',
    },
  },
  async ({ request, params, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

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
            throw ApiError.notFound('CBA not found'
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
          return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: cbasSchema,
    openapi: {
      tags: ['Cbas'],
      summary: 'PATCH [id]',
    },
  },
  async ({ request: _request, params, userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          const { id } = params;
          // Validate request body
        // If only updating status, use specialized function
          if (body.status && Object.keys(body).length === 1) {
            const updatedCba = await updateCBAStatus(id, body.status as Parameters<typeof updateCBAStatus>[1]);
            if (!updatedCba) {
              throw ApiError.notFound('CBA not found'
        );
            }
            return NextResponse.json({ cba: updatedCba });
          }
          // Update CBA
          const updatedCba = await updateCBA(id, {
            ...(body as Record<string, unknown>),
            lastModifiedBy: userId ?? undefined,
          } as Parameters<typeof updateCBA>[1]);
          if (!updatedCba) {
            throw ApiError.notFound('CBA not found'
        );
          }
          return NextResponse.json({ cba: updatedCba });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: cbasSchema,
    openapi: {
      tags: ['Cbas'],
      summary: 'DELETE [id]',
    },
  },
  async ({ request, params, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

          const { id } = params;
          const { searchParams } = new URL(request.url);
          const hardDelete = searchParams.get("hard") === "true";
          if (hardDelete) {
            // Hard delete - this will cascade delete all related clauses
            // Only allow for admins/authorized users
            const success = await deleteCBA(id); // This does soft delete by default
            if (!success) {
              throw ApiError.notFound('CBA not found'
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
              throw ApiError.notFound('CBA not found'
        );
            }
            return NextResponse.json({ 
              message: "CBA archived successfully",
              deleted: true 
            });
          }
  },
);
