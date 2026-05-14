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
import { notFound, redirect } from 'next/navigation';
import { locales } from '@/i18n/config';

type MarketingCatchAllPageProps = {
  params: Promise<{ slug: string[] }>;
};

export const dynamic = 'force-dynamic';

export default async function MarketingCatchAllPage({ params }: MarketingCatchAllPageProps) {
  const { slug } = await params;

  // Avoid recursive locale-prefix redirects for already-localized unknown paths,
  // e.g. /en-CA/dashboard/workflow-builder.
  if (slug.length > 0 && locales.includes(slug[0] as (typeof locales)[number])) {
    notFound();
  }

  redirect(`/en-CA/${slug.join('/')}`);
}