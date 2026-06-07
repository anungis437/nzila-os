/**
 * Bargaining Notes Service - Corporate Knowledge Management
 * 
 * Provides comprehensive bargaining notes management including:
 * - Notes CRUD operations
 * - Session management
 * - Knowledge preservation
 * - AI-powered insights
 * - Search and filtering
 */

import { db } from "@/db/db";
import { 
  bargainingNotes
} from "@/db/schema";
import { eq, and, or, like, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type NewBargainingNote = typeof bargainingNotes.$inferInsert;
export type BargainingNote = typeof bargainingNotes.$inferSelect;

export interface BargainingNoteFilters {
  cbaId?: string;
  organizationId?: string;
  sessionType?: string[];
  confidentialityLevel?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  searchQuery?: string;
  createdBy?: string;
}

export interface BargainingNoteSearchOptions {
  includeAttachments?: boolean;
  includeRelated?: boolean;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get bargaining note by ID
 */
export async function getBargainingNoteById(
  id: string,
  _options: BargainingNoteSearchOptions = {}
): Promise<BargainingNote | null> {
  try {
    const note = await db.query.bargainingNotes.findFirst({
      where: eq(bargainingNotes.id, id),
    });

    return note || null;
  } catch (error) {
    logger.error("Error fetching bargaining note by ID", { error, id });
    throw new Error("Failed to fetch bargaining note");
  }
}

/**
 * List bargaining notes with filtering
 */
export async function listBargainingNotes(
  filters: BargainingNoteFilters = {},
  pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: "asc" | "desc" } = {}
): Promise<{ notes: BargainingNote[]; total: number; page: number; limit: number }> {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "sessionDate",
      sortOrder = "desc"
    } = pagination;

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [];

    if (filters.cbaId) {
      conditions.push(eq(bargainingNotes.cbaId, filters.cbaId));
    }

    if (filters.organizationId) {
      conditions.push(eq(bargainingNotes.organizationId, filters.organizationId));
    }

    if (filters.sessionType && filters.sessionType.length > 0) {
      conditions.push(inArray(bargainingNotes.sessionType, filters.sessionType));
    }

    if (filters.confidentialityLevel) {
      conditions.push(eq(bargainingNotes.confidentialityLevel, filters.confidentialityLevel));
    }

    if (filters.dateFrom) {
      conditions.push(gte(bargainingNotes.sessionDate, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(bargainingNotes.sessionDate, filters.dateTo));
    }

    if (filters.createdBy) {
      conditions.push(eq(bargainingNotes.createdBy, filters.createdBy));
    }

    if (filters.searchQuery) {
      conditions.push(
        or(
          like(bargainingNotes.title, `%${filters.searchQuery}%`),
          like(bargainingNotes.content, `%${filters.searchQuery}%`)
        )!
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      // JSONB array overlap query
      conditions.push(sql`${bargainingNotes.tags}::jsonb ?| array[${sql.join(filters.tags.map(t => sql`${t}`), sql`, `)}]`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bargainingNotes)
      .where(whereClause);

    // Get notes with sorting
    const sortColumn = sortBy === "sessionDate" 
      ? bargainingNotes.sessionDate
      : sortBy === "createdAt"
      ? bargainingNotes.createdAt
      : bargainingNotes.sessionDate;

    const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const notes = await db
      .select()
      .from(bargainingNotes)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      notes,
      total: count,
      page,
      limit
    };
  } catch (error) {
    logger.error("Error listing bargaining notes", { error, filters });
    throw new Error("Failed to list bargaining notes");
  }
}

/**
 * Get bargaining notes by CBA
 */
export async function getBargainingNotesByCBA(
  cbaId: string,
  sessionType?: string
): Promise<BargainingNote[]> {
  try {
    const conditions = [eq(bargainingNotes.cbaId, cbaId)];

    if (sessionType) {
      conditions.push(eq(bargainingNotes.sessionType, sessionType));
    }

    const notes = await db
      .select()
      .from(bargainingNotes)
      .where(and(...conditions))
      .orderBy(desc(bargainingNotes.sessionDate));

    return notes;
  } catch (error) {
    logger.error("Error fetching bargaining notes by CBA", { error, cbaId });
    throw new Error("Failed to fetch bargaining notes by CBA");
  }
}

/**
 * Create a new bargaining note
 */
export async function createBargainingNote(data: NewBargainingNote): Promise<BargainingNote> {
  try {
    const [newNote] = await db
      .insert(bargainingNotes)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newNote;
  } catch (error) {
    logger.error("Error creating bargaining note", { error });
    throw new Error("Failed to create bargaining note");
  }
}

/**
 * Bulk create bargaining notes
 */
export async function bulkCreateBargainingNotes(
  notes: NewBargainingNote[]
): Promise<BargainingNote[]> {
  try {
    const newNotes = await db
      .insert(bargainingNotes)
      .values(
        notes.map(note => ({
          ...note,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      )
      .returning();

    return newNotes;
  } catch (error) {
    logger.error("Error bulk creating bargaining notes", { error, count: notes.length });
    throw new Error("Failed to bulk create bargaining notes");
  }
}

/**
 * Update a bargaining note
 */
export async function updateBargainingNote(
  id: string,
  data: Partial<NewBargainingNote>
): Promise<BargainingNote | null> {
  try {
    const [updated] = await db
      .update(bargainingNotes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(bargainingNotes.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating bargaining note", { error, id });
    throw new Error("Failed to update bargaining note");
  }
}

/**
 * Delete a bargaining note
 */
export async function deleteBargainingNote(id: string): Promise<boolean> {
  try {
    await db
      .delete(bargainingNotes)
      .where(eq(bargainingNotes.id, id));

    return true;
  } catch (error) {
    logger.error("Error deleting bargaining note", { error, id });
    throw new Error("Failed to delete bargaining note");
  }
}

// ============================================================================
// Search and Knowledge Management
// ============================================================================

/**
 * Search bargaining notes
 */
export async function searchBargainingNotes(
  query: string,
  filters: Omit<BargainingNoteFilters, "searchQuery"> = {},
  limit: number = 50
): Promise<BargainingNote[]> {
  try {
    const conditions: SQL[] = [
      or(
        like(bargainingNotes.title, `%${query}%`),
        like(bargainingNotes.content, `%${query}%`)
      )!
    ];

    if (filters.organizationId) {
      conditions.push(eq(bargainingNotes.organizationId, filters.organizationId));
    }

    if (filters.cbaId) {
      conditions.push(eq(bargainingNotes.cbaId, filters.cbaId));
    }

    if (filters.sessionType && filters.sessionType.length > 0) {
      conditions.push(inArray(bargainingNotes.sessionType, filters.sessionType));
    }

    const results = await db
      .select()
      .from(bargainingNotes)
      .where(and(...conditions))
      .orderBy(desc(bargainingNotes.sessionDate))
      .limit(limit);

    return results;
  } catch (error) {
    logger.error("Error searching bargaining notes", { error, filters });
    throw new Error("Failed to search bargaining notes");
  }
}

/**
 * Get bargaining timeline for a CBA
 */
export async function getBargainingTimeline(
  cbaId: string
): Promise<Array<{
  sessionDate: Date;
  sessionType: string;
  sessionNumber: number | null;
  title: string;
  id: string;
}>> {
  try {
    const timeline = await db
      .select({
        id: bargainingNotes.id,
        sessionDate: bargainingNotes.sessionDate,
        sessionType: bargainingNotes.sessionType,
        sessionNumber: bargainingNotes.sessionNumber,
        title: bargainingNotes.title,
      })
      .from(bargainingNotes)
      .where(eq(bargainingNotes.cbaId, cbaId))
      .orderBy(asc(bargainingNotes.sessionDate));

    return timeline.map(t => ({
      sessionDate: t.sessionDate!,
      sessionType: t.sessionType!,
      sessionNumber: t.sessionNumber,
      title: t.title!,
      id: t.id!,
    }));
  } catch (error) {
    logger.error("Error fetching bargaining timeline", { error, cbaId });
    throw new Error("Failed to fetch bargaining timeline");
  }
}

/**
 * Get notes by tags
 */
export async function getNotesByTags(
  tags: string[],
  organizationId?: string,
  limit: number = 50
): Promise<BargainingNote[]> {
  try {
    const conditions: SQL[] = [
      sql`${bargainingNotes.tags}::jsonb ?| array[${sql.join(tags.map(t => sql`${t}`), sql`, `)}]`
    ];

    if (organizationId) {
      conditions.push(eq(bargainingNotes.organizationId, organizationId));
    }

    const notes = await db
      .select()
      .from(bargainingNotes)
      .where(and(...conditions))
      .orderBy(desc(bargainingNotes.sessionDate))
      .limit(limit);

    return notes;
  } catch (error) {
    logger.error("Error fetching notes by tags", { error, organizationId });
    throw new Error("Failed to fetch notes by tags");
  }
}

/**
 * Get notes related to specific clauses
 */
export async function getNotesRelatedToClauses(
  clauseIds: string[],
  limit: number = 50
): Promise<BargainingNote[]> {
  try {
    // JSONB array overlap query
    const notes = await db
      .select()
      .from(bargainingNotes)
      .where(
        sql`${bargainingNotes.relatedClauseIds}::jsonb ?| array[${sql.join(clauseIds.map(id => sql`${id}`), sql`, `)}]`
      )
      .orderBy(desc(bargainingNotes.sessionDate))
      .limit(limit);

    return notes;
  } catch (error) {
    logger.error("Error fetching notes related to clauses", { error });
    throw new Error("Failed to fetch notes related to clauses");
  }
}

/**
 * Get notes related to specific precedents
 */
export async function getNotesRelatedToPrecedents(
  decisionIds: string[],
  limit: number = 50
): Promise<BargainingNote[]> {
  try {
    // JSONB array overlap query
    const notes = await db
      .select()
      .from(bargainingNotes)
      .where(
        sql`${bargainingNotes.relatedDecisionIds}::jsonb ?| array[${sql.join(decisionIds.map(id => sql`${id}`), sql`, `)}]`
      )
      .orderBy(desc(bargainingNotes.sessionDate))
      .limit(limit);

    return notes;
  } catch (error) {
    logger.error("Error fetching notes related to precedents", { error });
    throw new Error("Failed to fetch notes related to precedents");
  }
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get session types used in an organization
 */
export async function getSessionTypes(organizationId: string): Promise<string[]> {
  try {
    const types = await db
      .selectDistinct({ sessionType: bargainingNotes.sessionType })
      .from(bargainingNotes)
      .where(eq(bargainingNotes.organizationId, organizationId));

    return types.map(t => t.sessionType!).filter(Boolean);
  } catch (error) {
    logger.error("Error fetching session types", { error, organizationId });
    throw new Error("Failed to fetch session types");
  }
}

/**
 * Get notes statistics for an organization
 */
export async function getBargainingNotesStatistics(organizationId: string) {
  try {
    const bySessionType = await db
      .select({
        sessionType: bargainingNotes.sessionType,
        count: sql<number>`count(*)::int`,
      })
      .from(bargainingNotes)
      .where(eq(bargainingNotes.organizationId, organizationId))
      .groupBy(bargainingNotes.sessionType);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(bargainingNotes)
      .where(eq(bargainingNotes.organizationId, organizationId));

    // Get recent activity
    const recentNotes = await db
      .select({
        sessionDate: bargainingNotes.sessionDate,
        sessionType: bargainingNotes.sessionType,
        title: bargainingNotes.title,
      })
      .from(bargainingNotes)
      .where(eq(bargainingNotes.organizationId, organizationId))
      .orderBy(desc(bargainingNotes.sessionDate))
      .limit(5);

    return {
      total,
      bySessionType,
      recentActivity: recentNotes,
    };
  } catch (error) {
    logger.error("Error fetching bargaining notes statistics", { error, organizationId });
    throw new Error("Failed to fetch bargaining notes statistics");
  }
}

/**
 * Add attachment to bargaining note
 */
export async function addAttachmentToNote(
  noteId: string,
  attachment: {
    filename: string;
    url: string;
    fileType: string;
  }
): Promise<BargainingNote | null> {
  try {
    const note = await getBargainingNoteById(noteId);
    if (!note) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingAttachments = (note.attachments as any[]) || [];
    const newAttachment = {
      ...attachment,
      uploadedAt: new Date().toISOString(),
    };

    const updated = await updateBargainingNote(noteId, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: [...existingAttachments, newAttachment] as any,
    });

    return updated;
  } catch (error) {
    logger.error("Error adding attachment to note", { error, noteId });
    throw new Error("Failed to add attachment to note");
  }
}

/**
 * Get all tags used in an organization
 */
export async function getAllTags(organizationId: string): Promise<string[]> {
  try {
    const notes = await db
      .select({ tags: bargainingNotes.tags })
      .from(bargainingNotes)
      .where(eq(bargainingNotes.organizationId, organizationId));

    const tagsFlat = notes
      .filter(n => n.tags)
      .flatMap(n => n.tags as string[]);

    const uniqueTags = [...new Set(tagsFlat)];

    return uniqueTags.sort();
  } catch (error) {
    logger.error("Error fetching all tags", { error, organizationId });
    throw new Error("Failed to fetch all tags");
  }
}

