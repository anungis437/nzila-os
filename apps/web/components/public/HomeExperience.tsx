'use client';

import { useState } from 'react';
import TrackedLink from './TrackedLink';

type Journey = 'union' | 'civic';

type JourneyContent = {
  audience: string;
  name: string;
  headline: string;
  description: string;
  stages: readonly { title: string; detail: string }[];
  outcome: string;
  destination: string;
  linkLabel: string;
};

const experiences: Record<'en' | 'fr', Record<Journey, JourneyContent>> = {
  en: {
    union: {
      audience: 'For labour organizations',
      name: 'Union Eyes',
      headline: 'Carry the entire case forward.',
      description: 'A member concern should not lose its history when a steward or representative changes.',
      stages: [
        { title: 'Member concern', detail: 'Capture the issue and relevant context' },
        { title: 'Case continuity', detail: 'Keep records, next steps and responsibilities connected' },
        { title: 'Accountable handoff', detail: 'Preserve the trail for the next authorized representative' },
      ],
      outcome: 'Continuity across member, steward and union workflows',
      destination: '/union-eyes',
      linkLabel: 'Explore Union Eyes',
    },
    civic: {
      audience: 'For public institutions',
      name: 'CIVIC',
      headline: 'Make implementation accountable.',
      description: 'Commitments and modernization decisions need ownership, evidence and continuity beyond a single project team.',
      stages: [
        { title: 'Institutional commitment', detail: 'Identify what must be delivered and protected' },
        { title: 'Implementation ownership', detail: 'Connect actions, evidence and responsible roles' },
        { title: 'Governance review', detail: 'Make gaps and decisions visible for human assessment' },
      ],
      outcome: 'Continuity from public commitment to operational action',
      destination: '/public-service',
      linkLabel: 'Explore CIVIC',
    },
  },
  fr: {
    union: {
      audience: 'Pour les organisations syndicales',
      name: 'Union Eyes',
      headline: 'Préserver tout l’historique d’un dossier.',
      description: 'Une situation vécue par un membre ne devrait pas perdre son contexte lorsqu’une personne déléguée ou représentante change.',
      stages: [
        { title: 'Situation du membre', detail: 'Consigner le problème et son contexte' },
        { title: 'Suivi du dossier', detail: 'Relier les pièces, les prochaines étapes et les responsabilités' },
        { title: 'Transfert responsable', detail: 'Préserver la trace pour la prochaine personne autorisée' },
      ],
      outcome: 'Continuité entre les parcours des membres, des délégués et du syndicat',
      destination: '/union-eyes',
      linkLabel: 'Découvrir Union Eyes',
    },
    civic: {
      audience: 'Pour les institutions publiques',
      name: 'CIVIC',
      headline: 'Rendre la mise en œuvre imputable.',
      description: 'Les engagements et les décisions de modernisation doivent conserver un responsable, des preuves et une continuité.',
      stages: [
        { title: 'Engagement institutionnel', detail: 'Définir ce qui doit être livré et préservé' },
        { title: 'Responsabilité de mise en œuvre', detail: 'Relier les actions, les preuves et les rôles' },
        { title: 'Examen de gouvernance', detail: 'Rendre les écarts visibles pour l’évaluation humaine' },
      ],
      outcome: 'Continuité entre les engagements publics et les actions concrètes',
      destination: '/public-service',
      linkLabel: 'Découvrir CIVIC',
    },
  },
};

