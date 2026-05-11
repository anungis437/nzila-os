/**
 * /dashboard/institutional-intelligence — Wave 5 collapse.
 * Canonical surface: /dashboard/intelligence (institutional tab).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalIntelligenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/intelligence?tab=institutional`);
}
