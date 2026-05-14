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
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  CheckCircle2,
  Layers,
  Building2,
  Landmark,
  Globe2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InstitutionalContinuityNote } from '@/components/marketing/institutional-continuity-note';
import ScrollReveal from '@/components/public/scroll-reveal';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Pricing | UnionEyes',
    description:
      'UnionEyes is institutional operational infrastructure. Pricing is organized as operational maturity states — Foundation, Governance Operations, Institutional Continuity, Sovereignty Layer — not seat-based SaaS tiers.',
    alternates: buildLocaleAlternates(locale, '/pricing'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Operational reality — the conditions that drive institutions to UE.
// ─────────────────────────────────────────────────────────────────────────────
const operationalReality = [
  {
    title: 'Institutional complexity',
    body: 'Multiple locals, mandates, and committees operating without a coherent operational picture.',
  },
  {
    title: 'Continuity risk',
    body: 'Critical knowledge held by individuals — lost on every leadership transition.',
  },
  {
    title: 'Governance fragmentation',
    body: 'Decisions, motions, and commitments scattered across inboxes, drives, and meeting notes.',
  },
  {
    title: 'Operational turnover',
    body: 'New stewards, officers, and staff inheriting unfinished casework with no operating record.',
  },
  {
    title: 'Steward overload',
    body: 'Front-line representatives carrying organizational memory the institution itself does not retain.',
  },
  {
    title: 'Organizational memory loss',
    body: 'Precedents, doctrines, and prior decisions degrading every year they remain unrecorded.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Maturity ladder — four canonical tiers.
// Restrained brand palette only. No multi-color accents.
// ─────────────────────────────────────────────────────────────────────────────
const maturityTiers = [
  {
    key: 'foundation',
    icon: Layers,
    name: 'Foundation',
    posture: 'Operational stabilization',
    fit: 'Locals and small unions establishing a coherent operating record.',
    feels: 'Stable. Coordinated. Auditable.',
    focus: [
      'Unified intake across cases and member messages',
      'Continuity-safe communication and steward coordination',
      'Bounded operational memory with explicit retention',
      'Operational visibility for officers and committees',
    ],
    surfaces: ['Inbox', 'Work', 'Priorities', 'Baseline Governance', 'Communications'],
    range: 'Annual program — typically $12K–$30K',
  },
  {
    key: 'governance',
    icon: Building2,
    name: 'Governance Operations',
    posture: 'Governance maturity infrastructure',
    fit: 'Mid-sized organizations modernizing governance cadence and federation reporting.',
    feels: 'Disciplined. Measurable. Transparent.',
    focus: [
      'Governance operations and decisions of record',
      'Federation reporting and compliance continuity',
      'Executive visibility across the operating institution',
      'Operational cadence with defensible audit trails',
    ],
    surfaces: ['Foundation surfaces', 'Governance', 'Analytics', 'Federation', 'Compliance', 'Executive Intelligence'],
    range: 'Annual program — typically $40K–$120K',
  },
  {
    key: 'continuity',
    icon: Landmark,
    name: 'Institutional Continuity',
    posture: 'Continuity infrastructure',
    fit: 'National unions and federations preserving institutional memory across transitions.',
    feels: 'Durable. Inherited. Continuous.',
    focus: [
      'Organizational Memory preserved across leadership transitions',
      'Continuity preservation and operational resilience',
      'Succession continuity for officers, stewards, and staff',
      'Governance-safe cognition across the federation',
    ],
    surfaces: [
      'Governance Operations surfaces',
      'Organizational Memory',
      'Continuity Intelligence',
      'Longitudinal Cognition',
      'Cross-Union Analytics',
      'Continuity Simulation',
    ],
    range: 'Scoped with executive leadership — let’s talk',
  },
  {
    key: 'sovereignty',
    icon: Globe2,
    name: 'Sovereignty Layer',
    posture: 'Institutional operational sovereignty',
    fit: 'Strategic federation-wide infrastructure with sovereign operational topology.',
    feels: 'Sovereign. Resilient. Federation-grade.',
    focus: [
      'Sovereign operational topology under your governance',
      'Continuity-safe cognition with fail-closed degradation',
      'Federation-level operational coordination',
      'Institutional resilience tooling and shared continuity infrastructure',
    ],
    surfaces: [
      'Institutional Continuity surfaces',
      'Cognition',
      'Sovereignty Operations',
      'Federation Coordination',
      'Governance-Safe AI',
      'Advanced Continuity Systems',
    ],
    range: 'Strategic federation engagement — let’s talk',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Visibility matrix — what each stakeholder band sees at each tier.
// ─────────────────────────────────────────────────────────────────────────────
const visibilityBands = [
  {
    band: 'Stewards & front-line representatives',
    foundation: 'Unified intake, casework, and continuity-safe communication.',
    governance: 'Casework with governance context and policy precedents.',
    continuity: 'Casework anchored to institutional memory and prior decisions.',
    sovereignty: 'Federation-wide casework patterns and cross-union precedents.',
  },
  {
    band: 'Officers & committees',
    foundation: 'Operational visibility and decisions of record.',
    governance: 'Governance cadence, motions, and compliance continuity.',
    continuity: 'Continuity intelligence across mandates and transitions.',
    sovereignty: 'Sovereign operating intelligence at federation scope.',
  },
  {
    band: 'Executive leadership',
    foundation: 'Operational picture across the institution.',
    governance: 'Executive intelligence with federation reporting.',
    continuity: 'Longitudinal executive intelligence across leadership cycles.',
    sovereignty: 'Federation-grade executive coordination and resilience posture.',
  },
  {
    band: 'Members & the institution',
    foundation: 'Confidence that intake and commitments are not lost.',
    governance: 'Confidence that governance is operating to a defensible cadence.',
    continuity: 'Confidence that institutional memory will outlive any individual.',
    sovereignty: 'Confidence that operational sovereignty is preserved by design.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Continuity progression — institutions evolve operationally over time.
// ─────────────────────────────────────────────────────────────────────────────
const progression = [
  {
    from: 'Foundation',
    to: 'Governance Operations',
    trigger: 'Governance cadence becomes the binding constraint, not casework throughput.',
  },
  {
    from: 'Governance Operations',
    to: 'Institutional Continuity',
    trigger: 'Leadership transitions, succession, and federation reporting become institutional risks.',
  },
  {
    from: 'Institutional Continuity',
    to: 'Sovereignty Layer',
    trigger: 'Operational sovereignty, federation coordination, and shared continuity become strategic priorities.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Procurement-safe positioning — institutional commitments.
// ─────────────────────────────────────────────────────────────────────────────
const procurementCommitments = [
  {
    title: 'Operational honesty',
    body: 'Capabilities, limits, and degradation behaviour are documented before procurement, not after.',
  },
  {
    title: 'Governance-safe cognition',
    body: 'Reasoning surfaces operate under institutional governance — not autonomous agent assumptions.',
  },
  {
    title: 'Fail-closed degradation',
    body: 'When systems degrade, they degrade safely — operations remain governable, not opaque.',
  },
  {
    title: 'Sovereignty posture',
    body: 'Canadian data residency and sovereign hosting are structural commitments, not configuration toggles.',
  },
  {
    title: 'Continuity-safe operations',
    body: 'No operational pathway depends on a single individual, vendor, or undocumented practice.',
  },
];

export default async function LocalePricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tNote = await getTranslations({ locale, namespace: 'continuityNotes.procurement' });
  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.pricing}
        tone="dark"
        revealTempo="conference"
        heading={
          <>
            Institutional operational infrastructure,
            <br />
            organized by operational maturity.
          </>
        }
        description="We meet institutions where they are. Programs are organized as operational maturity states — chosen with you, not handed down as seat counts or feature matrices. Start where it fits, grow when it matters."
      />

      <InstitutionalContinuityNote
        surface={tNote('label')}
        posture={tNote('posture')}
      />

      {/* ── 1. Operational reality ── */}
      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-3">Operational reality</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              Institutions adopt UnionEyes when operational reality outgrows informal coordination. The conditions below consistently determine the right maturity tier.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 narrative-sequence">
            {operationalReality.map((item) => (
              <article key={item.title} className="institution-panel calm-elevation p-5">
                <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. Maturity ladder ── */}
      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-3">Find the tier that fits you today</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              Four operational maturity states. Each one is a coherent place to live for a while — not a feature bundle. You don’t need to start at the top; you need to start where your institution actually is.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-5 narrative-sequence">
            {maturityTiers.map((tier) => {
              const Icon = tier.icon;
              return (
                <article key={tier.key} className="institution-panel calm-elevation p-6 flex flex-col">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-navy" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-navy leading-tight">{tier.name}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{tier.posture}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 italic mb-4">{tier.feels}</p>

                  <p className="text-sm text-slate-700 leading-relaxed mb-5">
                    <span className="font-semibold text-navy">Best for: </span>{tier.fit}
                  </p>

                  <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
                    What you focus on
                  </div>
                  <ul className="space-y-2 mb-5">
                    {tier.focus.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                        <CheckCircle2 className="h-4 w-4 text-[#1f5b84] mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
                    What’s included
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {tier.surfaces.map((s) => (
                      <span
                        key={s}
                        className="inline-block px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-200/70">
                    <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                      Investment
                    </div>
                    <p className="text-sm font-semibold text-navy">{tier.range}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      A starting range — we shape the final scope with you and your procurement team.
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Friendly fit-finder */}
          <div className="institution-panel calm-elevation mt-8 p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-navy mb-1">Not sure where you fit?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                That’s the most common starting point. A short conversation usually makes the right tier obvious — and we’ll tell you honestly if you don’t need the bigger one yet.
              </p>
            </div>
            <Link
              href="../contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-[#1f5b84] transition-colors whitespace-nowrap"
            >
              Talk it through with us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. Visibility matrix ── */}
      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-3">What everyone gets out of it</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              Each tier changes what stewards, officers, executives, and members can see and rely on. High-level on purpose — we keep the feature talk for the conversation.
            </p>
          </ScrollReveal>

          <div className="institution-panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200/70">
                <tr className="text-navy">
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Who</th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Foundation</th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Governance Operations</th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Institutional Continuity</th>
                  <th className="text-left px-5 py-4 font-semibold text-xs uppercase tracking-wider">Sovereignty Layer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {visibilityBands.map((row) => (
                  <tr key={row.band} className="hover:bg-[#f8f6f2]/60 transition-colors">
                    <td className="px-5 py-4 font-semibold text-navy align-top">{row.band}</td>
                    <td className="px-5 py-4 text-slate-700 align-top leading-relaxed">{row.foundation}</td>
                    <td className="px-5 py-4 text-slate-700 align-top leading-relaxed">{row.governance}</td>
                    <td className="px-5 py-4 text-slate-700 align-top leading-relaxed">{row.continuity}</td>
                    <td className="px-5 py-4 text-slate-700 align-top leading-relaxed">{row.sovereignty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 4. Continuity progression ── */}
      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-3">Grow when you’re ready</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              Institutions evolve. The ladder is designed to be lived in — each tier earns the next when something concrete in your operations changes.
            </p>
          </ScrollReveal>

          <div className="space-y-4 narrative-sequence">
            {progression.map((step) => (
              <article
                key={`${step.from}-${step.to}`}
                className="institution-panel calm-elevation p-5 flex flex-col md:flex-row md:items-center gap-4"
              >
                <div className="flex items-center gap-3 md:w-1/3">
                  <span className="text-sm font-semibold text-navy">{step.from}</span>
                  <ArrowRight className="h-4 w-4 text-[#1f5b84]" />
                  <span className="text-sm font-semibold text-navy">{step.to}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed md:flex-1">
                  <span className="font-semibold text-navy">When it happens: </span>
                  {step.trigger}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Procurement-safe positioning ── */}
      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-slate-100 text-navy text-xs font-semibold tracking-wide uppercase mb-4">
              <ShieldCheck className="h-3.5 w-3.5" />
              Procurement-safe by design
            </div>
            <h2 className="text-3xl font-semibold text-navy mb-3">Institutional commitments, not feature claims</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              Every maturity tier inherits the same institutional commitments. These are the positions that distinguish operational infrastructure from generic AI tooling.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 narrative-sequence">
            {procurementCommitments.map((item) => (
              <article key={item.title} className="institution-panel calm-elevation p-5">
                <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-5">
            <Link
              href="../trust"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
            >
              Trust Center <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="../governance"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
            >
              Governance Structure <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="../proof"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
            >
              Institutional Proof <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Executive briefing CTA ── */}
      <section className="py-16 bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/10 text-xs font-semibold tracking-wide uppercase mb-4">
            <Users className="h-3.5 w-3.5" />
            Let’s find the right fit
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Start with a conversation, not a quote
          </h2>
          <p className="text-white/75 text-base max-w-3xl mx-auto mb-8 leading-relaxed">
            Tell us where your institution is today. We’ll help you identify the right tier, walk through what it looks like in practice, and shape the program with you — at the pace that fits your governance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="../pilot-request"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              Request Executive Briefing
            </Link>
            <Link
              href="../contact"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/90 text-navy font-semibold rounded-xl border border-white hover:bg-white transition-all"
            >
              Discuss Operational Maturity
            </Link>
          </div>
          <p className="text-xs text-white/55 mt-6 max-w-2xl mx-auto leading-relaxed">
            Maturity tiers and ranges are positioning structure for institutional planning. Final program scope is set jointly with executive and procurement leadership.
          </p>
        </div>
      </section>
    </div>
  );
}
