'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import ScrollReveal from '@/components/public/scroll-reveal';
import { PartnershipAttribution, TrustStrip } from '@/components/branding';
import type { BrandAsset } from '@/lib/branding/types';
import type { BrandingFeatureFlags } from '@/lib/branding/types';

const featureIcons = ['🎧', '📋', '🎪', '💰', '⚡', '🎵'];

const regionFlags = ['🇳🇬', '🇰🇪', '🇿🇦', '🇨🇩', '🇲🇦', '🌍'];

const stakeholderKeys = ['listeners', 'artists', 'labels', 'events'] as const;
const stakeholderIcons = ['🎧', '🎤', '🏢', '🎪'];
const stakeholderHrefs = ['/artists', '/sign-up', '/for-labels', '/events'];

interface MarketingPageContentProps {
  flags: BrandingFeatureFlags;
  client: BrandAsset;
  partner: BrandAsset;
}

export default function MarketingPageContent({ flags, client, partner }: MarketingPageContentProps) {
  const t = useTranslations('marketing');

  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden -mt-16 md:-mt-20">
        <Image
          src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920"
          alt="African musician performing live — representing the creative spirit Zonga empowers"
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
              {t('hero.badge')}
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
              {t('hero.title')}<br />
              <span className="gradient-text">{t('hero.titleAccent')}</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              {t('hero.description')}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/artists"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                {t('hero.ctaListen')}
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
              >
                {t('hero.ctaDistribute')}
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
            {[
              { value: '40+', label: t('stats.genres') },
              { value: t('stats.streamingValue'), label: t('stats.streaming') },
              { value: '85%', label: t('stats.revenueShare') },
              { value: '16+', label: t('stats.currencies') },
            ].map((stat) => (
              <ScrollReveal key={stat.label}>
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                    {stat.value}
                  </div>
                  <div className="text-gray-400 font-medium text-sm tracking-wider uppercase">
                    {stat.label}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CREATOR PROOF BAR ═══════════════════════ */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold tracking-widest uppercase text-gray-400 mb-8">
            What creators achieve on Zonga
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { metric: '3.2×', label: 'Earnings vs. prior platform', sub: 'avg. first 90 days' },
              { metric: '48hr', label: 'First payout', sub: 'after first stream revenue' },
              { metric: '68%', label: 'Fan conversion uplift', sub: 'with Pro Creator tools' },
              { metric: '100%', label: 'Ticket sellout rate', sub: 'launch events on-platform' },
            ].map((item) => (
              <ScrollReveal key={item.metric}>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-3xl font-extrabold text-electric mb-1">{item.metric}</div>
                  <div className="text-sm font-semibold text-navy mb-0.5">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.sub}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ STAKEHOLDER PATHS ═══════════════════════ */}
      <section className="py-24 px-4 md:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                {t('stakeholders.badge')}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                {t('stakeholders.title')} <span className="text-electric">{t('stakeholders.titleAccent')}</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {t('stakeholders.description')}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8">
            {stakeholderKeys.map((key, i) => {
              const highlights = t.raw(`stakeholders.${key}.highlights`) as string[];
              return (
                <ScrollReveal key={key} delay={i * 0.1}>
                  <div className="glass-card-light rounded-2xl p-8 hover-lift h-full flex flex-col">
                    <div className="text-4xl mb-4">{stakeholderIcons[i]}</div>
                    <h3 className="text-2xl font-bold text-navy mb-3">
                      {t(`stakeholders.${key}.title`)}
                    </h3>
                    <p className="text-gray-600 leading-relaxed mb-6">
                      {t(`stakeholders.${key}.description`)}
                    </p>
                    <ul className="space-y-2 mb-8 flex-1">
                      {highlights.map((h: string) => (
                        <li key={h} className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-electric shrink-0" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={stakeholderHrefs[i]}
                      className="inline-flex items-center justify-center px-6 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-light transition-all text-sm btn-press"
                    >
                      {t(`stakeholders.${key}.cta`)} →
                    </Link>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PLATFORM FEATURES ═══════════════════════ */}
      <section className="py-24 px-4 md:px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                {t('features.badge')}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                {t('features.title')} <span className="text-electric">{t('features.titleAccent')}</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {t('features.description')}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featureIcons.map((icon, i) => {
              const items = t.raw('features.items') as Array<{ title: string; description: string }>;
              const feature = items[i];
              if (!feature) return null;
              return (
                <ScrollReveal key={i} delay={i * 0.1}>
                  <div className="glass-card-light rounded-2xl p-8 hover-lift">
                    <div className="text-4xl mb-4">{icon}</div>
                    <h3 className="text-xl font-bold text-navy mb-3">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ REGIONS ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                {t('regions.badge')}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                {t('regions.title')} <span className="text-electric">{t('regions.titleAccent')}</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {t('regions.description')}
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {(t.raw('regions.items') as Array<{ name: string; genres: string }>).map((region, i) => (
              <ScrollReveal key={region.name} delay={i * 0.08}>
                <div className="glass-card-light rounded-xl p-6 hover-lift text-center">
                  <div className="text-3xl mb-3">{regionFlags[i]}</div>
                  <h3 className="text-lg font-bold text-navy mb-1">{region.name}</h3>
                  <p className="text-sm text-gray-500">{region.genres}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PARTNERSHIP (flag-gated) ═══════════════════════ */}
      {flags.ENABLE_PARTNERSHIP_SECTION && (
        <section className="py-24 bg-navy-light relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-20" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-16">
                <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-4">
                  {t('partnership.badge')}
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                  {t('partnership.title')} <span className="gradient-text">{t('partnership.titleAccent')}</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                  {t('partnership.description')}
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <div className="glass-card rounded-2xl p-8 md:p-12 text-center">
                <PartnershipAttribution placement="marketing_partnership" client={client} partner={partner} variant="stacked" className="items-center" />
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* ═══════════════════════ TRUST STRIP (flag-gated) ═══════════════════════ */}
      {flags.ENABLE_CLIENT_LOGO_TRUST && (
        <section className="py-12 bg-gray-50 border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TrustStrip placement="marketing_trust" brands={[client, partner]} flags={flags} title="Trusted By" />
          </div>
        </section>
      )}

      {/* ═══════════════════════ MISSION ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                {t('mission.badge')}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                {t('mission.title')} <span className="text-electric">{t('mission.titleAccent')}</span>
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {t('mission.description')}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {(t.raw('mission.highlights') as string[]).map((item: string) => (
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
                  src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800"
                  alt="Music studio — representing the creative tools Zonga provides"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-linear-to-t from-navy/40 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 glass-card rounded-xl p-4">
                  <div className="flex items-center gap-6 text-white">
                    <div>
                      <div className="text-2xl font-bold">85%</div>
                      <div className="text-xs text-gray-300">{t('missionCard.revenueShare')}</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">{t('missionCard.instant')}</div>
                      <div className="text-xs text-gray-300">{t('missionCard.payouts')}</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">100%</div>
                      <div className="text-xs text-gray-300">{t('missionCard.ownership')}</div>
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
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              {t('cta.title')} <span className="gradient-text">{t('cta.titleAccent')}</span>
            </h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              {t('cta.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/artists"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                {t('cta.ctaListen')}
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
              >
                {t('cta.ctaDistribute')}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
