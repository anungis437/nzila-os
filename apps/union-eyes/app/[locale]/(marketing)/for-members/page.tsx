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
 *
 * Role coordination surface
 *
 * Coordination posture: representation workflow, case management, intake choreography,
 * and operational coordination across federation, leadership, member, and staff touchpoints.
 *
 * Governance posture: bylaw-aligned procedural cadence, constitutional consistency,
 * accountability surfaces, and compliance choreography across jurisdictions and mandates.
 *
 * Continuity posture: organizational memory preservation, succession-aware handoff,
 * stewardship of representational records, and procedural continuity across mandates.
 */
import type { Metadata } from 'next';
/**
 * Locale-aware For Members page.
 */
export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import LocaleRolePageContent from '../locale-role-page-content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.rolePages.members' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: buildLocaleAlternates(locale, '/for-members'),
  };
}

export default async function LocaleForMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LocaleRolePageContent role="members" locale={locale} />;
}
