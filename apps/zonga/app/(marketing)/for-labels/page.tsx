/**
 * For Labels — Dedicated landing page for labels and distributors.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'For Labels — Zonga',
  description: 'Manage your roster, automate royalty splits, and distribute African music at scale — with Zonga for Labels.',
};

const capabilities = [
  {
    title: 'Roster Management',
    description: 'Onboard artists, manage contracts, and oversee catalogs from a single dashboard. Invite artists to join your label on Zonga with one click.',
    icon: '👥',
  },
  {
    title: 'Automated Royalty Splits',
    description: 'Define split agreements per release, per track, or per artist. Zonga calculates and distributes royalties automatically — no spreadsheets required.',
    icon: '📊',
  },
  {
    title: 'Compliance & Reporting',
    description: 'Export-ready financial reports, tax documentation, and audit trails. Stay compliant across jurisdictions without the overhead.',
    icon: '📋',
  },
  {
    title: 'Bulk Operations',
    description: 'Upload entire catalogs, schedule releases across your roster, and manage metadata in bulk. Built for labels that move fast.',
    icon: '⚡',
  },
  {
    title: 'Priority Review',
    description: 'Skip the queue. Label releases get priority content review and audio fingerprinting, so your music goes live faster.',
    icon: '🚀',
  },
  {
    title: 'Revenue Intelligence',
    description: 'Cross-artist analytics, regional performance comparisons, and revenue forecasting. Make data-driven decisions for your roster.',
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
                For Labels & Distributors
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                Scale Your Roster<br />
                <span className="gradient-text">Without the Friction</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                Manage artists, automate royalties, and distribute African music
                at continental scale — with the transparency your artists deserve.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
                >
                  Talk to Sales
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
                >
                  View Pricing
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
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                Label-Grade <span className="text-electric">Tools</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Everything your operations team needs — nothing they don&apos;t.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {capabilities.map((c, i) => (
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
              Ready to <span className="gradient-text">Scale?</span>
            </h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              Let&apos;s talk about how Zonga can power your label&apos;s distribution,
              royalties, and analytics across the continent.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              Contact Our Label Team
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
