/**
 * Zonga — Marketing Landing Page
 * ───────────────────────────────
 * Premium, Nzila-quality public site celebrating African music.
 * Speaks to ALL stakeholders: artists, labels, listeners, event organizers.
 */

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';
import { PartnershipAttribution, TrustStrip } from '@/components/branding';
import { loadBrandingFlags } from '@/lib/branding/feature-flags';

export const metadata: Metadata = {
  title: 'Zonga — Music Without Borders',
  description: 'The fair-share African music platform — for artists, labels, listeners, and event organizers. Transparent royalties, instant payouts, and a vibrant music ecosystem.',
  openGraph: {
    title: 'Zonga — Music Without Borders',
    description: 'The fair-share African music platform for artists, labels, listeners, and event organizers.',
    images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'African musician performing — Zonga music platform' }],
  },
};

const stakeholderPaths = [
  {
    title: 'For Artists',
    description: 'Distribute your music, earn 85% of revenue, and own your masters — with instant payouts to mobile money, bank, or crypto.',
    icon: '🎤',
    href: '/sign-up',
    cta: 'Start Distributing',
    highlights: ['85% revenue share', 'Instant mobile money payouts', 'Own your masters'],
  },
  {
    title: 'For Labels',
    description: 'Manage rosters, automate royalty splits, and scale distribution across the continent — with full compliance and reporting.',
    icon: '🏢',
    href: '/for-labels',
    cta: 'Learn More',
    highlights: ['Multi-artist dashboard', 'Automated royalty splits', 'Compliance + reporting'],
  },
  {
    title: 'For Listeners',
    description: 'Discover the best of African music — Afrobeats, Amapiano, Highlife, Bongo, and more. Follow artists. Attend live events.',
    icon: '🎧',
    href: '/artists',
    cta: 'Explore Music',
    highlights: ['Curated playlists', 'Follow your favorites', 'Live event access'],
  },
  {
    title: 'For Event Organizers',
    description: 'Sell tickets, manage events, and connect with fans — powered by the same platform artists already trust.',
    icon: '🎪',
    href: '/events',
    cta: 'Browse Events',
    highlights: ['Ticketing built-in', 'Multi-tier pricing', 'Fan engagement tools'],
  },
];

const platformFeatures = [
  {
    title: 'Fair Revenue Split',
    description: 'Transparent royalty calculations with real-time breakdown by stream, download, licensing, sync, and more.',
    icon: '💰',
  },
  {
    title: 'Instant Payouts',
    description: 'Request payouts anytime via Orange Money, M-Pesa, MTN MoMo, Flutterwave, or bank transfer. No 90-day holds.',
    icon: '⚡',
  },
  {
    title: 'Full Creative Control',
    description: 'You own your masters. Upload, distribute, and manage your catalog with complete creative ownership.',
    icon: '🎵',
  },
  {
    title: 'Multi-Format Catalog',
    description: 'Release tracks, albums, podcasts, and music videos — all managed from a single dashboard.',
    icon: '📀',
  },
  {
    title: 'Audio Fingerprinting',
    description: 'Automated content protection with audio fingerprinting and copyright verification on every upload.',
    icon: '🔒',
  },
  {
    title: 'Audience Analytics',
    description: 'Deep listener analytics by geography, demographics, and trends. Know your audience across the continent.',
    icon: '📊',
  },
];

const regions = [
  { name: 'West Africa', genres: 'Afrobeats · Highlife · Jùjú', flag: '🇳🇬' },
  { name: 'East Africa', genres: 'Bongo Flava · Benga · Taarab', flag: '🇰🇪' },
  { name: 'Southern Africa', genres: 'Amapiano · Kwaito · Maskandi', flag: '🇿🇦' },
  { name: 'Central Africa', genres: 'Soukous · Ndombolo · Rumba', flag: '🇨🇩' },
  { name: 'North Africa', genres: 'Raï · Gnawa · Chaabi', flag: '🇲🇦' },
  { name: 'Diaspora', genres: 'Afro-House · Afro-R&B · Afrofusion', flag: '🌍' },
];

