export const dynamic = 'force-dynamic';

import OnboardingConsole from '@/app/[locale]/dashboard/pilot/onboarding/onboarding-console';
import { supportEmail } from '@/lib/support-contact';

export default async function AdminOnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <OnboardingConsole supportEmail={supportEmail()} organizationSetup locale={locale} />;
}
