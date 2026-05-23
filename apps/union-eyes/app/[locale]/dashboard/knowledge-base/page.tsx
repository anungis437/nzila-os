/**
 * /dashboard/knowledge-base — Wave 5 collapse.
 * Canonical surface: /dashboard/organizational-memory (knowledge-base tab).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function KnowledgeBaseRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/organizational-memory?tab=knowledge-base`);
}
