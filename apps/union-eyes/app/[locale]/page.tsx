/**
 * Locale-prefixed root page
 *
 * - Authenticated users → redirect to /{locale}/dashboard
 * - Unauthenticated users → render locale-aware marketing home
 *   (includes LocaleSiteNavigation + hero + CTA + LocaleSiteFooter)
 */

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
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
    title: 'Union Eyes — AI-Powered Union Management',
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

  // Authenticated users go straight to their dashboard
  if (userId) {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations({ locale, namespace: 'marketing.home' });

  const stats = [
    { value: '4,773', label: t('statsLabel.unionEntities') },
    { value: '56%',   label: t('statsLabel.timeSaved') },
    { value: '40%',   label: t('statsLabel.fasterResponses') },
    { value: '99.9%', label: t('statsLabel.platformUptime') },
  ];

  const values = [t('value1'), t('value2'), t('value3'), t('value4')];

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
          <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
          <div className="absolute inset-0 bg-mesh opacity-60" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <ScrollReveal>
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
                {t('badge')}
              </span>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
                {t('heroHeading').split(' ').slice(0, -2).join(' ')}<br />
                <span className="gradient-text">{t('heroHeading').split(' ').slice(-2).join(' ')}</span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
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
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
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
                    <div className="text-gray-400 font-medium text-sm tracking-wider uppercase">{stat.label}</div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ MISSION ═══════════════════════ */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <ScrollReveal direction="left">
                <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                  {t('missionBadge')}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                  {t('missionHeading')}
                </h2>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  {t('missionDescription')}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {values.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-electric" />
                      <span className="text-sm font-medium text-gray-700">{item}</span>
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
                        <div className="text-xs text-gray-300">{t('unionRoles')}</div>
                      </div>
                      <div className="w-px h-10 bg-white/20" />
                      <div>
                        <div className="text-2xl font-bold">4</div>
                        <div className="text-xs text-gray-300">{t('languages')}</div>
                      </div>
                      <div className="w-px h-10 bg-white/20" />
                      <div>
                        <div className="text-2xl font-bold">PIPEDA</div>
                        <div className="text-xs text-gray-300">{t('certLabel')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ CTA ═══════════════════════ */}
        <section className="py-24 bg-navy relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-30" />
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">{t('badge')}</h2>
              <p className="text-xl text-gray-300 mb-10">{t('heroDescription')}</p>
              <Link
                href={`/${locale}/pilot-request`}
                className="inline-flex items-center justify-center px-10 py-5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                {t('ctaPrimary')}
              </Link>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <LocaleSiteFooter />
    </>
  );
}


