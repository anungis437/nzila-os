/**
 * Union Eyes — Marketing Landing Page
 * ────────────────────────────────────
 * Premium, Nzila-quality public site with scroll-triggered reveals,
 * rich imagery, animated stats, and consistent section patterns.
 */

export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';
import AnimatedFeatures from './components/animated-features';
import AnimatedCTA from './components/animated-cta';

export const metadata: Metadata = {
  title: 'Union Eyes — AI-Powered Union Management',
  description: 'Grievance management, claims processing, member engagement, and operational excellence — built with unions, not for unions. Powered by Nzila.',
  openGraph: {
    title: 'Union Eyes — AI-Powered Union Management',
    description: 'AI-powered grievance management, member engagement, and operational tools — co-designed with Canadian unions. Now piloting with CUPE, CAPE, and more.',
    images: [{ url: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Workers in a professional labor meeting — Union Eyes platform' }],
  },
};

const pilotPartners = [
  'CUPE',
  'CAPE',
  'PSAC',
  'UNIFOR',
  'USW',
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden -mt-16 md:-mt-20">
        <Image
          src="https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920"
          alt="Workers gathered in a professional labor meeting — representing the solidarity Union Eyes supports"
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
              Built with Unions, Not for Unions
            </span>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
              Your union.<br />
              <span className="gradient-text">Under control.</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <p className="text-xl md:text-2xl text-white mb-10 max-w-3xl">
              AI-powered grievance management, claims processing, and member
              engagement — co-designed with Canadian unions, now entering pilot.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/pilot-request"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                Request a Pilot
              </Link>
              <Link
                href="/story"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/15 backdrop-blur text-white font-bold rounded-xl border border-white/30 hover:bg-white/25 transition-all text-lg btn-press"
              >
                Our Story
              </Link>
            </div>
          </ScrollReveal>
        </div>

        {/* Scroll indicator */}
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
              { value: '35+', label: 'Organizational Roles' },
              { value: '2', label: 'Languages' },
              { value: 'PIPEDA', label: 'Compliant' },
              { value: '5', label: 'Pilot Partners' },
            ].map((stat) => (
              <ScrollReveal key={stat.label}>
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                    {stat.value}
                  </div>
                  <div className="text-white font-medium text-sm tracking-wider uppercase">
                    {stat.label}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURES ═══════════════════════ */}
      <section className="py-24 px-4 md:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <AnimatedFeatures />
        </div>
      </section>

      {/* ═══════════════════════ MISSION ═══════════════════════ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                Our Mission
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                Technology That Serves <span className="text-electric">Workers First</span>
              </h2>
              <p className="text-lg text-gray-800 mb-6 leading-relaxed">
                Union Eyes was born when a healthcare steward lost a winnable
                grievance because her notes were trapped in a spreadsheet. The employer
                had a million-dollar HR system. She had a notebook. We&apos;re building this
                platform to level the playing field — and we&apos;re piloting it now with
                unions like CUPE and CAPE to get it right.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {['Human-Centered', 'No Surveillance', 'Democratic Governance', 'Worker Owned Data'].map((item) => (
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
                  alt="Diverse team collaborating around laptops — representing the people behind Union Eyes"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-linear-to-t from-navy/40 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 glass-card rounded-xl p-4">
                  <div className="flex items-center gap-6 text-white">
                    <div>
                      <div className="text-2xl font-bold">35+</div>
                      <div className="text-xs text-gray-100">Union Roles</div>
                    </div>
                    <div className="w-px h-10 bg-white/30" />
                    <div>
                      <div className="text-2xl font-bold">2</div>
                      <div className="text-xs text-gray-100">Languages</div>
                    </div>
                    <div className="w-px h-10 bg-white/30" />
                    <div>
                      <div className="text-2xl font-bold">PIPEDA</div>
                      <div className="text-xs text-gray-100">Compliant</div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PILOT PARTNERS ═══════════════════════ */}
      <section className="py-24 px-4 md:px-6 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
              Pilot Program
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
              Trusted by Leading Canadian Unions
            </h2>
            <p className="text-lg text-gray-800 mb-12 max-w-2xl mx-auto">
              We&apos;re working directly with union leadership to shape Union Eyes
              through real-world pilots before general availability.
            </p>
          </ScrollReveal>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {pilotPartners.map((name) => (
              <ScrollReveal key={name}>
                <div className="px-8 py-4 rounded-xl border border-gray-200 bg-gray-50 text-navy font-bold text-xl tracking-wide">
                  {name}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA ═══════════════════════ */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedCTA />
        </div>
      </section>
    </main>
  );
}