/**
 * Trust & Compliance page.
 * Accessible at /{locale}/trust — fully translated.
 *
 * Demonstrates governance-first platform design: audit trails,
 * RBAC, Canadian data sovereignty, financial reconciliation,
 * entitlement controls, and defensibility.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ShieldCheck,
  Lock,
  MapPin,
  DollarSign,
  ToggleRight,
  Scale,
  ArrowRight,
} from 'lucide-react';
import { StatusPage } from '@/components/monitoring/StatusPage';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.trust' });
  return { title: t('pageTitle'), description: t('heroDescription') };
}

const pillars = [
  { icon: ShieldCheck, key: 'audit' },
  { icon: Lock, key: 'rbac' },
  { icon: MapPin, key: 'data' },
  { icon: DollarSign, key: 'recon' },
  { icon: ToggleRight, key: 'entitlement' },
  { icon: Scale, key: 'defensibility' },
] as const;

export default async function TrustPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.trust' });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-navy/5 border border-navy/10 rounded-full text-sm text-navy font-medium mb-6">
            <ShieldCheck className="h-4 w-4" />
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

      {/* Pillars grid */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {pillars.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="p-8 rounded-xl border border-slate-200 hover:border-navy/20 hover:shadow-sm transition-all"
            >
              <Icon className="h-8 w-8 text-navy mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                {t(`${key}Title`)}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {t(`${key}Desc`)}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        {/* System Status */}
        <section id="system-status" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">System Status</h2>
          <p className="text-slate-600 mb-8">
            Real-time operational status of Union Eyes platform services.
          </p>
          <StatusPage />
        </section>

        {/* CTA */}
        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Ready to see governance in action?
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            Start a controlled pilot scoped to your organization&apos;s governance requirements.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors text-sm"
            >
              Start a Pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              View Pricing & Deployment
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
