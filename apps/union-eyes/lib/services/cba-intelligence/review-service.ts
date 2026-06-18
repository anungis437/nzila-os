import { db } from "@/db/db";
import {
  cbaIntelReviewDecisions,
  cbaIntelFindings,
  cbaIntelAgreements,
  cbaIntelWageAdjustments,
  cbaIntelClauses,
  type ReviewStatus,
} from "@/db/schema";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
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

export async function getReviewQueue(
  filters: ReviewQueueFilters = {},
  pagination: { page?: number; limit?: number } = {},
) {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [
    sql`${cbaIntelFindings.reviewStatus} IN ('pending_review', 'needs_followup')`,
  ];
  if (filters.minConfidence != null) {
    conditions.push(sql`${cbaIntelFindings.confidence} >= ${filters.minConfidence}`);
  }
  if (filters.maxConfidence != null) {
    conditions.push(sql`${cbaIntelFindings.confidence} <= ${filters.maxConfidence}`);
  }
  if (filters.clauseFamily) {
    conditions.push(eq(cbaIntelFindings.clauseFamily, filters.clauseFamily as never));
  }

  const whereClause = and(...conditions);

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cbaIntelFindings)
      .where(whereClause);

    const items = await db
      .select()
      .from(cbaIntelFindings)
      .where(whereClause)
      .orderBy(cbaIntelFindings.confidence, desc(cbaIntelFindings.createdAt))
      .limit(limit)
      .offset(offset);

    return { items, total: count, page, limit };
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

export async function submitReview(action: ReviewAction): Promise<CbaIntelReviewDecision> {
  const table = TARGET_TABLES[action.targetType];
  if (!table) {
    throw new Error(`Unknown target type: ${action.targetType}`);
  }

  try {
    // Fetch current status
    const [existing] = await db
      .select({ id: (table as typeof cbaIntelFindings).id, reviewStatus: (table as typeof cbaIntelFindings).reviewStatus })
      .from(table)
      .where(eq((table as typeof cbaIntelFindings).id, action.targetId))
      .limit(1);

    if (!existing) {
      throw new Error(`Target not found: ${action.targetType}/${action.targetId}`);
    }

    const previousStatus = existing.reviewStatus ?? "pending_review";

    // Insert the review decision (audit trail)
    const [decision] = await db
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
    await db
      .update(table)
      .set({ reviewStatus: action.decision } as never)
      .where(eq((table as typeof cbaIntelFindings).id, action.targetId));

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
        .where(eq(cbaIntelFindings.reviewStatus, "pending_review")),
      db.select({ count: sql<number>`count(*)::int` }).from(cbaIntelAgreements)
        .where(eq(cbaIntelAgreements.reviewStatus, "pending_review")),
      db.select({ count: sql<number>`count(*)::int` }).from(cbaIntelWageAdjustments)
        .where(eq(cbaIntelWageAdjustments.reviewStatus, "pending_review")),
      db.select({ count: sql<number>`count(*)::int` }).from(cbaIntelClauses)
        .where(eq(cbaIntelClauses.reviewStatus, "pending_review")),
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
