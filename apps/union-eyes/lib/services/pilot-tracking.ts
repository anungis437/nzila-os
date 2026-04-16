/**
 * Pilot Event Tracking Service
 *
 * Lightweight event emission for pilot usage observability.
 * Tracks: user_login, session_started, session_ended, first_case_created,
 *         case_created, first_update_added, update_added, case_viewed
 *
 * Each event captures: userId, orgId, sessionId, timestamp.
 * Used by metrics, friction detection, and champion signal services.
 *
 * Event → Business Meaning:
 *   session_started      → reach        (user opened the app)
 *   first_case_created   → activation   (user completed the core action for the first time)
 *   first_update_added   → engagement   (user returned and interacted with their case)
 *   case_created (≥2)    → adoption     (user treats the system as their default tool)
 *   case_viewed          → retention    (user checks status without prompting)
 */

import { db } from "@/db";
import { pilotEvents } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type PilotEventType =
  | "user_login"
  | "session_started"
  | "session_ended"
  | "first_case_created"
  | "case_created"
  | "case_imported"
  | "case_transitioned"
  | "case_closed"
  | "document_attached"
  | "document_accessed"
  | "document_uploaded"
  | "mapping_applied"
  | "validation_failed"
  | "sla_breach_risk"
  | "sla_breached"
  | "active_user"
  | "feature_used"
  | "user_action"
  | "feedback_submitted"
  | "org_created"
  | "user_invited"
  | "role_assigned"
  | "first_update_added"
  | "update_added"
  | "case_viewed";

interface TrackEventInput {
  userId: string;
  organizationId: string;
  sessionId: string;
  eventType: PilotEventType;
  metadata?: Record<string, unknown>;
}

/**
 * Record a single pilot event.
 */
export async function trackPilotEvent(input: TrackEventInput): Promise<void> {
  await db.insert(pilotEvents).values({
    organizationId: input.organizationId,
    userId: input.userId,
    sessionId: input.sessionId,
    eventType: input.eventType,
    metadata: input.metadata ?? null,
  });
}

/**
 * Check whether a user has already emitted a specific event type.
 * Used to distinguish "first_case_created" from "case_created".
 */
export async function hasUserEvent(
  userId: string,
  organizationId: string,
  eventType: PilotEventType,
): Promise<boolean> {
  const rows = await db
    .select({ id: pilotEvents.id })
    .from(pilotEvents)
    .where(
      and(
        eq(pilotEvents.userId, userId),
        eq(pilotEvents.organizationId, organizationId),
        eq(pilotEvents.eventType, eventType),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Track a case creation — automatically determines if it's the first case.
 */
export async function trackCaseCreated(
  userId: string,
  organizationId: string,
  sessionId: string,
  caseId: string,
): Promise<void> {
  const isFirst = !(await hasUserEvent(userId, organizationId, "case_created"));

  if (isFirst) {
    await trackPilotEvent({
      userId,
      organizationId,
      sessionId,
      eventType: "first_case_created",
      metadata: { caseId },
    });
  }

  await trackPilotEvent({
    userId,
    organizationId,
    sessionId,
    eventType: "case_created",
    metadata: { caseId },
  });
}

/**
 * Track an update added — automatically determines if it's the first update.
 */
export async function trackUpdateAdded(
  userId: string,
  organizationId: string,
  sessionId: string,
  caseId: string,
): Promise<void> {
  const isFirst = !(await hasUserEvent(userId, organizationId, "update_added"));

  if (isFirst) {
    await trackPilotEvent({
      userId,
      organizationId,
      sessionId,
      eventType: "first_update_added",
      metadata: { caseId },
    });
  }

  await trackPilotEvent({
    userId,
    organizationId,
    sessionId,
    eventType: "update_added",
    metadata: { caseId },
  });
}

/**
 * Get event count for a user within an org.
 */
export async function getUserEventCount(
  userId: string,
  organizationId: string,
  eventType?: PilotEventType,
): Promise<number> {
  const conditions = [
    eq(pilotEvents.userId, userId),
    eq(pilotEvents.organizationId, organizationId),
  ];
  if (eventType) {
    conditions.push(eq(pilotEvents.eventType, eventType));
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pilotEvents)
    .where(and(...conditions));

  return result[0]?.count ?? 0;
}
