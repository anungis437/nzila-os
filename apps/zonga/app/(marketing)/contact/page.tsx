/**
 * Contact — Reach the Zonga team.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'Contact — Zonga',
  description: 'Get in touch with the Zonga team. Artist support, label partnerships, press inquiries, and general questions.',
};

const channels = [
  {
    title: 'Artist Support',
    description: 'Questions about your catalog, payouts, or account? Our support team is here.',
    email: 'artists@zonga.app',
    icon: '🎤',
  },
  {
    title: 'Label Partnerships',
    description: 'Interested in Zonga for your label? Let\u2019s discuss how we can work together.',
    email: 'labels@zonga.app',
    icon: '🏢',
  },
  {
    title: 'Press & Media',
    description: 'Press kit, interviews, and media inquiries about Zonga and African music.',
    email: 'press@zonga.app',
    icon: '📰',
  },
  {
    title: 'General Inquiries',
    description: 'Anything else? Partnerships, integrations, or just saying hello.',
    email: 'hello@zonga.app',
    icon: '💬',
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              Contact
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Let&apos;s <span className="gradient-text">Talk Music</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Whether you&apos;re an artist, a label, or just curious — we&apos;d love to hear from you.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Contact channels */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {channels.map((ch, i) => (
              <ScrollReveal key={ch.title} delay={i * 0.1}>
                <div className="glass-card-light rounded-2xl p-8 hover-lift h-full">
                  <div className="text-4xl mb-4">{ch.icon}</div>
                  <h3 className="text-xl font-bold text-navy mb-2">{ch.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-4">{ch.description}</p>
                  <a
                    href={`mailto:${ch.email}`}
                    className="text-electric font-semibold hover:underline"
                  >
                    {ch.email}
                  </a>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Office / Socials */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16">
            <ScrollReveal direction="left">
              <h2 className="text-2xl font-bold text-navy mb-4">Our Offices</h2>
              <div className="space-y-6 text-gray-600">
                <div>
                  <h3 className="font-semibold text-navy mb-1">Montr&eacute;al (HQ)</h3>
                  <p>1000 Rue de la Gaucheti&egrave;re O<br />Montr&eacute;al, QC H3B 4W5, Canada</p>
                </div>
                <div>
                  <h3 className="font-semibold text-navy mb-1">Lagos</h3>
                  <p>Victoria Island<br />Lagos, Nigeria</p>
                </div>
                <div>
                  <h3 className="font-semibold text-navy mb-1">Nairobi</h3>
                  <p>Westlands<br />Nairobi, Kenya</p>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <h2 className="text-2xl font-bold text-navy mb-4">Follow Us</h2>
              <p className="text-gray-600 mb-6">
                Stay connected with Zonga for the latest on African music, creator stories,
                and platform updates.
              </p>
              <div className="space-y-3">
                {[
                  { platform: 'X (Twitter)', handle: '@zongamusic' },
                  { platform: 'Instagram', handle: '@zongamusic' },
                  { platform: 'LinkedIn', handle: 'Zonga Music' },
                  { platform: 'YouTube', handle: 'Zonga Music' },
                ].map((s) => (
                  <div key={s.platform} className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 rounded-full bg-electric" />
                    <span className="font-medium">{s.platform}</span>
                    <span className="text-gray-400">—</span>
                    <span className="text-electric">{s.handle}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to <span className="gradient-text">Get Started?</span>
            </h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              Create your free account and start sharing your music today.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              Join Zonga Free
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
