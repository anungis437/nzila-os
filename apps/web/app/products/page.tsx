import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import TrackedLink from '@/components/public/TrackedLink';
import type { Locale } from '@/lib/locales';

const metaByLocale = {
  'en-CA': {
    title: 'Products',
    description: 'Discover Nzila Ventures product experiences: Union Eyes for labour organizations, CIVIC for institutional continuity, and the broader Nzila product portfolio.',
  },
  'fr-CA': {
    title: 'Produits',
    description: 'Découvrez les expériences produit de Nzila Ventures : Union Eyes pour les organisations syndicales, CIVIC pour la continuité institutionnelle et le portefeuille Nzila.',
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return { ...(metaByLocale[locale] ?? metaByLocale['en-CA']), alternates: { canonical: '/products' } };
}

const copy = {
  'en-CA': {
    eyebrow: 'Product experiences',
    title: 'Software shaped around the work that matters.',
    intro: 'Nzila Ventures is a product studio. We develop distinct experiences for different institutional and operational needs, grounded in continuity, governed workflows and human accountability.',
    foundationTag: 'How the portfolio fits',
    foundationTitle: 'One studio. Distinct product journeys.',
    foundation: 'Nzila Ventures is the company. Nzila OS is the engineering and governance foundation. Each product has its own users, boundaries, maturity and commercial path.',
    entries: [
      {
        name: 'Union Eyes',
        audience: 'For labour organizations',
        title: 'Keep member support connected.',
        description: 'Explore a continuity-oriented approach to intake, stewardship, case handoffs, deadlines and evidence management.',
        phase: 'Flagship · Pilot validation',
        href: '/union-eyes',
        cta: 'Explore Union Eyes',
        tone: 'gold',
      },
      {
        name: 'CIVIC',
        audience: 'For public institutions',
        title: 'Make modernization accountable.',
        description: 'Explore how institutional commitments, responsibilities, evidence and human review can remain connected through change.',
        phase: 'Discovery · Institutional briefings',
        href: '/public-service',
        cta: 'Explore CIVIC',
        tone: 'blue',
      },
    ],
    portfolioTag: 'The wider portfolio',
    portfolioTitle: 'Explore beyond the first two doors.',
    portfolioBody: 'Nzila also develops and explores initiatives across sport, justice, research, finance, care, creative industries and commerce. Listing an initiative does not imply commercial or production availability.',
    portfolioCta: 'Browse the portfolio',
    conversationTitle: 'Start with your organization, not a software catalogue.',
    conversationBody: 'We can discuss your operational needs and identify whether a product journey, pilot or exploratory conversation makes sense.',
    conversationCta: 'Start a conversation',
  },
  'fr-CA': {
    eyebrow: 'Expériences produits',
    title: 'Des logiciels conçus pour le travail qui compte.',
    intro: 'Nzila Ventures est un studio de produits. Nous concevons des expériences distinctes pour différents besoins institutionnels et opérationnels, fondées sur la continuité, la gouvernance et la responsabilité humaine.',
    foundationTag: 'L’architecture du portefeuille',
    foundationTitle: 'Un studio. Des parcours distincts.',
    foundation: 'Nzila Ventures est la société. Nzila OS forme le socle d’ingénierie et de gouvernance. Chaque produit a ses propres utilisateurs, limites, niveau de maturité et parcours commercial.',
    entries: [
      {
        name: 'Union Eyes',
        audience: 'Pour les organisations syndicales',
        title: 'Relier l’accompagnement des membres.',
        description: 'Explorer une approche de continuité pour l’accueil, la représentation, les transferts de dossiers, les échéances et les preuves.',
        phase: 'Produit phare · Validation pilote',
        href: '/union-eyes',
        cta: 'Découvrir Union Eyes',
        tone: 'gold',
      },
      {
        name: 'CIVIC',
        audience: 'Pour les institutions publiques',
        title: 'Rendre la modernisation responsable.',
        description: 'Explorer comment relier engagements institutionnels, responsabilités, preuves et examens humains pendant le changement.',
        phase: 'Découverte · Présentations institutionnelles',
        href: '/public-service',
        cta: 'Découvrir CIVIC',
        tone: 'blue',
      },
    ],
    portfolioTag: 'Le portefeuille élargi',
    portfolioTitle: 'Explorer les autres parcours.',
    portfolioBody: 'Nzila développe et explore également des initiatives dans le sport, la justice, la recherche, la finance, les soins, les industries créatives et le commerce. Leur présence ici ne garantit ni leur disponibilité commerciale ni leur déploiement en production.',
    portfolioCta: 'Parcourir le portefeuille',
    conversationTitle: 'Commencer par votre organisation, pas par un catalogue.',
    conversationBody: 'Nous pouvons examiner vos besoins opérationnels et déterminer si un parcours produit, un pilote ou une conversation exploratoire convient.',
    conversationCta: 'Échanger avec nous',
  },
} as const;

export default async function ProductsPage() {
  const locale = (await getLocale()) as Locale;
  const c = copy[locale] ?? copy['en-CA'];

  return (
    <main className="min-h-screen bg-white">
      <section className="relative isolate overflow-hidden bg-[#080e1c] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-10 h-[30rem] w-[30rem] rounded-full bg-violet/20 blur-[110px]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-36 sm:px-6 lg:px-8 lg:pb-24 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#dfbe70]">{c.eyebrow}</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.07] tracking-[-0.045em] sm:text-6xl lg:text-7xl">{c.title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">{c.intro}</p>
          <div className="mt-10 grid gap-4 border-t border-white/15 pt-7 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#dfbe70]">Nzila Ventures</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{locale === 'fr-CA' ? 'Société et vision' : 'The company and its vision'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#dfbe70]">Nzila OS</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{locale === 'fr-CA' ? 'Socle technique et gouvernance' : 'Engineering and governance foundation'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#dfbe70]">{locale === 'fr-CA' ? 'Produits' : 'Products'}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{locale === 'fr-CA' ? 'Parcours adaptés aux besoins' : 'Distinct user and buyer journeys'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f8fb] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">{c.foundationTag}</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.foundationTitle}</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{c.foundation}</p>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {c.entries.map((entry) => (
              <article key={entry.name} className={entry.tone === 'gold'
                ? 'flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9'
                : 'flex flex-col rounded-3xl border border-white/10 bg-[#101a2c] p-7 text-white shadow-lg sm:p-9'}>
                <p className={entry.tone === 'gold'
                  ? 'text-xs font-semibold uppercase tracking-wider text-electric'
                  : 'text-xs font-semibold uppercase tracking-wider text-[#dfbe70]'}>{entry.audience}</p>
                <h3 className={entry.tone === 'gold' ? 'mt-6 text-4xl font-semibold text-navy' : 'mt-6 text-4xl font-semibold text-white'}>{entry.name}</h3>
                <p className={entry.tone === 'gold'
                  ? 'mt-2 text-2xl font-medium tracking-tight text-navy'
                  : 'mt-2 text-2xl font-medium tracking-tight text-white'}>{entry.title}</p>
                <p className={entry.tone === 'gold'
                  ? 'mt-5 flex-1 text-base leading-8 text-slate-600'
                  : 'mt-5 flex-1 text-base leading-8 text-slate-300'}>{entry.description}</p>
                <p className={entry.tone === 'gold'
                  ? 'mt-8 text-xs font-semibold text-slate-500'
                  : 'mt-8 text-xs font-semibold text-slate-400'}>{entry.phase}</p>
                <TrackedLink
                  href={entry.href}
                  eventName="products_primary_detail"
                  eventProps={{ product: entry.name }}
                  className={entry.tone === 'gold'
                    ? 'mt-4 inline-flex min-h-11 items-center self-start text-sm font-bold text-electric hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric'
                    : 'mt-4 inline-flex min-h-11 items-center self-start text-sm font-bold text-[#dfbe70] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'}
                >
                  {entry.cta} <span aria-hidden="true" className="ml-2">→</span>
                </TrackedLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 py-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">{c.portfolioTag}</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-navy md:text-4xl">{c.portfolioTitle}</h2>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{c.portfolioBody}</p>
            </div>
            <TrackedLink href="/portfolio" eventName="products_portfolio" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white hover:bg-navy-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">{c.portfolioCta} <span aria-hidden="true" className="ml-2">→</span></TrackedLink>
          </div>
        </div>
      </section>

      <section className="bg-[#101a2c] py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{c.conversationTitle}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">{c.conversationBody}</p>
          <TrackedLink href="/contact?interest=portfolio" eventName="products_contact" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-7 py-3 text-sm font-bold text-navy hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.conversationCta} <span aria-hidden="true" className="ml-2">↗</span></TrackedLink>
        </div>
      </section>
    </main>
  );
}
