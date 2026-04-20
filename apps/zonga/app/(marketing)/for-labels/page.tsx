/**
 * For Labels — Dedicated landing page for labels and distributors.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'Zonga for Labels & Creators',
  description: 'Diaspora-first distribution, transparent analytics, and event monetization for founding label partners and creators.',
};

const sections = [
  {
    title: 'Why Zonga',
    description: 'A premium African and diaspora music platform built for reliable playback, transparent governance, and label-grade operations.',
    icon: '👥',
  },
  {
    title: 'Diaspora Reach',
    description: 'Regional discovery surfaces and market visibility across Canada, Europe, and pan-African audiences.',
    icon: '📊',
  },
  {
    title: 'Better Artist Spotlight',
    description: 'Artist story surfaces, curated playlist placement, and event tie-ins that convert discovery into loyal listening.',
    icon: '📋',
  },
  {
    title: 'Transparent Analytics',
    description: 'Executive-readable dashboards with streams, listeners, markets, source traffic, and completion metrics.',
    icon: '⚡',
  },
  {
    title: 'Event Monetization Opportunities',
    description: 'Track event-driven campaigns, connect releases to live moments, and capture conversion impact.',
    icon: '🚀',
  },
  {
    title: 'Founding Partner Benefits',
    description: 'White-glove onboarding, pilot governance reviews, and direct co-building access for launch partners.',
    icon: '💡',
  },
];

const painPoints = [
  { before: 'Manual royalty calculations in spreadsheets', after: 'Automated splits — set once, pay forever' },
  { before: '90-day payout delays from major distributors', after: 'Instant payouts via local payment rails' },
  { before: 'Opaque revenue reporting', after: 'Real-time, auditable revenue dashboards' },
  { before: 'Per-release distribution fees', after: 'Flat monthly fee — unlimited releases' },
  { before: 'No visibility into regional performance', after: 'Geography, demographic, and trend analytics' },
];

export default function ForLabelsPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
                Zonga for Labels & Creators
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                Zonga for Labels & Creators<br />
                <span className="gradient-text">Pilot With Confidence</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                Founding-partner grade launch surface for diaspora reach, transparent analytics,
                and event monetization.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact?intent=founding-partner"
                  className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  Apply Now
                </Link>
                <Link
                  href="/ms-celebrations"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
                >
                  View Founding Partner Preview
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative rounded-2xl overflow-hidden aspect-4/3">
                <Image
                  src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800"
                  alt="Music studio control room — representing label operations on Zonga"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-linear-to-t from-navy/60 to-transparent" />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                The Old Way vs. <span className="text-electric">The Zonga Way</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-6">
            {painPoints.map((p, i) => (
              <ScrollReveal key={p.before} delay={i * 0.08}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl p-5 bg-red-50 border border-red-100">
                    <div className="flex items-start gap-3">
                      <span className="text-red-400 text-lg mt-0.5">✗</span>
                      <p className="text-gray-700">{p.before}</p>
                    </div>
                  </div>
                  <div className="rounded-xl p-5 bg-emerald-50 border border-emerald-100">
                    <div className="flex items-start gap-3">
                      <span className="text-emerald-500 text-lg mt-0.5">✓</span>
                      <p className="text-gray-700">{p.after}</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="community-playlists" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                What Founding Partners Get
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                The exact layers label teams ask for before green-lighting pilot launch.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sections.map((c, i) => (
              <ScrollReveal key={c.title} delay={i * 0.1}>
                <div className="glass-card-light rounded-2xl p-8 hover-lift h-full">
                  <div className="text-4xl mb-4">{c.icon}</div>
                  <h3 className="text-xl font-bold text-navy mb-3">{c.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{c.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Become a Founding Partner?
            </h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              Apply now for the MS Celebrations-ready launch program with white-glove onboarding.
            </p>
            <Link
              href="/contact?intent=apply-now"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              Apply Now
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
