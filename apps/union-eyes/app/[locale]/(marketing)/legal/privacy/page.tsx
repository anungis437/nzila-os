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
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Shield, Lock, Eye, Database, Trash2, Download } from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.legal.privacy' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: buildLocaleAlternates(locale, '/legal/privacy'),
  };
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.legal.privacy' });
  const tLegal = await getTranslations({ locale, namespace: 'marketing.legal' });

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-violet-600" />
            <h1 className="text-4xl font-bold text-gray-900">{t('heading')}</h1>
          </div>
          <p className="text-lg text-gray-600">{tLegal('lastUpdated')}</p>
        </div>

        <div className="prose prose-lg max-w-none">
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('collectTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('collectDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('useTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('useDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('storageTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('storageDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Download className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('rightsTitle')}</h2>
            </div>
            <p className="text-gray-700">
              {t('rightsDesc')}{' '}
              <a href="mailto:privacy@unioneyes.com" className="text-violet-600 hover:text-violet-700">
                privacy@unioneyes.com
              </a>.
            </p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('retentionTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('retentionDesc')}</p>
          </section>

          <section className="border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold text-gray-900">{t('contactTitle')}</h2>
            <p className="text-gray-700">
              {t('contactDesc')}{' '}
              <a href="mailto:privacy@unioneyes.com" className="text-violet-600 hover:text-violet-700">
                privacy@unioneyes.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
