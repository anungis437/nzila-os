import { NextResponse } from "next/server";
import { withRoleAuth } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { pilotFeedback } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * POST /api/pilot/feedback — submit in-app feedback.
 *
 * Body: { userId, organizationId, easeRating (1-5), category?, comment?, trigger }
 */
export const POST = withRoleAuth('member', async (req) => {
  try {
    const body = await req.json();
    const { userId, organizationId, easeRating, category, comment, trigger } = body;

    if (!userId || !organizationId || !easeRating || !trigger) {
      return NextResponse.json(
        { error: "Missing required: userId, organizationId, easeRating, trigger" },
        { status: 400 },
      );
    }

    if (easeRating < 1 || easeRating > 5) {
      return NextResponse.json({ error: "easeRating must be 1–5" }, { status: 400 });
    }

    const validCategories = ["confusing", "slow", "unnecessary_steps", "missing_feature"];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Valid: ${validCategories.join(", ")}` },
        { status: 400 },
      );
    }

    const validTriggers = ["first_case", "milestone_usage"];
    if (!validTriggers.includes(trigger)) {
      return NextResponse.json(
        { error: `Invalid trigger. Valid: ${validTriggers.join(", ")}` },
        { status: 400 },
      );
    }

    await withRLSContext(async () => {
      await db.insert(pilotFeedback).values({
        userId,
        organizationId,
        easeRating,
        category: category ?? null,
        comment: comment ?? null,
        trigger,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[pilot/feedback] Error:", error as Error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
});

/**
 * GET /api/pilot/feedback?organizationId=...
 *
 * Returns feedback summary for admin view.
 */
export const GET = withRoleAuth('admin', async (req) => {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId");
    if (!orgId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const summary = await withRLSContext(async () => db.execute(sql`
      SELECT
        COUNT(*)::int AS total_responses,
        ROUND(AVG(ease_rating), 1)::float AS avg_ease_rating,
        COUNT(*) FILTER (WHERE category = 'confusing')::int AS confusing_count,
        COUNT(*) FILTER (WHERE category = 'slow')::int AS slow_count,
        COUNT(*) FILTER (WHERE category = 'unnecessary_steps')::int AS unnecessary_count,
        COUNT(*) FILTER (WHERE category = 'missing_feature')::int AS missing_feature_count
      FROM pilot_feedback
      WHERE organization_id = ${orgId}
    `));

    const recent = await withRLSContext(async () => db
      .select()
      .from(pilotFeedback)
      .where(eq(pilotFeedback.organizationId, orgId))
      .orderBy(sql`created_at DESC`)
      .limit(10));

    return NextResponse.json({
      summary: (summary as Record<string, unknown>[])[0] ?? {},
      recent,
    });
  } catch (error) {
    logger.error("[pilot/feedback] Error:", error as Error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
});
