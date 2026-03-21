import type { Metadata } from 'next';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'Documentation — Zonga',
  description: 'Guides, tutorials, and reference documentation for the Zonga music platform.',
};

const sections = [
  {
    title: 'Getting Started',
    description: 'Create your account, set up your profile, and upload your first release.',
    icon: '🚀',
    items: ['Account setup', 'Profile completion', 'First upload walkthrough', 'Payout configuration'],
  },
  {
    title: 'Catalog Management',
    description: 'Manage releases, tracks, cover art, and metadata across your entire catalog.',
    icon: '🎵',
    items: ['Release creation', 'Track ordering', 'Metadata standards', 'Cover art requirements'],
  },
  {
    title: 'Revenue & Payouts',
    description: 'Understand how revenue is calculated, royalty splits work, and payouts are processed.',
    icon: '💰',
    items: ['Revenue model (85/15)', 'Royalty split configuration', 'Payout schedules', 'Currency support'],
  },
  {
    title: 'Events & Ticketing',
    description: 'Create events, configure ticket types, and manage attendees.',
    icon: '🎫',
    items: ['Event creation', 'Multi-tier tickets', 'Attendee management', 'Post-event analytics'],
  },
  {
    title: 'Moderation & Integrity',
    description: 'Learn about our content policies, audio fingerprinting, and dispute resolution.',
    icon: '🛡️',
    items: ['Content policies', 'Audio fingerprinting', 'Dispute process', 'Appeal workflow'],
  },
  {
    title: 'API Reference',
    description: 'Integrate with Zonga programmatically using our REST APIs.',
    icon: '🔌',
    href: '/docs/api',
    items: ['Authentication', 'Catalog endpoints', 'Revenue endpoints', 'Webhooks'],
  },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen">
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              Documentation
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Learn <span className="gradient-text">Zonga</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Everything you need to distribute music, manage your catalog, and grow your audience on the platform.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sections.map((s, i) => (
              <ScrollReveal key={s.title} delay={i * 0.08}>
                <div className="glass-card-light rounded-2xl p-8 hover-lift h-full flex flex-col">
                  <div className="text-4xl mb-4">{s.icon}</div>
                  <h3 className="text-xl font-bold text-navy mb-2">{s.title}</h3>
                  <p className="text-gray-600 leading-relaxed mb-4">{s.description}</p>
                  <ul className="mt-auto space-y-2">
                    {s.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-electric" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  {s.href && (
                    <Link href={s.href} className="mt-6 text-electric font-semibold hover:underline text-sm">
                      View API Reference →
                    </Link>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-navy relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Need <span className="gradient-text">Help?</span>
            </h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              Our support team is here for artists, labels, and listeners.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              Contact Support
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
