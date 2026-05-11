/**
 * /dashboard/institutional-operating-intelligence — Wave 5 collapse.
 * Canonical surface: /dashboard/intelligence (executive-operating tab).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalOperatingIntelligenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/intelligence?tab=executive-operating`);
}
