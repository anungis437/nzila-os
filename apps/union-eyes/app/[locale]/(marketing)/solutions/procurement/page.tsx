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
import { Briefcase, FileCheck, CheckCircle2, BarChart3, Layers, ArrowRight } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  governanceOperationalWalkthroughs,
  governanceMaturityDimensions,
  governanceModernizationJourney,
  governanceReviewSimulationLayers,
  institutionalRolloutPathway,
  operationalMaturityPathway,
  deploymentTimelines,
  executiveScenarioModels,
  procurementEvidenceBinder,
} from '@/lib/institutional-legitimacy';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Procurement Stakeholders | Solutions | UnionEyes',
    description:
      'Procurement-ready governance, clear implementation scope, and measurable value for institutional deployments.',
    alternates: buildLocaleAlternates(locale, '/solutions/procurement'),
  };
}

const outcomes = [
  {
    icon: Briefcase,
    title: 'Procurement-ready scope',
    desc: 'Clear module boundaries, staged rollout options, and governance-safe implementation paths.',
  },
  {
    icon: FileCheck,
    title: 'Trust documentation in hand',
    desc: 'Explainability standards, governance controls, and security posture are documented for due diligence.',
  },
  {
    icon: CheckCircle2,
    title: 'Implementation risk reduced',
    desc: 'Phased deployment avoids big-bang risk and aligns with institutional change capacity.',
  },
  {
    icon: BarChart3,
    title: 'Value visibility for leadership',
    desc: 'Outcomes are measured in operational terms: cycle time, admin burden, and continuity health.',
  },
  {
    icon: Layers,
    title: 'Cross-stakeholder alignment',
    desc: 'Operations, governance, policy, and technology teams align around one shared implementation plan.',
  },
];

const challenges = [
  'Procurement processes often miss governance and labour-safety requirements unique to unions',
  'Vendors present broad AI claims without explainability or audit-ready evidence',
  'Implementation risk rises when rollout plans ignore organizational readiness',
  'Stakeholders find it difficult to compare options without clear continuity and trust criteria',
];

export default function ProcurementPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.procurementLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Solutions · Procurement Stakeholders
          </span>
        }
        heading={<>Procurement clarity for<br />institutional deployment.</>}
        description="UnionEyes gives procurement teams a practical, defensible path to selection: clear scope, governance-ready controls, and measurable outcomes for leadership confidence."
        cta={
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              Request an Institutional Briefing
            </Link>
            <Link href="../trust" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              Review Trust Center
            </Link>
          </div>
        }
      />

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-navy mb-4">The procurement challenge</h2>
            <ul className="space-y-3">
              {challenges.map((c) => (
                <li key={c} className="flex items-start gap-3 text-gray-700 text-sm leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-10 text-center">What procurement stakeholders gain</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {outcomes.map((o) => (
              <div key={o.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <o.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-sm font-bold text-navy mb-2">{o.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-2xl font-bold text-navy mb-3">Build confidence through phased, governable deployment</h2>
          <p className="text-sm text-gray-600 max-w-3xl mb-6">
            Procurement teams can evaluate deployment safety through explicit implementation boundaries, governance checkpoints, and rollout pacing that avoids institutional disruption.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <article className="p-5 rounded-xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Implementation Boundaries</h3>
              <p className="text-xs text-gray-600">Clear scope definitions for pilot modules, governance ownership, and continuity requirements.</p>
            </article>
            <article className="p-5 rounded-xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Governance Review Pathways</h3>
              <p className="text-xs text-gray-600">Documented oversight, explainability standards, and audit-ready decision pathways for due diligence.</p>
            </article>
            <article className="p-5 rounded-xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Phased Adoption Controls</h3>
              <p className="text-xs text-gray-600">Sequenced rollout checkpoints that align deployment speed with institutional change capacity.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-3">Institutional rollout sequence for procurement planning</h2>
          <p className="text-sm text-gray-600 mb-6 max-w-3xl">
            This canonical pathway helps procurement and leadership teams validate deployability, risk posture, and implementation realism before commitment.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3 text-sm">
            {institutionalRolloutPathway.map((stage, index) => (
              <article key={stage} className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-center">
                <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">Phase {index + 1}</p>
                <p className="font-semibold text-navy">{stage}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-navy mb-4">Governance journey map</h3>
              <div className="space-y-3">
                {governanceModernizationJourney.map((stage) => (
                  <article key={stage.stage} className="p-4 rounded-lg bg-white border border-gray-100">
                    <h4 className="text-sm font-semibold text-navy mb-1">{stage.stage}</h4>
                    <p className="text-xs text-gray-600">{stage.detail}</p>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-navy mb-4">Operational maturity model</h3>
              <div className="space-y-3 mb-5">
                {operationalMaturityPathway.map((stage, index) => (
                  <div key={stage} className="p-3 rounded-lg bg-white border border-gray-100 text-sm text-gray-700">
                    {index + 1}. <span className="font-semibold text-navy">{stage}</span>
                  </div>
                ))}
              </div>
              <h4 className="text-sm font-bold text-navy mb-2">Governance maturity dimensions</h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {governanceMaturityDimensions.map((dimension) => (
                  <div key={dimension.key} className="p-3 rounded-lg bg-white border border-gray-100">
                    <p className="text-xs font-semibold text-navy">{dimension.label}</p>
                    <p className="text-xs text-gray-600">{dimension.focus}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-2xl font-bold text-navy mb-3">Phased pacing for procurement and leadership confidence</h2>
          <p className="text-sm text-gray-600 max-w-3xl mb-6">
            Reviewers can see how deployment would be staged over time, where governance stays engaged, and how continuity is protected during adoption.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {deploymentTimelines.map((timeline) => (
              <article key={timeline.title} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-1">{timeline.title}</h3>
                <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">{timeline.purpose}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{timeline.detail}</p>
              </article>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {executiveScenarioModels.map((scenario) => (
              <article key={scenario.title} className="p-5 rounded-xl border border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-navy mb-2">{scenario.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{scenario.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-2xl font-bold text-navy mb-3">Due diligence content in one operational package</h2>
          <p className="text-sm text-gray-600 max-w-3xl mb-6">
            Procurement teams receive implementation-aware evidence organized for reviewability, governance confidence, and continuity-safe deployment decisions.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {procurementEvidenceBinder.map((item) => (
              <article key={item} className="p-4 rounded-lg bg-white border border-gray-100 text-sm text-gray-700">
                {item}
              </article>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {governanceOperationalWalkthroughs.map((walkthrough) => (
              <article key={walkthrough.type} className="p-5 rounded-xl bg-white border border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{walkthrough.focus}</p>
                <h3 className="text-sm font-bold text-navy mb-2">{walkthrough.type}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{walkthrough.narrative}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 p-5 rounded-xl bg-white border border-gray-100">
            <h3 className="text-sm font-bold text-navy mb-3">Governance review simulation layers</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {governanceReviewSimulationLayers.map((layer) => (
                <div key={layer} className="text-xs text-gray-700 px-3 py-2 rounded border border-gray-100 bg-gray-50">
                  {layer}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-base font-bold text-navy mb-6">Explore related solutions</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Technology Leadership', href: './technology-leadership' },
              { label: 'Policy & Labour Leadership', href: './labour-leadership' },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 text-sm font-medium text-navy hover:text-electric transition-colors">
                {l.label} <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Run an evidence-backed procurement process</h2>
          <p className="text-white/70 mb-8">Get a guided demo and implementation brief for your team.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request an Institutional Briefing
          </Link>
        </div>
      </section>
    </div>
  );
}
