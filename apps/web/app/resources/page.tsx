import type { Metadata } from 'next';
import Image from 'next/image';
import { getLocale } from 'next-intl/server';
import { getAllDocs } from '@/lib/docs';
import ScrollReveal from '@/components/public/ScrollReveal';
import SectionDivider from '@/components/public/SectionDivider';
import TrackedLink from '@/components/public/TrackedLink';
import { governedCoverageLabel, platformCoverageLabel } from '@/lib/marketing-facts';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Public documentation, doctrine explainers, and operational resources from Nzila Ventures.',
  openGraph: {
    title: 'Nzila Ventures Resources',
    description: `Documentation, guides, and technical resources for ${platformCoverageLabel()} and ${governedCoverageLabel()}.`,
    images: [{ url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&h=630&fit=crop&q=80', width: 1200, height: 630, alt: 'Grand library with natural light representing knowledge resources' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nzila Ventures Resources',
    description: `Documentation, guides, and technical resources for ${platformCoverageLabel()} and ${governedCoverageLabel()}.`,
    images: ['https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&h=630&fit=crop&q=80'],
  },
  alternates: { canonical: '/resources' },
};

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  'Getting Started':   { icon: '🚀', color: 'from-emerald/10 to-emerald/5' },
  'Technical':         { icon: '⚙️', color: 'from-electric/10 to-violet/5' },
  'Security':          { icon: '🔐', color: 'from-coral/10 to-coral/5' },
  'Integrations':      { icon: '🔗', color: 'from-violet/10 to-violet/5' },
  'Platform':          { icon: '🏗️', color: 'from-gold/10 to-gold/5' },
  'Developer Guide':   { icon: '💻', color: 'from-electric/10 to-electric/5' },
  'General':           { icon: '📄', color: 'from-gray-100 to-gray-50' },
};

function categoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { icon: '📄', color: 'from-gray-100 to-gray-50' };
}

