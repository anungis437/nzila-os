import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Download } from 'lucide-react';

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
  /^\d+(?:\.\d+)?\s+[A-Z]/,
  /^Objections and Counterarguments$/i,
  /^Legal and Regulatory Alignment$/i,
  /^Category Declaration$/i,
  /^Final Thesis$/i,
  /^Research Foundations and Selected References$/i,
  /^Source Documents Used for This Revision$/i,
];

const SECTION_IMAGE_URLS = [
  heroImagery.institutionalContinuity,
  heroImagery.governance,
  heroImagery.insights,
  heroImagery.platform,
  heroImagery.story,
  heroImagery.trust,
];

const OPENING_PARAGRAPH =
  'Modern institutions are losing continuity faster than they preserve it. The organizations that endure the next decade will not simply digitize faster; they will preserve institutional memory, governance lineage, operational trust, and continuity intelligence more deliberately. "Continuity is not nostalgia for how organizations used to work. It is the discipline of ensuring that what matters can survive the people who carried it."';

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

function isHeadingLine(line: string): boolean {
  const candidate = line.trim();
  if (!candidate) return false;
  return HEADING_PATTERNS.some((pattern) => pattern.test(candidate));
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

type WhitepaperSection = {
  heading: string;
  body: string;
  segments: ContentSegment[];
};

function buildWhitepaperSections(blocks: string[]): WhitepaperSection[] {
  const sections: Array<{ heading: string; bodyLines: string[] }> = [];
  let current: { heading: string; bodyLines: string[] } | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const body = current.bodyLines.join('\n').trim();
    if (body.length === 0 && sections.length > 0) {
      current = null;
      return;
    }

    sections.push({
      heading: current.heading,
      bodyLines: current.bodyLines,
    });
    current = null;
  };

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim());

    for (const line of lines) {
      if (!line) {
        if (current) {
          current.bodyLines.push('');
        }
        continue;
      }

      if (isHeadingLine(line)) {
        pushCurrent();
        current = {
          heading: line,
          bodyLines: [],
        };
        continue;
      }

      if (!current) {
        current = {
          heading: 'The Continuity Gap',
          bodyLines: [],
        };
      }

      current.bodyLines.push(line);
    }

    if (current) {
      current.bodyLines.push('');
    }
  }

  pushCurrent();

  return sections.map((section) => {
    const body = section.bodyLines.join('\n').trim();
    return {
      heading: section.heading,
      body,
      segments: parseContentSegments(body),
    };
  });
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
  const sections = buildWhitepaperSections(whitepaperBlocks);
  const tocHeadings = sections.map((section) => section.heading);

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-[#0f2133] via-[#123451] to-[#0f2133]">
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">The Continuity Gap</h1>
            <p className="mt-3 text-base text-white/90 sm:text-lg">Organizational Memory, Institutional Resilience, and the Future of Operational Trust</p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
      </section>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
        <section className="grid gap-8 xl:grid-cols-12">
          <aside className="xl:col-span-3 xl:sticky xl:top-24 xl:self-start space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{copy.tocLabel}</h3>
              <p className="mt-2 text-xs text-slate-500">{tocHeadings.length} major sections</p>
              <ol className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto pr-1 text-sm text-slate-700">
                {tocHeadings.map((heading, index) => (
                  <li key={heading}>
                    <a href={`#${slugify(heading)}`} className="group inline-flex items-start gap-2 transition-colors hover:text-[#1f5b84]">
                      <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 group-hover:bg-[#1f5b84]/10 group-hover:text-[#1f5b84]">{index + 1}</span>
                      <span>{heading}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Quick actions</h3>
              <div className="mt-3 space-y-2">
                <a
                  href={CONTINUITY_GAP_SOURCE_PDF}
                  download
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  <Download className="h-4 w-4" />
                  {copy.downloadLabel}
                </a>
                {tocHeadings[0] ? (
                  <a href={`#${slugify(tocHeadings[0])}`} className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100">
                    Start reading
                  </a>
                ) : null}
              </div>
            </div>
          </aside>

          <article className="xl:col-span-9 rounded-2xl border border-slate-200 bg-white p-7 sm:p-10 space-y-10">
            {sections.map((section, index) => {
              const heading = section.heading;
              const body = index === 0 ? OPENING_PARAGRAPH : section.body;

              return (
                <div key={`wb-${index}`} className="space-y-4">
                  {heading ? (
                    <h2 id={slugify(heading)} className="scroll-mt-28 text-3xl font-semibold text-navy tracking-tight">
                      {heading}
                    </h2>
                  ) : null}

                  {heading && index > 0 && index % 3 === 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="relative h-52 w-full">
                        <Image
                          src={SECTION_IMAGE_URLS[index % SECTION_IMAGE_URLS.length]}
                          alt={heading}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#10263a]/70 via-[#10263a]/30 to-transparent" />
                        <div className="relative z-10 flex h-full items-end p-5">
                          <p className="text-sm font-medium text-white/90">{heading}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {body
                    ? section.segments.map((segment, segmentIndex) => (
                        segment.type === 'paragraph' ? (
                          <p key={`wb-segment-${index}-${segmentIndex}`} className="text-[1.05rem] leading-8 text-slate-700">
                            {segment.text}
                          </p>
                        ) : (
                          <ul key={`wb-segment-${index}-${segmentIndex}`} className="list-disc space-y-2 pl-6 text-[1.05rem] leading-8 text-slate-700">
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