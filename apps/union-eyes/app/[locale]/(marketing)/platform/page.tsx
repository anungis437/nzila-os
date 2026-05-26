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
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Inbox as InboxIcon,
  Briefcase,
  Target,
  LineChart,
  BrainCircuit,
  Scale,
  Library,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { OrganizationalContinuityNote } from '@/components/marketing/organizational-continuity-note';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    alternates: buildLocaleAlternates(locale, '/platform'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The 8 canonical pillars. These are the high-level marketing surfaces that
// the runtime now converges around (Wave 3 deletion + Wave 4 convergence).
// Anchor IDs match `locale-site-navigation.tsx` and `locale-site-footer.tsx`.
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_COPY = {
  'en-CA': {
    metadataTitle: 'Platform overview | How UnionEyes works | UnionEyes',
    metadataDescription:
      'See the parts of UnionEyes and how they work together to support day-to-day union operations.',
    badge: 'Platform overview',
    heading: 'One platform for the work your team does every day.',
    description:
      'UnionEyes brings cases, priorities, decisions, and audit trails into one system.',
    maturityLink: 'Operational maturity programs',
    finalHeading: 'Everything works better together.',
    finalBody:
      'Start with the parts you need now, then expand as your team grows.',
    finalCta: 'See operational maturity programs',
    pillars: [
      {
        id: 'inbox',
        icon: InboxIcon,
        name: 'Inbox',
        posture: 'One place for incoming work',
        body:
          'Cases, member messages, and alerts come into one queue so nothing gets missed.',
        runtime: 'dashboard/inbox',
      },
      {
        id: 'work',
        icon: Briefcase,
        name: 'Work',
        posture: 'Where active casework happens',
        body:
          'Track grievances and casework, assign owners, and hand off work without losing context.',
        runtime: 'dashboard/work',
      },
      {
        id: 'priorities',
        icon: Target,
        name: 'Priorities',
        posture: 'Deadlines and next steps',
        body:
          'See what is due next, what is at risk, and what your team should do now.',
        runtime: 'dashboard/priorities',
      },
      {
        id: 'intelligence',
        icon: LineChart,
        name: 'Intelligence',
        posture: 'Trends you can act on',
        body:
          'Turn activity data into trends so leaders can spot risk early and decide faster.',
        runtime: 'dashboard/intelligence',
      },
      {
        id: 'cognition',
        icon: BrainCircuit,
        name: 'Cognition',
        posture: 'Assisted analysis for complex work',
        body:
          'Use structured AI help for difficult decisions, with review controls and clear boundaries.',
        runtime: 'dashboard/cognition',
      },
      {
        id: 'governance',
        icon: Scale,
        name: 'Governance',
        posture: 'Decisions and policy history',
        body:
          'Keep motions, votes, and decisions in one place with a clear history.',
        runtime: 'dashboard/governance',
      },
      {
        id: 'organizational-memory',
        icon: Library,
        name: 'Organizational Memory',
        posture: 'Shared team memory',
        body:
          'Store key precedents and past decisions so knowledge stays with the organization.',
        runtime: 'dashboard/organizational-memory',
      },
      {
        id: 'trust',
        icon: ShieldCheck,
        name: 'Trust',
        posture: 'Audit and accountability',
        body:
          'Review AI use, controls, and evidence trails so oversight stays straightforward.',
        runtime: 'dashboard/trust',
      },
    ],
  },
  'fr-CA': {
    metadataTitle: 'Vue de la plateforme | Comment UnionEyes fonctionne | UnionEyes',
    metadataDescription:
      'Decouvrez les parties de UnionEyes et comment elles travaillent ensemble au quotidien.',
    badge: 'Vue de la plateforme',
    heading: 'Une seule plateforme pour le travail quotidien de votre equipe.',
    description:
      'UnionEyes rassemble dossiers, priorites, decisions et traces d audit dans un seul systeme.',
    maturityLink: 'Programmes de maturité opérationnelle',
    finalHeading: 'Tout fonctionne mieux ensemble.',
    finalBody:
      'Commencez avec les surfaces utiles maintenant, puis elargissez selon la croissance de votre equipe.',
    finalCta: 'Voir les programmes de maturité opérationnelle',
    pillars: [
      {
        id: 'inbox',
        icon: InboxIcon,
        name: 'Boîte de réception',
        posture: 'Un seul point d entree',
        body:
          'Les dossiers, messages des membres et alertes arrivent dans une seule file.',
        runtime: 'dashboard/inbox',
      },
      {
        id: 'work',
        icon: Briefcase,
        name: 'Travail',
        posture: 'Espace de travail actif',
        body:
          'Suivez les griefs et dossiers, assignez les responsables et transferez sans perdre le contexte.',
        runtime: 'dashboard/work',
      },
      {
        id: 'priorities',
        icon: Target,
        name: 'Priorités',
        posture: 'Echeances et prochaines actions',
        body:
          'Voyez ce qui est urgent, ce qui arrive bientot et ce que l equipe doit faire ensuite.',
        runtime: 'dashboard/priorities',
      },
      {
        id: 'intelligence',
        icon: LineChart,
        name: 'Intelligence',
        posture: 'Tendances utiles',
        body:
          'Transformez les donnees en tendances pour decider plus vite.',
        runtime: 'dashboard/intelligence',
      },
      {
        id: 'cognition',
        icon: BrainCircuit,
        name: 'Cognition',
        posture: 'Aide analytiques pour cas complexes',
        body:
          'Utilisez une aide IA structuree avec controles humains et limites claires.',
        runtime: 'dashboard/cognition',
      },
      {
        id: 'governance',
        icon: Scale,
        name: 'Gouvernance',
        posture: 'Historique des decisions',
        body:
          'Conservez motions, votes et decisions dans un seul endroit.',
        runtime: 'dashboard/governance',
      },
      {
        id: 'organizational-memory',
        icon: Library,
        name: 'Mémoire organisationnelle',
        posture: 'Memoire partagee de l equipe',
        body:
          'Gardez les precedents et decisions cles pour que le savoir reste dans l organisation.',
        runtime: 'dashboard/organizational-memory',
      },
      {
        id: 'trust',
        icon: ShieldCheck,
        name: 'Confiance',
        posture: 'Audit et responsabilite',
        body:
          'Suivez l usage IA, les controles et les preuves pour faciliter la supervision.',
        runtime: 'dashboard/trust',
      },
    ],
  },
} as const;

export default async function PlatformOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tNote = await getTranslations({ locale, namespace: 'continuityNotes.ontology' });
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];

  return (
    <main className="min-h-screen bg-white">
      <MarketingHeroSection
        badge={<span className="text-xs uppercase tracking-wider text-white/80">{copy.badge}</span>}
        heading={copy.heading}
        description={copy.description}
        imageUrl={heroImagery.platform}
      />

      <OrganizationalContinuityNote
        surface={tNote('label')}
        posture={tNote('posture')}
      />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-2">
          {copy.pillars.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.id}
                id={p.id}
                className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-5 flex items-center gap-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-electric">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold text-navy">{p.name}</h2>
                    <p className="text-sm text-gray-500">{p.posture}</p>
                  </div>
                </div>
                <p className="mb-5 text-sm leading-relaxed text-gray-700">{p.body}</p>
                <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
                  <code className="rounded bg-gray-50 px-2 py-1 text-gray-600">
                    /{p.runtime}
                  </code>
                  <Link
                    href={`/${locale}/pricing`}
                    className="inline-flex items-center gap-1 text-electric hover:text-navy"
                  >
                    {copy.maturityLink}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-20 rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
          <h3 className="mb-3 text-2xl font-semibold text-navy">
            {copy.finalHeading}
          </h3>
          <p className="mx-auto mb-6 max-w-2xl text-sm leading-relaxed text-gray-700">
            {copy.finalBody}
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy/90"
          >
            {copy.finalCta}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}
