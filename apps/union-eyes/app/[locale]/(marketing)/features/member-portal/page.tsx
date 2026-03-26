/**
 * Member Portal & Engagement module page.
 * Accessible at /{locale}/features/member-portal — fully translated.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Users,
  UserPlus,
  CreditCard,
  FileUp,
  MessageSquare,
  BarChart3,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.features.memberPortal' });
  return { title: t('pageTitle'), description: t('pageDescription') };
}

const featureIcons = [Users, UserPlus, FolderOpen, CreditCard, FileUp, MessageSquare, BarChart3];

export default async function LocaleMemberPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.features.memberPortal' });

  const features = featureIcons.map((icon, i) => ({
    icon,
    title: t(`feat${i + 1}Title`),
    description: t(`feat${i + 1}Desc`),
  }));

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 font-medium mb-6">
            <Users className="h-4 w-4" />
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
              className="p-6 rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <section className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-blue-50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              {t('forMembers')}
            </h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>• {t('member1')}</li>
              <li>• {t('member2')}</li>
              <li>• {t('member3')}</li>
              <li>• {t('member4')}</li>
            </ul>
          </div>
          <div className="bg-violet-50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              {t('forStewards')}
            </h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>• {t('steward1')}</li>
              <li>• {t('steward2')}</li>
              <li>• {t('steward3')}</li>
              <li>• {t('steward4')}</li>
            </ul>
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
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
