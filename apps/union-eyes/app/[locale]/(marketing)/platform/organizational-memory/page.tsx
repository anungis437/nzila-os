/**
 * /platform/organizational-memory — Wave 6 ontology collapse.
 * Canonical: /platform#institutional-memory (eight-pillar overview).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OrganizationalMemoryRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#institutional-memory`);
}
