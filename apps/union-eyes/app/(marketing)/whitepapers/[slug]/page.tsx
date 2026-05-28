import { redirect } from 'next/navigation';

import { getPreferredLocaleForRedirect, getPublicOriginForRedirect } from '@/lib/locale-routing';

export const dynamic = 'force-dynamic';

export default async function WhitepaperSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const locale = await getPreferredLocaleForRedirect();
  const publicOrigin = await getPublicOriginForRedirect();
  const { slug } = await params;
  const targetPath = `/${locale}/whitepapers/${slug}`;

  redirect(publicOrigin ? `${publicOrigin}${targetPath}` : targetPath);
}
