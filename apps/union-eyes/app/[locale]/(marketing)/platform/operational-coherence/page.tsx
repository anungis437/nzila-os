/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * organizational trust for democratic infrastructure.
 */
/**
 * /platform/operational-coherence — Wave 6 ontology collapse.
 * Canonical: /platform#priorities (operational cadence pillar).
 */
import { redirect } from 'next/navigation';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const copy = locale === 'fr-CA'
    ? {
        title: 'Redirection | Plateforme UnionEyes',
        description: 'Cette page redirige vers la section canonique de la plateforme.',
      }
    : {
        title: 'Redirecting | UnionEyes Platform',
        description: 'This route redirects to the canonical platform section.',
      };
  return {
    title: copy.title,
    description: copy.description,
    robots: {
      index: false,
      follow: false,
    },
    alternates: buildLocaleAlternates(locale, '/platform/operational-coherence'),
  };
}

export default async function OperationalCoherenceRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#priorities`);
}
