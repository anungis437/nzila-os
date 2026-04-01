import { db } from "@/db/db";
import {
  cbaIntelDocuments,
  docTypeEnum,
  docProcessingStatusEnum,
} from "@/db/schema";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelDocument = typeof cbaIntelDocuments.$inferSelect;
export type NewCbaIntelDocument = typeof cbaIntelDocuments.$inferInsert;

export interface DocumentFilters {
  sourceId?: string;
  documentType?: (typeof docTypeEnum.enumValues)[number];
  processingStatus?: (typeof docProcessingStatusEnum.enumValues)[number];
  jurisdiction?: string;
  isLatest?: boolean;
  language?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listDocuments(
  filters: DocumentFilters = {},
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filters.sourceId) conditions.push(eq(cbaIntelDocuments.sourceId, filters.sourceId));
  if (filters.documentType) conditions.push(eq(cbaIntelDocuments.documentType, filters.documentType));
  if (filters.processingStatus) conditions.push(eq(cbaIntelDocuments.processingStatus, filters.processingStatus));
  if (filters.jurisdiction) conditions.push(eq(cbaIntelDocuments.jurisdiction, filters.jurisdiction));
  if (filters.language) conditions.push(eq(cbaIntelDocuments.language, filters.language));
  if (filters.isLatest !== undefined) conditions.push(eq(cbaIntelDocuments.isLatest, filters.isLatest));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelDocuments)
      .where(whereClause);

    const items = await db
      .select()
      .from(cbaIntelDocuments)
      .where(whereClause)
      .orderBy(desc(cbaIntelDocuments.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error listing CBA intelligence documents", { error, filters });
    throw new Error("Failed to list CBA intelligence documents");
  }
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

export async function getDocumentById(id: string): Promise<CbaIntelDocument | null> {
  try {
    const [doc] = await db
      .select()
      .from(cbaIntelDocuments)
      .where(eq(cbaIntelDocuments.id, id))
      .limit(1);
    return doc ?? null;
  } catch (error) {
    logger.error("Error getting CBA intelligence document", { error, id });
    throw new Error("Failed to get CBA intelligence document");
  }
}

// ---------------------------------------------------------------------------
// Upsert (content-hash dedup with versioning)
// ---------------------------------------------------------------------------

export async function upsertDocument(
  data: NewCbaIntelDocument,
): Promise<{ document: CbaIntelDocument; action: "created" | "updated" | "unchanged" }> {
  const contentHash = data.contentHash ?? computeContentHash(data.rawContent ?? "");

  try {
    // Check for existing document from same source with same source URL
    const [existing] = await db
      .select()
      .from(cbaIntelDocuments)
      .where(
        and(
          eq(cbaIntelDocuments.sourceId, data.sourceId),
          eq(cbaIntelDocuments.sourceUrl, data.sourceUrl),
          eq(cbaIntelDocuments.isLatest, true),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.contentHash === contentHash) {
        // Content unchanged — just bump lastSeenAt
        const [updated] = await db
          .update(cbaIntelDocuments)
          .set({ lastSeenAt: new Date(), updatedAt: new Date() })
          .where(eq(cbaIntelDocuments.id, existing.id))
          .returning();
        return { document: updated, action: "unchanged" };
      }

      // Content changed — create new version, mark old as not-latest
      await db
        .update(cbaIntelDocuments)
        .set({ isLatest: false, updatedAt: new Date() })
        .where(eq(cbaIntelDocuments.id, existing.id));

      const [newVersion] = await db
        .insert(cbaIntelDocuments)
        .values({
          ...data,
          contentHash,
          version: existing.version + 1,
          previousVersionId: existing.id,
          isLatest: true,
        })
        .returning();

      return { document: newVersion, action: "updated" };
    }

    // New document
    const [created] = await db
      .insert(cbaIntelDocuments)
      .values({ ...data, contentHash, isLatest: true })
      .returning();

    return { document: created, action: "created" };
  } catch (error) {
    logger.error("Error upserting CBA intelligence document", { error, sourceUrl: data.sourceUrl });
    throw new Error("Failed to upsert CBA intelligence document");
  }
}

// ---------------------------------------------------------------------------
// Update processing status
// ---------------------------------------------------------------------------

export async function updateDocumentStatus(
  id: string,
  status: (typeof docProcessingStatusEnum.enumValues)[number],
  extra?: { normalizedText?: string; parsedMetadata?: Record<string, unknown>; pageCount?: number; wordCount?: number },
): Promise<CbaIntelDocument | null> {
  try {
    const [updated] = await db
      .update(cbaIntelDocuments)
      .set({ processingStatus: status, ...extra, updatedAt: new Date() })
      .where(eq(cbaIntelDocuments.id, id))
      .returning();
    return updated ?? null;
  } catch (error) {
    logger.error("Error updating document status", { error, id, status });
    throw new Error("Failed to update document status");
  }
}
