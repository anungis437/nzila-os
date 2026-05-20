"use client";

/**
 * OnboardingProvider — renders the onboarding overlay on the user's
 * landing page after role-based routing completes.
 *
 * Mounted once in the dashboard layout. Uses the current pathname and
 * user role to show role-appropriate onboarding steps. Disappears
 * permanently after completion or dismissal.
 */

import { useUser } from "@nzila/platform-auth/entra/client";
import { useEffect, useState } from "react";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import {
  OnboardingOverlay,
  toOnboardingRole,
} from "@/components/onboarding/onboarding-overlay";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";

interface OnboardingProviderProps {
  /** Server-resolved RBAC role */
  userRole: string;
}

export function OnboardingProvider({ userRole }: OnboardingProviderProps) {
  const suppressForCupeDemo = isCupe4373DemoRuntime();
  const { user } = useUser();
  const {
    showOverlay,
    currentStep,
    advanceStep,
    completeOnboarding,
  } = useOnboarding(user?.id);

  // Small delay to let the page content render before showing overlay
  const [delayPassed, setDelayPassed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDelayPassed(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (suppressForCupeDemo || !showOverlay || !delayPassed) return null;

  const onboardingRole = toOnboardingRole(userRole);

  return (
    <OnboardingOverlay
      currentStep={currentStep}
      onboardingRole={onboardingRole}
      onNext={advanceStep}
      onDismiss={completeOnboarding}
    />
  );
}
