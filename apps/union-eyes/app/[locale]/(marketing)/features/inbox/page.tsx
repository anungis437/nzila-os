/**
 * Institutional Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (institutional memory, succession, stewardship),
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
 * institutional trust for democratic infrastructure.
 */
/**
 * Inbox feature page.
 * Accessible at /{locale}/features/inbox.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Inbox,
  Bell,
  ClipboardList,
  MessagesSquare,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Inbox | UnionEyes',
    description:
      'Inbox is the union representative signal hub for intake, follow-up requests, and time-sensitive representation work.',
    alternates: buildLocaleAlternates(locale, '/features/inbox'),
  };
}

const features = {
  'en-CA': [
    {
      icon: ClipboardList,
      title: 'Intake arrives in context',
      description:
        'New intake lands where union representatives can review it with the right organizational context instead of chasing email threads.',
    },
    {
      icon: Bell,
      title: 'Urgent signals stay visible',
      description:
        'Inbox surfaces overdue follow-up, new member updates, and the work that needs attention now.',
    },
    {
      icon: MessagesSquare,
      title: 'Follow-up stays contained',
      description:
        'Requests for clarification and member responses stay connected to the record that triggered them.',
    },
    {
      icon: ShieldCheck,
      title: 'Role-appropriate visibility',
      description:
        'Inbox is for union representatives and admins. Members use the intake and follow-up flow instead of the full signal queue.',
    },
  ],
  'fr-CA': [
    {
      icon: ClipboardList,
      title: 'Les demandes arrivent dans le bon contexte',
      description:
        'Les nouvelles demandes arrivent là où les représentants syndicaux peuvent les examiner avec le bon contexte organisationnel, sans courir après les fils de courriels.',
    },
    {
      icon: Bell,
      title: 'Les signaux urgents restent visibles',
      description:
        'La boîte de réception met en avant les suivis en retard, les nouvelles mises à jour des membres et le travail qui nécessite une attention immédiate.',
    },
    {
      icon: MessagesSquare,
      title: 'Le suivi reste contenu',
      description:
        'Les demandes de clarification et les réponses des membres restent liées à l’enregistrement qui les a déclenchées.',
    },
    {
      icon: ShieldCheck,
      title: 'Visibilité adaptée au rôle',
      description:
        'La boîte de réception est destinée aux représentants syndicaux et aux administrateurs. Les membres utilisent le flux de demande et de suivi au lieu de la file complète des signaux.',
    },
  ],
};

export default async function LocaleInboxPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const briefingCta = locale === 'fr-CA' ? 'Demander un breffage exécutif' : 'Request an Executive Briefing';
  const featuresArr = features[locale as keyof typeof features] ?? features['en-CA'];
  const sectionCopy = {
    'en-CA': {
      badge: 'Union Representative Signal Hub',
      heading: 'Inbox is where the union team sees what needs attention first',
      description: 'Inbox is not a member portal. It is the governed signal queue for union representatives and admins reviewing new intake, follow-up requests, and time-sensitive updates.',
      whatLands: 'What lands here',
      whatLandsList: [
        'New intake submitted by members.',
        'Responses to follow-up requests.',
        'Signals that need triage or reassignment.',
        'Updates that should move into Priorities or Work.',
      ],
    },
    'fr-CA': {
      badge: 'Centre de signaux des représentants syndicaux',
      heading: 'La boîte de réception permet à l’équipe syndicale de voir ce qui nécessite une attention prioritaire',
      description: 'La boîte de réception n’est pas un portail membre. C’est la file de signaux gouvernée pour les représentants syndicaux et les administrateurs qui examinent les nouvelles demandes, les suivis et les mises à jour urgentes.',
      whatLands: 'Ce qui arrive ici',
      whatLandsList: [
        'Nouvelles demandes soumises par les membres.',
        'Réponses aux demandes de suivi.',
        'Signaux nécessitant un tri ou une réaffectation.',
        'Mises à jour à transférer dans Priorités ou Travail.',
      ],
    },
  };
  const copy = sectionCopy[locale as keyof typeof sectionCopy] ?? sectionCopy['en-CA'];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-50 border border-sky-200 rounded-full text-sm text-sky-700 font-medium mb-6">
            <Inbox className="h-4 w-4" />
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
              className="p-6 rounded-xl border border-slate-200 hover:border-sky-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-sky-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <section className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-sky-50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">{copy.whatLands}</h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              {copy.whatLandsList.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">What members see instead</h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>• A narrow intake form.</li>
              <li>• Lightweight case follow-up.</li>
              <li>• Status updates and requests for information.</li>
              <li>• No access to the full steward workflow.</li>
            </ul>
          </div>
        </section>

        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">See how Inbox feeds action</h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            Inbox collects signals. Priorities decides what moves next.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-sky-600 text-white font-semibold rounded-xl hover:bg-sky-700 transition-colors text-sm"
            >
              {briefingCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/priorities`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See Priorities
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
