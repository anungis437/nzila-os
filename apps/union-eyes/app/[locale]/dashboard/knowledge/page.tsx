/**
 * /dashboard/knowledge — Wave 5 collapse.
 * Canonical surface: /dashboard/organizational-memory (knowledge tab).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function KnowledgeRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/organizational-memory?tab=knowledge`);
}
