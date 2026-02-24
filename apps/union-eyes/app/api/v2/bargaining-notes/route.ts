import { NextResponse } from 'next/server';
/**
 * GET POST /api/bargaining-notes
 * Migrated to withApi() framework
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
 
 
 
 
 
 
 
 
import {
  listBargainingNotes,
  createBargainingNote,
  bulkCreateBargainingNotes,
  getBargainingTimeline,
  getBargainingNotesStatistics,
  getNotesByTags,
  getSessionTypes,
} from '@/lib/services/bargaining-notes-service';

const bargainingNotesSchema = z.object({
  map: z.unknown().optional(),
  organizationId: z.string().uuid('Invalid organizationId'),
  sessionDate: z.string().datetime().optional(),
  sessionType: z.unknown().optional(),
  title: z.string().min(1, 'title is required'),
  content: z.unknown().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Bargaining-notes'],
      summary: 'GET bargaining-notes',
    },
  },
  async ({ request, userId: _userId, organizationId, user: _user, body: _body, query: _query }) => {

          const { searchParams } = new URL(request.url);
          // Check for special modes
          const timeline = searchParams.get("timeline") === "true";
          const statistics = searchParams.get("statistics") === "true";
          const sessionTypes = searchParams.get("sessionTypes") === "true";
          const cbaId = searchParams.get("cbaId");
          const orgIdParam = searchParams.get("organizationId");
      if (orgIdParam && orgIdParam !== organizationId) {
        throw ApiError.forbidden('Forbidden'
        );
      }
          // Return timeline
          if (timeline && cbaId) {
            const timelineData = await getBargainingTimeline(cbaId);
            return NextResponse.json({ timeline: timelineData });
          }
          // Return statistics
          if (statistics && orgIdParam) {
            const stats = await getBargainingNotesStatistics(orgIdParam);
            return stats;
          }
          // Return session types
          if (sessionTypes && orgIdParam) {
            const types = await getSessionTypes(orgIdParam);
            return NextResponse.json({ sessionTypes: types });
          }
          // Check for tags filter
          const tags = searchParams.get("tags");
          if (tags) {
            const tagArray = tags.split(",");
            const limit = parseInt(searchParams.get("limit") || "50");
            const notes = await getNotesByTags(tagArray, orgIdParam || undefined, limit);
            return NextResponse.json({ notes, count: notes.length });
          }
          // Build filters
          const filters: Record<string, unknown> = {};
          if (cbaId) {
            filters.cbaId = cbaId;
          }
          if (orgIdParam) {
            filters.organizationId = orgIdParam;
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
          return result;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: bargainingNotesSchema,
    openapi: {
      tags: ['Bargaining-notes'],
      summary: 'POST bargaining-notes',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          // Check if bulk create
          if (Array.isArray(body)) {
            // Validate all required fields
            for (const note of body) {
              if (!note.organizationId || !note.sessionDate || !note.sessionType || !note.title || !note.content) {
                throw ApiError.badRequest('All notes must have organizationId, sessionDate, sessionType, title, and content');
              }
            }
            // Add createdBy to all notes
            const notesWithUser = body.map(note => ({
              ...note,
              createdBy: userId,
              lastModifiedBy: userId
            }));
            const notes = await bulkCreateBargainingNotes(notesWithUser);
            return {  notes, count: notes.length  };
          }
          // Single note creation
          // Validate required fields
          if (!body.organizationId) {
            throw ApiError.internal('organizationId is required'
        );
          }
          if (!body.sessionDate) {
            throw ApiError.internal('sessionDate is required'
        );
          }
          if (!body.sessionType) {
            throw ApiError.internal('sessionType is required'
        );
          }
          if (!body.title) {
            throw ApiError.internal('title is required'
        );
          }
          if (!body.content) {
            throw ApiError.internal('content is required'
        );
          }
          // Create note
          const note = await createBargainingNote({
            ...body as unknown as Parameters<typeof createBargainingNote>[0],
            createdBy: userId!,
            lastModifiedBy: userId!,
          });
          return {  note  };
  },
);
