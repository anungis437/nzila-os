/**
 * Financial Allocation & Billing module page.
 * Accessible at /{locale}/features/analytics — fully translated.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Download,
  Calendar,
  Share2,
  ArrowRight,
  DollarSign,
} from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.features.analytics' });
  return { title: t('pageTitle'), description: t('pageDescription') };
}

const featureIcons = [BarChart3, TrendingUp, DollarSign, PieChart, Share2, Calendar, Download];

export default async function LocaleAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.features.analytics' });

  const features = featureIcons.map((icon, i) => ({
    icon,
    title: t(`feat${i + 1}Title`),
    description: t(`feat${i + 1}Desc`),
  }));

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-700 font-medium mb-6">
            <BarChart3 className="h-4 w-4" />
            <span>{t('badge')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            {t('heroHeading')}
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            {t('heroDescription')}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-amber-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-amber-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <section className="mb-20 bg-amber-50 rounded-2xl border border-amber-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
            {t('useCaseHeading')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">{t('roleStewards')}</p>
              <p className="text-sm text-slate-600">{t('roleStewardsDesc')}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">{t('roleOfficers')}</p>
              <p className="text-sm text-slate-600">{t('roleOfficersDesc')}</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">{t('roleTreasurers')}</p>
              <p className="text-sm text-slate-600">{t('roleTreasurersDesc')}</p>
            </div>
          </div>
        </section>

        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            {t('ctaHeading')}
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            {t('ctaDescription')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors text-sm"
            >
              {t('ctaPrimary')} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/ai-workbench`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              {t('ctaSecondary')}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
