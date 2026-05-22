import type { Metadata } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { FileText } from 'lucide-react';

import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

const WHITEPAPER_COPY = {
  'en-CA': {
    title: 'UnionEyes Whitepaper | Institutional Continuity Infrastructure',
    description:
      'The UnionEyes whitepaper outlines the institutional continuity model, governance boundaries, deterministic AI doctrine, and deployment controls for labour organizations.',
    heading: 'UnionEyes Whitepaper',
    heroDescription:
      'An executive technical brief on institutional continuity architecture, governed AI boundaries, and operational safeguards for labour leadership.',
    subtitle: 'Full whitepaper text',
    ctaLabel: 'Read Insights Library',
    ctaHref: '/insights',
    sourceLabel: 'Source file',
    sourceValue: 'infotech/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf',
    fallbackText: 'The whitepaper text source was not found on this environment.',
  },
  'fr-CA': {
    title: 'Livre blanc UnionEyes | Infrastructure de continuite institutionnelle',
    description:
      'Le livre blanc UnionEyes presente le modele de continuite institutionnelle, les limites de gouvernance, la doctrine IA deterministe et les controles de deploiement pour les organisations syndicales.',
    heading: 'Livre blanc UnionEyes',
    heroDescription:
      'Une note technique executive sur l architecture de continuite institutionnelle, les limites d IA gouvernee et les garanties operationnelles pour la direction syndicale.',
    subtitle: 'Texte integral du livre blanc',
    ctaLabel: 'Consulter la bibliotheque Perspectives',
    ctaHref: '/insights',
    sourceLabel: 'Fichier source',
    sourceValue: 'infotech/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf',
    fallbackText: 'La source texte du livre blanc est introuvable dans cet environnement.',
  },
} as const;

function loadWhitepaperBlocks(): string[] {
  const sourcePath = path.join(process.cwd(), 'infotech', '_continuity_gap.txt');
  try {
    const raw = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n').trim();
    return raw
      .split(/\n\s*\n/g)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = WHITEPAPER_COPY[locale as keyof typeof WHITEPAPER_COPY] ?? WHITEPAPER_COPY['en-CA'];
  const whitepaperBlocks = loadWhitepaperBlocks();

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
  const whitepaperBlocks = loadWhitepaperBlocks();

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        heading={copy.heading}
        description={copy.heroDescription}
        cta={(
          <Link
            href={`/${locale}${copy.ctaHref}`}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            {copy.ctaLabel}
          </Link>
        )}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <FileText className="h-3.5 w-3.5" />
            Whitepaper
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-900">{copy.subtitle}</h2>
          <p className="mt-3 text-sm text-slate-600">
            {copy.sourceLabel}: <span className="font-medium text-slate-800">{copy.sourceValue}</span>
          </p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            {whitepaperBlocks.length === 0 ? (
              <p className="text-sm leading-6 text-slate-700">{copy.fallbackText}</p>
            ) : (
              <div className="space-y-4">
                {whitepaperBlocks.map((block, index) => {
                  const isHeading =
                    /^Section\s+\d+/i.test(block)
                    || /^Executive Summary$/i.test(block)
                    || /^Central Thesis$/i.test(block)
                    || /^Category Declaration$/i.test(block)
                    || /^Final Thesis$/i.test(block)
                    || /^Research Foundations/i.test(block)
                    || /^Objections and Counterarguments$/i.test(block)
                    || /^Legal and Regulatory Alignment$/i.test(block);

                  return isHeading ? (
                    <h3 key={`wb-${index}`} className="pt-2 text-xl font-semibold text-slate-900">
                      {block}
                    </h3>
                  ) : (
                    <p key={`wb-${index}`} className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {block}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Next step</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            For linked doctrine references and implementation notes, continue to the Insights library.
          </p>
          <Link
            href={`/${locale}${copy.ctaHref}`}
            className="mt-5 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            {copy.ctaLabel}
          </Link>
        </section>
      </main>
    </div>
  );
}