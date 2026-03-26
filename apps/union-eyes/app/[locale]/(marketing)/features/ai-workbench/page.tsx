/**
 * Intelligence & Insights module page.
 * Accessible at /{locale}/features/ai-workbench — fully translated.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Brain,
  Search,
  FileText,
  ShieldCheck,
  ToggleRight,
  Eye,
  ArrowRight,
  Scale,
} from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.features.aiWorkbench' });
  return { title: t('pageTitle'), description: t('pageDescription') };
}

const capIcons = [Scale, Search, FileText, Brain, Eye];
const safeIcons = [ToggleRight, ShieldCheck, Scale];

export default async function LocaleAIWorkbenchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.features.aiWorkbench' });

  const capabilities = capIcons.map((icon, i) => ({
    icon,
    title: t(`cap${i + 1}Title`),
    description: t(`cap${i + 1}Desc`),
  }));

  const safeguards = safeIcons.map((icon, i) => ({
    icon,
    title: t(`safe${i + 1}Title`),
    description: t(`safe${i + 1}Desc`),
  }));

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm text-emerald-700 font-medium mb-6">
            <Brain className="h-4 w-4" />
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
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            {t('capabilitiesHeading')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="p-6 rounded-xl border border-slate-200 hover:border-emerald-200 hover:shadow-sm transition-all"
              >
                <cap.icon className="h-8 w-8 text-emerald-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {cap.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20 bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
            {t('safeguardsHeading')}
          </h2>
          <p className="text-slate-600 text-center mb-8 max-w-2xl mx-auto">
            {t('safeguardsDescription')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {safeguards.map((s) => (
              <div key={s.title} className="text-center">
                <s.icon className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
                <h4 className="font-semibold text-slate-900 mb-1">{s.title}</h4>
                <p className="text-sm text-slate-500">{s.description}</p>
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors text-sm"
            >
              {t('ctaPrimary')} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/grievance-tracking`}
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
