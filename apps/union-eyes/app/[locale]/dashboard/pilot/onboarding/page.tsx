/**
 * Pilot Onboarding Page
 *
 * Server component with RBAC — delegates to OnboardingConsole client component.
 */

export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { redirect } from 'next/navigation';
import OnboardingConsole from './onboarding-console';

export const metadata: Metadata = {
  title: 'Pilot Onboarding | Union Eyes',
  description: 'Readiness checklist, demo data controls, training resources',
};

export default async function PilotOnboardingPage() {
  await requireUser();

  const hasAccess = await hasMinRole('officer');
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <OnboardingConsole />;
}
