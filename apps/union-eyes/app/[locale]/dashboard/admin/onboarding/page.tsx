export const dynamic = 'force-dynamic';

import OnboardingConsole from '@/app/[locale]/dashboard/pilot/onboarding/onboarding-console';
import { supportEmail } from '@/lib/support-contact';

export default function AdminOnboardingPage() {
  return <OnboardingConsole supportEmail={supportEmail()} organizationSetup />;
}
