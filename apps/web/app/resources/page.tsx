import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getAllDocs } from '@/lib/docs';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionDivider from '@/components/public/SectionDivider';

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Public documentation, guides, and technical resources from Nzila Ventures — the APEX of AI in social impact.',
  openGraph: {
    title: 'Nzila Ventures Resources',
    description: 'Documentation, guides, and technical resources for our AI platform ecosystem.',
    images: [{ url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Grand library with natural light representing knowledge resources' }],
  },
  alternates: { canonical: '/resources' },
};

export default function ResourcesPage() {
  const docs = getAllDocs('public');

  // Group by category
  const grouped = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    const cat = doc.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  const quickLinks = [
    { label: 'Platform Architecture', href: '/platform', icon: '🏗️', description: 'Our unified Backbone infrastructure' },
    { label: 'Investment Thesis', href: '/investors', icon: '📈', description: 'Series A opportunity & market analysis' },
    { label: 'Portfolio Overview', href: '/portfolio', icon: '📊', description: '15 platforms across 10+ verticals' },
    { label: 'Contact Us', href: '/contact', icon: '✉️', description: 'Get in touch with our team' },
  ];

  return (
    <main className="min-h-screen">
      {/* ─── Hero ─── */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920"
          alt="Library of knowledge and resources"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              Knowledge Base
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Resources & <span className="gradient-text">Documentation</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-2xl">
              Explore our public documentation, technical guides, and strategic insights
              into the Nzila Ventures ecosystem.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── Quick Links ─── */}
      <section className="relative bg-navy-light py-16 overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map((link, i) => (
              <ScrollReveal key={link.label} delay={i * 0.08}>
                <Link href={link.href}>
                  <div className="glass-card rounded-2xl p-5 hover-lift cursor-pointer group transition-all duration-300">
                    <span className="text-3xl mb-3 block">{link.icon}</span>
                    <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-electric-light transition-colors">
                      {link.label}
                    </h3>
                    <p className="text-xs text-gray-400">{link.description}</p>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Documents ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {docs.length === 0 ? (
            <ScrollReveal>
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">📄</span>
                </div>
                <h2 className="text-2xl font-bold text-navy mb-3">No resources published yet</h2>
                <p className="text-gray-500 max-w-sm mx-auto">
                  Add markdown files to <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono">content/public/</code> to see them here.
                </p>
              </div>
            </ScrollReveal>
          ) : (
            <div className="space-y-16">
              {categories.map((category, catIdx) => (
                <div key={category}>
                  <ScrollReveal>
                    <div className="flex items-center gap-4 mb-8">
                      <h2 className="text-2xl font-bold text-navy">{category}</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-electric/20 to-transparent" />
                    </div>
                  </ScrollReveal>

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped[category]
                      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                      .map((doc, i) => (
                        <ScrollReveal key={doc.slug} delay={i * 0.08}>
                          <Link href={`/resources/${doc.slug}`}>
                            <div className="group relative bg-white rounded-2xl border border-gray-200/80 p-6 hover:border-electric/30 hover:shadow-xl hover:shadow-electric/5 transition-all duration-300 hover-lift h-full">
                              <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-electric/10 to-violet/10 flex items-center justify-center flex-shrink-0 group-hover:from-electric/20 group-hover:to-violet/20 transition-colors">
                                  <span className="text-lg">📄</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-navy text-base mb-1 group-hover:text-electric transition-colors">
                                    {doc.title}
                                  </h3>
                                  {doc.description && (
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{doc.description}</p>
                                  )}
                                  {doc.date && (
                                    <span className="text-xs text-gray-400">{doc.date}</span>
                                  )}
                                </div>
                              </div>

                              {/* Hover arrow */}
                              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M3 13L13 3M13 3H5M13 3V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-electric" />
                                </svg>
                              </div>
                            </div>
                          </Link>
                        </ScrollReveal>
                      ))}
                  </div>

                  {catIdx < categories.length - 1 && (
                    <SectionDivider variant="dots" className="mt-12" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
              Looking for something specific?
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              Get in touch with our team for detailed technical documentation, partnership materials, or investor decks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/25 btn-press"
              >
                Contact Us
              </Link>
              <Link
                href="/investors"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-navy font-bold rounded-xl border border-gray-200 hover:border-electric/30 hover:shadow-lg transition-all text-lg btn-press"
              >
                Investor Materials
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}
