/**
 * Locale-prefixed root page
 *
 * - Authenticated users → redirect to /{locale}/dashboard
 * - Unauthenticated users → render locale-aware marketing home
 *   (includes LocaleSiteNavigation + hero + sections + LocaleSiteFooter)
 */

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@nzila/platform-auth/entra/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import ScrollReveal from '@/components/public/scroll-reveal';
import LocaleSiteNavigation from './(marketing)/locale-site-navigation';
import LocaleSiteFooter from './(marketing)/locale-site-footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.home' });
  return {
    title: 'Union Eyes — A Governed Operating System for Unions',
    description: t('heroDescription'),
  };
}

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { userId } = await auth();

  if (userId) {
    redirect(`/${locale}/dashboard/priorities`);
  }

  const t = await getTranslations({ locale, namespace: 'marketing.home' });

  const stats = [
    { value: '5',      label: t('statsLabel.unionEntities') },
    { value: '2',      label: t('statsLabel.timeSaved') },
    { value: 'PIPEDA', label: t('statsLabel.fasterResponses') },
    { value: '5+',     label: t('statsLabel.platformUptime') },
  ];

  const pillars = [t('pillar1'), t('pillar2'), t('pillar3'), t('pillar4')];

  const steps = [
    { label: t('step1Label'), desc: t('step1Desc') },
    { label: t('step2Label'), desc: t('step2Desc') },
    { label: t('step3Label'), desc: t('step3Desc') },
    { label: t('step4Label'), desc: t('step4Desc') },
    { label: t('step5Label'), desc: t('step5Desc') },
  ];

  const govItems = [
    { title: t('gov1Title'), desc: t('gov1Desc') },
    { title: t('gov2Title'), desc: t('gov2Desc') },
    { title: t('gov3Title'), desc: t('gov3Desc') },
    { title: t('gov4Title'), desc: t('gov4Desc') },
  ];

  const modules = [
    { name: t('module1'), desc: t('module1Desc') },
    { name: t('module2'), desc: t('module2Desc') },
    { name: t('module3'), desc: t('module3Desc') },
    { name: t('module4'), desc: t('module4Desc') },
    { name: t('module5'), desc: t('module5Desc') },
  ];

  return (
    <>
      <LocaleSiteNavigation />

      <main className="min-h-screen pt-16 md:pt-20">
        {/* ═══════════════════════ HERO ═══════════════════════ */}
        <section className="relative min-h-[85vh] flex items-center overflow-hidden -mt-16 md:-mt-20">
          <Image
            src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920"
            alt="Workers gathered in a professional labor meeting"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-linear-to-b from-navy/90 via-navy/85 to-navy/95" />
          <div className="absolute inset-0 bg-mesh opacity-60" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <ScrollReveal>
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white mb-6">
                {t('badge')}
              </span>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
                {t('heroHeading')}
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="text-xl md:text-2xl text-white mb-10 max-w-3xl">
                {t('heroDescription')}
              </p>
            </ScrollReveal>

            <ScrollReveal delay={0.3}>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/${locale}/pilot-request`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  {t('ctaPrimary')}
                </Link>
                <Link
                  href={`/${locale}/story`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
                >
                  {t('ctaSecondary')}
                </Link>
              </div>
            </ScrollReveal>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
            <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-1.5">
              <div className="w-1.5 h-3 rounded-full bg-white/60 animate-bounce" />
            </div>
          </div>
        </section>

        {/* ═══════════════════════ STATS BAR ═══════════════════════ */}
        <section className="relative bg-navy-light py-16 overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-40" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <ScrollReveal key={stat.label}>
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold text-white mb-2">{stat.value}</div>
                    <div className="text-white font-medium text-sm tracking-wider uppercase">{stat.label}</div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ PROBLEM ═══════════════════════ */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <ScrollReveal>
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-red-100 text-red-700 mb-4">
                {t('problemBadge')}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                {t('problemHeading')}
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                {t('problemDescription')}
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════════════ SOLUTION ═══════════════════════ */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center mb-16">
              <ScrollReveal>
                <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                  {t('solutionBadge')}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                  {t('solutionHeading')}
                </h2>
                <p className="text-lg text-gray-700 leading-relaxed">
                  {t('solutionDescription')}
                </p>
              </ScrollReveal>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {pillars.map((pillar) => (
                <ScrollReveal key={pillar}>
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-2 h-2 rounded-full bg-electric" />
                    <span className="text-sm font-semibold text-navy">{pillar}</span>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ HOW IT WORKS ═══════════════════════ */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <ScrollReveal>
                <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                  {t('howItWorksBadge')}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-navy">
                  {t('howItWorksHeading')}
                </h2>
              </ScrollReveal>
            </div>
            <div className="grid md:grid-cols-5 gap-8">
              {steps.map((step, i) => (
                <ScrollReveal key={step.label} delay={i * 0.1}>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-electric text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                      {i + 1}
                    </div>
                    <h3 className="font-bold text-navy text-lg mb-2">{step.label}</h3>
                    <p className="text-sm text-gray-600">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ GOVERNANCE ═══════════════════════ */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <ScrollReveal>
                <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                  {t('governanceBadge')}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                  {t('governanceHeading')}
                </h2>
                <p className="text-lg text-gray-700 max-w-3xl mx-auto">
                  {t('governanceDescription')}
                </p>
              </ScrollReveal>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {govItems.map((item) => (
                <ScrollReveal key={item.title}>
                  <div className="bg-gray-50 rounded-2xl p-6 h-full">
                    <h3 className="font-bold text-navy text-lg mb-3">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ MODULES ═══════════════════════ */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <ScrollReveal>
                <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                  {t('modulesBadge')}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                  {t('modulesHeading')}
                </h2>
                <p className="text-lg text-gray-700 max-w-3xl mx-auto">
                  {t('modulesDescription')}
                </p>
              </ScrollReveal>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {modules.map((mod) => (
                <ScrollReveal key={mod.name}>
                  <div className="bg-white rounded-2xl p-6 h-full border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-navy text-lg mb-3">{mod.name}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{mod.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ MISSION ═══════════════════════ */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <ScrollReveal direction="left">
                <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                  {t('missionBadge')}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                  {t('missionHeading')}
                </h2>
                <p className="text-lg text-gray-800 mb-6 leading-relaxed">
                  {t('missionDescription')}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[t('value1'), t('value2'), t('value3'), t('value4')].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-electric" />
                      <span className="text-sm font-medium text-gray-800">{item}</span>
                    </div>
                  ))}
                </div>
              </ScrollReveal>

              <ScrollReveal direction="right">
                <div className="relative rounded-2xl overflow-hidden aspect-4/3">
                  <Image
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800"
                    alt="Diverse team collaborating"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-navy/40 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 glass-card rounded-xl p-4">
                    <div className="flex items-center gap-6 text-white">
                      <div>
                        <div className="text-2xl font-bold">35+</div>
                        <div className="text-xs text-gray-100">{t('unionRoles')}</div>
                      </div>
                      <div className="w-px h-10 bg-white/30" />
                      <div>
                        <div className="text-2xl font-bold">4</div>
                        <div className="text-xs text-gray-100">{t('languages')}</div>
                      </div>
                      <div className="w-px h-10 bg-white/30" />
                      <div>
                        <div className="text-2xl font-bold">PIPEDA</div>
                        <div className="text-xs text-gray-100">{t('certLabel')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ SOCIAL PROOF ═══════════════════════ */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <ScrollReveal>
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-green-100 text-green-700 mb-4">
                {t('socialProofBadge')}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                {t('socialProofHeading')}
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                {t('socialProofDescription')}
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* ═══════════════════════ FINAL CTA ═══════════════════════ */}
        <section className="py-24 bg-navy relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">{t('finalCtaHeading')}</h2>
              <p className="text-xl text-gray-100 mb-10">{t('finalCtaDescription')}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={`/${locale}/pilot-request`}
                  className="inline-flex items-center justify-center px-10 py-5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  {t('finalCtaPrimary')}
                </Link>
                <Link
                  href={`/${locale}/trust`}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
                >
                  {t('finalCtaSecondary')}
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <LocaleSiteFooter />
    </>
  );
}


