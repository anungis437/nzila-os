/**
 * Admin Settings — redirect to dashboard/settings
 *
 * Settings now live under the dashboard layout so they use the global
 * sidebar navigation. This page simply redirects so old links / admin-nav
 * clicks still work.
 */

import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminSettingsPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/settings`);
}
