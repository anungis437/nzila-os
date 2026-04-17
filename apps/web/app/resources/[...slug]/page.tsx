import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDocBySlug, getAllDocSlugs } from '@/lib/docs';
import ScrollReveal from '@/components/public/ScrollReveal';
import { sanitizeHtml } from '@/lib/sanitize';

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  const slugs = getAllDocSlugs('public');
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug.join('/'), 'public');
  if (!doc) return { title: 'Not Found' };

  const docPath = slug.join('/');
  const canonical = `/resources/${docPath}`;
  const ogImage = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&h=630&fit=crop&q=80';

  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: doc.title,
      description: doc.description,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: doc.title }],
      publishedTime: doc.date,
    },
    twitter: {
      card: 'summary_large_image',
      title: doc.title,
      description: doc.description,
      images: [ogImage],
    },
  } satisfies Metadata;
}

function formatDocDate(date?: string): string | undefined {
  if (!date) return undefined;
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const source = isoDateOnly.test(date) ? `${date}T00:00:00Z` : date;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export default async function ResourceDocPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = await getDocBySlug(slug.join('/'), 'public');

  if (!doc) notFound();

  const docPath = slug.join('/');
  const docUrl = `https://nzilaventures.com/resources/${docPath}`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: doc.title,
    description: doc.description,
    datePublished: doc.date,
    dateModified: doc.date,
    mainEntityOfPage: docUrl,
    url: docUrl,
    inLanguage: 'en-CA',
    timeRequired: doc.readingTime ? `PT${doc.readingTime}M` : undefined,
    author: {
      '@type': 'Organization',
      name: 'Nzila Ventures',
      url: 'https://nzilaventures.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Nzila Ventures',
      url: 'https://nzilaventures.com',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Resources',
        item: 'https://nzilaventures.com/resources',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: doc.title,
        item: docUrl,
      },
    ],
  };

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* ─── Hero Header ─── */}
      <section className="relative overflow-hidden bg-navy pt-32 pb-16">
        <div className="absolute inset-0 bg-mesh opacity-30" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <Link
              href="/resources"
              className="inline-flex items-center text-sm text-electric-light hover:text-white transition-colors mb-8 group"
            >
              <svg
                className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Resources
            </Link>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
              {doc.title}
            </h1>
          </ScrollReveal>

          {doc.description && (
            <ScrollReveal delay={0.15}>
              <p className="text-lg text-gray-300 max-w-2xl">{doc.description}</p>
            </ScrollReveal>
          )}

          <ScrollReveal delay={0.2}>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              {doc.category && (
                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-electric/20 text-electric-light">
                  {doc.category}
                </span>
              )}
              {doc.date && (
                <span className="text-sm text-gray-400">{formatDocDate(doc.date)}</span>
              )}
              {doc.readingTime && (
                <span className="flex items-center gap-1.5 text-sm text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {doc.readingTime} min read
                </span>
              )}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── Content ─── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <article
              className="doc-prose prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.htmlContent) }}
            />
          </ScrollReveal>
        </div>
      </section>

      {/* ─── Footer Nav ─── */}
      <section className="py-12 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/resources"
              className="inline-flex items-center text-electric font-semibold hover:text-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              All Resources
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-3 bg-electric text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-electric/25 btn-press"
            >
              Request More Information
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
