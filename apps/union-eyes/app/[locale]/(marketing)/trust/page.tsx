/**
 * Trust & Compliance page.
 * Accessible at /{locale}/trust — fully translated.
 *
 * Demonstrates governance-first platform design: audit trails,
 * RBAC, Canadian data sovereignty, financial reconciliation,
 * entitlement controls, and defensibility.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ShieldCheck,
  Lock,
  MapPin,
  DollarSign,
  ToggleRight,
  Scale,
  ArrowRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusPage } from '@/components/monitoring/StatusPage';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InstitutionalContinuityNote } from '@/components/marketing/institutional-continuity-note';
import { getInstitutionalModeProfile, parseInstitutionalMode, withInstitutionalContext } from '@/lib/institutional-context';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  committeeCoordinationSimulations,
  executiveBriefingFlows,
  governanceFrictionSimulationFlows,
  governanceMaturityDimensions,
  governanceOperationalWalkthroughs,
  governanceReviewSimulationLayers,
  leadershipTransitionContinuityScenarios,
  operationalMaturityPathway,
  operationalDisruptionModels,
  organizationalStabilizationSimulationFlow,
  procurementEvidenceBinder,
} from '@/lib/institutional-legitimacy';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.trust' });
  return {
    title: t('pageTitle'),
    description: t('heroDescription'),
    alternates: buildLocaleAlternates(locale, '/trust'),
  };
}

const pillars = [
  { icon: ShieldCheck, key: 'audit' },
  { icon: Lock, key: 'rbac' },
  { icon: MapPin, key: 'data' },
  { icon: DollarSign, key: 'recon' },
  { icon: ToggleRight, key: 'entitlement' },
  { icon: Scale, key: 'defensibility' },
] as const;

export default async function TrustPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ context?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);
  const contextProfile = getInstitutionalModeProfile(contextMode);
  const t = await getTranslations({ locale, namespace: 'marketing.trust' });
  const tNote = await getTranslations({ locale, namespace: 'continuityNotes.trust' });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero with Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.trust}
        badge={
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 border border-white/30 rounded-full text-sm text-white font-medium backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4" />
            <span>{t('badge')}</span>
          </div>
        }
        heading={t('heroHeading')}
        description={t('heroDescription')}
        contextKicker={`${contextProfile.label} context`}
        contextNote={contextProfile.heroFraming}
        cta={
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Link
              href={withInstitutionalContext(`/${locale}/proof`, contextMode)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/30"
            >
              Review the proof record
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={withInstitutionalContext(`/${locale}/pilot-request`, contextMode)}
              className="inline-flex items-center gap-2 rounded-xl border border-electric/40 bg-electric px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Begin a continuity briefing
            </Link>
          </div>
        }
      />

      <InstitutionalContinuityNote
        surface={tNote('label')}
        posture={tNote('posture')}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Tabs defaultValue="foundations" className="space-y-8">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-5 gap-2 bg-transparent p-0 my-3">
              <TabsTrigger value="foundations" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-navy/70 data-[state=active]:text-navy data-[state=active]:shadow-none">
                Foundations
              </TabsTrigger>
              <TabsTrigger value="governance" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-navy/70 data-[state=active]:text-navy data-[state=active]:shadow-none">
                Governance
              </TabsTrigger>
              <TabsTrigger value="scenario" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-navy/70 data-[state=active]:text-navy data-[state=active]:shadow-none">
                {t('phase6.tabScenario')}
              </TabsTrigger>
              <TabsTrigger value="proof" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-navy/70 data-[state=active]:text-navy data-[state=active]:shadow-none">
                Proof Layer
              </TabsTrigger>
              <TabsTrigger value="status" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-navy/70 data-[state=active]:text-navy data-[state=active]:shadow-none">
                Status
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="foundations" className="space-y-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {pillars.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="p-8 rounded-xl border border-slate-200 hover:border-navy/20 hover:shadow-sm transition-all"
            >
              <Icon className="h-8 w-8 text-navy mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                {t(`${key}Title`)}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {t(`${key}Desc`)}
              </p>
            </div>
          ))}
            </div>

        {/* Labour-Safe AI */}
        <section id="labour-safe" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Labour-Safe AI</h2>
          <p className="text-slate-600 mb-6 max-w-2xl leading-relaxed">
            UnionEyes is designed from the ground up for deployment in labour environments.
            Our labour-safe posture is not a policy addendum — it is an architectural commitment
            enforced at every layer of the platform.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Zero worker surveillance',          desc: 'No worker behavioural scoring, monitoring, or performance tracking.' },
              { label: 'No workforce analytics',             desc: 'Intelligence is institutional, not individual. Workers are never the subject of analysis.' },
              { label: 'Human oversight required',           desc: 'All intelligence recommendations require human review before any action.' },
              { label: 'Democratic governance controls',     desc: 'AI systems operate within democratic governance structures, never replacing them.' },
              { label: 'Transparent data use',               desc: 'What data is used, how it is used, and why — documented and available for review.' },
              { label: 'Anti-surveillance by design',        desc: 'No capability path in the platform can be re-purposed for workforce surveillance.' },
            ].map((item) => (
              <div key={item.label} className="p-5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="text-sm font-bold text-slate-900 mb-1">{item.label}</div>
                <div className="text-sm text-slate-600">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Explainability Standards */}
        <section id="explainability" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Explainability Standards</h2>
          <p className="text-slate-600 mb-6 max-w-2xl leading-relaxed">
            Every UnionEyes intelligence output is traceable to its source evidence and
            explainable in plain institutional language. Explainability is enforced — not
            aspirational.
          </p>
          <div className="space-y-3">
            {[
              'Every recommendation traces to specific source evidence',
              'Reasoning pathways are visible and auditable',
              'Plain-language explanations for every intelligence output',
              'No output without a human-readable justification',
              'Audit log for all system intelligence actions',
              'Evidence lineage preserved for governance review',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white">
                <ShieldCheck className="h-4 w-4 text-navy mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

          </TabsContent>

          <TabsContent value="governance" className="space-y-16">

        <section id="trust-operationalization" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Trust-Center Operationalization</h2>
          <p className="text-slate-600 mb-6 max-w-3xl leading-relaxed">
            Trust in UnionEyes is operational, not symbolic. Institutions can review how explainability,
            governance checkpoints, and oversight pathways are executed in deployment practice.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <article className="p-5 rounded-xl border border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Explainability Philosophy</h3>
              <p className="text-sm text-slate-600">
                Every recommendation remains grounded in evidence lineage, plain-language rationale, and institutional context.
              </p>
            </article>
            <article className="p-5 rounded-xl border border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Implementation Safeguards</h3>
              <p className="text-sm text-slate-600">
                Human oversight, review gates, and auditable governance pathways remain active at every rollout stage.
              </p>
            </article>
            <article className="p-5 rounded-xl border border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Operational Transparency</h3>
              <p className="text-sm text-slate-600">
                Leadership and procurement teams can verify boundaries, controls, and modernization posture before expansion.
              </p>
            </article>
          </div>
        </section>

        <section id="governance-maturity" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Governance Maturity Scoring Model</h2>
          <p className="text-slate-600 mb-6 max-w-3xl leading-relaxed">
            Maturity scores are directional institutional signals used for deployment planning. They are never used for worker evaluation or productivity scoring.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {governanceMaturityDimensions.map((dimension) => (
              <article key={dimension.key} className="p-4 rounded-lg border border-slate-200 bg-white">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">{dimension.label}</h3>
                <p className="text-xs text-slate-600">{dimension.focus}</p>
              </article>
            ))}
          </div>
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Operational Maturity Pathway</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {operationalMaturityPathway.map((stage, index) => (
                <div key={stage} className="text-xs text-slate-700 px-3 py-2 rounded bg-white border border-slate-200">
                  {index + 1}. {stage}
                </div>
              ))}
            </div>
          </div>
        </section>

          </TabsContent>

          <TabsContent value="scenario" className="space-y-16">

        <section className="mb-20">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">{t('phase6.leadershipTitle')}</h2>
          <p className="text-slate-600 mb-6 max-w-3xl leading-relaxed">
            {t('phase6.leadershipDesc')}
          </p>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leadershipTransitionContinuityScenarios.map((item) => (
              <article key={item.scenario} className="p-5 rounded-xl border border-slate-200 bg-white">
                <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">{item.focus}</p>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{item.scenario}</h3>
                <p className="text-sm text-slate-600 mb-2">{item.livedSignal}</p>
                <p className="text-xs text-slate-700"><span className="font-semibold">{t('phase6.stabilizationMoveLabel')}</span> {item.stabilizationMove}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-20 grid lg:grid-cols-2 gap-6">
          <article className="p-6 rounded-xl border border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-900 mb-3">{t('phase6.frictionTitle')}</h3>
            <div className="space-y-3">
              {governanceFrictionSimulationFlows.map((item) => (
                <div key={item.friction} className="p-4 rounded-lg border border-slate-200 bg-white">
                  <p className="text-sm font-semibold text-slate-900 mb-1">{item.friction}</p>
                  <p className="text-sm text-slate-600 mb-1">{item.continuityImpact}</p>
                  <p className="text-xs text-slate-700"><span className="font-semibold">{t('phase6.manageThroughLabel')}</span> {item.managementPath}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="p-6 rounded-xl border border-slate-200 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-3">{t('phase6.disruptionTitle')}</h3>
            <div className="space-y-3">
              {operationalDisruptionModels.map((item) => (
                <div key={item.area} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">{item.focus}</p>
                  <p className="text-sm font-semibold text-slate-900 mb-1">{item.area}</p>
                  <p className="text-sm text-slate-600 mb-1">{item.signal}</p>
                  <p className="text-xs text-slate-700"><span className="font-semibold">{t('phase6.stabilizeWithLabel')}</span> {item.mitigation}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mb-20 grid lg:grid-cols-2 gap-6">
          <article className="p-6 rounded-xl border border-slate-200 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-3">{t('phase6.stabilizationTitle')}</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {organizationalStabilizationSimulationFlow.map((stage, index) => (
                <div key={stage} className="text-sm text-slate-700 px-3 py-2 rounded border border-slate-200 bg-slate-50">
                  {index + 1}. {stage}
                </div>
              ))}
            </div>
          </article>

          <article className="p-6 rounded-xl border border-slate-200 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-900 mb-3">{t('phase6.committeeTitle')}</h3>
            <div className="space-y-3">
              {committeeCoordinationSimulations.map((item) => (
                <div key={item.simulation} className="p-4 rounded-lg border border-slate-200 bg-white">
                  <p className="text-sm font-semibold text-slate-900 mb-1">{item.simulation}</p>
                  <p className="text-sm text-slate-600 mb-1">{item.coordinationSignal}</p>
                  <p className="text-xs text-slate-700"><span className="font-semibold">{t('phase6.stabilizeWithLabel')}</span> {item.stabilizationApproach}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

          </TabsContent>

          <TabsContent value="proof" className="space-y-16">

        <section id="proof-layer" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Trust-Center Operational Proof Layer</h2>
          <p className="text-slate-600 mb-6 max-w-3xl leading-relaxed">
            The trust surface now includes implementation-aware proof. Reviewers can trace safeguards, governance review, and continuity protection in operational terms rather than symbolic claims.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {[
              { title: 'Implementation safeguards', desc: 'Phased activation, bounded scope, and review windows remain visible.' },
              { title: 'Governance review structure', desc: 'Oversight checkpoints and human validation layers stay explicit.' },
              { title: 'Continuity protection principles', desc: 'Transition safety, resilience, and memory retention remain central.' },
            ].map((item) => (
              <article key={item.title} className="p-5 rounded-xl border border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {executiveBriefingFlows.map((item) => (
              <span key={item} className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-700">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6">
            <Link href={withInstitutionalContext(`/${locale}/proof`, contextMode)} className="inline-flex items-center gap-2 text-sm font-semibold text-electric hover:text-blue-700">
              Review the institutional proof page <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="governance-walkthroughs" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Governance Operational Walkthroughs</h2>
          <p className="text-slate-600 mb-6 max-w-3xl leading-relaxed">
            Walkthroughs model how governance holds in real modernization situations: transitions, committee coordination, onboarding pressure, and procurement review.
          </p>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {governanceOperationalWalkthroughs.map((walkthrough) => (
              <article key={walkthrough.type} className="p-5 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">{walkthrough.focus}</p>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{walkthrough.type}</h3>
                <p className="text-sm text-slate-600">{walkthrough.narrative}</p>
              </article>
            ))}
          </div>
          <div className="p-5 rounded-xl bg-white border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Governance review simulation layers</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {governanceReviewSimulationLayers.map((layer) => (
                <div key={layer} className="text-xs text-slate-700 px-3 py-2 rounded border border-slate-200 bg-slate-50">
                  {layer}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="procurement-binder" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Procurement Evidence Binder</h2>
          <p className="text-slate-600 mb-6 max-w-3xl leading-relaxed">
            Trust documentation is packaged as a procurement-ready binder for disciplined due diligence, not sales collateral.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {procurementEvidenceBinder.map((item) => (
              <article key={item} className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700">
                {item}
              </article>
            ))}
          </div>
        </section>

          </TabsContent>

          <TabsContent value="status" className="space-y-16">

        {/* CTA */}
        {/* System Status */}
        <section id="system-status" className="mb-20 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">System Status</h2>
          <p className="text-slate-600 mb-8">
            Real-time operational status of UnionEyes platform services.
          </p>
          <StatusPage />
        </section>

        {/* CTA */}
        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Ready to see governance in action?
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            Start a controlled pilot scoped to your organization&apos;s governance requirements.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={withInstitutionalContext(`/${locale}/pilot-request`, contextMode)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors text-sm"
            >
              Start a Pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              View Pricing & Deployment
            </Link>
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
