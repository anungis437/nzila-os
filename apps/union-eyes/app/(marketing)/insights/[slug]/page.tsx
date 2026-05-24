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
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type MarketingInsightRedirectPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MarketingInsightRedirectPage({ params }: MarketingInsightRedirectPageProps) {
  const { slug } = await params;
  redirect(`/en-CA/insights/${slug}`);
}
