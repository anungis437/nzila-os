"use client";

/**
 * Client-side pilot event tracking hook.
 *
 * Manages session ID generation and provides simple tracking functions.
 * Events are sent to POST /api/pilot/events.
 *
 * Usage:
 *   const { trackEvent, trackCaseCreated, trackUpdateAdded } = usePilotTracking();
 *   trackEvent("case_viewed", { caseId: "..." });
 */

import { useCallback, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import { usePilotMode } from "@/contexts/pilot-mode-context";

const SESSION_KEY = "ue-pilot-session-id";

function getOrCreateSessionId(): string {
  try {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return crypto.randomUUID();
  }
}

export function usePilotTracking() {
  const { user } = useUser();
  const userId = user?.id;
  const organizationId = useOrganizationId();
  const { isPilotMode } = usePilotMode();
  const sessionIdRef = useRef<string>("");
  const loginTrackedRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  const trackEvent = useCallback(
    async (
      eventType: string,
      metadata?: Record<string, unknown>,
    ) => {
      if (!isPilotMode || !userId || !organizationId) return;

      try {
        await fetch("/api/pilot/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType,
            userId,
            organizationId,
            sessionId: sessionIdRef.current,
            metadata,
          }),
        });
      } catch {
        // Tracking failures should never block the user
      }
    },
    [isPilotMode, userId, organizationId],
  );

  // Track login once per session
  useEffect(() => {
    if (isPilotMode && userId && organizationId && !loginTrackedRef.current) {
      loginTrackedRef.current = true;
      trackEvent("user_login");
      trackEvent("session_started");
    }
  }, [isPilotMode, userId, organizationId, trackEvent]);

  const trackCaseCreated = useCallback(
    (caseId: string) => trackEvent("case_created", { caseId }),
    [trackEvent],
  );

  const trackUpdateAdded = useCallback(
    (caseId: string) => trackEvent("update_added", { caseId }),
    [trackEvent],
  );

  const trackCaseViewed = useCallback(
    (caseId: string) => trackEvent("case_viewed", { caseId }),
    [trackEvent],
  );

  return { trackEvent, trackCaseCreated, trackUpdateAdded, trackCaseViewed };
}
