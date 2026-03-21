/**
 * Pricing — Transparent pricing for artists, labels, listeners, and event organizers.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';

export const metadata: Metadata = {
  title: 'Pricing — Zonga',
  description: 'Simple, transparent pricing for everyone in the African music ecosystem. Free streaming for listeners, 85% revenue share for artists, label plans, and event ticketing.',
};

const plans = [
  {
    name: 'Artist',
    audience: 'Independent creators',
    price: 'Free',
    priceNote: 'No monthly fee',
    highlight: true,
    features: [
      '85% revenue share',
      'Unlimited uploads',
      'Instant payouts (mobile money, bank)',
      'Audio fingerprinting',
      'Basic analytics',
      'Event ticketing (5% fee)',
      'Community support',
    ],
    cta: 'Start Free',
    href: '/sign-up',
  },
  {
    name: 'Label',
    audience: 'Labels & distributors',
    price: '$49',
    priceNote: '/month per label',
    highlight: false,
    features: [
      'Everything in Artist',
      'Multi-artist roster management',
      'Automated royalty splits',
      'Advanced analytics & reporting',
      'Priority content review',
      'Bulk upload tools',
      'Dedicated account manager',
      'Compliance & audit exports',
    ],
    cta: 'Contact Sales',
    href: '/contact',
  },
  {
    name: 'Enterprise',
    audience: 'Major labels & platforms',
    price: 'Custom',
    priceNote: 'Tailored to your scale',
    highlight: false,
    features: [
      'Everything in Label',
      'Custom revenue split tiers',
      'API access & integrations',
      'White-label options',
      'SLA guarantees',
      'On-premise deployment option',
      'Custom payment rail setup',
      'Legal & rights management',
    ],
    cta: 'Talk to Us',
    href: '/contact',
  },
];

const faqs = [
  {
    q: 'How does the 85% revenue share work?',
    a: 'For every stream, download, or sync placement, 85% of the net revenue goes directly to the rights holder. Zonga retains 15% to cover infrastructure, payment processing, and platform operations.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'We support Orange Money, M-Pesa, MTN MoMo, Flutterwave, bank transfers, and more. Payouts are processed within 24 hours of request.',
  },
  {
    q: 'Is there a minimum payout threshold?',
    a: 'The minimum payout is equivalent to $5 USD in your local currency. Once you reach it, you can request a payout anytime.',
  },
  {
    q: 'Do I keep ownership of my music?',
    a: 'Yes — always. Zonga is a non-exclusive distribution platform. You retain 100% ownership and rights to your masters.',
  },
  {
    q: 'What does event ticketing cost?',
    a: 'Event organizers pay a 5% fee on each ticket sold through Zonga. Tickets for free events have no fee.',
  },
  {
    q: 'What do listeners get for free?',
    a: 'Free listeners get unlimited ad-supported streaming, playlist creation, artist follows, event discovery, and the ability to tip artists directly. Upgrade to Premium for ad-free, offline, and hi-fi audio.',
  },
  {
    q: 'How does Premium support artists?',
    a: 'Premium subscription revenue is shared with artists based on your listening habits. The more you listen to an artist, the larger their share — so every stream directly supports the creators you love.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Listener and artist accounts are free forever. Premium and label plans are billed monthly with no long-term commitment — cancel anytime.',
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              Pricing
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Simple, <span className="gradient-text">Transparent</span> Pricing
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              No hidden fees. No lock-in. Listeners stream free, artists keep 85%,
              and labels get the tools they need — all at a fair price.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Plans */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <ScrollReveal key={plan.name} delay={i * 0.1}>
                <div className={`rounded-2xl p-8 h-full flex flex-col ${
                  plan.highlight
                    ? 'bg-navy text-white ring-2 ring-electric shadow-xl shadow-electric/20'
                    : 'glass-card-light'
                }`}>
                  <div className="mb-6">
                    <h3 className={`text-sm font-semibold tracking-widest uppercase mb-2 ${
                      plan.highlight ? 'text-electric-light' : 'text-electric'
                    }`}>{plan.name}</h3>
                    <p className={`text-sm mb-4 ${plan.highlight ? 'text-gray-300' : 'text-gray-500'}`}>
                      {plan.audience}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-navy'}`}>
                        {plan.price}
                      </span>
                      <span className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                        {plan.priceNote}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2 text-sm ${
                        plan.highlight ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        <span className="text-electric mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`inline-flex items-center justify-center px-6 py-3 font-semibold rounded-xl transition-all text-sm btn-press ${
                      plan.highlight
                        ? 'bg-electric text-white hover:bg-blue-700 shadow-lg shadow-electric/30'
                        : 'bg-navy text-white hover:bg-navy-light'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Listener Plans */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                For Listeners
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                Stream <span className="text-electric">Your Way</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Discover and support African music — free or premium, your choice.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Listener */}
            <ScrollReveal delay={0}>
              <div className="glass-card-light rounded-2xl p-8 h-full flex flex-col">
                <div className="mb-6">
                  <h3 className="text-sm font-semibold tracking-widest uppercase mb-2 text-electric">Free</h3>
                  <p className="text-sm mb-4 text-gray-500">Casual listeners</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-navy">$0</span>
                    <span className="text-sm text-gray-500">forever</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    'Ad-supported streaming',
                    'Create & share playlists',
                    'Follow artists & labels',
                    'Event discovery & ticketing',
                    'Standard audio quality',
                    'Tip artists directly',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-electric mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center px-6 py-3 font-semibold rounded-xl transition-all text-sm btn-press bg-navy text-white hover:bg-navy-light"
                >
                  Listen Free
                </Link>
              </div>
            </ScrollReveal>

            {/* Premium Listener */}
            <ScrollReveal delay={0.1}>
              <div className="bg-navy text-white ring-2 ring-gold shadow-xl shadow-gold/20 rounded-2xl p-8 h-full flex flex-col">
                <div className="mb-6">
                  <h3 className="text-sm font-semibold tracking-widest uppercase mb-2 text-gold">Premium</h3>
                  <p className="text-sm mb-4 text-gray-300">Dedicated fans</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">$4.99</span>
                    <span className="text-sm text-gray-400">/month</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    'Ad-free streaming',
                    'Offline downloads',
                    'Hi-fi lossless audio',
                    'Exclusive releases & early access',
                    'Enhanced playlist tools',
                    'Tip artists directly',
                    'Support artists with every stream',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-200">
                      <span className="text-gold mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center px-6 py-3 font-semibold rounded-xl transition-all text-sm btn-press bg-gold text-navy hover:bg-yellow-500 shadow-lg shadow-gold/30"
                >
                  Go Premium
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-4">
                Frequently <span className="text-electric">Asked</span>
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <ScrollReveal key={faq.q} delay={i * 0.08}>
                <div className="glass-card-light rounded-xl p-6">
                  <h3 className="text-lg font-bold text-navy mb-2">{faq.q}</h3>
                  <p className="text-gray-600 leading-relaxed">{faq.a}</p>
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
              Start for <span className="gradient-text">Free</span>
            </h2>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
              No credit card required. Stream your favorite artists or upload your first track — get started in seconds.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              Create Your Account
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
