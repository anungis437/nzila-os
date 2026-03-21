/**
 * About — Zonga's story, mission, and the team behind the platform.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'About Zonga — Our Story',
  description: 'Zonga is the fair-share music platform built for African artists, labels, listeners, and event organizers. Learn about our mission and values.',
};

const values = [
  {
    title: 'Fairness First',
    description: 'Every creator gets 85% of their revenue. No hidden fees, no black-box deductions, no surprises.',
    icon: '⚖️',
  },
  {
    title: 'Pan-African Reach',
    description: 'Built for the continent — with local payment rails, regional genre support, and multilingual access.',
    icon: '🌍',
  },
  {
    title: 'Creator Ownership',
    description: 'Artists own their masters, control their catalog, and make every decision about their music.',
    icon: '🎵',
  },
  {
    title: 'Transparent Operations',
    description: 'Every royalty, every split, every payout is auditable. Trust through transparency, not promises.',
    icon: '🔍',
  },
  {
    title: 'Inclusive Ecosystem',
    description: 'Labels, listeners, and event organizers all benefit. Music is a community, not just a product.',
    icon: '🤝',
  },
  {
    title: 'Innovation with Integrity',
    description: 'Audio fingerprinting, content protection, and analytics — technology in service of creators, not against them.',
    icon: '🛡️',
  },
];

const milestones = [
  { year: '2024', event: 'Zonga concept born — a fair-share platform for African music' },
  { year: '2025', event: 'Core platform built — catalog, payouts, royalty engine, events' },
  { year: '2026', event: 'Delta upgrade — economics, rights, moderation, integrity layers launch' },
  { year: 'Next', event: 'Pan-African expansion — 20+ payment rails, live streaming, sync licensing' },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              About Zonga
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              The Sound of <span className="gradient-text">Fair Play</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              We believe African music deserves a platform built with the same care,
              transparency, and respect as the music itself.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 bg-white" id="story">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">
                Why We Built Zonga
              </h2>
              <div className="space-y-4 text-lg text-gray-600 leading-relaxed">
                <p>
                  African music is a global force — Afrobeats, Amapiano, Highlife, and
                  Bongo Flava top charts worldwide. But too many creators still lose 70%
                  or more of their revenue to opaque intermediaries.
                </p>
                <p>
                  Zonga was built to change that equation. We give artists 85% of revenue,
                  instant payouts via local mobile money and bank rails, and full ownership
                  of their masters — because they earned it.
                </p>
                <p>
                  But artists are just the beginning. We built Zonga for everyone in the
                  music ecosystem: labels who need scale, listeners who crave discovery,
                  and event organizers who bring music to life.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="relative rounded-2xl overflow-hidden aspect-4/3">
                <Image
                  src="https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800"
                  alt="African music culture — the vibrant community Zonga serves"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                Our <span className="text-electric">Values</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Six principles that guide every decision we make.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((v, i) => (
              <ScrollReveal key={v.title} delay={i * 0.1}>
                <div className="glass-card-light rounded-2xl p-8 hover-lift h-full">
                  <div className="text-4xl mb-4">{v.icon}</div>
                  <h3 className="text-xl font-bold text-navy mb-3">{v.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{v.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                Our <span className="text-electric">Journey</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-8">
            {milestones.map((m, i) => (
              <ScrollReveal key={m.year} delay={i * 0.1}>
                <div className="flex gap-6 items-start">
                  <div className="shrink-0 w-16 text-right">
                    <span className="text-lg font-bold text-electric">{m.year}</span>
                  </div>
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-electric mt-2" />
                    {i < milestones.length - 1 && (
                      <div className="absolute top-5 left-1.5 w-px h-12 bg-gray-200" />
                    )}
                  </div>
                  <p className="text-gray-700 text-lg pt-0.5">{m.event}</p>
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
              Be Part of the <span className="gradient-text">Story</span>
            </h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              Whether you&apos;re an artist, a label, a listener, or an organizer — Zonga
              is your home.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                Join Zonga
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 text-white font-bold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-lg btn-press"
              >
                Get in Touch
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
