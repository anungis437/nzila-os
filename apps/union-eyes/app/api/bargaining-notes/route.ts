/**
 * Bargaining Notes API Routes - Main endpoints
 * GET /api/bargaining-notes - List notes with filtering
 * POST /api/bargaining-notes - Create a new note
 */

import { NextResponse } from "next/server";
import {
  listBargainingNotes,
  createBargainingNote,
  bulkCreateBargainingNotes,
  getBargainingTimeline,
  getBargainingNotesStatistics,
  getNotesByTags,
  getSessionTypes,
} from "@/lib/services/bargaining-notes-service";
import { z } from "zod";
import { withRoleAuth } from '@/lib/api-auth-guard';

 
 
 
 
 
 
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('member', async (request, context) => {
  try {
      const { searchParams } = new URL(request.url);
      
      // Check for special modes
      const timeline = searchParams.get("timeline") === "true";
      const statistics = searchParams.get("statistics") === "true";
      const sessionTypes = searchParams.get("sessionTypes") === "true";
      const cbaId = searchParams.get("cbaId");
      const organizationId = searchParams.get("organizationId");
  if (organizationId && organizationId !== context.organizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }


      // Return timeline
      if (timeline && cbaId) {
        const timelineData = await getBargainingTimeline(cbaId);
        return NextResponse.json({ timeline: timelineData });
      }

      // Return statistics
      if (statistics && organizationId) {
        const stats = await getBargainingNotesStatistics(organizationId);
        return NextResponse.json(stats);
      }

      // Return session types
      if (sessionTypes && organizationId) {
        const types = await getSessionTypes(organizationId);
        return NextResponse.json({ sessionTypes: types });
      }

      // Check for tags filter
      const tags = searchParams.get("tags");
      if (tags) {
        const tagArray = tags.split(",");
        const limit = parseInt(searchParams.get("limit") || "50");
        const notes = await getNotesByTags(tagArray, organizationId || undefined, limit);
        return NextResponse.json({ notes, count: notes.length });
      }

      // Build filters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filters: Record<string, any> = {};
      
      if (cbaId) {
        filters.cbaId = cbaId;
      }

      if (organizationId) {
        filters.organizationId = organizationId;
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
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
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
  organizationId: z.string().uuid('Invalid organizationId'),
  cbaId: z.string().uuid().optional(),
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
  relatedClauseIds: z.array(z.string().uuid()).optional(),
  relatedDecisionIds: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  confidentialityLevel: z.enum(['public', 'internal', 'restricted', 'confidential']).optional(),
});

export const POST = withRoleAuth('steward', async (request, context) => {
    const { userId } = context;

  try {
      const body = await request.json();
    // Validate request body
    const validation = bargainingNotesSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { organizationId: _organizationId, sessionDate: _sessionDate, sessionType: _sessionType, title: _title, content: _content } = validation.data;

      // Check if bulk create
      if (Array.isArray(body)) {
        // Validate all required fields
        for (const note of body) {
          if (!note.organizationId || !note.sessionDate || !note.sessionType || !note.title || !note.content) {
            return NextResponse.json(
              { error: "All notes must have organizationId, sessionDate, sessionType, title, and content" },
              { status: 400 }
            );
          }
        }

        // Add createdBy to all notes
        const notesWithUser = body.map(note => ({
          ...note,
          createdBy: userId,
          lastModifiedBy: userId
        }));

        const notes = await bulkCreateBargainingNotes(notesWithUser);
        return standardSuccessResponse(
      {  notes, count: notes.length  }
    );
      }

      // Create note
      const note = await createBargainingNote({
        ...validation.data,
        createdBy: userId!,
        lastModifiedBy: userId!,
      });

      return standardSuccessResponse(
      {  note  }
    );
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});

