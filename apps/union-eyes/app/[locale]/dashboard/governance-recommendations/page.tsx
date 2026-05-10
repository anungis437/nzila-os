/**
 * /dashboard/governance-recommendations — Wave 5 collapse.
 * Canonical surface: /dashboard/governance (recommendations tab).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function GovernanceRecommendationsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/governance?tab=recommendations`);
}
