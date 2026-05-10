/**
 * /platform/operational-coherence — Wave 6 ontology collapse.
 * Canonical: /platform#priorities (operational cadence pillar).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OperationalCoherenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#priorities`);
}
