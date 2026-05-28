import { redirect } from 'next/navigation';

import { getPreferredLocaleForRedirect } from '@/lib/locale-routing';

export const dynamic = 'force-dynamic';

export default async function WhitepaperSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const locale = await getPreferredLocaleForRedirect();
  const { slug } = await params;

  redirect(`/${locale}/whitepapers/${slug}`);
}
