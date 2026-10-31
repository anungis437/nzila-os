import type { Metadata } from 'next';
import HumanCenteredAI from '@/components/public/HumanCenteredAI';
import { getLocale } from 'next-intl/server';
import TrackedLink from '@/components/public/TrackedLink';
import type { Locale } from '@/lib/locales';

const metaByLocale = {
  'en-CA': {
    title: 'CIVIC | Public-Service Continuity',
    description: 'CIVIC by Nzila explores accountable public-service modernization: institutional memory, implementation ownership, governance evidence, and human-reviewed decisions.',
  },
  'fr-CA': {
    title: 'CIVIC | Continuité des services publics',
    description: 'CIVIC de Nzila explore une modernisation responsable des services publics : mémoire institutionnelle, responsabilité de mise en œuvre, preuves de gouvernance et décisions examinées par des humains.',
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return { ...(metaByLocale[locale] ?? metaByLocale['en-CA']), alternates: { canonical: '/public-service' } };
}

const copy = {
  'en-CA': {
    eyebrow: 'CIVIC by Nzila · Public institutions',
    maturity: 'Discovery and institutional briefings',
    title: 'Modernize services. Keep accountability intact.',
    intro: 'Public institutions face workforce transitions, changing service expectations and pressure to introduce AI. CIVIC connects institutional commitments to ownership, evidence and review — so continuity is not lost in the transition.',
    primary: 'Request a briefing',
    secondary: 'Explore the framework',
    notice: 'CIVIC is currently a public-service continuity initiative and briefing series. The conceptual journey below does not represent a deployed government application or verified institutional results.',
    graphicLabel: 'Illustrative continuity model · Not live institutional data',
    graphicTitle: 'From commitment to accountable delivery',
    steps: [
      { number: '01', title: 'Commitment', detail: 'A service, policy or modernization objective is defined.' },
      { number: '02', title: 'Ownership', detail: 'Responsibility and review points are made explicit.' },
      { number: '03', title: 'Evidence', detail: 'Delivery signals, risks and uncertainty are traceable.' },
      { number: '04', title: 'Human review', detail: 'Authorized leaders assess what the record supports.' },
    ],
    whyTag: 'The institutional challenge',
    whyTitle: 'A policy is only as durable as its implementation.',
    whyBody: 'Organizations may know what they promised, but struggle to reconstruct who owned the work, why decisions changed, which evidence matters and what a successor must understand.',
    issueAreas: [
      { title: 'Institutional memory', description: 'Protect knowledge as experienced staff retire, transfer or change roles.' },
      { title: 'Responsible AI and modernization', description: 'Make dependencies, readiness and human decision boundaries visible before change is embedded.' },
      { title: 'Service continuity', description: 'Connect operational risks with accountable owners and practical follow-up.' },
      { title: 'Equity implementation', description: 'Trace commitments and remedies without profiling workers or issuing automated findings.' },
      { title: 'Governance evidence', description: 'Keep rationale, approvals, gaps and review materials connected over time.' },
      { title: 'Public accountability', description: 'Support explainable, documented human review rather than replacing institutional authority.' },
    ],
    frameworkTag: 'The CIVIC framework',
    frameworkTitle: 'Five lenses for continuity under change.',
    framework: [
      { title: 'Continuity', detail: 'Services and knowledge persist across transitions.' },
      { title: 'Implementation', detail: 'Policy commitments connect to operating actions.' },
      { title: 'Visibility', detail: 'Risks and uncertainty can be examined.' },
      { title: 'Integrity', detail: 'Decisions retain context and reviewability.' },
      { title: 'Capacity', detail: 'Institutions can absorb change responsibly.' },
    ],
    methodTag: 'Evidence discipline',
    methodTitle: 'CLEAR: a method for structured review.',
    methodBody: 'CLEAR stands for Continuity, Legitimacy, Evidence, Accountability and Readiness. It is a framework for organizing evidence and uncertainty, not an automated verdict or a paid assessment currently on offer.',
    methodOutputs: [
      'Continuity and implementation risk map',
      'Evidence confidence and unresolved questions',
      'Responsibility and review checkpoints',
      'Potential 30/60/90-day control plan',
    ],
    futureTag: 'Longer-term workspace direction',
    futureTitle: 'SAGE is a future direction, not today’s offer.',
    futureBody: 'Service Assurance, Governance and Evidence (SAGE) describes a possible recurring workspace for continuity tracking and governance review. It is not presented here as a live government product.',
    boundaryTag: 'Non-negotiable safeguards',
    boundaryTitle: 'AI can assist a review. It cannot become the institution.',
    boundaries: [
      'No autonomous legal, HR, equity or employment decisions.',
      'No automated findings of discrimination, racism or wrongdoing.',
      'No autonomous legal advice, filing or punitive actions.',
      'Privacy, access minimization and explicit uncertainty are part of the design.',
      'Accountable humans remain the decision-makers.',
    ],
    finalTitle: 'Explore where your institution could lose continuity.',
    finalBody: 'A briefing can help clarify the risk, the evidence needed and whether a narrowly scoped discovery conversation is useful. No deployment or purchase is implied.',
    finalCta: 'Request a CIVIC briefing',
    related: 'See Union Eyes for labour organizations',
    doctrine: 'Read the governance doctrine',
  },
  'fr-CA': {
    eyebrow: 'CIVIC par Nzila · Institutions publiques',
    maturity: 'Découverte et présentations institutionnelles',
    title: 'Moderniser les services. Préserver la responsabilité.',
    intro: 'Les institutions publiques composent avec le renouvellement de leurs équipes, l’évolution des attentes et les pressions liées à l’IA. CIVIC relie les engagements institutionnels aux responsabilités, aux preuves et aux examens humains pour préserver la continuité.',
    primary: 'Demander une présentation',
    secondary: 'Explorer le cadre',
    notice: 'CIVIC est actuellement une initiative de continuité du service public et une série de présentations. Le parcours conceptuel ci-dessous ne représente ni une application gouvernementale déployée ni des résultats institutionnels vérifiés.',
    graphicLabel: 'Modèle illustratif · Aucune donnée institutionnelle réelle',
    graphicTitle: 'De l’engagement à une réalisation responsable',
    steps: [
      { number: '01', title: 'Engagement', detail: 'Définir un objectif de service, de politique ou de modernisation.' },
      { number: '02', title: 'Responsabilité', detail: 'Clarifier les responsables et les points de révision.' },
      { number: '03', title: 'Preuves', detail: 'Relier les livrables, les risques et les incertitudes.' },
      { number: '04', title: 'Examen humain', detail: 'Permettre aux dirigeants autorisés d’évaluer les éléments disponibles.' },
    ],
    whyTag: 'Le défi institutionnel',
    whyTitle: 'Une politique ne vaut que par la solidité de sa mise en œuvre.',
    whyBody: 'Une organisation peut connaître ses engagements, mais avoir du mal à retrouver qui était responsable, pourquoi les décisions ont changé, quelles preuves comptent et ce que la relève doit comprendre.',
    issueAreas: [
      { title: 'Mémoire institutionnelle', description: 'Préserver le savoir lors des départs à la retraite, des mutations ou des changements de rôle.' },
      { title: 'IA responsable et modernisation', description: 'Rendre visibles les dépendances, la préparation et les limites des décisions humaines.' },
      { title: 'Continuité des services', description: 'Relier les risques opérationnels aux responsables et aux actions de suivi.' },
      { title: 'Équité dans la mise en œuvre', description: 'Suivre les engagements sans profiler les employés ni établir des conclusions automatiques.' },
      { title: 'Preuves de gouvernance', description: 'Conserver les motifs, les approbations, les écarts et les éléments de révision.' },
      { title: 'Responsabilité publique', description: 'Soutenir des examens humains documentés plutôt que remplacer l’autorité institutionnelle.' },
    ],
    frameworkTag: 'Le cadre CIVIC',
    frameworkTitle: 'Cinq angles d’analyse pour une transition responsable.',
    framework: [
      { title: 'Continuité', detail: 'Les services et le savoir résistent aux transitions.' },
      { title: 'Implantation', detail: 'Les engagements se traduisent en actions.' },
      { title: 'Visibilité', detail: 'Les risques et incertitudes peuvent être examinés.' },
      { title: 'Intégrité', detail: 'Les décisions conservent leur contexte et leur traçabilité.' },
      { title: 'Capacité', detail: 'Les institutions absorbent les changements de manière responsable.' },
    ],
    methodTag: 'Discipline de preuve',
    methodTitle: 'CLEAR : une méthode de révision structurée.',
    methodBody: 'CLEAR désigne la continuité, la légitimité, les preuves, la responsabilité et la préparation. Ce cadre sert à organiser les preuves et les incertitudes. Il ne s’agit ni d’un verdict automatisé ni d’une évaluation payante actuellement offerte.',
    methodOutputs: [
      'Carte des risques de continuité et de mise en œuvre',
      'Niveau de confiance des preuves et questions ouvertes',
      'Responsables et points de contrôle',
      'Plan de maîtrise potentiel sur 30, 60 et 90 jours',
    ],
    futureTag: 'Orientation future',
    futureTitle: 'SAGE est une orientation future, pas l’offre actuelle.',
    futureBody: 'SAGE (Service Assurance, Governance and Evidence) représente un espace de travail potentiel pour suivre la continuité et les examens de gouvernance. Il ne s’agit pas d’un produit gouvernemental déployé.',
    boundaryTag: 'Garanties incontournables',
    boundaryTitle: 'L’IA peut aider à examiner. Elle ne remplace pas l’institution.',
    boundaries: [
      'Aucune décision autonome en droit, en ressources humaines, en équité ou en emploi.',
      'Aucune conclusion automatisée de discrimination, de racisme ou de faute.',
      'Aucun conseil juridique, dépôt ou sanction autonome.',
      'Confidentialité, accès minimal et incertitudes explicites dès la conception.',
      'Les personnes responsables demeurent décisionnaires.',
    ],
    finalTitle: 'Identifier les risques de perte de continuité.',
    finalBody: 'Une présentation peut clarifier les risques, les preuves nécessaires et l’intérêt d’une démarche de découverte ciblée, sans engagement de déploiement ni d’achat.',
    finalCta: 'Demander une présentation CIVIC',
    related: 'Voir Union Eyes pour les organisations syndicales',
    doctrine: 'Lire la doctrine de gouvernance',
  },
} as const;

export default async function PublicServicePage() {
  const locale = (await getLocale()) as Locale;
  const c = copy[locale] ?? copy['en-CA'];

  return (
    <main className="min-h-screen bg-white">
      <section className="relative isolate overflow-hidden bg-[#080e1c] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute right-[-12rem] top-[-8rem] h-[36rem] w-[36rem] rounded-full bg-blue-500/20 blur-[115px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-36 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-28 lg:pt-44">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">{c.eyebrow}</p>
            <p className="mt-4 inline-flex rounded-full border border-white/20 px-3 py-1 text-xs text-slate-300">{c.maturity}</p>
            <h1 className="mt-7 text-4xl font-semibold leading-[1.1] tracking-[-0.04em] sm:text-5xl lg:text-6xl">{c.title}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-300">{c.intro}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <TrackedLink href="/contact?interest=civic" eventName="civic_briefing_request" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-6 py-3 text-sm font-bold text-navy hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.primary} <span aria-hidden="true" className="ml-2">↗</span></TrackedLink>
              <a href="#civic-framework" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.secondary}</a>
            </div>
            <p className="mt-9 max-w-xl border-l-2 border-white/20 pl-4 text-xs leading-relaxed text-slate-400">{c.notice}</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/15 bg-[#101c30] shadow-[0_35px_100px_rgba(0,0,0,0.35)]">
            <div className="border-b border-white/10 px-5 py-4 text-xs font-medium text-slate-400">{c.graphicLabel}</div>
            <div className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-white">{c.graphicTitle}</h2>
              <ol className="mt-6 space-y-3">
                {c.steps.map((step) => (
                  <li key={step.number} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.045] p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-400/15 text-xs font-bold text-blue-200">{step.number}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-5 rounded-xl border border-[#dfbe70]/25 bg-[#dfbe70]/10 px-4 py-3 text-xs leading-relaxed text-slate-200">
                {c.notice}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f8fb] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric">{c.whyTag}</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.whyTitle}</h2>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">{c.whyBody}</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {c.issueAreas.map((area) => (
              <article key={area.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-navy">{area.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{area.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="civic-framework" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric">{c.frameworkTag}</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.frameworkTitle}</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {c.framework.map((part, index) => (
              <article key={part.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className="text-xs font-bold tracking-wider text-electric">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="mt-4 text-lg font-semibold text-navy">{part.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{part.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#101a2c] py-20 text-white sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#dfbe70]">{c.methodTag}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{c.methodTitle}</h2>
            <p className="mt-6 text-base leading-8 text-slate-300">{c.methodBody}</p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-8">
            <ul className="space-y-4">
              {c.methodOutputs.map((output, index) => (
                <li key={output} className="flex gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
                  <span className="text-xs font-bold text-[#dfbe70]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-sm leading-7 text-slate-200">{output}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric">{c.futureTag}</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-4xl">{c.futureTitle}</h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{c.futureBody}</p>
        </div>
      </section>

      <HumanCenteredAI isFr={locale === "fr-CA"} audience="civic" />

      <section className="bg-[#f6f8fb] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric">{c.boundaryTag}</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-navy md:text-5xl">{c.boundaryTitle}</h2>
          <ul className="mt-9 grid gap-4 md:grid-cols-2">
            {c.boundaries.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5">
                <span aria-hidden="true" className="text-electric">✓</span>
                <span className="text-sm leading-7 text-slate-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[#080e1c] py-20 text-white">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">{c.finalTitle}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">{c.finalBody}</p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <TrackedLink href="/contact?interest=civic" eventName="civic_briefing_request" eventProps={{ source: 'civic_bottom' }} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#dfbe70] px-7 py-3 text-sm font-bold text-navy hover:bg-[#f2d694] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.finalCta}</TrackedLink>
            <TrackedLink href="/union-eyes" eventName="civic_related_union_eyes" className="inline-flex min-h-12 items-center justify-center text-sm font-semibold text-blue-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.related} <span aria-hidden="true" className="ml-2">→</span></TrackedLink>
          </div>
          <TrackedLink href="/doctrine" eventName="civic_doctrine" className="mt-6 inline-flex min-h-10 items-center text-sm text-slate-300 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{c.doctrine} <span aria-hidden="true" className="ml-2">→</span></TrackedLink>
        </div>
      </section>
    </main>
  );
}
