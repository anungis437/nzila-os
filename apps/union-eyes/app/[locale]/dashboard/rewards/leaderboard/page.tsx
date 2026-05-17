/**
 * Wave 1 vocabulary hardening: this surface previously framed recognition
 * as a ranking/leaderboard. Recognition (not ranking) is the canonical
 * doctrine, so this route is now a permanent redirect to the recognition
 * surface. URL preserved so existing bookmarks and procurement deep links
 * keep resolving. Locale is preserved from the dynamic segment.
 */

import { redirect, permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LeaderboardRedirectPage({ params }: PageProps) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/dashboard/rewards/recognition`);
  // Fallback to satisfy types; permanentRedirect throws and never returns.
  redirect(`/${locale}/dashboard/rewards/recognition`);
}
