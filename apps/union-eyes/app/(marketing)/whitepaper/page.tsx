import { redirect } from 'next/navigation';

import { getPreferredLocaleForRedirect } from '@/lib/locale-routing';

export const dynamic = 'force-dynamic';

export default async function WhitepaperPage() {
  const locale = await getPreferredLocaleForRedirect();
  redirect(`/${locale}/whitepaper`);
}