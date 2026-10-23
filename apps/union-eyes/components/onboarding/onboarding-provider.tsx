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
import { useConsentDecision } from '@/lib/privacy/consent-decision';
import { useOrganization } from '@/contexts/organization-context';
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import {
  OnboardingOverlay,
  toOnboardingRole,
} from "@/components/onboarding/onboarding-overlay";

interface OnboardingProviderProps {
  /** Server-resolved RBAC role */
  userRole: string;
}

export function OnboardingProvider({ userRole }: OnboardingProviderProps) {
  const { user } = useUser();
  const {
    showOverlay,
    currentStep,
    advanceStep,
    completeOnboarding,
  } = useOnboarding(user?.id);

  const privacyDecided = useConsentDecision();
  const { organization, isLoading } = useOrganization();
  if (!showOverlay || !privacyDecided || !user || isLoading || !organization) return null;

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
