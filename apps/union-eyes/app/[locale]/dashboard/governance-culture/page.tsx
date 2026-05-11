/**
 * /dashboard/governance-culture — Wave 5 collapse.
 * Canonical surface: /dashboard/governance (culture tab).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function GovernanceCultureRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/governance?tab=culture`);
}
