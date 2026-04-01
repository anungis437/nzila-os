import { db } from "@/db/db";
import {
  cbaIntelSources,
  sourceTypeEnum,
  trustTierEnum,
  sourceHealthEnum,
} from "@/db/schema";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelSource = typeof cbaIntelSources.$inferSelect;
export type NewCbaIntelSource = typeof cbaIntelSources.$inferInsert;

export interface SourceFilters {
  sourceType?: (typeof sourceTypeEnum.enumValues)[number];
  trustTier?: (typeof trustTierEnum.enumValues)[number];
  healthStatus?: (typeof sourceHealthEnum.enumValues)[number];
  isActive?: boolean;
  jurisdiction?: string;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listSources(
  filters: SourceFilters = {},
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filters.sourceType) conditions.push(eq(cbaIntelSources.sourceType, filters.sourceType));
  if (filters.trustTier) conditions.push(eq(cbaIntelSources.trustTier, filters.trustTier));
  if (filters.healthStatus) conditions.push(eq(cbaIntelSources.healthStatus, filters.healthStatus));
  if (filters.isActive !== undefined) conditions.push(eq(cbaIntelSources.isActive, filters.isActive));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelSources)
      .where(whereClause);

    const items = await db
      .select()
      .from(cbaIntelSources)
      .where(whereClause)
      .orderBy(desc(cbaIntelSources.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error listing CBA intelligence sources", { error, filters });
    throw new Error("Failed to list CBA intelligence sources");
  }
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

export async function getSourceById(id: string): Promise<CbaIntelSource | null> {
  try {
    const [source] = await db
      .select()
      .from(cbaIntelSources)
      .where(eq(cbaIntelSources.id, id))
      .limit(1);
    return source ?? null;
  } catch (error) {
    logger.error("Error getting CBA intelligence source", { error, id });
    throw new Error("Failed to get CBA intelligence source");
  }
}

export async function getSourceBySlug(slug: string): Promise<CbaIntelSource | null> {
  try {
    const [source] = await db
      .select()
      .from(cbaIntelSources)
      .where(eq(cbaIntelSources.slug, slug))
      .limit(1);
    return source ?? null;
  } catch (error) {
    logger.error("Error getting CBA intelligence source by slug", { error, slug });
    throw new Error("Failed to get CBA intelligence source by slug");
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createSource(data: NewCbaIntelSource): Promise<CbaIntelSource> {
  try {
    const [source] = await db.insert(cbaIntelSources).values(data).returning();
    return source;
  } catch (error) {
    logger.error("Error creating CBA intelligence source", { error, slug: data.slug });
    throw new Error("Failed to create CBA intelligence source");
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateSource(
  id: string,
  data: Partial<NewCbaIntelSource>,
): Promise<CbaIntelSource | null> {
  try {
    const [updated] = await db
      .update(cbaIntelSources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cbaIntelSources.id, id))
      .returning();
    return updated ?? null;
  } catch (error) {
    logger.error("Error updating CBA intelligence source", { error, id });
    throw new Error("Failed to update CBA intelligence source");
  }
}

// ---------------------------------------------------------------------------
// Health check update
// ---------------------------------------------------------------------------

export async function updateSourceHealth(
  id: string,
  healthy: boolean,
): Promise<void> {
  try {
    if (healthy) {
      await db
        .update(cbaIntelSources)
        .set({
          healthStatus: "healthy",
          lastCheckedAt: new Date(),
          lastSuccessAt: new Date(),
          consecutiveFailures: 0,
          updatedAt: new Date(),
        })
        .where(eq(cbaIntelSources.id, id));
    } else {
      await db
        .update(cbaIntelSources)
        .set({
          healthStatus: "degraded",
          lastCheckedAt: new Date(),
          consecutiveFailures: sql`${cbaIntelSources.consecutiveFailures} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(cbaIntelSources.id, id));
    }
  } catch (error) {
    logger.error("Error updating source health", { error, id, healthy });
    throw new Error("Failed to update source health");
  }
}

// ---------------------------------------------------------------------------
// Deactivate
// ---------------------------------------------------------------------------

export async function deactivateSource(id: string): Promise<boolean> {
  try {
    const [updated] = await db
      .update(cbaIntelSources)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(cbaIntelSources.id, id))
      .returning();
    return !!updated;
  } catch (error) {
    logger.error("Error deactivating CBA intelligence source", { error, id });
    throw new Error("Failed to deactivate CBA intelligence source");
  }
}

// ---------------------------------------------------------------------------
// Active sources for ingestion
// ---------------------------------------------------------------------------

export async function getActiveSourcesForIngestion(): Promise<CbaIntelSource[]> {
  try {
    return await db
      .select()
      .from(cbaIntelSources)
      .where(
        and(
          eq(cbaIntelSources.isActive, true),
          sql`${cbaIntelSources.healthStatus} != 'unreachable'`,
        ),
      )
      .orderBy(cbaIntelSources.slug);
  } catch (error) {
    logger.error("Error fetching active sources for ingestion", { error });
    throw new Error("Failed to fetch active sources for ingestion");
  }
}
