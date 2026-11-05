import { db } from "@/db/db";
import {
  cbaIntelReviewDecisions,
  cbaIntelFindings,
  cbaIntelAgreements,
  cbaIntelWageAdjustments,
  cbaIntelClauses,
  type ReviewStatus,
} from "@/db/schema";
import { eq, and, desc, isNull, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { RLSTx } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";
import { updateReviewQueueDepthMetrics } from "@/lib/observability/metrics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelReviewDecision = typeof cbaIntelReviewDecisions.$inferSelect;
export type NewReviewDecision = typeof cbaIntelReviewDecisions.$inferInsert;

export type ReviewTargetType = "finding" | "agreement" | "wage_adjustment" | "clause";

export interface ReviewQueueFilters {
  targetType?: ReviewTargetType;
  minConfidence?: number;
  maxConfidence?: number;
  clauseFamily?: string;
  jurisdiction?: string;
}

/** One row awaiting review, whichever of the four extracted tables it is from: what a reviewer needs to tell it apart and judge it. */
export interface ReviewQueueItem {
  id: string;
  targetType: ReviewTargetType;
  /** What names the row: an agreement's or a clause's title, a finding's label, a wage adjustment's type, amount and classification. */
  title: string | null;
  /** The employer of an agreement; null for the other kinds. */
  employer: string | null;
  /** The jurisdiction of an agreement; null for the other kinds. */
  jurisdiction: string | null;
  clauseFamily: string | null;
  confidence: number | null;
  citationText: string | null;
  isInferred: boolean;
  reviewStatus: string;
  createdAt: string;
}

export interface ReviewAction {
  targetType: ReviewTargetType;
  targetId: string;
  decision: ReviewStatus;
  reason?: string;
  comment?: string;
  reviewerId: string;
  reviewerRole: string;
}

// ---------------------------------------------------------------------------
// Review queue — pending items
// ---------------------------------------------------------------------------

/**
 * A row awaits a reviewer when it has not been reviewed or was flagged for another look. One predicate for the queue and for its counts,
 * so the number on a tab is the number of rows its list holds.
 */
const awaitingReview = (status: AnyColumn): SQL => sql`${status} IN ('pending_review', 'needs_followup')`;

const asNumber = (value: string | number | null): number | null => (value === null || value === "" || Number.isNaN(Number(value)) ? null : Number(value));

const wageTitle = (row: typeof cbaIntelWageAdjustments.$inferSelect): string | null => {
  const amount = row.adjustmentPercent !== null ? `${Number(row.adjustmentPercent)}%` : row.adjustmentFlat !== null ? `$${Number(row.adjustmentFlat)}` : null;
  const parts = [row.adjustmentType.replace(/_/g, " "), amount, row.year, row.classification].filter((part) => part !== null && part !== "");
  return parts.length > 0 ? parts.join(" · ") : null;
};

/** The conditions a target's rows must meet to be in its queue, with the filters that mean something for that kind of row. */
function queueConditions(targetType: ReviewTargetType, filters: ReviewQueueFilters): SQL[] {
  const confidence =
    targetType === "agreement" ? cbaIntelAgreements.overallConfidence
      : targetType === "wage_adjustment" ? cbaIntelWageAdjustments.confidence
        : targetType === "clause" ? cbaIntelClauses.confidence
          : cbaIntelFindings.confidence;
  const status =
    targetType === "agreement" ? cbaIntelAgreements.reviewStatus
      : targetType === "wage_adjustment" ? cbaIntelWageAdjustments.reviewStatus
        : targetType === "clause" ? cbaIntelClauses.reviewStatus
          : cbaIntelFindings.reviewStatus;
  const conditions: SQL[] = [awaitingReview(status)];
  if (filters.minConfidence != null) conditions.push(sql`${confidence} >= ${filters.minConfidence}`);
  if (filters.maxConfidence != null) conditions.push(sql`${confidence} <= ${filters.maxConfidence}`);
  if (filters.clauseFamily && targetType === "finding") conditions.push(eq(cbaIntelFindings.clauseFamily, filters.clauseFamily as never));
  if (filters.clauseFamily && targetType === "clause") conditions.push(eq(cbaIntelClauses.clauseFamily, filters.clauseFamily as never));
  if (filters.jurisdiction && targetType === "agreement") conditions.push(eq(cbaIntelAgreements.jurisdiction, filters.jurisdiction));
  return conditions;
}

/** The page of rows of one kind that await review, lowest confidence first, as queue items. */
async function queuePage(targetType: ReviewTargetType, whereClause: SQL | undefined, limit: number, offset: number): Promise<ReviewQueueItem[]> {
  const item = (row: { id: string; reviewStatus: string | null; createdAt: Date }, fields: Pick<ReviewQueueItem, "title" | "employer" | "jurisdiction" | "clauseFamily" | "confidence" | "citationText" | "isInferred">): ReviewQueueItem => ({
    id: row.id,
    targetType,
    ...fields,
    reviewStatus: row.reviewStatus ?? "pending_review",
    createdAt: row.createdAt.toISOString(),
  });

  if (targetType === "agreement") {
    const rows = await db.select().from(cbaIntelAgreements).where(whereClause).orderBy(cbaIntelAgreements.overallConfidence, desc(cbaIntelAgreements.createdAt)).limit(limit).offset(offset);
    return rows.map((row) => item(row, { title: row.title, employer: row.employerNormalized, jurisdiction: row.jurisdiction, clauseFamily: null, confidence: asNumber(row.overallConfidence), citationText: null, isInferred: false }));
  }
  if (targetType === "wage_adjustment") {
    const rows = await db.select().from(cbaIntelWageAdjustments).where(whereClause).orderBy(cbaIntelWageAdjustments.confidence, desc(cbaIntelWageAdjustments.createdAt)).limit(limit).offset(offset);
    return rows.map((row) => item(row, { title: wageTitle(row), employer: null, jurisdiction: null, clauseFamily: null, confidence: asNumber(row.confidence), citationText: row.citationText, isInferred: row.isInferred }));
  }
  if (targetType === "clause") {
    const rows = await db.select().from(cbaIntelClauses).where(whereClause).orderBy(cbaIntelClauses.confidence, desc(cbaIntelClauses.createdAt)).limit(limit).offset(offset);
    return rows.map((row) => item(row, { title: row.title ?? (row.clauseNumber ? `§${row.clauseNumber}` : null), employer: null, jurisdiction: null, clauseFamily: row.clauseFamily, confidence: asNumber(row.confidence), citationText: row.summary, isInferred: row.isInferred }));
  }
  const rows = await db.select().from(cbaIntelFindings).where(whereClause).orderBy(cbaIntelFindings.confidence, desc(cbaIntelFindings.createdAt)).limit(limit).offset(offset);
  return rows.map((row) => item(row, { title: row.label, employer: null, jurisdiction: null, clauseFamily: row.clauseFamily, confidence: asNumber(row.confidence), citationText: row.citationText, isInferred: row.isInferred }));
}

/** The rows of one kind (findings unless a kind is named) that await review: each of the four tables has its own queue. */
export async function getReviewQueue(
  filters: ReviewQueueFilters = {},
  pagination: { page?: number; limit?: number } = {},
): Promise<{ items: ReviewQueueItem[]; total: number; page: number; limit: number }> {
  const targetType = filters.targetType ?? "finding";
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  const whereClause = and(...queueConditions(targetType, filters));

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(TARGET_TABLES[targetType] as typeof cbaIntelFindings)
      .where(whereClause);

    return { items: await queuePage(targetType, whereClause, limit, offset), total: count, page, limit };
  } catch (error) {
    logger.error("Error fetching review queue", { error, filters });
    throw new Error("Failed to fetch review queue");
  }
}

