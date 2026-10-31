import type { Metadata } from 'next';
import HumanCenteredAI from '@/components/public/HumanCenteredAI';
import { getLocale } from 'next-intl/server';
import TrackedLink from '@/components/public/TrackedLink';
import type { Locale } from '@/lib/locales';

export const metadata: Metadata = {
  title: 'Union Eyes | Continuity for Labour Organizations',
  description:
    'Explore Union Eyes: a continuity-first approach to member concerns, grievance casework, steward handoffs, governance evidence and role-scoped union operations.',
  alternates: { canonical: '/union-eyes' },
};

const contentByLocale = {
  'en-CA': {
    eyebrow: 'Union Eyes · Nzila Ventures',
    maturity: 'Flagship · Pilot validation',
    title: 'A member’s story should never disappear in a handoff.',
    intro: 'From the first concern to the next representative, Union Eyes is designed to keep union casework connected, accountable and understandable — without turning member support into surveillance.',
    primary: 'Discuss a pilot',
    secondary: 'Explore the member journey',
    tertiary: 'Our anti-surveillance commitment',
    info: 'Union Eyes is in pilot validation. Capabilities shown here describe product journeys and design scope, not a claim that every feature is available in production.',
    sketch: 'Illustrative journey · No live member information',
    journeyTag: 'How the work connects',
    journeyTitle: 'One case. A continuous story.',
    journeyIntro: 'A fragmented folder is not a case history. Each role needs the right context, next action and access boundary.',
    steps: [
      { stage: '01', role: 'Member', title: 'Share the concern', body: 'A member describes the issue, shares relevant documents and sees what is still needed.' },
      { stage: '02', role: 'Steward', title: 'Organize the response', body: 'The steward reviews the intake, determines next steps and keeps follow-up responsibilities visible.' },
      { stage: '03', role: 'Case support', title: 'Keep evidence connected', body: 'Documents, communications, milestones and appeal dates stay associated with the right matter.' },
      { stage: '04', role: 'Authorized successor', title: 'Handoff without starting over', body: 'A new representative receives the permitted history, unresolved tasks and decision context.' },
    ],
    scopeTitle: 'Built around the people doing the work.',
    scopeIntro: 'The experience should help everyone involved, without exposing private casework to people who have no reason to see it.',
    scopes: [
      { title: 'Members', body: 'Clear intake, document requests, status, secure communication and expectations.' },
      { title: 'Stewards', body: 'Case triage, deadlines, guided tasks, precedents and accountable handoffs.' },
      { title: 'Caseworkers', body: 'Evidence packages, appeal preparation, missing-item tracking and shared case context.' },
      { title: 'Union leadership', body: 'Aggregated governance posture and service continuity — not individual worker scores.' },
    ],
    principleTag: 'Trust is a product requirement',
    principleTitle: 'Protect members. Preserve institutional memory.',
    principles: [
      { title: 'Role-scoped access', body: 'Sensitive member records are visible only to authorized participants within a governed purpose.' },
      { title: 'Human authority', body: 'People remain responsible for decisions, legal interpretation, representation and escalations.' },
      { title: 'Continuity, not monitoring', body: 'The aim is case continuity and accountability, never productivity scoring or covert member profiling.' },
    ],
    programTag: 'Pilot participation',
    programTitle: 'A serious pilot begins with a bounded scope.',
    programIntro: 'Pilots should define ownership, data boundaries, role permissions, real cases only with authorization and measurable acceptance criteria before any production commitment.',
    pilotSteps: [
      'Discover the union’s existing case journey and identify the scope.',
      'Agree on authority, consent, privacy and anti-surveillance boundaries.',
      'Validate workflows with members, stewards and case-support stakeholders.',
      'Review evidence, usability, operational risk and unresolved gaps.',
    ],
    finalTitle: 'Keep the next handoff from becoming a reset.',
    finalBody: 'Tell us how your organization manages member concerns today. We can explore whether a limited, governed Union Eyes pilot is a fit.',
    finalCta: 'Request a pilot conversation',
    related: 'Explore CIVIC for public institutions',
  },
  'fr-CA': {
    eyebrow: 'Union Eyes · Nzila Ventures',
    maturity: 'Produit phare · Validation pilote',
    title: 'L’histoire d’un membre ne devrait jamais se perdre lors d’un transfert.',
    intro: 'De la première préoccupation à la relève, Union Eyes vise à préserver la continuité des dossiers syndicaux, la responsabilité des intervenants et la compréhension du parcours — sans surveillance des membres.',
    primary: 'Discuter d’un pilote',
    secondary: 'Explorer le parcours du membre',
    tertiary: 'Notre engagement anti-surveillance',
    info: 'Union Eyes est en validation pilote. Les parcours présentés décrivent la conception et la portée visée, sans affirmer que chaque fonctionnalité est disponible en production.',
    sketch: 'Parcours illustratif · Aucune donnée réelle de membre',
    journeyTag: 'Un travail interconnecté',
    journeyTitle: 'Un dossier. Une histoire continue.',
    journeyIntro: 'Un répertoire de fichiers ne remplace pas le suivi d’un dossier. Chaque rôle a besoin du bon contexte, de la prochaine action et des autorisations appropriées.',
    steps: [
      { stage: '01', role: 'Membre', title: 'Expliquer la situation', body: 'Le membre décrit le problème, transmet les pièces utiles et voit les éléments manquants.' },
      { stage: '02', role: 'Délégué syndical', title: 'Organiser la réponse', body: 'La personne déléguée examine la demande, planifie la suite et clarifie les responsabilités.' },
      { stage: '03', role: 'Soutien aux dossiers', title: 'Relier les preuves', body: 'Les documents, échanges, jalons et échéances restent associés au bon dossier.' },
      { stage: '04', role: 'Relève autorisée', title: 'Assurer un transfert sans recommencer', body: 'La relève reçoit l’historique permis, les tâches à compléter et le contexte des décisions.' },
    ],
    scopeTitle: 'Pensé pour les personnes qui accomplissent le travail.',
    scopeIntro: 'L’expérience doit aider chaque intervenant sans exposer des dossiers confidentiels à des personnes non autorisées.',
    scopes: [
      { title: 'Membres', body: 'Demande claire, pièces requises, état du dossier, échanges sécurisés et attentes.' },
      { title: 'Délégués', body: 'Triage, échéances, tâches guidées, précédents et transferts responsables.' },
      { title: 'Équipes de soutien', body: 'Dossiers de preuve, préparation des appels, suivi des pièces et contexte partagé.' },
      { title: 'Direction syndicale', body: 'Vue globale de la gouvernance et de la continuité, sans notation individuelle.' },
    ],
    principleTag: 'La confiance est une exigence',
    principleTitle: 'Protéger les membres. Préserver la mémoire institutionnelle.',
    principles: [
      { title: 'Accès selon le rôle', body: 'Les dossiers sensibles restent accessibles uniquement aux personnes autorisées pour un objectif légitime.' },
      { title: 'Autorité humaine', body: 'Les personnes demeurent responsables des décisions, des interprétations juridiques et de la représentation.' },
      { title: 'Continuité plutôt que surveillance', body: 'L’objectif est la continuité des dossiers, jamais la notation de rendement ni le profilage caché.' },
    ],
    programTag: 'Participation pilote',
    programTitle: 'Un pilote sérieux commence par une portée limitée.',
    programIntro: 'Un pilote doit définir les responsabilités, les limites de données, les permissions et les critères d’acceptation avant tout engagement de production.',
    pilotSteps: [
      'Comprendre le parcours syndical actuel et définir la portée.',
      'Convenir de l’autorité, du consentement, de la confidentialité et des limites anti-surveillance.',
      'Valider les parcours avec les membres, les délégués et les équipes de soutien.',
      'Examiner les preuves, l’accessibilité, les risques et les éléments à corriger.',
    ],
    finalTitle: 'Éviter que le prochain transfert soit un retour à zéro.',
    finalBody: 'Expliquez-nous comment votre organisation accompagne ses membres aujourd’hui. Nous pourrons examiner la pertinence d’un pilote Union Eyes limité et gouverné.',
    finalCta: 'Demander un échange sur un pilote',
    related: 'Explorer CIVIC pour les institutions publiques',
  },
} as const;

