/**
 * Legacy slug redirect — moved to /[locale]/dashboard/organizational-intelligence.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalIntelligenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/organizational-intelligence`);
}