// ---------------------------------------------------------------------------
// Pending agreement reviews
// ---------------------------------------------------------------------------

export async function getPendingAgreementReviews(
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelAgreements)
      .where(eq(cbaIntelAgreements.reviewStatus, "pending_review"));

    const items = await db
      .select()
      .from(cbaIntelAgreements)
      .where(eq(cbaIntelAgreements.reviewStatus, "pending_review"))
      .orderBy(cbaIntelAgreements.overallConfidence, desc(cbaIntelAgreements.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
  } catch (error) {
    logger.error("Error fetching agreement review queue", { error });
    throw new Error("Failed to fetch agreement review queue");
  }
}

// ---------------------------------------------------------------------------
// Submit review decision
// ---------------------------------------------------------------------------

const TARGET_TABLES = {
  finding: cbaIntelFindings,
  agreement: cbaIntelAgreements,
  wage_adjustment: cbaIntelWageAdjustments,
  clause: cbaIntelClauses,
} as const;

/**
 * Record a review decision and apply it to its target. Pass the caller's transaction so the decision, the status change
 * and the caller's audit record commit together; the status change carries the status it expected, so a concurrent
 * decision is never overwritten.
 */
export async function submitReview(action: ReviewAction, exec: RLSTx = db): Promise<CbaIntelReviewDecision> {
  const table = TARGET_TABLES[action.targetType];
  if (!table) {
    throw new Error(`Unknown target type: ${action.targetType}`);
  }

  try {
    // Fetch current status
    const [existing] = await exec
      .select({ id: (table as typeof cbaIntelFindings).id, reviewStatus: (table as typeof cbaIntelFindings).reviewStatus })
      .from(table)
      .where(eq((table as typeof cbaIntelFindings).id, action.targetId))
      .limit(1);

    if (!existing) {
      throw new Error(`Target not found: ${action.targetType}/${action.targetId}`);
    }

    const previousStatus = existing.reviewStatus ?? "pending_review";

    // Insert the review decision (audit trail)
    const [decision] = await exec
      .insert(cbaIntelReviewDecisions)
      .values({
        targetType: action.targetType,
        targetId: action.targetId,
        decision: action.decision,
        reason: action.reason,
        comment: action.comment,
        reviewerId: action.reviewerId,
        reviewerRole: action.reviewerRole,
        previousStatus,
      })
      .returning();

    // Update the target record's review status
    const reviewStatusColumn = (table as typeof cbaIntelFindings).reviewStatus;
    const [applied] = await exec
      .update(table)
      .set({ reviewStatus: action.decision } as never)
      .where(
        and(
          eq((table as typeof cbaIntelFindings).id, action.targetId),
          existing.reviewStatus == null ? isNull(reviewStatusColumn) : eq(reviewStatusColumn, existing.reviewStatus),
        ),
      )
      .returning({ id: (table as typeof cbaIntelFindings).id });
    if (!applied) {
      throw new Error(`Review target changed concurrently: ${action.targetType}/${action.targetId}`);
    }

    logger.info("Review decision submitted", {
      targetType: action.targetType,
      targetId: action.targetId,
      decision: action.decision,
      reviewerId: action.reviewerId,
    });

    return decision;
  } catch (error) {
    logger.error("Error submitting review", { error, action });
    throw error instanceof Error ? error : new Error("Failed to submit review");
  }
}

