import { NextResponse } from "next/server";
import { withRoleAuth, type BaseAuthContext } from "@/lib/api-auth-guard";
import { logger } from "@/lib/logger";
import { trackPilotEvent, trackCaseCreated, trackUpdateAdded } from "@/lib/services/pilot-tracking";
import type { PilotEventType } from "@/lib/services/pilot-tracking";

const VALID_EVENT_TYPES: PilotEventType[] = [
  "user_login",
  "session_started",
  "session_ended",
  "first_case_created",
  "case_created",
  "case_imported",
  "case_transitioned",
  "case_closed",
  "document_uploaded",
  "document_attached",
  "document_accessed",
  "mapping_applied",
  "validation_failed",
  "sla_breach_risk",
  "sla_breached",
  "active_user",
  "feature_used",
  "user_action",
  "feedback_submitted",
  "org_created",
  "user_invited",
  "role_assigned",
  "first_update_added",
  "update_added",
  "case_viewed",
];

/**
 * POST /api/pilot/events — record a pilot usage event.
 *
 * Body: { eventType, sessionId, metadata?, userId?, organizationId? }
 *
 * The event is always recorded for the authenticated caller in the caller's organization. A body that names a different
 * user or organization is refused rather than honoured, so a member cannot write usage events into another
 * organization's pilot metrics.
 *
 * Special handling for case_created and update_added to auto-detect "first" variants.
 */
export const POST = withRoleAuth('member', async (req, context: BaseAuthContext) => {
  try {
    const body = await req.json();
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

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Valid: ${VALID_EVENT_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    // Delegate to smart trackers for case/update events
    if (eventType === "case_created" && metadata?.caseId) {
      await trackCaseCreated(userId, organizationId, sessionId, metadata.caseId);
    } else if (eventType === "update_added" && metadata?.caseId) {
      await trackUpdateAdded(userId, organizationId, sessionId, metadata.caseId);
    } else {
      await trackPilotEvent({ eventType, userId, organizationId, sessionId, metadata });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[pilot/events] Error recording event:", error as Error);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
});
