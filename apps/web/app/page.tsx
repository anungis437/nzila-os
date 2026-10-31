import type { Metadata } from 'next';
import HumanCenteredAI from '@/components/public/HumanCenteredAI';
import { getLocale } from 'next-intl/server';
import ScrollReveal from '@/components/public/ScrollReveal';
import HomeExperience from '@/components/public/HomeExperience';
import TrustStrip from '@/components/public/TrustStrip';
import ProofLedger from '@/components/public/ProofLedger';
import { BuildingLibraryIcon, CubeTransparentIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import TechStackBar from '@/components/public/TechStackBar';
import InvestorCTA from '@/components/public/InvestorCTA';
import SectionDivider from '@/components/public/SectionDivider';
import TrackedLink from '@/components/public/TrackedLink';
import type { Locale } from '@/lib/locales';

export async function generateMetadata(): Promise<Metadata> {
  const isFr = (await getLocale()) === 'fr-CA';
  const description = isFr
    ? 'Nzila Ventures conçoit des logiciels centrés sur l’humain pour préserver la mémoire institutionnelle et relier les décisions à des preuves. Découvrez Union Eyes et CIVIC.'
    : 'Nzila Ventures builds human-centered software to preserve institutional knowledge and keep decisions accountable. Discover Union Eyes for unions and CIVIC for public institutions.';
  return {
    title: isFr ? 'Logiciels pensés pour les personnes et les institutions' : 'Human-Centered Software for Institutions',
    description,
    openGraph: {
      title: isFr ? 'Nzila Ventures | Des logiciels au service des personnes' : 'Nzila Ventures | Software That Keeps People in Control',
      description,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Nzila Ventures — Human-centered institutional software' }],
    },
    alternates: { canonical: '/' },
  };
}

const verticals = [
  { name: 'Fintech', description: 'Financial services and planning' },
  { name: 'Agrotech', description: 'Agriculture and supply chains' },
  { name: 'Uniontech', description: 'Union representation and operations' },
  { name: 'Legaltech', description: 'Justice and legal workflows' },
  { name: 'EdTech', description: 'Research and learning' },
  { name: 'Entertainment', description: 'Creative and cultural operations' },
  { name: 'Commerce', description: 'Trade and business operations' },
  { name: 'Healthtech', description: 'Care and wellbeing' },
  { name: 'Insurtech', description: 'Insurance and governance' },
  { name: 'Justice', description: 'Access, equity and accountability' },
];

const intelligenceCapabilities = [
  { name: 'Operational Memory', description: 'Procedures, precedents and decisions retain the context needed for the next responsible person.' },
  { name: 'Governance Evidence', description: 'Ownership, approvals and rationale stay connected to reviewable records.' },
  { name: 'Explainable Assistance', description: 'AI can support human reviews while preserving uncertainty, inspection and override.' },
  { name: 'Sovereign Coordination', description: 'Organizations can cooperate without erasing their distinct responsibilities and access boundaries.' },
];

const verticalDescriptionFr: Record<string, string> = {
  Fintech: 'Banque, paiements, assurance',
  Agrotech: 'Gestion agricole, chaine logistique',
  Uniontech: 'Droits du travail, gestion syndicale',
  Legaltech: 'Gestion des dossiers et outils juridiques',
  EdTech: 'Apprentissage, formation, certification',
  Entertainment: 'Streaming et plateformes de contenu',
  Commerce: 'Opérations commerciales, devis et logistique',
  Healthtech: 'Soins, bien-etre, cognition',
  Insurtech: 'Arbitrage et soutien a la souscription',
  Justice: 'Plaidoyer et formation DEI',
};

const intelligenceFr: Record<string, { name: string; description: string }> = {
  'Operational Memory': {
    name: 'Mémoire opérationnelle',
    description: 'Procédures, précédents et décisions gardent le contexte nécessaire à la relève.',
  },
  'Governance Evidence': {
    name: 'Preuves de gouvernance',
    description: 'Responsables, approbations et motifs restent associés à des dossiers consultables.',
  },
  'Explainable Assistance': {
    name: 'Assistance explicable',
    description: 'L’IA peut soutenir les examens humains tout en préservant l’incertitude, l’inspection et la révision.',
  },
  'Sovereign Coordination': {
    name: 'Coordination souveraine',
    description: 'Les organisations peuvent collaborer tout en préservant leurs responsabilités et limites d’accès.',
  },
};

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  const isFr = locale === 'fr-CA';

  return (
    <main className="min-h-screen">
      {/* Product-led homepage hero and interactive journey introduction */}
      <HomeExperience isFr={isFr} />
      <TrustStrip isFr={isFr} />

      {/* Two routes into the same governed operating architecture. */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">
              {isFr ? 'Pour commencer' : 'Where to start'}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-navy md:text-5xl">
              {isFr ? 'Commencez par le problème que vous connaissez.' : 'Start with the problem you recognize.'}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              {isFr
                ? 'Vous pouvez d’abord examiner vos risques de continuité ou vous concentrer sur un processus opérationnel à sécuriser.'
                : 'You can begin by understanding your continuity risks or by stabilizing the operational work that needs attention now.'}
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-7 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? 'Parcours stratégique' : 'Strategic starting point'}</p>
              <h3 className="mt-3 text-2xl font-semibold text-navy">
                {isFr ? 'Où notre continuité est-elle fragile?' : 'Where is our continuity fragile?'}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {isFr
                  ? 'Explorer les dépendances aux personnes, les pertes de contexte, les décisions sans trace et les risques de transition.'
                  : 'Examine reliance on individual knowledge, missing decision context, handoff risks and gaps in governance evidence.'}
              </p>
              <TrackedLink href="/continuity-assessment" eventName="home_path_continuity" className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-electric hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
                {isFr ? 'Explorer l’évaluation' : 'Explore the assessment'} <span aria-hidden="true" className="ml-2">→</span>
              </TrackedLink>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-7 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? 'Parcours opérationnel' : 'Operational starting point'}</p>
              <h3 className="mt-3 text-2xl font-semibold text-navy">
                {isFr ? 'Comment préserver le suivi du travail?' : 'How do we keep operational work connected?'}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {isFr
                  ? 'Découvrir un parcours concret de suivi des dossiers, de transfert des responsabilités et de préservation des preuves.'
                  : 'Explore a concrete journey through case continuity, responsibility handoffs and evidence-aware operations.'}
              </p>
              <TrackedLink href="/union-eyes" eventName="home_path_operations" className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-electric hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
                {isFr ? 'Explorer Union Eyes' : 'Explore Union Eyes'} <span aria-hidden="true" className="ml-2">→</span>
              </TrackedLink>
            </article>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ MISSION ═══════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal direction="left">
              <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-electric/10 text-electric mb-4">
                {isFr ? 'Le problème' : 'The Problem'}
              </span>
              <h2 className="text-3xl md:text-5xl font-bold text-navy mb-6">
                {isFr ? 'La gouvernance devient fragile quand ' : 'Governance becomes fragile when '}<span className="text-electric">{isFr ? 'la mémoire opérationnelle disparaît' : 'operational memory disappears'}</span>
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                {isFr
                  ? 'La plupart des institutions dépendent de quelques personnes qui se souviennent des décisions, des précédents, des relations et des exceptions. Quand ces personnes partent, l organisation perd plus que du temps: elle perd du contexte, de la confiance et de la capacité de gouverner.'
                  : 'Most institutions depend on a few people who remember the decisions, precedents, relationships, and exceptions. When those people leave, the organization loses more than time: it loses context, trust, and the ability to govern consistently.'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {(isFr
                  ? ['Mémoire opérationnelle', 'Gouvernance visible', 'Preuves auditables', 'Souveraineté des données']
                  : ['Operational Memory', 'Visible Governance', 'Auditable Evidence', 'Data Sovereignty']).map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-electric" />
                    <span className="text-sm font-medium text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>

            <ScrollReveal direction="right">
              <div className="rounded-3xl border border-slate-200 bg-[#101a2c] p-6 shadow-[0_25px_70px_rgba(8,14,28,0.16)] sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dfbe70]">
                  {isFr ? 'À préserver lors d’une transition' : 'What should survive a transition'}
                </p>
                <div className="mt-7 space-y-5">
                  {[
                    {
                      index: '01',
                      title: isFr ? 'Le contexte' : 'The context',
                      description: isFr ? 'Pourquoi une décision a été prise' : 'Why a decision was made',
                    },
                    {
                      index: '02',
                      title: isFr ? 'Les responsabilités' : 'The ownership',
                      description: isFr ? 'Qui doit agir et qui peut consulter' : 'Who acts, and who has authorized access',
                    },
                    {
                      index: '03',
                      title: isFr ? 'Les preuves' : 'The evidence',
                      description: isFr ? 'Ce qui permet de vérifier la suite' : 'What the next team can verify',
                    },
                  ].map((item) => (
                    <div key={item.index} className="flex items-start gap-4 border-b border-white/10 pb-5 last:border-0 last:pb-0">
                      <span className="rounded-lg border border-white/15 px-2.5 py-2 text-xs font-semibold text-[#dfbe70]">{item.index}</span>
                      <div>
                        <h3 className="font-semibold text-white">{item.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-8 rounded-xl bg-white/5 px-4 py-3 text-sm leading-relaxed text-slate-300">
                  {isFr ? 'Le savoir institutionnel ne devrait pas dépendre d’une seule personne.' : 'Institutional continuity should not depend on one person remembering everything.'}
                </p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal className="mt-12">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <TrackedLink
                href="/organizational-continuity"
                eventName="cta_organizational_continuity"
                eventProps={{ source: 'home_mission' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-lg shadow-lg shadow-electric/30 btn-press"
              >
                {isFr ? 'Comprendre la continuité' : 'Understand Continuity'}
              </TrackedLink>
              <TrackedLink
                href="/starter-kit"
                eventName="cta_starter_kit"
                eventProps={{ source: 'home_mission' }}
                className="inline-flex items-center justify-center px-8 py-4 bg-navy text-white font-bold rounded-xl border border-navy hover:bg-navy-light transition-all text-lg btn-press"
              >
                {isFr ? 'Kit de démarrage' : 'Get the Starter Kit'}
              </TrackedLink>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Priority product paths are explicit; portfolio maturity is not implied. */}
      <section className="bg-[#f6f8fb] py-24" id="solutions">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-electric">
              {isFr ? 'Nos solutions' : 'Our solutions'}
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-navy md:text-5xl">
              {isFr ? 'Une architecture commune. Des réalités institutionnelles distinctes.' : 'Shared foundations. Different institutional realities.'}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
              {isFr
                ? 'Union Eyes et CIVIC abordent des enjeux concrets avec des parcours adaptés. Les autres initiatives du portefeuille ont leur propre portée et niveau de maturité.'
                : 'Union Eyes and CIVIC address specific institutional challenges through distinct journeys. Other portfolio initiatives have their own scope and maturity.'}
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-lg sm:p-8">
              <span aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric/10 text-electric"><UserGroupIcon className="h-6 w-6" /></span>
              <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? 'Organisations syndicales' : 'Labour organizations'}</p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight text-navy">Union Eyes</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">
                {isFr
                  ? 'Protéger la continuité des dossiers, les transitions de représentation et la mémoire opérationnelle du syndicat.'
                  : 'Preserve case history, representative handoffs and union operational memory across transitions.'}
              </p>
              <p className="mt-7 text-xs font-semibold text-slate-500">{isFr ? 'Parcours de validation pilote' : 'Pilot-validation journey'}</p>
              <TrackedLink href="/union-eyes" eventName="home_solution_union_eyes" className="mt-4 inline-flex min-h-11 items-center self-start text-sm font-bold text-electric underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
                {isFr ? 'Explorer Union Eyes' : 'Explore Union Eyes'} <span aria-hidden="true" className="ml-2">→</span>
              </TrackedLink>
            </article>

            <article className="flex flex-col rounded-3xl border border-slate-200 bg-[#101a2c] p-7 shadow-lg sm:p-8">
              <span aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#dfbe70]"><BuildingLibraryIcon className="h-6 w-6" /></span>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#dfbe70]">{isFr ? 'Institutions publiques' : 'Public institutions'}</p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight text-white">CIVIC</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-slate-300">
                {isFr
                  ? 'Relier les engagements, les responsables, les preuves et les décisions au fil des programmes de modernisation.'
                  : 'Connect commitments, accountable owners, evidence and decisions across modernization initiatives.'}
              </p>
              <p className="mt-7 text-xs font-semibold text-slate-400">{isFr ? 'Présentations et découverte' : 'Briefings and discovery'}</p>
              <TrackedLink href="/public-service" eventName="home_solution_civic" className="mt-4 inline-flex min-h-11 items-center self-start text-sm font-bold text-[#dfbe70] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {isFr ? 'Explorer CIVIC' : 'Explore CIVIC'} <span aria-hidden="true" className="ml-2">→</span>
              </TrackedLink>
            </article>

            <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-lg sm:p-8">
              <span aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-electric/10 text-electric"><CubeTransparentIcon className="h-6 w-6" /></span>
              <p className="text-xs font-semibold uppercase tracking-wider text-electric">{isFr ? 'Fondation gouvernée' : 'Governed foundation'}</p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight text-navy">Nzila OS</h3>
              <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">
                {isFr
                  ? 'Identité, isolation des données, politiques, preuves et observabilité partagées entre les applications gouvernées de Nzila.'
                  : 'Shared identity, data isolation, policy, evidence and observability across Nzila’s governed applications.'}
              </p>
              <p className="mt-7 text-xs font-semibold text-slate-500">{isFr ? 'Aperçu de la plateforme' : 'Platform overview'}</p>
              <TrackedLink href="/platform" eventName="home_solution_platform" className="mt-4 inline-flex min-h-11 items-center self-start text-sm font-bold text-electric underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
                {isFr ? 'Découvrir la plateforme' : 'Explore the platform'} <span aria-hidden="true" className="ml-2">→</span>
              </TrackedLink>
            </article>
          </div>
          <p className="mt-8 text-sm text-slate-600">
            {isFr ? 'Vous cherchez autre chose ? ' : 'Looking for something else? '}
            <TrackedLink href="/products" eventName="home_solution_all_products" className="font-bold text-electric underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
              {isFr ? 'Voir tous les produits et leur maturité' : 'See every product and its maturity'}
            </TrackedLink>
          </p>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* Durable infrastructure principles without stock-photo simulations. */}
      <section className="relative overflow-hidden bg-[#101a2c] py-20 text-white sm:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute right-[-10rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-electric/15 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#dfbe70]">
            {isFr ? 'Notre fondation' : 'Our foundation'}
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
            {isFr ? 'Des systèmes conçus pour préserver le contexte.' : 'Systems designed to keep the context.'}
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            {isFr
              ? 'La continuité n’est pas une promesse de tableau de bord. Elle exige des responsabilités claires, des preuves consultables et une gouvernance adaptée.'
              : 'Continuity is not a dashboard promise. It takes clear ownership, reviewable records and governance suited to the people involved.'}
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {intelligenceCapabilities.map((cap, index) => (
              <ScrollReveal key={cap.name} delay={index * 0.08}>
                <article className="h-full rounded-2xl border border-white/15 bg-white/[0.045] p-7">
                  <p className="text-xs font-semibold tracking-wider text-[#dfbe70]">{String(index + 1).padStart(2, '0')}</p>
                  <h3 className="mt-5 text-2xl font-semibold text-white">
                    {isFr ? (intelligenceFr[cap.name]?.name ?? cap.name) : cap.name}
                  </h3>
                  <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
                    {isFr ? (intelligenceFr[cap.name]?.description ?? cap.description) : cap.description}
                  </p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sector interests lead to a clearly scoped portfolio, not to claims of market deployment. */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">
            {isFr ? 'Domaines d’exploration' : 'Areas of exploration'}
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">
            {isFr ? 'Des enjeux distincts. Un souci commun de continuité.' : 'Different challenges. A shared concern for continuity.'}
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
            {isFr
              ? 'Notre portefeuille explore plusieurs domaines. Les secteurs ci-dessous ne constituent pas des références clients ni des affirmations de disponibilité commerciale.'
              : 'Our portfolio explores several domains. These sectors are not customer references or claims of commercial availability.'}
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {verticals.map((vertical) => (
              <article key={vertical.name} className="rounded-2xl border border-slate-200 bg-[#f6f8fb] p-5">
                <h3 className="text-base font-semibold text-navy">{vertical.name}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {isFr ? (verticalDescriptionFr[vertical.name] ?? vertical.description) : vertical.description}
                </p>
              </article>
            ))}
          </div>
          <TrackedLink href="/portfolio" eventName="home_sector_portfolio" className="mt-9 inline-flex min-h-11 items-center text-sm font-bold text-electric hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
            {isFr ? 'Explorer les initiatives' : 'Explore the initiatives'} <span aria-hidden="true" className="ml-2">→</span>
          </TrackedLink>
        </div>
      </section>

      <SectionDivider variant="glow" />

      <HumanCenteredAI isFr={isFr} />

      <ProofLedger isFr={isFr} />

      {/* ═══════════════════════ TECH STACK ═══════════════════════ */}
      <section className="py-16 bg-white">
        <TechStackBar />
      </section>

      {/* ═══════════════════════ INVESTOR / PARTNER CTA ═══════════════════════ */}
      <InvestorCTA />
    </main>
  );
}