export default function HomeExperience({ isFr }: { isFr: boolean }) {
  const [selected, setSelected] = useState<Journey>('union');
  const language = isFr ? 'fr' : 'en';
  const experience = experiences[language][selected];

  return (
    <section
      aria-labelledby="nzila-home-title"
      className="relative isolate overflow-hidden bg-[#080e1c] text-white"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-44 right-[-15%] h-[35rem] w-[35rem] rounded-full bg-electric/20 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[-16rem] left-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet/15 blur-[100px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: 'linear-gradient(to right, #8ca5d8 1px, transparent 1px), linear-gradient(to bottom, #8ca5d8 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'linear-gradient(to bottom, black, transparent 95%)' }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-36 sm:px-6 md:pb-24 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-14 lg:px-8 lg:pb-28 lg:pt-44">
        <div className="max-w-2xl">
          <p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            <span aria-hidden="true" className="h-px w-9 bg-gold" />
            {isFr ? 'Nzila Ventures · logiciel institutionnel' : 'Nzila Ventures · institutional software'}
          </p>
          <h1 id="nzila-home-title" className="max-w-[14ch] text-5xl font-semibold leading-[1.06] tracking-[-0.045em] sm:text-6xl lg:text-[4.7rem]">
            {isFr ? 'Les gens changent.' : 'People move on.'}
            <span className="mt-2 block text-[#dfbe70]">
              {isFr ? 'Le savoir doit rester.' : 'What they built should endure.'}
            </span>
          </h1>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {isFr
              ? 'Nzila Ventures conçoit des logiciels qui préservent le savoir institutionnel, relient les décisions à leurs preuves et rendent les transitions plus sûres pour les organisations.'
              : 'Nzila Ventures builds software that preserves institutional knowledge, connects decisions to evidence, and helps organizations remain accountable through change.'}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <TrackedLink
              href="/union-eyes"
              eventName="home_hero_union_eyes"
              eventProps={{ source: 'public_home_refresh' }}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-6 py-3 text-sm font-bold text-navy transition-colors hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isFr ? 'Découvrir Union Eyes' : 'Explore Union Eyes'} <span aria-hidden="true" className="ml-2">↗</span>
            </TrackedLink>
            <TrackedLink
              href="/public-service"
              eventName="home_hero_civic"
              eventProps={{ source: 'public_home_refresh' }}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isFr ? 'Découvrir CIVIC' : 'Explore CIVIC'} <span aria-hidden="true" className="ml-2">↗</span>
            </TrackedLink>
          </div>
          <TrackedLink
            href="/continuity-assessment"
            eventName="home_hero_continuity_assessment"
            eventProps={{ source: 'public_home_refresh' }}
            className="mt-7 inline-flex min-h-10 items-center text-sm font-medium text-blue-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {isFr ? 'Explorer le diagnostic de continuité' : 'Explore the continuity assessment'} <span aria-hidden="true" className="ml-2">→</span>
          </TrackedLink>
          <p className="mt-9 max-w-lg border-l-2 border-white/20 pl-4 text-sm leading-relaxed text-slate-400">
            {isFr
              ? 'Une même infrastructure gouvernée, des expériences adaptées aux organisations syndicales et aux institutions publiques.'
              : 'One governed foundation, purpose-built experiences for labour organizations and public institutions.'}
          </p>
        </div>

        <div className="min-w-0 lg:pt-5">
          <div className="overflow-hidden rounded-[1.65rem] border border-white/15 bg-[#101a2c] shadow-[0_35px_100px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#dfbe70]" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                  {isFr ? 'Parcours produits' : 'Product journeys'}
                </span>
              </div>
              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-400">
                Nzila OS
              </span>
            </div>

            <div className="px-5 pb-6 pt-5 sm:px-6 sm:pb-7">
              <p className="mb-3 text-xs font-medium text-slate-400">
                {isFr ? 'Choisir un domaine' : 'Choose a domain'}
              </p>
              <div role="group" aria-label={isFr ? 'Sélectionner le produit' : 'Select product'} className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1.5">
                {(['union', 'civic'] as const).map((key) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={selected === key}
                    onClick={() => setSelected(key)}
                    className={selected === key
                      ? 'min-h-11 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-navy shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'
                      : 'min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold'}
                  >
                    {experiences[language][key].name}
                  </button>
                ))}
              </div>

              <div className="mt-7" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dfbe70]">{experience.audience}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{experience.headline}</h2>
                <p className="mt-3 min-h-12 text-sm leading-relaxed text-slate-300">{experience.description}</p>

                <div className="relative mt-7 space-y-3">
                  <div aria-hidden="true" className="absolute bottom-6 left-[1.1rem] top-6 w-px bg-blue-300/25" />
                  {experience.stages.map((stage, index) => (
                    <div key={stage.title} className="relative flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.045] p-3.5 sm:p-4">
                      <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-300/30 bg-[#142740] text-xs font-bold text-blue-100">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white">{stage.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">{stage.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-[#dfbe70]/25 bg-[#dfbe70]/10 px-4 py-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#dfbe70]">
                    {isFr ? 'Objectif du parcours' : 'Journey objective'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">{experience.outcome}</p>
                </div>

                <TrackedLink
                  href={experience.destination}
                  eventName="home_journey_detail"
                  eventProps={{ product: selected }}
                  className="mt-5 inline-flex min-h-10 items-center text-sm font-semibold text-blue-200 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {experience.linkLabel} <span aria-hidden="true" className="ml-2">→</span>
                </TrackedLink>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/[0.025] px-5 py-3 sm:px-6">
              <p className="text-xs leading-relaxed text-slate-400">
                {isFr
                  ? 'Illustration conceptuelle des parcours, non une démonstration connectée ni un dossier réel.'
                  : 'Illustrative workflow overview — not a connected demonstration or a real case record.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-7 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            isFr ? ['Nzila Ventures', 'La société et ses engagements'] : ['Nzila Ventures', 'The company and its commitments'],
            isFr ? ['Nzila OS', 'L’infrastructure de continuité'] : ['Nzila OS', 'The governed continuity foundation'],
            isFr ? ['Union Eyes + CIVIC', 'Deux parcours adaptés aux institutions'] : ['Union Eyes + CIVIC', 'Two institution-focused journeys'],
          ].map(([title, description]) => (
            <div key={title} className="border-l border-[#dfbe70]/50 pl-4">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-1 text-xs text-slate-400">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
