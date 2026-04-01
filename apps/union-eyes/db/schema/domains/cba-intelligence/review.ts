import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const reviewStatusEnum = pgEnum("cba_intel_review_status", [
  "pending_review",
  "approved",
  "rejected",
  "superseded",
  "needs_followup",
]);

export const reviewTargetTypeEnum = pgEnum("cba_intel_review_target_type", [
  "finding",
  "agreement",
  "wage_adjustment",
  "clause",
]);

// ---------------------------------------------------------------------------
// Review Decisions
// ---------------------------------------------------------------------------

export const cbaIntelReviewDecisions = pgTable(
  "cba_intel_review_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Target
    targetType: reviewTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),

    // Decision
    decision: reviewStatusEnum("decision").notNull(),
    reason: text("reason"),
    comment: text("comment"),

    // Actor
    reviewerId: varchar("reviewer_id", { length: 255 }).notNull(),
    reviewerRole: varchar("reviewer_role", { length: 60 }).notNull(),

    // Previous state
    previousStatus: varchar("previous_status", { length: 30 }),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_cba_intel_reviews_target").on(t.targetType, t.targetId),
    index("idx_cba_intel_reviews_decision").on(t.decision),
    index("idx_cba_intel_reviews_reviewer").on(t.reviewerId),
    index("idx_cba_intel_reviews_created").on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const cbaIntelReviewDecisionsRelations = relations(
  cbaIntelReviewDecisions,
  () => ({}),
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CbaIntelReviewDecision = typeof cbaIntelReviewDecisions.$inferSelect;
export type NewCbaIntelReviewDecision = typeof cbaIntelReviewDecisions.$inferInsert;
export type ReviewStatus = typeof reviewStatusEnum.enumValues[number];
