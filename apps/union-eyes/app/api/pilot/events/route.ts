import { NextRequest, NextResponse } from "next/server";
import { trackPilotEvent, trackCaseCreated, trackUpdateAdded } from "@/lib/services/pilot-tracking";
import type { PilotEventType } from "@/lib/services/pilot-tracking";

const VALID_EVENT_TYPES: PilotEventType[] = [
  "user_login",
  "session_started",
  "session_ended",
  "first_case_created",
  "case_created",
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
export async function POST(req: NextRequest) {
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
    console.error("[pilot/events] Error recording event:", error);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}
