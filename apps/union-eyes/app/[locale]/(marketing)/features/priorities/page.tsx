/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * organizational trust for democratic infrastructure.
 */
/**
 * Priorities feature page.
 * Accessible at /{locale}/features/priorities.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ListChecks,
  AlertTriangle,
  TimerReset,
  Users,
  ArrowRight,
} from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Priorities | UnionEyes',
    description:
      'Priorities is the role-routed queue for next actions, escalations, assignments, and overdue union representative work.',
    alternates: buildLocaleAlternates(locale, '/features/priorities'),
  };
}

const features = {
  'en-CA': [
    {
      icon: ListChecks,
      title: 'One queue for next actions',
      description:
        'Priorities tells each union representative or officer what needs action next instead of forcing them to interpret raw activity feeds.',
    },
    {
      icon: AlertTriangle,
      title: 'Escalations stay visible',
      description:
        'High-risk matters, stalled cases, and urgent deadlines rise to the top before the organization loses time.',
    },
    {
      icon: TimerReset,
      title: 'Deadlines drive action',
      description:
        'The queue reflects what is aging, what is blocked, and what needs follow-up now.',
    },
    {
      icon: Users,
      title: 'Role-routed accountability',
      description:
        'People see the work they own, the work they must review, and the work that needs handoff across the team.',
    },
  ],
  'fr-CA': [
    {
      icon: ListChecks,
      title: 'Une seule file pour les prochaines actions',
      description:
        'Priorités indique à chaque représentant syndical ou agent ce qui nécessite une action, sans devoir interpréter des flux d’activité bruts.',
    },
    {
      icon: AlertTriangle,
      title: 'Les escalades restent visibles',
      description:
        'Les dossiers à risque, les cas bloqués et les échéances urgentes remontent en haut avant que l’organisation ne perde du temps.',
    },
    {
      icon: TimerReset,
      title: 'Les échéances motivent l’action',
      description:
        'La file reflète ce qui vieillit, ce qui est bloqué et ce qui nécessite un suivi immédiat.',
    },
    {
      icon: Users,
      title: 'Responsabilisation par rôle',
      description:
        'Chacun voit le travail qui lui appartient, ce qu’il doit réviser et ce qui doit être transféré dans l’équipe.',
    },
  ],
};

const flow = {
  'en-CA': [
    'Inbox captures the signal.',
    'Priorities decides what requires attention now.',
    'Work handles the governed case activity.',
    'Outcomes records what happened and what follows from it.',
  ],
  'fr-CA': [
    'La boîte de réception capte le signal.',
    'Priorités décide ce qui requiert une attention immédiate.',
    'Travail gère l’activité encadrée du dossier.',
    'Résultats consignent ce qui s’est passé et ce qui en découle.',
  ],
};

export default async function LocalePrioritiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const briefingCta = locale === 'fr-CA' ? 'Commencer la réflexion de continuité (gratuite)' : 'Start the free Continuity Reflection';
  const featuresArr = features[locale as keyof typeof features] ?? features['en-CA'];
  const flowArr = flow[locale as keyof typeof flow] ?? flow['en-CA'];
  const sectionCopy = {
    'en-CA': {
      badge: 'Role-Routed Action Queue',
      heading: 'Priorities turns signals into the next action the team should take',
      description: 'Not every update belongs in the same queue. Priorities organizes what needs review, follow-up, escalation, and assignment for the people responsible.',
      workflowHeading: 'How Priorities fits the workflow',
      seeWorkHeading: 'See how Priorities leads into Work',
      seeWorkDescription: 'Priorities is the decision point between raw signals and governed case execution.',
      seeWorkCta: 'See Work',
    },
    'fr-CA': {
      badge: 'File d’actions routée par rôle',
      heading: 'Priorités transforme les signaux en prochaines actions pour l’équipe',
      description: 'Chaque mise à jour n’appartient pas à la même file. Priorités organise ce qui doit être révisé, suivi, escaladé ou assigné aux personnes responsables.',
      workflowHeading: 'Comment Priorités s’intègre au flux de travail',
      seeWorkHeading: 'Voyez comment Priorités mène à Travail',
      seeWorkDescription: 'Priorités est le point de décision entre les signaux bruts et l’exécution encadrée des dossiers.',
      seeWorkCta: 'Voir Travail',
    },
  };
  const copy = sectionCopy[locale as keyof typeof sectionCopy] ?? sectionCopy['en-CA'];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-full text-sm text-rose-700 font-medium mb-6">
            <ListChecks className="h-4 w-4" />
            <span>{copy.badge}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            {copy.heading}
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            {copy.description}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {featuresArr.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-rose-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-rose-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <section className="mb-20 bg-rose-50 rounded-2xl border border-rose-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">{copy.workflowHeading}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flowArr.map((item) => (
              <div key={item} className="rounded-xl bg-white px-5 py-4 text-sm text-slate-700 border border-rose-100">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">{copy.seeWorkHeading}</h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            {copy.seeWorkDescription}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/organizational-continuity-risk`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 transition-colors text-sm"
            >
              {briefingCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/grievance-tracking`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              {copy.seeWorkCta}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
