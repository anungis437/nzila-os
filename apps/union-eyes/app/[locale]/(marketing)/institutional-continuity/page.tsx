/**
 * Legacy slug redirect — moved to /[locale]/(marketing)/organizational-continuity.
 * Kept for SEO continuity and external bookmark stability.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalContinuityRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/organizational-continuity`);
}