export async function flagForFollowupReview(input: {
  targetType: ReviewTargetType;
  targetId: string;
  reason: string;
  comment?: string;
  reviewerId?: string;
  reviewerRole?: string;
}): Promise<CbaIntelReviewDecision> {
  return submitReview({
    targetType: input.targetType,
    targetId: input.targetId,
    decision: "needs_followup",
    reason: input.reason,
    comment: input.comment,
    reviewerId: input.reviewerId ?? "system:classification-guard",
    reviewerRole: input.reviewerRole ?? "system",
  });
}

// ---------------------------------------------------------------------------
// Review history for a target
// ---------------------------------------------------------------------------

export async function getReviewHistory(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<CbaIntelReviewDecision[]> {
  try {
    return await db
      .select()
      .from(cbaIntelReviewDecisions)
      .where(
        and(
          eq(cbaIntelReviewDecisions.targetType, targetType),
          eq(cbaIntelReviewDecisions.targetId, targetId),
        ),
      )
      .orderBy(desc(cbaIntelReviewDecisions.createdAt));
  } catch (error) {
    logger.error("Error fetching review history", { error, targetType, targetId });
    throw new Error("Failed to fetch review history");
  }
}

// ---------------------------------------------------------------------------
// Review queue counts (dashboard stats)
// ---------------------------------------------------------------------------

export async function getReviewQueueCounts(): Promise<{
  findings: number;
  agreements: number;
  wageAdjustments: number;
  clauses: number;
  total: number;
}> {
  try {
    const [[f], [a], [w], [c]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(cbaIntelFindings)
        .where(awaitingReview(cbaIntelFindings.reviewStatus)),
      db.select({ count: sql<number>`count(*)::int` }).from(cbaIntelAgreements)
        .where(awaitingReview(cbaIntelAgreements.reviewStatus)),
      db.select({ count: sql<number>`count(*)::int` }).from(cbaIntelWageAdjustments)
        .where(awaitingReview(cbaIntelWageAdjustments.reviewStatus)),
      db.select({ count: sql<number>`count(*)::int` }).from(cbaIntelClauses)
        .where(awaitingReview(cbaIntelClauses.reviewStatus)),
    ]);

    const counts = {
      findings: f.count,
      agreements: a.count,
      wageAdjustments: w.count,
      clauses: c.count,
      total: f.count + a.count + w.count + c.count,
    };

    updateReviewQueueDepthMetrics(counts);
    return counts;
  } catch (error) {
    logger.error("Error fetching review queue counts", { error });
    throw new Error("Failed to fetch review queue counts");
  }
}
