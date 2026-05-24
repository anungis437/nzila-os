/**
 * /dashboard/knowledge-transfer — Wave 5 collapse (root only).
 * Canonical surface: /dashboard/organizational-memory (transfer tab).
 *
 * NOTE: `/dashboard/knowledge-transfer/new` and `/dashboard/knowledge-transfer/[id]`
 * remain authoritative drilldowns under this segment. Only the root
 * page.tsx is converted to a redirect to the canonical surface.
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function KnowledgeTransferRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/organizational-memory?tab=transfer`);
}
