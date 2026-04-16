import { NextResponse } from "next/server";
import { withRoleAuth } from "@/lib/api-auth-guard";
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
 * Body: { eventType, userId, organizationId, sessionId, metadata? }
 *
 * Special handling for case_created and update_added to auto-detect "first" variants.
 */
export const POST = withRoleAuth('member', async (req) => {
  try {
    const body = await req.json();
    const { eventType, userId, organizationId, sessionId, metadata } = body;

    if (!eventType || !userId || !organizationId || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: eventType, userId, organizationId, sessionId" },
        { status: 400 },
      );
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
