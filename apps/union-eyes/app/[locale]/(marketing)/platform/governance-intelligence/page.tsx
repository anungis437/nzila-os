/**
 * /platform/governance-intelligence — Wave 6 ontology collapse.
 * Canonical: /platform#governance (eight-pillar overview).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function GovernanceIntelligenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#governance`);
}
