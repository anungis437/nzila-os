"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface PilotModeContextValue {
  /** True when the organization is in pilot mode (simplified UX). */
  isPilotMode: boolean;
  /** True while the initial flag fetch is pending. */
  isLoading: boolean;
  /** Whether the first-login onboarding wizard has been completed. */
  hasCompletedOnboarding: boolean;
  /** Mark the onboarding wizard as completed for this user. */
  completeOnboarding: () => void;
}

const PilotModeContext = createContext<PilotModeContextValue>({
  isPilotMode: false,
  isLoading: true,
  hasCompletedOnboarding: false,
  completeOnboarding: () => {},
});

const ONBOARDING_KEY = "ue-pilot-onboarding-complete";

export function PilotModeProvider({ children }: { children: ReactNode }) {
  const [isPilotMode, setIsPilotMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Check onboarding completion from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_KEY);
      if (stored === "true") {
        setHasCompletedOnboarding(true);
      }
    } catch {
      // SSR or storage unavailable
    }
  }, []);

  // Fetch pilot mode flag from the server
  useEffect(() => {
    const fetchPilotFlag = async () => {
      try {
        const res = await fetch("/api/feature-flags?flag=pilot-mode");
        if (res.ok) {
          const data = await res.json();
          setIsPilotMode(data?.enabled ?? false);
        }
      } catch {
        // Default to false if the flag endpoint is unavailable
        setIsPilotMode(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPilotFlag();
  }, []);

  const completeOnboarding = () => {
    setHasCompletedOnboarding(true);
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {
      // ignore
    }
  };

  return (
    <PilotModeContext.Provider
      value={{ isPilotMode, isLoading, hasCompletedOnboarding, completeOnboarding }}
    >
      {children}
    </PilotModeContext.Provider>
  );
}

export function usePilotMode() {
  return useContext(PilotModeContext);
}
