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
 * Member Intake feature page.
 * Accessible at /{locale}/features/member-portal.
 * Members submit intake and follow lightweight status only.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ClipboardList,
  Eye,
  FileUp,
  Bell,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Member Intake & Follow-up | UnionEyes',
    description:
      'Member-facing intake submission and lightweight case follow-up, while union representatives manage the full UnionEyes workflow.',
    alternates: buildLocaleAlternates(locale, '/features/member-portal'),
  };
}

const features = {
  'en-CA': [
    {
      icon: ClipboardList,
      title: 'Structured intake submission',
      description:
        'Members submit a clear intake with issue details, desired outcome, and supporting context before a union representative turns it into formal casework.',
    },
    {
      icon: FileUp,
      title: 'Secure document handoff',
      description:
        'Photos, letters, and supporting files move into the representative workflow without relying on scattered email threads.',
    },
    {
      icon: Eye,
      title: 'Lightweight case follow-up',
      description:
        'Members can check status and recent updates without needing access to Inbox, Priorities, Work, Intelligence, or Outcomes.',
    },
    {
      icon: Bell,
      title: 'Update notifications',
      description:
        'Status changes and follow-up requests surface as simple notifications so members know when action is needed from them.',
    },
    {
      icon: MessageSquare,
      title: 'Representative handoff',
      description:
        'Once intake is reviewed, union representatives take over inside the core app while members stay in a narrow, controlled follow-up flow.',
    },
  ],
  'fr-CA': [
    {
      icon: ClipboardList,
      title: 'Soumission structurée de la demande',
      description:
        'Les membres soumettent une demande claire avec les détails du problème, le résultat souhaité et le contexte avant qu’un représentant syndical ne la transforme en dossier formel.',
    },
    {
      icon: FileUp,
      title: 'Transfert sécurisé de documents',
      description:
        'Photos, lettres et fichiers de soutien sont transférés dans le flux du représentant sans dépendre de courriels dispersés.',
    },
    {
      icon: Eye,
      title: 'Suivi léger des dossiers',
      description:
        'Les membres peuvent vérifier le statut et les mises à jour récentes sans accéder à la boîte de réception, Priorités, Travail, Intelligence ou Résultats.',
    },
    {
      icon: Bell,
      title: 'Notifications de mise à jour',
      description:
        'Les changements de statut et les demandes de suivi apparaissent comme de simples notifications pour que les membres sachent quand une action est requise.',
    },
    {
      icon: MessageSquare,
      title: 'Transfert au représentant',
      description:
        'Une fois la demande examinée, les représentants syndicaux prennent le relais dans l’application principale tandis que les membres restent dans un flux de suivi contrôlé.',
    },
  ],
};

export default async function LocaleMemberPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const briefingCta = locale === 'fr-CA' ? 'Commencer la réflexion de continuité (gratuite)' : 'Start the free Continuity Reflection';
  const featuresArr = features[locale as keyof typeof features] ?? features['en-CA'];
  const sectionCopy = {
    'en-CA': {
      badge: 'Member-Facing Entry',
      heading: 'Submit intake. Follow progress. Leave the casework to your union team.',
      description: 'Members do not work inside the full UnionEyes application. They submit intake, share supporting material, and follow lightweight updates while union representatives operate Inbox, Priorities, Work, Intelligence, and Outcomes.',
    },
    'fr-CA': {
      badge: 'Entrée côté membre',
      heading: 'Soumettez une demande. Suivez la progression. Laissez le traitement à votre équipe syndicale.',
      description: 'Les membres n’utilisent pas l’application UnionEyes complète. Ils soumettent une demande, partagent des documents et suivent les mises à jour légères tandis que les représentants syndicaux gèrent la boîte de réception, Priorités, Travail, Intelligence et Résultats.',
    },
  };
  const copy = sectionCopy[locale as keyof typeof sectionCopy] ?? sectionCopy['en-CA'];

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 font-medium mb-6">
            <ClipboardList className="h-4 w-4" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {featuresArr.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <section className="mb-20 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-blue-50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">For members</h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>• Submit a new issue without navigating the full admin workflow.</li>
              <li>• Upload supporting documents from any device.</li>
              <li>• See current status and recent requests for information.</li>
              <li>• Receive simple updates when the union team needs follow-up.</li>
            </ul>
          </div>
          <div className="bg-violet-50 rounded-xl p-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">For union representatives</h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>• Triage intake from Inbox without exposing the rest of the app to members.</li>
              <li>• Request missing information without falling back to email chaos.</li>
              <li>• Convert qualified intake into governed casework inside Work.</li>
              <li>• Keep member follow-up narrow, auditable, and easy to understand.</li>
            </ul>
          </div>
        </section>

        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            See how member intake feeds the steward workflow
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            The member-facing flow stays narrow by design. Inbox and Work pick it up from there.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/institutional-continuity-risk`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              {briefingCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/inbox`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See Inbox
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
