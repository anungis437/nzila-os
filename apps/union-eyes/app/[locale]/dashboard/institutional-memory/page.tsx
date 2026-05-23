/**
 * Legacy slug redirect — moved to /[locale]/dashboard/organizational-memory.
 * Preserves the `?tab=` querystring so existing deep-links (knowledge,
 * knowledge-base, transfer) continue to land on the right tab.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstitutionalMemoryRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === 'string' ? sp.tab : undefined;
  const target = tab
    ? `/${locale}/dashboard/organizational-memory?tab=${encodeURIComponent(tab)}`
    : `/${locale}/dashboard/organizational-memory`;
  redirect(target);
}
