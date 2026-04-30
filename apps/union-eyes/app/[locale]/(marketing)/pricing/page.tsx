/**
 * Locale-aware Pricing page
 * Accessible at /{locale}/pricing
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';
import { Check } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.pricing' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function LocalePricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.pricingBody' });
  const _tp = await getTranslations({ locale, namespace: 'marketing.pricing' });

  const modules = ['Inbox', 'Priorities', 'Work', 'Intelligence', 'Outcomes'];

  const included = [
    t('included1'), t('included2'), t('included3'), t('included4'),
    t('included5'), t('included6'), t('included7'), t('included8'),
  ];

  return (
    <div className="container mx-auto py-16 max-w-5xl px-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="text-center space-y-4 mb-16">
        <ScrollReveal>
          <h1 className="text-5xl font-bold text-navy">{t('heading')}</h1>
          <p className="text-xl text-muted-foreground mt-4 max-w-3xl mx-auto">
            {t('subtitle')}
          </p>
        </ScrollReveal>
      </div>

      {/* ── Contract model ─────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <ScrollReveal>
          <div className="bg-gray-50 rounded-2xl p-8 h-full">
            <h2 className="text-2xl font-bold text-navy mb-4">{t('contractHeading')}</h2>
            <p className="text-gray-700 leading-relaxed">{t('contractDesc')}</p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div className="bg-gray-50 rounded-2xl p-8 h-full">
            <h2 className="text-2xl font-bold text-navy mb-4">{t('parentBillingHeading')}</h2>
            <p className="text-gray-700 leading-relaxed">{t('parentBillingDesc')}</p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.2}>
          <div className="bg-gray-50 rounded-2xl p-8 h-full">
            <h2 className="text-2xl font-bold text-navy mb-4">{t('allocationHeading')}</h2>
            <p className="text-gray-700 leading-relaxed">{t('allocationDesc')}</p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.3}>
          <div className="bg-gray-50 rounded-2xl p-8 h-full">
            <h2 className="text-2xl font-bold text-navy mb-4">{t('modulePricingHeading')}</h2>
            <p className="text-gray-700 leading-relaxed">{t('modulePricingDesc')}</p>
          </div>
        </ScrollReveal>
      </div>

      {/* ── Module list ────────────────────────────────────────── */}
      <ScrollReveal>
        <div className="bg-navy rounded-2xl p-8 mb-16">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">{t('modulePricingHeading')}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <div key={mod} className="flex items-center gap-3 text-white">
                <Check className="h-5 w-5 text-green-400 shrink-0" />
                <span className="text-sm font-medium">{mod}</span>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* ── Included in every contract ─────────────────────────── */}
      <ScrollReveal>
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-navy mb-8 text-center">{t('includedHeading')}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {included.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <Check className="h-5 w-5 text-electric shrink-0" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <ScrollReveal>
        <div className="text-center bg-gray-50 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-navy mb-4">{t('ctaHeading')}</h2>
          <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">{t('ctaDescription')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30"
            >
              {t('ctaPrimary')}
            </Link>
            <Link
              href={`/${locale}/story`}
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-navy font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-lg"
            >
              {t('ctaSecondary')}
            </Link>
          </div>
        </div>
      </ScrollReveal>

      {/* ── Trust strip ────────────────────────────────────────── */}
      <div className="mt-12 text-center text-sm text-muted-foreground space-y-2">
        <p>{t('trustLine1')}</p>
        <p>{t('trustLine2')}</p>
      </div>
    </div>
  );
}