function formatDocDate(date: string | undefined, locale: Locale): string | undefined {
  if (!date) return undefined;
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const source = isoDateOnly.test(date) ? `${date}T00:00:00Z` : date;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

const categoryFr: Record<string, string> = {
  'Getting Started': 'Demarrage',
  Technical: 'Technique',
  Security: 'Securite',
  Integrations: 'Integrations',
  Platform: 'Plateforme',
  'Developer Guide': 'Guide developpeur',
  General: 'General',
};

export default async function ResourcesPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';
  const docs = getAllDocs('public');

  // Group by category
  const grouped = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    const cat = doc.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();
  const totalDocs = docs.length;

  const quickLinks = [
    {
      label: isFr ? 'Architecture plateforme' : 'Platform Architecture',
      href: '/platform',
      icon: '🏗️',
      description: isFr ? 'Notre infrastructure Nzila OS gouvernée' : 'Our governed Nzila OS infrastructure',
    },
    {
      label: isFr ? 'Évaluation continuité' : 'Continuity Assessment',
      href: '/continuity-assessment',
      icon: '📈',
      description: isFr ? 'Diagnostic OCRA et risque institutionnel' : 'OCRA diagnostic and institutional risk',
    },
    {
      label: isFr ? 'Union Eyes' : 'Union Eyes',
      href: '/union-eyes',
      icon: '📊',
      description: isFr
        ? 'Produit de validation phare pour organisations syndicales'
        : 'Flagship validation product for labor organizations',
    },
    {
      label: isFr ? 'Nous contacter' : 'Contact Us',
      href: '/contact',
      icon: '✉️',
      description: isFr ? 'Entrer en contact avec notre équipe' : 'Get in touch with our team',
    },
  ];

  const resourcesItemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Nzila Ventures Resources',
    description: 'Public documentation, guides, and technical resources from Nzila Ventures.',
    numberOfItems: docs.length,
    itemListElement: docs
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .map((doc, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://nzilaventures.com/resources/${doc.slug}`,
        name: doc.title,
      })),
  };

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(resourcesItemListSchema) }}
      />

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
        <div className="absolute inset-0 bg-linear-to-b from-navy/80 via-navy/70 to-navy/90" />
        <div className="absolute inset-0 bg-mesh opacity-40" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <ScrollReveal>
            <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/20 text-electric-light mb-6">
              {isFr ? 'Base de connaissances' : 'Knowledge Base'}
            </span>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              {isFr ? 'Ressources et ' : 'Resources & '}<span className="gradient-text">{isFr ? 'documentation' : 'Documentation'}</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-xl text-gray-300 max-w-2xl">
              {isFr
                ? 'Explorez la doctrine publique, les guides techniques et les analyses opérationnelles de Nzila Ventures.'
                : 'Explore public doctrine, technical guides, and operational insights from Nzila Ventures.'}
            </p>
          </ScrollReveal>
          {totalDocs > 0 && (
            <ScrollReveal delay={0.3}>
              <div className="flex items-center gap-6 mt-8 text-sm text-gray-400">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-electric-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  {totalDocs} {isFr ? `article${totalDocs !== 1 ? 's' : ''}` : `article${totalDocs !== 1 ? 's' : ''}`}
                </span>
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-electric-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  </svg>
                  {categories.length} {isFr ? 'categories' : 'categories'}
                </span>
              </div>
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* ─── Quick Links ─── */}
      <section className="relative bg-navy-light py-16 overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickLinks.map((link, i) => (
              <ScrollReveal key={link.label} delay={i * 0.08}>
                <TrackedLink
                  href={link.href}
                  eventName="resources_quick_link"
                  eventProps={{ destination: link.href, label: link.label }}
                >
                  <div className="glass-card rounded-2xl p-5 hover-lift cursor-pointer group transition-all duration-300">
                    <span className="text-3xl mb-3 block">{link.icon}</span>
                    <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-electric-light transition-colors">
                      {link.label}
                    </h3>
                    <p className="text-xs text-gray-400">{link.description}</p>
                  </div>
                </TrackedLink>
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
                <h2 className="text-2xl font-bold text-navy mb-3">{isFr ? 'Aucune ressource publiée pour le moment' : 'No resources published yet'}</h2>
                <p className="text-gray-500 max-w-sm mx-auto">
                  {isFr
                    ? <>Ajoutez des fichiers markdown dans <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono">content/public/</code> pour les afficher ici.</>
                    : <>Add markdown files to <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono">content/public/</code> to see them here.</>}
                </p>
              </div>
            </ScrollReveal>
          ) : (
            <div className="space-y-16">
              {categories.map((category, catIdx) => {
                const meta = categoryMeta(category);
                return (
                  <div key={category}>
                    <ScrollReveal>
                      <div className="flex items-center gap-4 mb-8">
                        <span className="text-2xl">{meta.icon}</span>
                        <h2 className="text-2xl font-bold text-navy">{isFr ? (categoryFr[category] ?? category) : category}</h2>
                        <div className="flex-1 h-px bg-linear-to-r from-electric/20 to-transparent" />
                        <span className="text-sm text-gray-400 tabular-nums">
                          {grouped[category].length} article{grouped[category].length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </ScrollReveal>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {grouped[category]
                        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                        .map((doc, i) => (
                          <ScrollReveal key={doc.slug} delay={i * 0.08}>
                            <TrackedLink
                              href={`/resources/${doc.slug}`}
                              eventName="resource_open"
                              eventProps={{ slug: doc.slug, category }}
                            >
                              <div className="group relative bg-white rounded-2xl border border-gray-200/80 p-6 hover:border-electric/30 hover:shadow-xl hover:shadow-electric/5 transition-all duration-300 hover-lift h-full flex flex-col">
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${meta.color} flex items-center justify-center shrink-0 mb-4 group-hover:scale-110 transition-transform`}>
                                  <span className="text-lg">{meta.icon}</span>
                                </div>

                                {/* Title + description */}
                                <h3 className="font-semibold text-navy text-base mb-2 group-hover:text-electric transition-colors leading-snug">
                                  {doc.title}
                                </h3>
                                {doc.description && (
                                  <p className="text-sm text-gray-500 line-clamp-2 flex-1 mb-4">{doc.description}</p>
                                )}

                                {/* Meta row */}
                                <div className="flex items-center gap-3 mt-auto">
                                  {doc.date && (
                                    <span className="text-xs text-gray-400">{formatDocDate(doc.date, locale)}</span>
                                  )}
                                  {doc.readingTime && (
                                    <span className="flex items-center gap-1 text-xs text-gray-400">
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                      </svg>
                                      {doc.readingTime} {isFr ? 'min' : 'min'}
                                    </span>
                                  )}
                                </div>

                                {/* Hover arrow */}
                                <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 13L13 3M13 3H5M13 3V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-electric" />
                                  </svg>
                                </div>
                              </div>
                            </TrackedLink>
                          </ScrollReveal>
                        ))}
                    </div>

                    {catIdx < categories.length - 1 && (
                      <SectionDivider variant="dots" className="mt-12" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
              {isFr ? 'Vous cherchez quelque chose de precis ?' : 'Looking for something specific?'}
            </h2>
            <p className="text-gray-600 mb-8 text-lg">
              {isFr
                ? 'Contactez notre équipe pour une documentation technique détaillée, des matériaux de partenariat ou des decks investisseurs.'
                : 'Get in touch with our team for detailed technical documentation, partnership materials, or investor decks.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <TrackedLink
                href="/contact"
                eventName="cta_contact"
                eventProps={{ source: 'resources_bottom' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/25 btn-press"
              >
                {isFr ? 'Nous contacter' : 'Contact Us'}
              </TrackedLink>
              <TrackedLink
                href="/investors"
                eventName="cta_investors"
                eventProps={{ source: 'resources_bottom' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-navy font-bold rounded-xl border border-gray-200 hover:border-electric/30 hover:shadow-lg transition-all text-lg btn-press"
              >
                {isFr ? 'Documents investisseurs' : 'Investor Materials'}
              </TrackedLink>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}






