/**
 * Legacy slug redirect — moved to /[locale]/organizational-continuity-risk.
 * Kept for SEO continuity and external bookmark stability.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalContinuityRiskRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/organizational-continuity-risk`);
}
