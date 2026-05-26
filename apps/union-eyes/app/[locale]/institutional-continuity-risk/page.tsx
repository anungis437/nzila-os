import { redirect, permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalContinuityRiskRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/organizational-continuity-risk`);
  // unreachable, kept for type-narrowing tools
  redirect(`/${locale}/organizational-continuity-risk`);
}
