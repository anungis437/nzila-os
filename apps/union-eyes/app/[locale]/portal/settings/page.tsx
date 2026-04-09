/**
 * @deprecated Portal consolidated into dashboard (Phase 6 — Workflow Realignment).
 */
import { redirect } from "next/navigation";

export default async function PortalSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/settings`);
}
