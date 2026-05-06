/**
 * TrustCore — Onboarding Page
 *
 * Guards access (org_admin only) then renders the client-side wizard.
 * Redirects to /dashboard if onboarding was already completed.
 */

import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/rbac/requireRole'
import { getActivePrivacyProgram } from '@nzila/db/queries/trustcore'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const ctx = await requireRole(['org_admin'])

  // Prevent re-running if already completed
  const program = await getActivePrivacyProgram(ctx.orgId)
  if (program?.onboardingCompletedAt) {
    redirect('/dashboard')
  }

  return <OnboardingWizard orgId={ctx.orgId} />
}
