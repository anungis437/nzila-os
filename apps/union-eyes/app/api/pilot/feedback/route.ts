import { NextResponse } from "next/server";
import { withRoleAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import { db } from "@/db";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { pilotFeedback, pilotEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * POST /api/pilot/feedback — submit in-app feedback.
 *
 * Body: { easeRating (1-5), category?, comment?, trigger }
 * userId/organizationId are derived from the authenticated caller, never
 * accepted from the client — see round 56 fix (was spoofable via body).
 */
export const POST = withRoleAuth('member', async (req, context: BaseAuthContext) => {
  try {
    const body = await req.json();
    const { easeRating, category, comment, trigger } = body;
    const userId = context.userId;
    const organizationId = context.organizationId;

    if (!userId || !organizationId || !easeRating || !trigger) {
      return NextResponse.json(
        { error: "Missing required: easeRating, trigger" },
        { status: 400 },
      );
    }

    if (!Number.isInteger(easeRating) || easeRating < 1 || easeRating > 5) {
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

    // The feedback row, its usage events and the audit record are one unit: any failure rolls all of it back.
    await withRLSContext({ organizationId }, async (tx) => {
      const [row] = await tx
        .insert(pilotFeedback)
        .values({
          userId,
          organizationId,
          easeRating,
          category: category ?? null,
          comment: comment ?? null,
          trigger,
        })
        .returning({ id: pilotFeedback.id });

      const sessionId = `server:pilot-feedback:${trigger}`;
      await tx.insert(pilotEvents).values([
        {
          organizationId,
          userId,
          sessionId,
          eventType: 'feedback_submitted',
          metadata: { easeRating, category: category ?? null, trigger },
        },
        {
          organizationId,
          userId,
          sessionId,
          eventType: 'feature_used',
          metadata: { feature: 'pilot_feedback', trigger },
        },
      ]);

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pilot.feedback.submit',
        resourceType: 'pilot_feedback',
        resourceId: row?.id,
        details: { easeRating, category: category ?? null, trigger },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[pilot/feedback] Error:", error as Error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
});

/**
 * GET /api/pilot/feedback
 *
 * Returns feedback summary for admin view, scoped to the caller's own
 * organization — organizationId is derived from the authenticated caller,
 * never accepted from the client (round 56 fix: was a cross-org IDOR via
 * an arbitrary ?organizationId= query param).
 */
export const GET = withRoleAuth('admin', async (req, context: BaseAuthContext) => {
  try {
    const orgId = context.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Missing organization context" }, { status: 400 });
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
