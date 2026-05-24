/**
 * Legacy slug redirect — moved to /[locale]/dashboard/organizational-chronology.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalChronologyRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/organizational-chronology`);
}
