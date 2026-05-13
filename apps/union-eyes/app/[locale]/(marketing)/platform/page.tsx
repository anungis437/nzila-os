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
import { InstitutionalContinuityNote } from '@/components/marketing/institutional-continuity-note';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'The Operating Architecture | Eight Canonical Institutional Surfaces | UnionEyes',
    description:
      'UnionEyes is organized as eight canonical institutional surfaces — Inbox, Work, Priorities, Intelligence, Cognition, Governance, Corporate Memory, and Trust — composed into one continuous institutional operating record.',
    alternates: buildLocaleAlternates(locale, '/platform'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The 8 canonical pillars. These are the high-level marketing surfaces that
// the runtime now converges around (Wave 3 deletion + Wave 4 convergence).
// Anchor IDs match `locale-site-navigation.tsx` and `locale-site-footer.tsx`.
// ─────────────────────────────────────────────────────────────────────────────
const pillars = [
  {
    id: 'inbox',
    icon: InboxIcon,
    name: 'Inbox',
    posture: 'Unified institutional intake',
    body:
      'A single, governed surface for incoming cases, member messages, federation signals, and operational notifications. Replaces fragmented portal/messaging surfaces with one coherent stream.',
    runtime: 'dashboard/inbox',
  },
  {
    id: 'work',
    icon: Briefcase,
    name: 'Work',
    posture: 'Active representation workbench',
    body:
      'The operating surface for stewards and officers — active grievances, casework, representation tracking, and continuity-safe handoff. The canonical destination for institutional execution.',
    runtime: 'dashboard/work',
  },
  {
    id: 'priorities',
    icon: Target,
    name: 'Priorities',
    posture: 'Operational cadence and commitments',
    body:
      'Deadlines, commitments, and the next set of operationally responsible actions. Cadence-centric, not feature-centric — institutions operate on rhythms, not menus.',
    runtime: 'dashboard/priorities',
  },
  {
    id: 'intelligence',
    icon: LineChart,
    name: 'Intelligence',
    posture: 'Operational interpretation',
    body:
      'One canonical executive surface — federation analytics, executive operating views, sector signals, and cross-union interpretation. Replaces overlapping intelligence variants with one bounded reading.',
    runtime: 'dashboard/intelligence',
  },
  {
    id: 'cognition',
    icon: BrainCircuit,
    name: 'Cognition',
    posture: 'Sovereignty-layer reasoning',
    body:
      'Bounded, governance-safe, continuity-critical reasoning over the institution\'s memory. Gated to sovereignty stewards. Not a chat product — an operational reasoning substrate.',
    runtime: 'dashboard/cognition',
  },
  {
    id: 'governance',
    icon: Scale,
    name: 'Governance',
    posture: 'Decisions of record',
    body:
      'Charter, motions, votes, decisions of record, and the auditable governance trail. The institution\'s governance becomes operational infrastructure, not committee minutes.',
    runtime: 'dashboard/governance',
  },
  {
    id: 'institutional-memory',
    icon: Library,
    name: 'Corporate Memory',
    posture: 'Continuity substrate',
    body:
      'Doctrine, precedents, prior decisions, and the continuity archive. Survives leadership transitions because it is held by the institution, not by individuals.',
    runtime: 'dashboard/institutional-memory',
  },
  {
    id: 'trust',
    icon: ShieldCheck,
    name: 'Trust',
    posture: 'Audit, explainability, sovereignty',
    body:
      'Auditable AI use, explainable reasoning, Canadian operational sovereignty, and procurement-safe governance posture. Trust is not a marketing claim — it is a runtime surface.',
    runtime: 'dashboard/trust',
  },
] as const;

export default async function PlatformOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tNote = await getTranslations({ locale, namespace: 'continuityNotes.ontology' });

  return (
    <main className="min-h-screen bg-white">
      <MarketingHeroSection
        badge={<span className="text-xs uppercase tracking-wider text-white/80">The Operating Architecture</span>}
        heading="One institutional operating experience."
        description="UnionEyes is organized as eight canonical institutional surfaces — composed, not bundled — into one continuous operating record of governance, continuity, and trust."
        imageUrl={heroImagery.platform}
      />

      <InstitutionalContinuityNote
        surface={tNote('label')}
        posture={tNote('posture')}
      />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-2">
          {pillars.map((p) => {
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
                    Operational maturity programs
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-20 rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
          <h3 className="mb-3 text-2xl font-semibold text-navy">
            Composed, not bundled.
          </h3>
          <p className="mx-auto mb-6 max-w-2xl text-sm leading-relaxed text-gray-700">
            Each canonical surface is governance-safe, continuity-safe, and
            procurement-safe. Programs activate the maturity bands appropriate
            to the institution — Foundation, Governance Operations,
            Institutional Continuity, or the Sovereignty Layer.
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-6 py-3 text-sm font-semibold text-white hover:bg-navy/90"
          >
            See operational maturity programs
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}
