/**
 * /platform/explainable-intelligence — Wave 6 ontology collapse.
 * Canonical: /platform#trust (audit/explainability pillar).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ExplainableIntelligenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#trust`);
}
