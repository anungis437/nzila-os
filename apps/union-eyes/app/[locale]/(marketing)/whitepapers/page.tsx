import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { WHITEPAPER_LIBRARY } from '@/lib/whitepaper/library';

const HUB_COPY = {
  'en-CA': {
    title: 'Whitepapers | UnionEyes',
    description:
      'The UnionEyes whitepaper library: Organizational Continuity Infrastructure (OCI), the OCI Method canonical authority, the methodology companion, and the operational-reality edition of the Continuity Gap.',
    heading: 'Whitepapers',
    heroDescription:
      'Doctrinal whitepapers on Organizational Continuity Infrastructure, the OCI Method, and the operational reality from which the category emerged.',
    introHeading: 'A library, not a single document',
    introBody:
      'The continuity category surfaced from operational work and was hardened through methodology. This library presents the four documents that together establish OCI / OCRA as a defensible, procurement-grade discipline.',
    readingLabel: 'Read',
  },
  'fr-CA': {
    title: 'Livres blancs | UnionEyes',
    description:
      'La bibliotheque de livres blancs UnionEyes : Infrastructure de continuite organisationnelle (OCI), autorite canonique de la methode OCI, livre blanc compagnon de la methode et edition de realite operationnelle de l ecart de continuite.',
    heading: 'Livres blancs',
    heroDescription:
      'Livres blancs doctrinaux sur l Infrastructure de continuite organisationnelle, la methode OCI et la realite operationnelle d ou la categorie a emerge.',
    introHeading: 'Une bibliotheque, pas un seul document',
    introBody:
      'La categorie de continuite a emerge du travail operationnel et a ete renforcee par la methodologie. Cette bibliotheque presente les quatre documents qui etablissent ensemble OCI / OCRA comme une discipline defendable et qualifiee pour l approvisionnement.',
    readingLabel: 'Lire',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = HUB_COPY[locale as keyof typeof HUB_COPY] ?? HUB_COPY['en-CA'];
  return {
    title: copy.title,
    description: copy.description,
    alternates: buildLocaleAlternates(locale, '/whitepapers'),
  };
}

export default async function WhitepapersHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = HUB_COPY[locale as keyof typeof HUB_COPY] ?? HUB_COPY['en-CA'];

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#0f2133]">
        <img
          aria-hidden="true"
          src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1920&q=80&auto=format"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#0f2133]/85 via-[#123451]/75 to-[#0f2133]/90"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
              Nzila OS Research Initiative
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-white drop-shadow-md sm:text-5xl lg:text-6xl">
              {copy.heading}
            </h1>
            <p className="mt-4 text-base text-white/90 drop-shadow sm:text-lg lg:text-xl">
              {copy.heroDescription}
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1f5b84]">
            {copy.introHeading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-700 sm:text-lg">
            {copy.introBody}
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8">
        <ul className="grid gap-6 lg:grid-cols-2">
          {WHITEPAPER_LIBRARY.map((entry) => (
            <li
              key={entry.slug}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <Link href={`/${locale}${entry.href}`} className="block">
                <div className="relative h-44 w-full overflow-hidden">
                  <Image
                    src={entry.heroImage}
                    alt={entry.heroAlt}
                    fill
                    sizes="(min-width: 1024px) 600px, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f2133]/80 via-[#0f2133]/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 px-5 py-3">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/80">
                      {entry.format} · {entry.version}
                    </p>
                  </div>
                </div>
              </Link>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl">
                    <Link href={`/${locale}${entry.href}`} className="hover:text-[#1f5b84]">
                      {entry.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{entry.subtitle}</p>
                </div>
                <p className="text-sm leading-7 text-slate-700">{entry.abstract}</p>
                <ul className="mt-1 grid gap-2 text-xs leading-5 text-slate-700">
                  {entry.abstractCallouts.map((point) => (
                    <li
                      key={point}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs font-medium text-slate-500">{entry.readingTime}</span>
                  <Link
                    href={`/${locale}${entry.href}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f5b84] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#163f5e]"
                  >
                    {copy.readingLabel}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
