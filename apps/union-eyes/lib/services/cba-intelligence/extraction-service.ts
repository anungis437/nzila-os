import { db } from "@/db/db";
import {
  cbaIntelExtractionRuns,
  cbaIntelFindings,
  cbaIntelAgreements,
  cbaIntelWageAdjustments,
  cbaIntelClauses,
  extractionMethodEnum,
  extractionStatusEnum,
  clauseFamilyEnum,
} from "@/db/schema";
import { eq, and, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelExtractionRun = typeof cbaIntelExtractionRuns.$inferSelect;
export type CbaIntelFinding = typeof cbaIntelFindings.$inferSelect;
export type CbaIntelAgreement = typeof cbaIntelAgreements.$inferSelect;
export type CbaIntelWageAdjustment = typeof cbaIntelWageAdjustments.$inferSelect;
export type CbaIntelClause = typeof cbaIntelClauses.$inferSelect;

export type NewExtractionRun = typeof cbaIntelExtractionRuns.$inferInsert;
export type NewFinding = typeof cbaIntelFindings.$inferInsert;
export type NewAgreement = typeof cbaIntelAgreements.$inferInsert;
export type NewWageAdjustment = typeof cbaIntelWageAdjustments.$inferInsert;
export type NewClause = typeof cbaIntelClauses.$inferInsert;

export interface ExtractionRunFilters {
  documentId?: string;
  status?: (typeof extractionStatusEnum.enumValues)[number];
  method?: (typeof extractionMethodEnum.enumValues)[number];
}

export interface FindingFilters {
  documentId?: string;
  extractionRunId?: string;
  clauseFamily?: (typeof clauseFamilyEnum.enumValues)[number];
  findingType?: string;
  reviewStatus?: string;
  minConfidence?: number;
}

export interface AgreementFilters {
  jurisdiction?: string;
  sector?: string;
  reviewStatus?: string;
  search?: string;
  employerLike?: string;
  unionLike?: string;
}

// ---------------------------------------------------------------------------
// Extraction Runs
// ---------------------------------------------------------------------------

export async function createExtractionRun(data: NewExtractionRun): Promise<CbaIntelExtractionRun> {
  try {
    const [run] = await db.insert(cbaIntelExtractionRuns).values(data).returning();
    return run;
  } catch (error) {
    logger.error("Error creating extraction run", { error, documentId: data.documentId });
    throw new Error("Failed to create extraction run");
  }
}

export async function completeExtractionRun(
  id: string,
  stats: { findingsCount: number; errorCount?: number; errors?: any },
): Promise<CbaIntelExtractionRun | null> {
  const now = new Date();
  try {
    const run = await getExtractionRunById(id);
    if (!run) return null;

    const durationMs = run.startedAt ? now.getTime() - new Date(run.startedAt).getTime() : null;
    const hasErrors = (stats.errorCount ?? 0) > 0;

    const [updated] = await db
      .update(cbaIntelExtractionRuns)
      .set({
        status: hasErrors ? "completed_with_errors" : "completed",
        completedAt: now,
        durationMs,
        findingsCount: stats.findingsCount,
        errorCount: stats.errorCount ?? 0,
        errors: stats.errors as Array<{ field: string; message: string }> | null ?? null,
      })
      .where(eq(cbaIntelExtractionRuns.id, id))
      .returning();
    return updated ?? null;
  } catch (error) {
    logger.error("Error completing extraction run", { error, id });
    throw new Error("Failed to complete extraction run");
  }
}

export async function getExtractionRunById(id: string): Promise<CbaIntelExtractionRun | null> {
  try {
    const [run] = await db
      .select()
      .from(cbaIntelExtractionRuns)
      .where(eq(cbaIntelExtractionRuns.id, id))
      .limit(1);
    return run ?? null;
  } catch (error) {
    logger.error("Error getting extraction run", { error, id });
    throw new Error("Failed to get extraction run");
  }
}

export async function listExtractionRuns(
  filters: ExtractionRunFilters = {},
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filters.documentId) conditions.push(eq(cbaIntelExtractionRuns.documentId, filters.documentId));
  if (filters.status) conditions.push(eq(cbaIntelExtractionRuns.status, filters.status));
  if (filters.method) conditions.push(eq(cbaIntelExtractionRuns.extractionMethod, filters.method));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelExtractionRuns)
      .where(whereClause);

    const items = await db
      .select()
      .from(cbaIntelExtractionRuns)
      .where(whereClause)
      .orderBy(desc(cbaIntelExtractionRuns.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error listing extraction runs", { error, filters });
    throw new Error("Failed to list extraction runs");
  }
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export async function createFinding(data: NewFinding): Promise<CbaIntelFinding> {
  const contentHash = createHash("sha256")
    .update(`${data.findingType}:${data.label}:${data.value ?? ""}`)
    .digest("hex");

  try {
    const [finding] = await db
      .insert(cbaIntelFindings)
      .values({ ...data, contentHash })
      .returning();
    return finding;
  } catch (error) {
    logger.error("Error creating finding", { error, type: data.findingType });
    throw new Error("Failed to create finding");
  }
}

export async function createFindingsBatch(data: NewFinding[]): Promise<CbaIntelFinding[]> {
  if (data.length === 0) return [];

  const withHashes = data.map((d) => ({
    ...d,
    contentHash: createHash("sha256")
      .update(`${d.findingType}:${d.label}:${d.value ?? ""}`)
      .digest("hex"),
  }));

  try {
    const findings = await db.insert(cbaIntelFindings).values(withHashes).returning();
    return findings;
  } catch (error) {
    logger.error("Error creating findings batch", { error, count: data.length });
    throw new Error("Failed to create findings batch");
  }
}

export async function listFindings(
  filters: FindingFilters = {},
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 50, 200);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filters.documentId) conditions.push(eq(cbaIntelFindings.documentId, filters.documentId));
  if (filters.extractionRunId) conditions.push(eq(cbaIntelFindings.extractionRunId, filters.extractionRunId));
  if (filters.clauseFamily) conditions.push(eq(cbaIntelFindings.clauseFamily, filters.clauseFamily));
  if (filters.findingType) conditions.push(eq(cbaIntelFindings.findingType, filters.findingType));
  if (filters.reviewStatus) conditions.push(eq(cbaIntelFindings.reviewStatus, filters.reviewStatus));
  if (filters.minConfidence != null) {
    conditions.push(sql`${cbaIntelFindings.confidence} >= ${filters.minConfidence}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelFindings)
      .where(whereClause);

    const items = await db
      .select()
      .from(cbaIntelFindings)
      .where(whereClause)
      .orderBy(desc(cbaIntelFindings.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error listing findings", { error, filters });
    throw new Error("Failed to list findings");
  }
}

// ---------------------------------------------------------------------------
// Agreements
// ---------------------------------------------------------------------------

export async function createAgreement(data: NewAgreement): Promise<CbaIntelAgreement> {
  try {
    const [agreement] = await db.insert(cbaIntelAgreements).values(data).returning();
    return agreement;
  } catch (error) {
    logger.error("Error creating extracted agreement", { error, title: data.title });
    throw new Error("Failed to create extracted agreement");
  }
}

export async function getAgreementById(id: string): Promise<CbaIntelAgreement | null> {
  try {
    const [agreement] = await db
      .select()
      .from(cbaIntelAgreements)
      .where(eq(cbaIntelAgreements.id, id))
      .limit(1);
    return agreement ?? null;
  } catch (error) {
    logger.error("Error getting extracted agreement", { error, id });
    throw new Error("Failed to get extracted agreement");
  }
}

export async function listAgreements(
  filters: AgreementFilters = {},
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (filters.jurisdiction) conditions.push(eq(cbaIntelAgreements.jurisdiction, filters.jurisdiction));
  if (filters.sector) conditions.push(eq(cbaIntelAgreements.sector, filters.sector));
  if (filters.reviewStatus) conditions.push(eq(cbaIntelAgreements.reviewStatus, filters.reviewStatus));
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(cbaIntelAgreements.title, searchTerm),
        ilike(cbaIntelAgreements.employerNormalized, searchTerm),
        ilike(cbaIntelAgreements.unionNormalized, searchTerm),
        ilike(cbaIntelAgreements.localEntity, searchTerm),
      )!,
    );
  }
  if (filters.employerLike) {
    conditions.push(sql`${cbaIntelAgreements.employerNormalized} ILIKE ${'%' + filters.employerLike + '%'}`);
  }
  if (filters.unionLike) {
    conditions.push(sql`${cbaIntelAgreements.unionNormalized} ILIKE ${'%' + filters.unionLike + '%'}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelAgreements)
      .where(whereClause);

    const items = await db
      .select()
      .from(cbaIntelAgreements)
      .where(whereClause)
      .orderBy(desc(cbaIntelAgreements.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error listing extracted agreements", { error, filters });
    throw new Error("Failed to list extracted agreements");
  }
}

// ---------------------------------------------------------------------------
// Wage Adjustments
// ---------------------------------------------------------------------------

export async function createWageAdjustment(data: NewWageAdjustment): Promise<CbaIntelWageAdjustment> {
  try {
    const [wage] = await db.insert(cbaIntelWageAdjustments).values(data).returning();
    return wage;
  } catch (error) {
    logger.error("Error creating wage adjustment", { error, agreementId: data.agreementId });
    throw new Error("Failed to create wage adjustment");
  }
}

export async function listWageAdjustments(agreementId: string) {
  try {
    return await db
      .select()
      .from(cbaIntelWageAdjustments)
      .where(eq(cbaIntelWageAdjustments.agreementId, agreementId))
      .orderBy(cbaIntelWageAdjustments.year, cbaIntelWageAdjustments.effectiveDate);
  } catch (error) {
    logger.error("Error listing wage adjustments", { error, agreementId });
    throw new Error("Failed to list wage adjustments");
  }
}

// ---------------------------------------------------------------------------
// Clauses
// ---------------------------------------------------------------------------

export async function createClause(data: NewClause): Promise<CbaIntelClause> {
  const contentHash = data.contentHash ?? createHash("sha256")
    .update(data.rawText ?? data.summary ?? "")
    .digest("hex");

  try {
    const [clause] = await db
      .insert(cbaIntelClauses)
      .values({ ...data, contentHash })
      .returning();
    return clause;
  } catch (error) {
    logger.error("Error creating clause", { error, family: data.clauseFamily });
    throw new Error("Failed to create clause");
  }
}

export async function listClauses(agreementId: string) {
  try {
    return await db
      .select()
      .from(cbaIntelClauses)
      .where(eq(cbaIntelClauses.agreementId, agreementId))
      .orderBy(cbaIntelClauses.clauseFamily, cbaIntelClauses.clauseNumber);
  } catch (error) {
    logger.error("Error listing clauses", { error, agreementId });
    throw new Error("Failed to list clauses");
  }
}
