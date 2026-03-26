/**
 * Case & Grievance Management module page.
 * Accessible at /{locale}/features/grievance-tracking — fully translated.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  FileText,
  Search,
  ShieldCheck,
  Clock,
  ArrowRight,
  Scale,
  Layers,
} from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.features.grievanceTracking' });
  return { title: t('pageTitle'), description: t('pageDescription') };
}

const featureIcons = [FileText, Layers, Search, ShieldCheck, Clock, Scale];

export default async function LocaleGrievanceTrackingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.features.grievanceTracking' });

  const features = featureIcons.map((icon, i) => ({
    icon,
    title: t(`feat${i + 1}Title`),
    description: t(`feat${i + 1}Desc`),
  }));

  const steps = [1, 2, 3, 4, 5].map((n) => ({
    step: String(n),
    label: t(`step${n}Label`),
    desc: t(`step${n}Desc`),
  }));

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-full text-sm text-violet-700 font-medium mb-6">
            <FileText className="h-4 w-4" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-violet-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            {t('howItWorksHeading')}
          </h2>
          <div className="flex flex-col md:flex-row items-start gap-4">
            {steps.map((item, i) => (
              <div key={item.step} className="flex-1 text-center">
                <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h4 className="font-semibold text-slate-900 mb-1">{item.label}</h4>
                <p className="text-sm text-slate-500">{item.desc}</p>
                {i < 4 && (
                  <ArrowRight className="h-4 w-4 text-slate-300 mx-auto mt-3 hidden md:block" />
                )}
              </div>
            ))}
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors text-sm"
            >
              {t('ctaPrimary')} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/story`}
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
