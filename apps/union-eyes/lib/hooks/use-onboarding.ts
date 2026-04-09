"use client";

/**
 * useOnboarding — lightweight onboarding state hook.
 *
 * Tracks whether the current user has completed onboarding and which
 * step they are on.  State is persisted in localStorage per userId so
 * it survives page reloads without requiring an API call.
 *
 * Onboarding completes when:
 *   1. The user dismisses the overlay, OR
 *   2. The user performs their first meaningful action
 *   (whichever happens first).
 */

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "ue_onboarding";

export interface OnboardingState {
  hasCompleted: boolean;
  lastStep: number;
  completedAt?: string;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY}_${userId}`;
}

function readState(userId: string): OnboardingState {
  if (typeof window === "undefined") return { hasCompleted: false, lastStep: 0 };
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) return JSON.parse(raw) as OnboardingState;
  } catch {
    // Corrupted — treat as fresh
  }
  return { hasCompleted: false, lastStep: 0 };
}

function writeState(userId: string, state: OnboardingState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch {
    // Storage full — non-fatal
  }
}

export function useOnboarding(userId: string | undefined) {
  const [state, setState] = useState<OnboardingState>({
    hasCompleted: true, // default to true to avoid flash
    lastStep: 0,
  });
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage once userId is available
  useEffect(() => {
    if (!userId) return;
    const saved = readState(userId);
    setState(saved);
    setReady(true);
  }, [userId]);

  const advanceStep = useCallback(() => {
    if (!userId) return;
    setState((prev) => {
      const next = { ...prev, lastStep: prev.lastStep + 1 };
      writeState(userId, next);
      return next;
    });
  }, [userId]);

  const completeOnboarding = useCallback(() => {
    if (!userId) return;
    const completed: OnboardingState = {
      hasCompleted: true,
      lastStep: -1,
      completedAt: new Date().toISOString(),
    };
    writeState(userId, completed);
    setState(completed);
  }, [userId]);

  const resetOnboarding = useCallback(() => {
    if (!userId) return;
    const fresh: OnboardingState = { hasCompleted: false, lastStep: 0 };
    writeState(userId, fresh);
    setState(fresh);
  }, [userId]);

  return {
    /** True once localStorage has been read */
    ready,
    /** Whether onboarding is complete */
    hasCompleted: state.hasCompleted,
    /** Current step index (0-based) */
    currentStep: state.lastStep,
    /** Move to the next overlay step */
    advanceStep,
    /** Mark onboarding as done */
    completeOnboarding,
    /** Admin/debug: reset onboarding flow */
    resetOnboarding,
    /** True when the overlay should be shown */
    showOverlay: ready && !state.hasCompleted,
  };
}
