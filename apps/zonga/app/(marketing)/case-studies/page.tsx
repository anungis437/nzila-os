/**
 * Case Studies — Zonga deployment stories and partner impact.
 *
 * This is the primary surface where client and partner brands receive
 * their strongest visibility (`logo` mode) per the brand policy matrix.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import ScrollReveal from '@/components/public/scroll-reveal';
import { PartnershipAttribution } from '@/components/branding';
import { ZONGA_BRAND } from '@/lib/branding/registry';
import { getClientBrand, getPartnerBrand } from '@/lib/branding/brand-config';
import { loadBrandingFlags } from '@/lib/branding/feature-flags';

export const metadata: Metadata = {
  title: 'Case Studies — Zonga',
  description: 'See how Zonga deployments empower African music ecosystems through strategic partnerships and technology.',
};

const caseStudies = [
  {
    title: 'Bringing Fair-Share Music to French-Speaking Canada',
    summary:
      'How Zonga partnered to bring transparent royalty distribution and mobile payouts to over 2,000 African diaspora artists in Québec.',
    highlights: [
      '85% revenue share from day one',
      'Mobile money + Interac payouts',
      'Bilingual French/English platform',
      '2,000+ artists onboarded in 6 months',
    ],
    href: '#ms-celebration',
  },
];

export default function CaseStudiesPage() {
  const flags = loadBrandingFlags();
  const client = getClientBrand();
  const partner = getPartnerBrand();

  return (
    <main className="min-h-screen">
      {/* Hero — Zonga-primary */}
      <section className="relative py-32 bg-navy overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              Case Studies
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              {ZONGA_BRAND.name} in <span className="gradient-text">Action</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Real deployments. Real impact. See how {ZONGA_BRAND.name} and our
              partners are transforming African music ecosystems.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Case Study Cards */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12">
            {caseStudies.map((cs, i) => (
              <ScrollReveal key={cs.title} delay={i * 0.15}>
                <article className="glass-card-light rounded-2xl p-10 hover-lift" id={cs.href.replace('#', '')}>
                  <div className="grid lg:grid-cols-2 gap-10">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-navy mb-4">
                        {cs.title}
                      </h2>
                      <p className="text-lg text-gray-600 leading-relaxed mb-6">
                        {cs.summary}
                      </p>

                      {/* Partnership attribution — strongest visibility per policy */}
                      <div className="p-4 rounded-xl bg-navy/5 mb-6">
                        <PartnershipAttribution
                          placement="marketing_case_study"
                          client={client}
                          partner={partner}
                          flags={flags}
                          variant="stacked"
                          className="[&_span]:text-navy/60! [&_span]:font-medium!"
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-widest text-electric mb-4">
                        Key Highlights
                      </h3>
                      <ul className="space-y-3">
                        {cs.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-3">
                            <div className="mt-1.5 w-2 h-2 rounded-full bg-electric shrink-0" />
                            <span className="text-gray-700">{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Partner CTA — partner gets strong visibility here */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
              Partner With <span className="gradient-text">{ZONGA_BRAND.name}</span>
            </h2>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
              Interested in bringing {ZONGA_BRAND.name} to your region? We work with
              distribution partners to deploy fair-share music infrastructure
              across Africa and the diaspora.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
            >
              Become a Partner
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
