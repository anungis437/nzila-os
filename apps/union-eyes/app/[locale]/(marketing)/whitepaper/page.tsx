import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Download, FileText } from 'lucide-react';

import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import {
  CONTINUITY_GAP_BLOCKS,
  CONTINUITY_GAP_SOURCE_PDF,
} from '@/lib/whitepaper/continuity-gap';

const WHITEPAPER_COPY = {
  'en-CA': {
    title: 'UnionEyes Whitepaper | Institutional Continuity Infrastructure',
    description:
      'The UnionEyes whitepaper outlines the institutional continuity model, governance boundaries, deterministic AI doctrine, and deployment controls for labour organizations.',
    heading: 'UnionEyes Whitepaper',
    heroDescription:
      'An executive technical brief on institutional continuity architecture, governed AI boundaries, and operational safeguards for labour leadership.',
    subtitle: 'Whitepaper article',
    ctaLabel: 'Read Insights Library',
    ctaHref: '/insights',
    downloadLabel: 'Download Full PDF',
    tocLabel: 'On this page',
    articleMeta: {
      format: 'Evidence-Enhanced Whitepaper',
      version: 'v3.0',
      author: 'Nzila Ventures / Nzila OS Research Initiative',
      source: 'Primary source',
    },
    sourceLabel: 'Source file',
    sourceValue: 'infotech/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf',
    articleNotice:
      'This page renders the full extracted whitepaper text and preserves section order for direct online reading.',
  },
  'fr-CA': {
    title: 'Livre blanc UnionEyes | Infrastructure de continuite institutionnelle',
    description:
      'Le livre blanc UnionEyes presente le modele de continuite institutionnelle, les limites de gouvernance, la doctrine IA deterministe et les controles de deploiement pour les organisations syndicales.',
    heading: 'Livre blanc UnionEyes',
    heroDescription:
      'Une note technique executive sur l architecture de continuite institutionnelle, les limites d IA gouvernee et les garanties operationnelles pour la direction syndicale.',
    subtitle: 'Article livre blanc',
    ctaLabel: 'Consulter la bibliotheque Perspectives',
    ctaHref: '/insights',
    downloadLabel: 'Telecharger le PDF complet',
    tocLabel: 'Sommaire',
    articleMeta: {
      format: 'Livre blanc renforce par preuves',
      version: 'v3.0',
      author: 'Nzila Ventures / Initiative de recherche Nzila OS',
      source: 'Source principale',
    },
    sourceLabel: 'Fichier source',
    sourceValue: 'infotech/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf',
    articleNotice:
      'Cette page affiche le texte integral extrait du livre blanc et conserve l ordre original des sections.',
  },
} as const;

const HEADING_PATTERNS = [
  /^The Continuity Gap$/i,
  /^Central Thesis$/i,
  /^A Note on Stewardship and Memory$/i,
  /^Executive Summary$/i,
  /^Section\s+\d+/i,
  /^Objections and Counterarguments$/i,
  /^Legal and Regulatory Alignment$/i,
  /^Category Declaration$/i,
  /^Final Thesis$/i,
  /^Research Foundations and Selected References$/i,
  /^Source Documents Used for This Revision$/i,
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function normalizeBlock(block: string): string {
  return block
    .replace(/^The Continuity Gap \| Evidence-Enhanced Edition\nNzila Ventures \/ Nzila OS Research Initiative\n?/gm, '')
    .trim();
}

function getHeadingLine(block: string): string | null {
  const firstLine = block.split('\n')[0]?.trim() ?? '';
  if (!firstLine) return null;
  return HEADING_PATTERNS.some((pattern) => pattern.test(firstLine)) ? firstLine : null;
}

type ContentSegment =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

function parseContentSegments(body: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const normalized = body.replace(/\u2022|\uF0B7/g, '•');
  const lines = normalized.split('\n').map((line) => line.trim());

  let paragraphParts: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphParts.length > 0) {
      segments.push({ type: 'paragraph', text: paragraphParts.join(' ').replace(/\s+/g, ' ').trim() });
      paragraphParts = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      segments.push({ type: 'list', items: [...listItems] });
      listItems = [];
    }
  };

  lines.forEach((line) => {
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const bulletMatch = line.match(/^(?:•|-|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1].trim());
      return;
    }

    if (listItems.length > 0) {
      const last = listItems[listItems.length - 1];
      listItems[listItems.length - 1] = `${last} ${line}`.replace(/\s+/g, ' ').trim();
      return;
    }

    paragraphParts.push(line);
  });

  flushParagraph();
  flushList();

  return segments;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = WHITEPAPER_COPY[locale as keyof typeof WHITEPAPER_COPY] ?? WHITEPAPER_COPY['en-CA'];

  return {
    title: copy.title,
    description: copy.description,
    alternates: buildLocaleAlternates(locale, '/whitepaper'),
  };
}

