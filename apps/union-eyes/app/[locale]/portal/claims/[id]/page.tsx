/**
 * @deprecated Portal consolidated into dashboard (Phase 6 — Workflow Realignment).
 */
import { redirect } from "next/navigation";

export default async function PortalClaimDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  redirect(`/${locale}/dashboard/claims/${id}`);
}
