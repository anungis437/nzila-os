import { withApi, ApiError, z } from "@/lib/api/framework";
import {
  getReviewQueue,
  getReviewQueueCounts,
  submitReview,
} from "@/lib/services/cba-intelligence/review-service";

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
    if (query.counts) {
      return getReviewQueueCounts();
    }

    const { page, limit, counts, ...filters } = query;
    return getReviewQueue(filters, { page, limit });
  },
);

// ---------------------------------------------------------------------------
// POST /api/cba-intelligence/review — Submit review decision
// ---------------------------------------------------------------------------

const reviewDecisionSchema = z.object({
  targetType: z.enum(["finding", "agreement", "wage_adjustment", "clause"]),
  targetId: z.string().uuid(),
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
  async ({ body, userId }) => {
    if (!userId) throw ApiError.unauthorized("User context required");

    return submitReview({
      ...body,
      reviewerId: userId,
      reviewerRole: "steward", // Could be enriched from user context
    });
  },
);
