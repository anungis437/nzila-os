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
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Shield, Lock, Eye, Server, Key, Bug, Mail } from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.legal.security' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: buildLocaleAlternates(locale, '/legal/security'),
  };
}

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.legal.security' });
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
          <p className="text-gray-700 mt-4 leading-relaxed">{t('intro')}</p>
        </div>

        <div className="prose prose-lg max-w-none">
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('encryptionTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('encryptionDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('accessControlTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('accessControlDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('infrastructureTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('infrastructureDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('monitoringTitle')}</h2>
            </div>
            <p className="text-gray-700">{t('monitoringDesc')}</p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Bug className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('vulnTitle')}</h2>
            </div>
            <p className="text-gray-700">
              {t('vulnDesc')}{' '}
              <a href="mailto:security@nzila.app" className="text-violet-600 hover:text-violet-800 font-medium">
                security@nzila.app
              </a>
              {t('vulnAck')}
            </p>
          </section>

          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('complianceTitle')}</h2>
            </div>
            <p className="text-gray-700">
              {t('complianceDesc')}{' '}
              <Link href={`/${locale}/legal/privacy`} className="text-violet-600 hover:text-violet-800 font-medium">
                {t('privacyPolicyLink')}
              </Link>.
            </p>
          </section>

          <section className="mb-12 bg-slate-50 border border-slate-200 rounded-xl p-8">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-violet-600" />
              <h2 className="text-2xl font-semibold text-gray-900 mt-0!">{t('questionsTitle')}</h2>
            </div>
            <p className="text-gray-700 mb-4">
              {t('questionsDesc')}{' '}
              <a href="mailto:security@nzila.app" className="text-violet-600 hover:text-violet-800 font-medium">
                security@nzila.app
              </a>{' '}
              <Link href={`/${locale}/contact`} className="text-violet-600 hover:text-violet-800 font-medium">
                {t('contactPageLink')}
              </Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
