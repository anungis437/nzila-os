import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import PortfolioExplorer from '@/components/public/PortfolioExplorer';
import TrackedLink from '@/components/public/TrackedLink';
import type { Locale } from '@/lib/locales';

const metaByLocale = {
  'en-CA': {
    title: 'Portfolio',
    description: 'Explore the Nzila Ventures product portfolio by name and sector, with a clear distinction between institutional product journeys and initiatives under exploration.',
  },
  'fr-CA': {
    title: 'Portefeuille',
    description: 'Explorez le portefeuille de produits de Nzila Ventures par nom et par secteur, en distinguant clairement les parcours institutionnels des initiatives en exploration.',
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return { ...(metaByLocale[locale] ?? metaByLocale['en-CA']), alternates: { canonical: '/portfolio' } };
}

export default async function PortfolioPage() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <section className="relative isolate overflow-hidden bg-[#080e1c] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-[32rem] w-[32rem] rounded-full bg-blue-500/20 blur-[110px]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-36 sm:px-6 lg:px-8 lg:pb-24 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#dfbe70]">
            {isFr ? 'Studio de produits' : 'Product studio'}
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl">
            {isFr ? 'Le portefeuille Nzila.' : 'The Nzila portfolio.'}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            {isFr
              ? 'Explorer les domaines dans lesquels Nzila Ventures conçoit, expérimente et développe des logiciels. Chaque initiative suit son propre parcours de validation, de gouvernance et de commercialisation.'
              : 'Explore the domains where Nzila Ventures designs, explores and develops software. Each initiative has its own validation, governance and commercial journey.'}
          </p>
          <p className="mt-7 max-w-3xl border-l-2 border-white/20 pl-4 text-sm leading-7 text-slate-400">
            {isFr
              ? 'Une fiche de portefeuille ne constitue pas une annonce de disponibilité en production, une certification ou une preuve d’adoption commerciale.'
              : 'A portfolio listing does not establish production availability, certification, customer adoption or validated outcomes.'}
          </p>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:px-8">
          <article className="rounded-2xl border border-slate-200 bg-[#f6f8fb] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? 'Produit phare' : 'Flagship product'}</p>
            <h2 className="mt-3 text-2xl font-semibold text-navy">Union Eyes</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {isFr ? 'Parcours de continuité pour les organisations syndicales, actuellement en validation pilote.' : 'Continuity-focused union operations, currently in pilot validation.'}
            </p>
            <TrackedLink href="/union-eyes" eventName="portfolio_union_eyes" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-electric hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
              {isFr ? 'Explorer Union Eyes' : 'Explore Union Eyes'} <span aria-hidden="true" className="ml-2">→</span>
            </TrackedLink>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-[#f6f8fb] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? 'Initiative institutionnelle' : 'Institutional initiative'}</p>
            <h2 className="mt-3 text-2xl font-semibold text-navy">CIVIC</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {isFr ? 'Continuité et modernisation du service public, actuellement au stade de la découverte et des présentations.' : 'Public-service continuity and modernization, currently in discovery and briefing.'}
            </p>
            <TrackedLink href="/public-service" eventName="portfolio_civic" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-electric hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
              {isFr ? 'Explorer CIVIC' : 'Explore CIVIC'} <span aria-hidden="true" className="ml-2">→</span>
            </TrackedLink>
          </article>
        </div>
      </section>

      <section className="py-20 sm:py-24" id="catalogue">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">{isFr ? 'Explorer les initiatives' : 'Explore the initiatives'}</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">
            {isFr ? 'Trouver un domaine d’intérêt.' : 'Find a domain of interest.'}
          </h2>
          <p className="mt-5 mb-9 max-w-3xl text-base leading-8 text-slate-600">
            {isFr
              ? 'Filtrez les initiatives par nom ou secteur. Pour connaître la portée réelle, les dépendances ou la disponibilité d’un produit, veuillez communiquer avec notre équipe.'
              : 'Filter initiatives by name or sector. Contact our team for confirmed scope, dependencies and availability of any individual product.'}
          </p>
          <PortfolioExplorer locale={locale} />
        </div>
      </section>

      <section className="bg-[#101a2c] py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {isFr ? 'Discutons du besoin avant de choisir une solution.' : 'Discuss the need before choosing a solution.'}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300">
            {isFr
              ? 'Nous pouvons distinguer ensemble les fonctionnalités disponibles, les capacités pilotes et les orientations encore exploratoires.'
              : 'We can clarify the difference between available capabilities, pilot work and exploratory directions for your organization.'}
          </p>
          <TrackedLink href="/contact?interest=portfolio" eventName="portfolio_contact" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-7 py-3 text-sm font-bold text-navy hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {isFr ? 'Communiquer avec nous' : 'Get in touch'} <span aria-hidden="true" className="ml-2">↗</span>
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
