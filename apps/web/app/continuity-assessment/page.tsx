import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import TrackedLink from '@/components/public/TrackedLink';
import type { Locale } from '@/lib/locales';

const metaByLocale = {
  'en-CA': {
    title: 'Continuity Assessment',
    description: 'Explore an organization-level approach to assessing key-person dependencies, decision context, governance evidence and operational transition risks.',
  },
  'fr-CA': {
    title: 'Évaluation de la continuité',
    description: 'Découvrez une approche organisationnelle pour évaluer les dépendances aux personnes clés, le contexte décisionnel, les preuves de gouvernance et les risques de transition opérationnelle.',
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return { ...(metaByLocale[locale] ?? metaByLocale['en-CA']), alternates: { canonical: '/continuity-assessment' } };
}

const copy = {
  'en-CA': {
    eyebrow: 'Organizational Continuity Risk Assessment · OCRA',
    title: 'Understand where your organization could lose continuity.',
    intro: 'Transitions expose gaps in documentation, ownership and decision context. The OCRA approach helps frame a structured conversation about those organizational risks.',
    note: 'This page explains the assessment approach. It is not a live questionnaire or an automatically generated diagnostic report.',
    cta: 'Discuss an assessment',
    secondary: 'Explore operational continuity',
    measuresTitle: 'Nine areas to examine.',
    measuresBody: 'The scope of an assessment should be defined with the organization. These are example dimensions, not an automated score.',
    dimensions: [
      'Key-person dependency', 'Governance visibility', 'Institutional memory',
      'Onboarding and handoffs', 'Transition readiness', 'Decision traceability',
      'Cross-organization coordination', 'Human review and explainability', 'Operational sovereignty',
    ],
    outputsTitle: 'Potential assessment outputs.',
    outputsBody: 'Outputs require a confirmed methodology, scoped evidence and human review. They are not generated on this page.',
    outputs: [
      'Continuity exposure and dependency map',
      'Ownership and decision-context gaps',
      'Evidence confidence and unresolved questions',
      'Practical next steps and review checkpoints',
    ],
    boundaryTitle: 'About organizations, not surveillance of individuals.',
    boundaryBody: 'An appropriate continuity review evaluates organizational processes and controls, not individual productivity, attention or behavior. Authorized leaders retain responsibility for decisions.',
    finalTitle: 'Start with the risk you already recognize.',
    finalBody: 'Tell us about your institutional context and we can discuss whether a bounded continuity review would be useful.',
    finalCta: 'Contact Nzila Ventures',
  },
  'fr-CA': {
    eyebrow: 'Évaluation des risques de continuité organisationnelle · OCRA',
    title: 'Repérer les points de rupture possibles de la continuité.',
    intro: 'Les transitions révèlent les lacunes de documentation, de responsabilité et de contexte décisionnel. L’approche OCRA aide à structurer une discussion sur ces risques organisationnels.',
    note: 'Cette page présente l’approche d’évaluation. Il ne s’agit ni d’un questionnaire actif ni d’un rapport diagnostique généré automatiquement.',
    cta: 'Discuter d’une évaluation',
    secondary: 'Explorer la continuité opérationnelle',
    measuresTitle: 'Neuf dimensions à examiner.',
    measuresBody: 'La portée de l’évaluation doit être définie avec l’organisation. Il s’agit de dimensions indicatives, pas d’une note calculée automatiquement.',
    dimensions: [
      'Dépendance aux personnes clés', 'Visibilité de la gouvernance', 'Mémoire institutionnelle',
      'Accueil et transferts', 'Préparation aux transitions', 'Traçabilité des décisions',
      'Coordination entre organismes', 'Examen humain et explicabilité', 'Souveraineté opérationnelle',
    ],
    outputsTitle: 'Livrables potentiels de l’évaluation.',
    outputsBody: 'Les livrables supposent une méthodologie confirmée, des preuves définies et un examen humain. Ils ne sont pas générés sur cette page.',
    outputs: [
      'Carte des dépendances et des risques de continuité',
      'Lacunes de responsabilité et de contexte décisionnel',
      'Fiabilité des preuves et questions non résolues',
      'Prochaines étapes concrètes et points de révision',
    ],
    boundaryTitle: 'Évaluer l’organisation, pas surveiller les personnes.',
    boundaryBody: 'Une évaluation appropriée porte sur les processus et les contrôles organisationnels, et non sur la productivité, l’attention ou les comportements individuels. Les décisions demeurent sous responsabilité humaine.',
    finalTitle: 'Commencer par un risque déjà visible.',
    finalBody: 'Décrivez votre contexte institutionnel; nous pourrons examiner la pertinence d’une évaluation de continuité à portée limitée.',
    finalCta: 'Communiquer avec Nzila Ventures',
  },
} as const;

export default async function ContinuityAssessmentPage() {
  const locale = (await getLocale()) as Locale;
  const c = copy[locale] ?? copy['en-CA'];

  return (
    <main className="min-h-screen bg-white">
      <section className="relative isolate overflow-hidden bg-[#080e1c] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-0 h-[32rem] w-[32rem] rounded-full bg-electric/20 blur-[105px]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-36 sm:px-6 lg:px-8 lg:pb-24 lg:pt-44">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dfbe70]">{c.eyebrow}</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-6xl">{c.title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">{c.intro}</p>
          <p className="mt-6 max-w-3xl border-l-2 border-white/20 pl-4 text-sm leading-7 text-slate-400">{c.note}</p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <TrackedLink href="/contact" eventName="ocra_contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-6 py-3 text-sm font-bold text-navy hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.cta} <span aria-hidden="true" className="ml-2">↗</span></TrackedLink>
            <TrackedLink href="/union-eyes" eventName="ocra_union_eyes" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.secondary}</TrackedLink>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f8fb] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.measuresTitle}</h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{c.measuresBody}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.dimensions.map((dimension, index) => (
              <article key={dimension} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6">
                <span className="text-xs font-bold text-electric">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="text-base font-semibold text-navy">{dimension}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-navy md:text-4xl">{c.outputsTitle}</h2>
            <p className="mt-5 text-base leading-8 text-slate-600">{c.outputsBody}</p>
          </div>
          <ul className="space-y-3">
            {c.outputs.map((output, index) => (
              <li key={output} className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <span className="text-sm font-bold text-electric">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-sm leading-7 text-slate-700">{output}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[#101a2c] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">{c.boundaryTitle}</h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">{c.boundaryBody}</p>
        </div>
      </section>

      <section className="bg-[#f6f8fb] py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.finalTitle}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">{c.finalBody}</p>
          <TrackedLink href="/contact" eventName="ocra_contact" eventProps={{ source: 'ocra_bottom' }} className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-navy px-7 py-3 text-sm font-bold text-white hover:bg-navy-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">{c.finalCta} <span aria-hidden="true" className="ml-2">↗</span></TrackedLink>
        </div>
      </section>
    </main>
  );
}
