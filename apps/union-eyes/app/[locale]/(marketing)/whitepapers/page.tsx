import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { buildLocaleAlternates } from '@/lib/marketing-seo';
import {
  WHITEPAPER_LIBRARY,
  getWhitepaperLocaleContent,
} from '@/lib/whitepaper/library';

const HUB_COPY = {
  'en-CA': {
    title: 'Whitepapers | UnionEyes',
    description:
      'Read the UnionEyes whitepaper library: what continuity is, why it matters, and how teams can apply it in real operations.',
    heading: 'Whitepapers',
    heroDescription:
      'Clear, practical whitepapers on continuity, governance, and real-world operations.',
    introHeading: 'A library, not one document',
    introBody:
      'Each paper covers a different angle: the idea, the method, and the day-to-day use.',
    readingLabel: 'Read',
  },
  'fr-CA': {
    title: 'Livres blancs | UnionEyes',
    description:
      'La bibliotheque de livres blancs UnionEyes explique simplement la continuite, son importance, et son application sur le terrain.',
    heading: 'Livres blancs',
    heroDescription:
      'Des livres blancs clairs et concrets sur la continuite, la gouvernance et les operations reelles.',
    introHeading: 'Une bibliothèque, pas un seul document',
    introBody:
      'Chaque document couvre un angle précis: l’idée, la méthode et l’usage au quotidien.',
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
          {WHITEPAPER_LIBRARY.map((entry) => {
            const entryCopy = getWhitepaperLocaleContent(entry, locale);

            return (
              <li
                key={entry.slug}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <Link href={`/${locale}${entry.href}`} className="block">
                  <div className="relative h-44 w-full overflow-hidden">
                    <Image
                      src={entry.heroImage}
                      alt={entryCopy.heroAlt}
                      fill
                      sizes="(min-width: 1024px) 600px, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f2133]/80 via-[#0f2133]/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 px-5 py-3">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/80">
                        {entryCopy.format} · {entry.version}
                      </p>
                    </div>
                  </div>
                </Link>
                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl">
                      <Link href={`/${locale}${entry.href}`} className="hover:text-[#1f5b84]">
                        {entryCopy.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{entryCopy.subtitle}</p>
                  </div>
                  <p className="text-sm leading-7 text-slate-700">{entryCopy.abstract}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs font-medium text-slate-500">
                      {entryCopy.readingTime}
                    </span>
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
            );
          })}
        </ul>
      </main>
    </div>
  );
}
