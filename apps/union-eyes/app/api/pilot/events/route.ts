import { NextResponse } from "next/server";
import { withRoleAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import { trackPilotEvent, trackCaseCreated, trackUpdateAdded } from "@/lib/services/pilot-tracking";
import { claims } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { withRLSContext } from "@/lib/db/with-rls-context";
import type { PilotEventType } from "@/lib/services/pilot-tracking";

// Usage signals a browser can report. Every other pilot event type records something the server itself does (a case
// filed, an update added, an organization created, a role assigned) and is written by the route that did it.
const CLIENT_REPORTED_EVENT_TYPES: PilotEventType[] = [
  "user_login",
  "session_started",
  "session_ended",
  "active_user",
  "feature_used",
  "user_action",
  "case_viewed",
];
// These two are accepted only for a case that exists in the caller's organization.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASE_BOUND_EVENT_TYPES: PilotEventType[] = ["case_created", "update_added"];

/**
 * POST /api/pilot/events — record a pilot usage event.
 *
 * Body: { eventType, sessionId, metadata?, userId?, organizationId? }
 *
 * The event is always recorded for the authenticated caller in the caller's organization. A body that names a different
 * user or organization is refused rather than honoured, so a member cannot write usage events into another
 * organization's pilot metrics.
 *
 * Only usage signals and the case-bound case_created and update_added are accepted from a browser; the case must exist in
 * the caller's organization, so a member cannot make an organization look active without filing a case. Any other event
 * type is recorded by the server route that performs the action and is refused here.
 *
 * Special handling for case_created and update_added to auto-detect "first" variants.
 */
export const POST = withRoleAuth('member', async (req, context: BaseAuthContext) => {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A JSON object is required" }, { status: 400 });
    }
    const { eventType, userId: claimedUserId, organizationId: claimedOrganizationId, sessionId, metadata } = body;
    const userId = context.userId;
    const organizationId = context.organizationId;

    if (!userId || !organizationId) {
      return NextResponse.json({ error: "Organization context required" }, { status: 400 });
    }

    if (!eventType || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: eventType, sessionId" },
        { status: 400 },
      );
    }

    if (
      (claimedUserId !== undefined && claimedUserId !== userId) ||
      (claimedOrganizationId !== undefined && claimedOrganizationId !== organizationId)
    ) {
      return NextResponse.json({ error: "Events can only be recorded for the authenticated user and organization" }, { status: 403 });
    }

    // The free-form fields are bounded: a session id is short text and the metadata a small plain object.
    if (typeof sessionId !== "string" || sessionId.length > 100) {
      return NextResponse.json({ error: "sessionId must be text of at most 100 characters" }, { status: 400 });
    }
    if (metadata !== undefined && metadata !== null) {
      const isObject = typeof metadata === "object" && !Array.isArray(metadata);
      if (!isObject || JSON.stringify(metadata).length > 4096) {
        return NextResponse.json({ error: "metadata must be an object of at most 4 KB" }, { status: 400 });
      }
      if (metadata.caseId !== undefined && (typeof metadata.caseId !== "string" || metadata.caseId.length > 100)) {
        return NextResponse.json({ error: "metadata.caseId must be text of at most 100 characters" }, { status: 400 });
      }
    }

    const caseBound = CASE_BOUND_EVENT_TYPES.includes(eventType);
    if (!caseBound && !CLIENT_REPORTED_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: `eventType is not reported by a browser. Accepted: ${[...CLIENT_REPORTED_EVENT_TYPES, ...CASE_BOUND_EVENT_TYPES].join(", ")}` },
        { status: 400 },
      );
    }

    if (caseBound) {
      if (typeof metadata?.caseId !== "string" || !metadata.caseId) {
        return NextResponse.json({ error: "metadata.caseId is required for this event" }, { status: 400 });
      }
      const caseId: string = metadata.caseId;
      const known = UUID_PATTERN.test(caseId)
        ? await withRLSContext({ organizationId }, async (tx) =>
            tx.select({ claimId: claims.claimId }).from(claims)
              .where(and(eq(claims.claimId, caseId), eq(claims.organizationId, organizationId))).limit(1))
        : [];
      if (known.length === 0) {
        return NextResponse.json({ error: "Case not found" }, { status: 404 });
      }
    }

    // Delegate to smart trackers for case/update events
    if (eventType === "case_created" && metadata?.caseId) {
      await withRLSContext({ organizationId }, async (tx) => trackCaseCreated(userId, organizationId, sessionId, metadata.caseId, tx));
    } else if (eventType === "update_added" && metadata?.caseId) {
      await withRLSContext({ organizationId }, async (tx) => trackUpdateAdded(userId, organizationId, sessionId, metadata.caseId, tx));
    } else {
      await withRLSContext({ organizationId }, async (tx) => trackPilotEvent({ eventType, userId, organizationId, sessionId, metadata }, tx));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[pilot/events] Error recording event:", error as Error);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
});
