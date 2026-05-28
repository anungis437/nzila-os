import { redirect } from 'next/navigation';

import { getPreferredLocaleForRedirect, getPublicOriginForRedirect } from '@/lib/locale-routing';

export const dynamic = 'force-dynamic';

export default async function WhitepaperPage() {
  const locale = await getPreferredLocaleForRedirect();
  const publicOrigin = await getPublicOriginForRedirect();
  const targetPath = `/${locale}/whitepaper`;
  redirect(publicOrigin ? `${publicOrigin}${targetPath}` : targetPath);
}