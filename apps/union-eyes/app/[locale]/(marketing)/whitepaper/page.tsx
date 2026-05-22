import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, FileText, ShieldCheck } from 'lucide-react';

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
    subtitle: 'What this whitepaper covers',
    ctaLabel: 'Read Insights Library',
    ctaHref: '/insights',
    sections: [
      {
        title: 'Institutional continuity model',
        body: 'How UnionEyes protects organizational memory, governance context, and representational continuity through leadership turnover and operational drift.',
      },
      {
        title: 'Deterministic AI governance',
        body: 'Why report assistance is deterministic, review-gated, and audit-aware. No free-form generative output enters official report surfaces without explicit approval.',
      },
      {
        title: 'Procurement and trust controls',
        body: 'Implementation controls for transparency, explainability, sovereignty-conscious deployment, and evidentiary defensibility in public-trust environments.',
      },
    ],
    highlights: [
      'Doctrine-bound operational intelligence',
      'Approved-only AI-assisted report rendering',
      'Audit trail and governance lifecycle enforcement',
    ],
  },
  'fr-CA': {
    title: 'Livre blanc UnionEyes | Infrastructure de continuite institutionnelle',
    description:
      'Le livre blanc UnionEyes presente le modele de continuite institutionnelle, les limites de gouvernance, la doctrine IA deterministe et les controles de deploiement pour les organisations syndicales.',
    heading: 'Livre blanc UnionEyes',
    heroDescription:
      'Une note technique executive sur l architecture de continuite institutionnelle, les limites d IA gouvernee et les garanties operationnelles pour la direction syndicale.',
    subtitle: 'Contenu du livre blanc',
    ctaLabel: 'Consulter la bibliotheque Perspectives',
    ctaHref: '/insights',
    sections: [
      {
        title: 'Modele de continuite institutionnelle',
        body: 'Comment UnionEyes protege la memoire organisationnelle, le contexte de gouvernance et la continuite de representation lors des transitions de direction et de la derive operationnelle.',
      },
      {
        title: 'Gouvernance IA deterministe',
        body: 'Pourquoi l assistance aux rapports est deterministe, soumise a une revision humaine et auditable. Aucun texte generatif libre n entre dans les surfaces officielles sans approbation explicite.',
      },
      {
        title: 'Controles de confiance et d approvisionnement',
        body: 'Controles de mise en oeuvre pour la transparence, l explicabilite, le deploiement conscient de la souverainete et la defensibilite des preuves en contexte de confiance publique.',
      },
    ],
    highlights: [
      'Intelligence operationnelle liee a la doctrine',
      'Rendu de rapports assistes par IA uniquement apres approbation',
      'Piste d audit et cycle de gouvernance appliques',
    ],
  },
} as const;

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
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {copy.sections.map((section) => (
              <article key={section.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{section.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-center gap-2 text-blue-800">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Governance highlights</h3>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-blue-900">
              {copy.highlights.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Next step</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              For full doctrine references and implementation notes, continue to the Insights library where governance and continuity publications are maintained.
            </p>
            <Link
              href={`/${locale}${copy.ctaHref}`}
              className="mt-5 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              {copy.ctaLabel}
            </Link>
          </article>
        </section>
      </main>
    </div>
  );
}