export default function HomePage() {
  const flags = loadBrandingFlags();

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
              African Music, Global Stage
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
              Music Without<br />
              <span className="gradient-text">Borders</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl">
              The platform where African artists earn fairly, labels scale effortlessly,
              fans discover authentically, and events come alive.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                Join Zonga
              </Link>
              <Link
                href="/artists"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
              >
                Explore Music
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
              { value: '50K+', label: 'Creators' },
              { value: '2M+', label: 'Tracks' },
              { value: '85%', label: 'Revenue Share' },
              { value: '<24h', label: 'Payout Speed' },
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

      {/* ═══════════════════════ STAKEHOLDER PATHS ═══════════════════════ */}
      <section className="py-24 px-4 md:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                For Everyone in Music
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                One Platform, <span className="text-electric">Every Role</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Whether you create, curate, listen, or organize — Zonga is built for you.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8">
            {stakeholderPaths.map((path, i) => (
              <ScrollReveal key={path.title} delay={i * 0.1}>
                <div className="glass-card-light rounded-2xl p-8 hover-lift h-full flex flex-col">
                  <div className="text-4xl mb-4">{path.icon}</div>
                  <h3 className="text-2xl font-bold text-navy mb-3">{path.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-6">{path.description}</p>
                  <ul className="space-y-2 mb-8 flex-1">
                    {path.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-electric shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={path.href}
                    className="inline-flex items-center justify-center px-6 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-light transition-all text-sm btn-press"
                  >
                    {path.cta} →
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PLATFORM FEATURES ═══════════════════════ */}
      <section className="py-24 px-4 md:px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                Platform Features
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                Built for <span className="text-electric">African Music</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Every feature designed with the realities of African music distribution, payments, and rights in mind.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {platformFeatures.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 0.1}>
                <div className="glass-card-light rounded-2xl p-8 hover-lift">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-navy mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ REGIONS ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                Continental Coverage
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                Every Sound, <span className="text-electric">Every Region</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                From Lagos to Nairobi, Johannesburg to Dakar — Zonga amplifies the full spectrum of African music.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {regions.map((region, i) => (
              <ScrollReveal key={region.name} delay={i * 0.08}>
                <div className="glass-card-light rounded-xl p-6 hover-lift text-center">
                  <div className="text-3xl mb-3">{region.flag}</div>
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
                  Partnership
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                  Built With <span className="gradient-text">Partners Who Care</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                  Zonga partners with organizations that share our commitment to fair music — from distribution to community impact.
                </p>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <div className="glass-card rounded-2xl p-8 md:p-12 text-center">
                <PartnershipAttribution placement="marketing_partnership" variant="stacked" className="items-center" />
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* ═══════════════════════ TRUST STRIP (flag-gated) ═══════════════════════ */}
      {flags.ENABLE_CLIENT_LOGO_TRUST && (
        <section className="py-12 bg-gray-50 border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <TrustStrip placement="marketing_trust" brands={[]} flags={flags} title="Trusted By" />
          </div>
        </section>
      )}

      {/* ═══════════════════════ MISSION ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                Our Mission
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                Music That <span className="text-electric">Empowers</span>
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Zonga was born from a simple belief: African creators deserve the
                same tools, transparency, and revenue share as artists anywhere in
                the world. But we go further — building for labels that need scale,
                listeners who crave authenticity, and organizers who bring music to life.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {['85% Revenue Share', 'No Hidden Fees', 'Own Your Masters', 'Pan-African Reach'].map((item) => (
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
                      <div className="text-xs text-gray-300">Revenue Share</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">Instant</div>
                      <div className="text-xs text-gray-300">Payouts</div>
                    </div>
                    <div className="w-px h-10 bg-white/20" />
                    <div>
                      <div className="text-2xl font-bold">100%</div>
                      <div className="text-xs text-gray-300">Ownership</div>
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
              Ready to Join the <span className="gradient-text">Movement?</span>
            </h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              Artists, labels, listeners, and event organizers — Zonga is where
              African music thrives. Join thousands who already call it home.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                Get Started Free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
              >
                View Pricing
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
