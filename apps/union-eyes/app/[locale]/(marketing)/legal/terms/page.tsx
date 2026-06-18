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
import type { Metadata } from 'next';
export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { FileText, Users, AlertTriangle, Scale, CreditCard } from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.legal.terms' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: buildLocaleAlternates(locale, '/legal/terms'),
  };
}

export default async function TermsOfServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.legal.terms' });
  const tLegal = await getTranslations({ locale, namespace: 'marketing.legal' });

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-8 w-8 text-violet-600" />
            <h1 className="text-4xl font-bold text-gray-900">{t('heading')}</h1>
          </div>
          <p className="text-lg text-gray-600">{tLegal('lastUpdated')}</p>
        </div>

        <div className="prose prose-lg max-w-none">
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('acceptanceTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('acceptanceDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('useTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('useDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('billingTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('billingDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('liabilityTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('liabilityDesc')}</p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900">{t('terminationTitle')}</h2>
            <p className="text-gray-700">{t('terminationDesc')}</p>
          </section>

          <section className="border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold text-gray-900">{t('contactTitle')}</h2>
            <p className="text-gray-700">
              {t('contactDesc')}{' '}
              <a href="mailto:legal@unioneyes.app" className="text-violet-600 hover:text-violet-700">
                legal@unioneyes.app
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
