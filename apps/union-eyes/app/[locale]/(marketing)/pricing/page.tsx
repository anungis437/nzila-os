export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FileCheck,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';

export const metadata: Metadata = {
  title: 'Pricing | Institutional Modernization Programs | Union Eyes',
  description:
    'Program-based commercial packaging for institutional continuity modernization, governance transformation, and operational trust infrastructure.',
};

const programs = [
  {
    name: 'Governance Continuity Foundation',
    fit: 'Best fit: Locals, smaller unions, and associations establishing governance modernization foundations.',
    focus: [
      'Operational continuity baselines',
      'Organizational memory foundations',
      'Governance workflow modernization',
      'Explainable operational visibility',
    ],
  },
  {
    name: 'Institutional Intelligence Program',
    fit: 'Best fit: Larger unions, federations, and multi-unit organizations coordinating cross-functional modernization.',
    focus: [
      'Continuity intelligence across leadership structures',
      'Executive-grade institutional visibility',
      'Memory mapping across teams and mandates',
      'Operational coherence modernization',
    ],
  },
  {
    name: 'Enterprise Governance & Continuity',
    fit: 'Best fit: National federations and large public-sector governance ecosystems with complex institutional scope.',
    focus: [
      'Enterprise continuity resilience planning',
      'Governance modernization at scale',
      'Explainability and oversight frameworks',
      'Strategic implementation partnership',
    ],
  },
];

const pricingPrinciples = [
  'Commercial structure reflects organizational complexity, not feature checklists.',
  'Program scope aligns to governance maturity and operational coordination needs.',
  'Packaging is designed around continuity outcomes, not consumption metrics.',
  'Implementation pathways are staged to match institutional readiness.',
];

const pilotTracks = [
  {
    title: 'Institutional Continuity Modernization Pilot',
    body: 'A structured pilot pathway focused on continuity visibility, governance-safe modernization, and executive readiness.',
  },
  {
    title: 'Governance Explainability Pilot',
    body: 'A pilot designed for policy and governance teams to validate explainability standards and human oversight controls.',
  },
  {
    title: 'Operational Coherence Pilot',
    body: 'A pilot centered on cross-team coordination, institutional memory recovery, and transition resilience.',
  },
];

const services = [
  'Executive onboarding and modernization planning sessions',
  'Governance and trust alignment workshops',
  'Institutional operating model configuration',
  'Change enablement and phased rollout support',
  'Operational KPI and continuity baseline definition',
  'Procurement and implementation brief support',
];

export default function LocalePricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.pricing}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Institutional Modernization Programs
          </span>
        }
        heading={
          <>
            Pricing for institutional transformation,
            <br />
            not software access.
          </>
        }
        description="Union Eyes is packaged as an operational modernization partnership. Commercial structure is based on institutional scope, governance complexity, and continuity outcomes."
      />

      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-8 text-center">Program structure</h2>
          <div className="grid lg:grid-cols-3 gap-6">
            {programs.map((program) => (
              <article key={program.name} className="rounded-2xl border border-gray-100 bg-white p-6">
                <h3 className="text-lg font-bold text-navy mb-2">{program.name}</h3>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">{program.fit}</p>
                <ul className="space-y-2">
                  {program.focus.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-electric mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-6 text-center">Commercial architecture principles</h2>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-7">
            <ul className="space-y-3">
              {pricingPrinciples.map((principle) => (
                <li key={principle} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-electric mt-2 shrink-0" />
                  {principle}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-navy">Pilot pathways</h2>
            <p className="text-sm text-gray-600 mt-2 max-w-3xl mx-auto">
              Pilot programs are framed as institutional modernization pathways, not product trials.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {pilotTracks.map((track) => (
              <article key={track.title} className="rounded-2xl border border-gray-100 bg-white p-6">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <Compass className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-base font-bold text-navy mb-2">{track.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{track.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-8">
          <article className="rounded-2xl border border-gray-100 bg-gray-50 p-7">
            <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
              <Workflow className="h-5 w-5 text-electric" />
            </div>
            <h3 className="text-xl font-bold text-navy mb-3">Implementation services</h3>
            <ul className="space-y-2">
              {services.map((item) => (
                <li key={item} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-electric mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-gray-100 bg-gray-50 p-7">
            <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
              <ShieldCheck className="h-5 w-5 text-electric" />
            </div>
            <h3 className="text-xl font-bold text-navy mb-3">Governance & trust references</h3>
            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <p>Explainability standards and human oversight posture are embedded in every program scope.</p>
              <p>Governance architecture and trust controls are documented for procurement and executive review.</p>
              <p>Commercial pathways include implementation governance checkpoints, not just software deployment milestones.</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="../trust" className="inline-flex items-center gap-1 text-sm font-semibold text-electric hover:text-blue-700 transition-colors">
                View Trust Center <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="../governance" className="inline-flex items-center gap-1 text-sm font-semibold text-electric hover:text-blue-700 transition-colors">
                Review Governance Structure <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/15 text-xs font-semibold tracking-wide uppercase mb-4">
            <Users className="h-3.5 w-3.5" />
            Executive Briefing Pathway
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Discuss institutional modernization packaging
          </h2>
          <p className="text-white/75 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
            We provide consultative program packaging and implementation pathways aligned to your governance maturity,
            organizational scale, and continuity priorities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="../pilot-request"
              className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
            >
              Request Executive Briefing
            </Link>
            <Link
              href="../contact"
              className="inline-flex items-center justify-center px-8 py-4 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              Discuss Institutional Modernization
            </Link>
          </div>
          <p className="text-xs text-white/60 mt-6">
            Public program structure is shown for planning alignment. Commercial proposals are finalized through executive and procurement briefing.
          </p>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-gray-100 p-6 bg-gray-50">
            <div className="flex items-start gap-3">
              <FileCheck className="h-5 w-5 text-electric mt-0.5 shrink-0" />
              <p className="text-sm text-gray-700 leading-relaxed">
                Procurement-safe language, governance evidence, implementation approach, and onboarding methodology are available in the executive briefing pack.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
