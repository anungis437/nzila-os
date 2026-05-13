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
 * Solutions — Stakeholder-Oriented Platform Journeys
 *
 * Enterprise IA: Solutions hub surfacing each stakeholder journey.
 * Hides platform sophistication. Exposes institutional outcomes.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  Settings,
  Cpu,
  Heart,
  Briefcase,
  ArrowRight,
} from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Solutions | UnionEyes',
    description:
      'Institutional continuity and governance intelligence solutions for every stakeholder: union executives, governance leaders, operations, technology, policy, and procurement.',
    alternates: buildLocaleAlternates(locale, '/solutions'),
  };
}

const solutions = [
  {
    icon: Users,
    audience: 'Union Executive Leadership',
    href: 'solutions/executive-leadership',
    challenge: 'Strategic continuity is at risk when institutional knowledge lives in individuals, not in the organization.',
    outcomes: [
      'Organizational continuity visibility across leadership transitions',
      'Strategic coherence through succession and change',
      'Executive-grade operational summaries without technical complexity',
    ],
    cta: 'Executive leadership solutions',
  },
  {
    icon: ShieldCheck,
    audience: 'Governance Leadership',
    href: 'solutions/governance-leadership',
    challenge: 'Governance modernization requires explainability, oversight controls, and continuity — not opaque AI.',
    outcomes: [
      'Explainable governance intelligence with human oversight',
      'Governance modernization with full audit trails',
      'Continuity oversight across governance transitions',
    ],
    cta: 'Governance leadership solutions',
  },
  {
    icon: Settings,
    audience: 'Operations Leadership',
    href: 'solutions/operations-leadership',
    challenge: 'Operational fragmentation erodes institutional resilience over time.',
    outcomes: [
      'Operational coherence across distributed teams',
      'Institutional memory preservation during change',
      'Continuity planning for operational resilience',
    ],
    cta: 'Operations leadership solutions',
  },
  {
    icon: Cpu,
    audience: 'Technology Leadership',
    href: 'solutions/technology-leadership',
    challenge: 'Labour organizations need enterprise-safe AI that is explainable, governed, and trusted — not experimental.',
    outcomes: [
      'Governance-safe AI with full explainability guarantees',
      'Enterprise security and Canadian data residency',
      'Institutional trust infrastructure with audit capabilities',
    ],
    cta: 'Technology leadership solutions',
  },
  {
    icon: Heart,
    audience: 'Policy & Labour Leadership',
    href: 'solutions/labour-leadership',
    challenge: 'AI adoption in labour environments requires unambiguous labour-safe postures and human oversight.',
    outcomes: [
      'Anti-monitoring by design — no individual conduct grading',
      'Human oversight in all intelligence recommendations',
      'Labour-safe modernization with democratic governance controls',
    ],
    cta: 'Policy & labour solutions',
  },
  {
    icon: Briefcase,
    audience: 'Procurement Stakeholders',
    href: 'solutions/procurement',
    challenge: 'Procurement decisions require operational credibility, implementation readiness, and institutional trust validation.',
    outcomes: [
      'Modular deployment with phased implementation pathways',
      'Trust center documentation and audit-ready exports',
      'Pilot readiness assessment and governance briefings',
    ],
    cta: 'Procurement resources',
  },
];

export default async function SolutionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <div className="bg-white min-h-screen">
      {/* Hero with Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.solutions}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Solutions
          </span>
        }
        heading="Built for every institutional stakeholder"
        description="UnionEyes organizes around institutional stakeholder journeys — not engineering systems. Every capability surfaces the outcomes that matter for your role."
      />

      {/* ── Solutions Grid ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="space-y-10">
          {solutions.map((sol) => (
            <div
              key={sol.audience}
              className="flex flex-col md:flex-row gap-8 p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="flex-shrink-0 flex items-start justify-center md:justify-start">
                <div className="w-14 h-14 rounded-2xl bg-electric/10 flex items-center justify-center">
                  <sol.icon className="h-6 w-6 text-electric" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-navy mb-2">{sol.audience}</h2>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{sol.challenge}</p>
                <ul className="space-y-2 mb-6">
                  {sol.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 flex-shrink-0" />
                      {outcome}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}/${sol.href}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric hover:text-blue-700 transition-colors"
                >
                  {sol.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-navy text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to explore your stakeholder journey?
          </h2>
          <p className="text-white/70 mb-8">
            Request an institutional briefing tailored to your role and institutional context.
          </p>
          <Link
            href={`/${locale}/pilot-request`}
            className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
          >
            Request an Institutional Briefing
          </Link>
        </div>
      </section>
    </div>
  );
}
