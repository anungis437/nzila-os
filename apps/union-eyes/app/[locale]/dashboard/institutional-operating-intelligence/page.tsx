/**
 * Legacy slug redirect — moved to /[locale]/dashboard/organizational-operating-intelligence.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalOperatingIntelligenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/organizational-operating-intelligence`);
}
