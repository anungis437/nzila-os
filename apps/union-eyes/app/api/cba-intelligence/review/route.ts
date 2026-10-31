import { withApi, ApiError, z } from "@/lib/api/framework";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { requireSystemAdmin } from "@/lib/api-auth-guard";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import {
  getReviewQueue,
  getReviewQueueCounts,
  submitReview,
} from "@/lib/services/cba-intelligence/review-service";

// ---------------------------------------------------------------------------
// The agreements, findings, wage adjustments and clauses reviewed here are one platform-wide extracted dataset: none of its tables has an
// organization column. A decision changes what every organization reads, so reviewing is platform authority. A steward or administrator
// of one organization held the floor and could approve, reject or supersede rows for all of them.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /api/cba-intelligence/review — Get review queue
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  targetType: z.enum(["finding", "agreement", "wage_adjustment", "clause"]).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  maxConfidence: z.coerce.number().min(0).max(1).optional(),
  clauseFamily: z.string().optional(),
  counts: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const GET = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    query: listQuerySchema,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Get review queue with pending items",
    },
  },
  async ({ query }) => {
    await requireSystemAdmin();
    if (query.counts) {
      return getReviewQueueCounts();
    }

    const { page, limit, counts: _counts, ...filters } = query;
    return getReviewQueue(filters, { page, limit });
  },
);

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/review — Submit review decision
// ---------------------------------------------------------------------------

const reviewDecisionSchema = z.object({
  targetType: z.enum(["finding", "agreement", "wage_adjustment", "clause"]),
  targetId: z.guid(),
  decision: z.enum(["approved", "rejected", "needs_followup", "superseded"]),
  reason: z.string().max(1000).optional(),
  comment: z.string().max(5000).optional(),
});

export const POST = withApi(
  {
    auth: { minRole: "steward" },
    entitlement: "commercial_reporting",
    body: reviewDecisionSchema,
    successStatus: 201,
    openapi: {
      tags: ["CBA Intelligence"],
      summary: "Submit a review decision",
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!userId) throw ApiError.unauthorized("User context required");
    await requireSystemAdmin();
    if (!organizationId) throw ApiError.badRequest("Organization context required");

    // The decision, the status it sets on its target and the audit record commit together.
    return withRLSContext({ organizationId }, async (tx) => {
      const decision = await submitReview({
        ...body,
        reviewerId: userId,
        reviewerRole: "platform_administrator",
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: "cba_review.decide",
        resourceType: `cba_intel_${body.targetType}`,
        resourceId: body.targetId,
        details: { decision: body.decision, reviewDecisionId: decision.id },
      });
      return decision;
    });
  },
);