export default async function LocaleWhitepaperPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = WHITEPAPER_COPY[locale as keyof typeof WHITEPAPER_COPY] ?? WHITEPAPER_COPY['en-CA'];
  const whitepaperBlocks = CONTINUITY_GAP_BLOCKS.map(normalizeBlock).filter((block) => block.length > 0);
  const tocHeadings = whitepaperBlocks
    .map((block) => getHeadingLine(block))
    .filter((heading): heading is string => heading !== null);

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#10263a]">
        <Image
          src={heroImagery.institutionalContinuity}
          alt="Institutional continuity"
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f2133]/95 via-[#123451]/80 to-[#0f2133]/95" />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-black/20 backdrop-blur-sm">
            <div className="p-7 sm:p-9">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <FileText className="h-3.5 w-3.5" />
                Whitepaper
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{copy.heading}</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">{copy.heroDescription}</p>
              <p className="mt-2 text-sm text-slate-600">
                {copy.sourceLabel}: <span className="font-medium text-slate-800">{copy.sourceValue}</span>
              </p>

              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="relative h-48 w-full sm:h-56">
                  <Image src={heroImagery.insights} alt="Whitepaper cover" fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#0f2133]/85 to-[#1f5b84]/40" />
                  <div className="relative z-10 p-5 text-white sm:p-6">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/80">Evidence-Enhanced Canadian Edition</p>
                    <p className="mt-2 text-2xl font-semibold">The Continuity Gap</p>
                    <p className="mt-1 text-sm text-white/85">Organizational Memory, Institutional Resilience, and the Future of Operational Trust</p>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-slate-200 p-4 md:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Format</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{copy.articleMeta.format}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Version</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{copy.articleMeta.version}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Author</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{copy.articleMeta.author}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{copy.articleMeta.source}</p>
                    <a href={CONTINUITY_GAP_SOURCE_PDF} download className="mt-1 inline-flex text-sm font-medium text-[#1f5b84] hover:text-[#12324a]">
                      {copy.downloadLabel}
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={CONTINUITY_GAP_SOURCE_PDF}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  <Download className="h-4 w-4" />
                  {copy.downloadLabel}
                </a>
                <Link
                  href={`/${locale}${copy.ctaHref}`}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                >
                  {copy.ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <section className="grid gap-8 lg:grid-cols-12">
          <aside className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm leading-6 text-slate-700">{copy.articleNotice}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{copy.tocLabel}</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {tocHeadings.map((heading) => (
                  <li key={heading}>
                    <a href={`#${slugify(heading)}`} className="hover:text-[#1f5b84] transition-colors">
                      {heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <a
                href={CONTINUITY_GAP_SOURCE_PDF}
                download
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                <Download className="h-4 w-4" />
                {copy.downloadLabel}
              </a>
            </div>
          </aside>

          <article className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
            {whitepaperBlocks.map((block, index) => {
              const heading = getHeadingLine(block);
              const body = heading
                ? block
                    .split('\n')
                    .slice(1)
                    .join('\n')
                    .trim()
                : block;

              return (
                <div key={`wb-${index}`} className="space-y-3">
                  {heading ? (
                    <h2 id={slugify(heading)} className="text-2xl font-semibold text-navy tracking-tight">
                      {heading}
                    </h2>
                  ) : null}
                  {body
                    ? parseContentSegments(body).map((segment, segmentIndex) => (
                      segment.type === 'paragraph' ? (
                        <p key={`wb-segment-${index}-${segmentIndex}`} className="text-base leading-8 text-slate-700">
                          {segment.text}
                        </p>
                      ) : (
                        <ul key={`wb-segment-${index}-${segmentIndex}`} className="list-disc space-y-2 pl-6 text-base leading-8 text-slate-700">
                          {segment.items.map((item, itemIndex) => (
                            <li key={`wb-item-${index}-${segmentIndex}-${itemIndex}`}>{item}</li>
                          ))}
                        </ul>
                      )
                    ))
                    : null}
                </div>
              );
            })}
          </article>
        </section>
      </main>
    </div>
  );
}