/**
 * Institutional Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (institutional memory, succession, stewardship),
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
 * institutional trust for democratic infrastructure.
 */
/**
 * /platform/organizational-memory — Wave 6 ontology collapse.
 * Canonical: /platform#institutional-memory (eight-pillar overview).
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Redirecting | UnionEyes Platform',
    description: 'This route redirects to the canonical platform section.',
    robots: {
      index: false,
      follow: false,
    },
    alternates: buildLocaleAlternates(locale, '/platform/organizational-memory'),
  };
}

export default async function OrganizationalMemoryRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/platform#institutional-memory`);
}