export default async function UnionEyesPage() {
  const locale = (await getLocale()) as Locale;
  const c = contentByLocale[locale] ?? contentByLocale['en-CA'];

  return (
    <main className="min-h-screen bg-white">
      <section className="relative isolate overflow-hidden bg-[#080e1c] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-12 h-[34rem] w-[34rem] rounded-full bg-electric/20 blur-[110px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-36 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-28 lg:pt-44">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dfbe70]">{c.eyebrow}</p>
            <p className="mt-4 inline-flex rounded-full border border-white/20 px-3 py-1 text-xs text-slate-300">{c.maturity}</p>
            <h1 className="mt-7 text-4xl font-semibold leading-[1.1] tracking-[-0.04em] sm:text-5xl lg:text-6xl">{c.title}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-300">{c.intro}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <TrackedLink href="/contact?interest=union-eyes" eventName="union_eyes_pilot_contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-6 py-3 text-sm font-bold text-navy hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {c.primary} <span aria-hidden="true" className="ml-2">↗</span>
              </TrackedLink>
              <a href="#member-journey" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.secondary}</a>
            </div>
            <TrackedLink href="/anti-surveillance" eventName="union_eyes_privacy_commitment" className="mt-6 inline-flex min-h-10 items-center text-sm font-medium text-blue-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.tertiary} <span aria-hidden="true" className="ml-2">→</span></TrackedLink>
            <p className="mt-8 max-w-xl border-l-2 border-white/20 pl-4 text-xs leading-relaxed text-slate-400">{c.info}</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#101c30] shadow-[0_35px_100px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Union Eyes</p>
              <p className="text-xs text-slate-400">{c.sketch}</p>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#dfbe70]/20 bg-[#dfbe70]/10 px-4 py-3">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[#dfbe70]">{c.journeyTag}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{c.journeyTitle}</p>
                </div>
                <span aria-hidden="true" className="text-2xl text-[#dfbe70]">↗</span>
              </div>
              <ol className="mt-5 space-y-3">
                {c.steps.map((step) => (
                  <li key={step.stage} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.045] p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-400/15 text-xs font-bold text-blue-200">{step.stage}</span>
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[#dfbe70]">{step.role}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="member-journey" className="scroll-mt-24 bg-[#f6f8fb] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric">{c.journeyTag}</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.journeyTitle}</h2>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">{c.journeyIntro}</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {c.steps.map((step) => (
              <article key={step.stage} className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-bold tracking-wider text-electric">{step.stage} / {step.role}</p>
                <h3 className="mt-4 text-xl font-semibold text-navy">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.scopeTitle}</h2>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">{c.scopeIntro}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {c.scopes.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 p-7">
                <h3 className="text-xl font-semibold text-navy">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#101a2c] py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dfbe70]">{c.principleTag}</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{c.principleTitle}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {c.principles.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/15 bg-white/5 p-6">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <HumanCenteredAI isFr={locale === "fr-CA"} audience="union" />

      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric">{c.programTag}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-navy md:text-4xl">{c.programTitle}</h2>
            <p className="mt-5 text-base leading-8 text-slate-600">{c.programIntro}</p>
          </div>
          <ol className="space-y-3">
            {c.pilotSteps.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <span className="text-sm font-bold text-electric">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-sm leading-7 text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#f6f8fb] py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.finalTitle}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{c.finalBody}</p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <TrackedLink href="/contact?interest=union-eyes" eventName="union_eyes_pilot_contact" eventProps={{ source: 'union_eyes_bottom' }} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-navy px-7 py-3 text-sm font-bold text-white hover:bg-navy-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">{c.finalCta}</TrackedLink>
            <TrackedLink href="/public-service" eventName="union_eyes_related_civic" className="inline-flex min-h-12 items-center justify-center text-sm font-semibold text-electric hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">{c.related} <span aria-hidden="true" className="ml-2">→</span></TrackedLink>
          </div>
        </div>
      </section>
    </main>
  );
}
