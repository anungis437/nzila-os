/**
 * @deprecated Portal consolidated into dashboard (Phase 6 — Workflow Realignment).
 * All member self-service features are now in the unified dashboard.
 */
import { redirect } from "next/navigation";

export default async function PortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
