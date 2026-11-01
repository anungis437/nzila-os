/**
 * Bargaining Notes API Routes - Main endpoints
 * GET /api/bargaining-notes - List notes with filtering
 * POST /api/bargaining-notes - Create a new note
 */

import { NextResponse } from "next/server";
import {
  listBargainingNotes,
} from "@/lib/services/bargaining-notes-service";
import {
  createBargainingNoteAudited,
  ForeignAgreementError,
} from "@/lib/services/bargaining-notes-audited-service";
import { getCbaForOrganization } from "@/lib/services/cba-audited-service";
import { z } from "zod";
import { db } from '@/db/db';
import { bargainingNotes } from '@/db/schema';
import { and, or, eq, inArray, asc, desc, count } from 'drizzle-orm';
import { withRoleAuth } from '@/lib/api-auth-guard';

 
 
 
 
 
 
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('member', async (request, context) => {
  const { userId } = context;
  const organizationId = context.organizationId;
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'No active organization');
  }
  try {
      const { searchParams } = new URL(request.url);
      
      // Check for special modes
      const timeline = searchParams.get("timeline") === "true";
      const statistics = searchParams.get("statistics") === "true";
      const sessionTypes = searchParams.get("sessionTypes") === "true";
      const cbaId = searchParams.get("cbaId");
      const requestedOrganizationId = searchParams.get("organizationId");
  if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }

      // An agreement outside the caller's organization is not found
      if (cbaId && !(await getCbaForOrganization(organizationId, cbaId))) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'CBA not found');
      }

      // Special views must use the SAME confidentiality policy as ordinary
      // listing. The legacy summary helpers read restricted note titles.
      const visible = and(
        eq(bargainingNotes.organizationId, organizationId),
        or(
          inArray(bargainingNotes.confidentialityLevel, ['public', 'internal']),
          eq(bargainingNotes.createdBy, userId),
        ),
      );
      if (timeline && cbaId) {
        const timelineData = await db.select({
          id: bargainingNotes.id,
          sessionDate: bargainingNotes.sessionDate,
          sessionType: bargainingNotes.sessionType,
          sessionNumber: bargainingNotes.sessionNumber,
          title: bargainingNotes.title,
        }).from(bargainingNotes).where(and(visible, eq(bargainingNotes.cbaId, cbaId)))
          .orderBy(asc(bargainingNotes.sessionDate)).limit(500);
        return NextResponse.json({ timeline: timelineData });
      }
      if (statistics) {
        const bySessionType = await db.select({
          sessionType: bargainingNotes.sessionType,
          count: count(),
        }).from(bargainingNotes).where(visible).groupBy(bargainingNotes.sessionType);
        const [total] = await db.select({ value: count() }).from(bargainingNotes).where(visible);
        const recentActivity = await db.select({
          sessionDate: bargainingNotes.sessionDate,
          sessionType: bargainingNotes.sessionType,
          title: bargainingNotes.title,
        }).from(bargainingNotes).where(visible).orderBy(desc(bargainingNotes.sessionDate)).limit(5);
        return NextResponse.json({ total: total?.value ?? 0, bySessionType, recentActivity });
      }
      if (sessionTypes) {
        const rows = await db.selectDistinct({ sessionType: bargainingNotes.sessionType })
          .from(bargainingNotes).where(visible);
        return NextResponse.json({ sessionTypes: rows.map(row => row.sessionType).filter(Boolean) });
      }

      // Privileged session notes stay with their author; everyone else sees public and internal notes only
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: Record<string, any> = { organizationId, visibleToUserId: userId };

      // Check for tags filter
      const tags = searchParams.get("tags");
      if (tags) {
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
        const { notes } = await listBargainingNotes(
          { ...filters, tags: tags.split(",") },
          { limit },
        );
        return NextResponse.json({ notes, count: notes.length });
      }

      // Build filters
      if (cbaId) {
        filters.cbaId = cbaId;
      }

      const sessionType = searchParams.get("sessionType");
      if (sessionType) {
        filters.sessionType = sessionType.split(",");
      }

      const confidentialityLevel = searchParams.get("confidentialityLevel");
      if (confidentialityLevel) {
        filters.confidentialityLevel = confidentialityLevel;
      }

      const dateFrom = searchParams.get("dateFrom");
      if (dateFrom) {
        filters.dateFrom = new Date(dateFrom);
      }

      const dateTo = searchParams.get("dateTo");
      if (dateTo) {
        filters.dateTo = new Date(dateTo);
      }

      const createdBy = searchParams.get("createdBy");
      if (createdBy) {
        filters.createdBy = createdBy;
      }

      const searchQuery = searchParams.get("searchQuery");
      if (searchQuery) {
        filters.searchQuery = searchQuery;
      }

      // Pagination
      const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
      const sortBy = searchParams.get("sortBy") || "sessionDate";
      const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

      const result = await listBargainingNotes(filters, { page, limit, sortBy, sortOrder });

      return NextResponse.json(result);
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});


const bargainingNotesSchema = z.object({
  organizationId: z.guid('Invalid organizationId').optional(),
  cbaId: z.guid().optional(),
  sessionDate: z.coerce.date(),
  sessionType: z.string().max(100),
  sessionNumber: z.number().int().optional(),
  title: z.string().min(1, 'title is required').max(300),
  content: z.string().min(1, 'content is required'),
  attendees: z.array(z.object({
    name: z.string(),
    role: z.string(),
    organization: z.string(),
  })).optional(),
  relatedClauseIds: z.array(z.guid()).optional(),
  relatedDecisionIds: z.array(z.guid()).optional(),
  tags: z.array(z.string()).optional(),
  confidentialityLevel: z.enum(['public', 'internal', 'restricted', 'confidential']).optional(),
});

export const POST = withRoleAuth('steward', async (request, context) => {
    const { userId, organizationId: contextOrganizationId } = context;
    if (!userId || !contextOrganizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'No active organization');
    }

  try {
      const body = await request.json();
    // Validate request body
    const validation = bargainingNotesSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

    const { organizationId: requestedOrganizationId, ...noteData } = validation.data;
    if (requestedOrganizationId && requestedOrganizationId !== contextOrganizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Forbidden');
    }

      // Create note in the caller's organization
      const note = await createBargainingNoteAudited(
        { organizationId: contextOrganizationId, userId },
        noteData,
      );

      return standardSuccessResponse(
      {  note  }
    );
    } catch (error) {
      if (error instanceof ForeignAgreementError) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'CBA not found');
      }
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});

