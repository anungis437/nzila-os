import Link from 'next/link';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InsightsHubSubmenu } from '@/components/marketing/insights-hub-navigation';
import {
  ConferenceMemoryAnchors,
  ConferenceStoryFlow,
  ContinuityFlowSignature,
  ContinuityMappingLanguage,
  FragmentationToCoherenceSequence,
  MethodologyVisualizationSystem,
} from '@/components/marketing/institutional-visual-systems';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  rotateNarrativePathway,
  type InstitutionalMode,
  withInstitutionalContext,
} from '@/lib/institutional-context';
import {
  getFeaturedInsights,
  getInsightHref,
  getInsightCategoryCounts,
  insightCategories,
  upcomingInsightTopics,
} from '@/lib/insights-content';
import ScrollReveal from '@/components/public/scroll-reveal';

const editorialStandards = [
  {
    title: 'Governance-safe by default',
    description:
      'Each recommendation is framed with human oversight, explicit rationale, and auditable governance pathways.',
  },
  {
    title: 'Continuity-centered architecture',
    description:
      'Doctrine prioritizes institutional memory, transition resilience, and stable organizational operations over novelty.',
  },
  {
    title: 'Executive-readable methodology',
    description:
      'Long-form guidance is structured for decision forums, procurement reviews, and implementation planning.',
  },
  {
    title: 'Labour-safe modernization lens',
    description:
      'Approaches avoid surveillance positioning and keep modernization anchored in institutional trust and accountability.',
  },
];

const narrativePathway = [
  {
    stage: 'Institutional Problem',
    detail:
      'Fragmented governance context, inconsistent operating interpretation, and loss of institutional rationale across transitions.',
  },
  {
    stage: 'Governance Risk',
    detail:
      'Decision ambiguity, weak traceability, and uneven accountability increase policy exposure and operational uncertainty.',
  },
  {
    stage: 'Continuity Impact',
    detail:
      'Leadership turnover and decentralized execution can destabilize delivery when continuity systems are informal.',
  },
  {
    stage: 'Operational Visibility',
    detail:
      'Institutional leaders require transparent, explainable visibility into policy alignment and implementation maturity.',
  },
  {
    stage: 'Explainable Intelligence',
    detail:
      'Intelligence supports governance with contextual rationale, not opaque automation or workforce monitoring patterns.',
  },
  {
    stage: 'Trust Reinforcement',
    detail:
      'Clarity of oversight, continuity safeguards, and documented rationale improve confidence for executives and procurement.',
  },
  {
    stage: 'Strategic Outcome',
    detail:
      'Organizations modernize with coherence: resilient transitions, explainable governance, and deployable institutional systems.',
  },
];

type InsightSectionPageProps = {
  locale: string;
  contextMode?: InstitutionalMode;
};

const INSIGHTS_RHYTHM = {
  tempo: 'conference' as const,
  kickerDistance: 12,
  titleDistance: 14,
  bodyDistance: 14,
  panelDistance: 15,
  kickerDuration: 0.85,
  titleDuration: 0.95,
  bodyDuration: 0.95,
  panelDuration: 0.9,
  titleDelay: 0.06,
  bodyDelay: 0.12,
  sequenceStep: '110ms',
};

const realizationMoments = [
  {
    title: 'Hidden continuity dependency',
    detail: 'Critical context often lives in people, not in reviewable institutional systems.',
  },
  {
    title: 'Governance drift accumulation',
    detail: 'Interpretation variance builds slowly until transitions expose structural fragility.',
  },
  {
    title: 'Coherence as resilience',
    detail: 'When reasoning, oversight, and operations align, continuity becomes durable.',
  },
];



export function InsightsDoctrinePageView({ locale, contextMode = 'executive' }: InsightSectionPageProps) {
  const featuredInsights = getFeaturedInsights();
  const adaptiveNarrativePathway = rotateNarrativePathway(narrativePathway, contextMode);

  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>Editorial standards and canonical story architecture</>}
        description="The doctrine layer defines how Union Eyes frames governance-safe modernization, executive readability, and continuity-centered publication design."
      />

      <InsightsHubSubmenu locale={locale} active="doctrine" contextMode={contextMode} />

      <section className="py-16 border-b border-slate-200/70 bg-[#f8f6f2]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">Designed for institutional adoption confidence</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mx-auto text-center mb-8">
              Union Eyes doctrine is structured for governance committees, executive leadership, operations stewards, and procurement stakeholders who require clarity before committing to modernization paths.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: INSIGHTS_RHYTHM.sequenceStep }}>
            {editorialStandards.map((standard) => (
              <ScrollReveal key={standard.title} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <article className="institution-panel calm-elevation narrative-step p-5">
                  <h3 className="text-sm font-semibold text-navy mb-2">{standard.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{standard.description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">From institutional fragmentation to operational trust</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
              Every doctrine article follows a strategic sequence built for executive cognition: problem framing, governance risk, continuity implications, and explainable implementation outcomes.
            </p>
          </ScrollReveal>
          <div className="space-y-3">
            {adaptiveNarrativePathway.map((item, idx) => (
              <ScrollReveal key={item.stage} delay={idx * 0.055} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <article className="institution-panel narrative-step px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
                    <span className="text-xs font-semibold text-slate-500 tracking-widest uppercase">Step {idx + 1}</span>
                    <div>
                      <h3 className="text-base font-semibold text-navy mb-1">{item.stage}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">What leaders realize as visibility improves</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
              This sequencing is designed to reveal fragility without alarmism, then stabilize through explainable continuity pathways.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: INSIGHTS_RHYTHM.sequenceStep }}>
            {realizationMoments.map((moment) => (
              <ScrollReveal key={moment.title} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <article className="institution-panel narrative-step p-5">
                  <h3 className="text-sm font-semibold text-navy mb-2">{moment.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{moment.detail}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-3 text-center">Executive publications in active use</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center">
              These publications are used in governance workshops, modernization committees, procurement reviews, and transition planning cycles.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6 narrative-sequence" style={{ ['--sequence-step' as string]: INSIGHTS_RHYTHM.sequenceStep }}>
            {featuredInsights.map((insight) => (
              <ScrollReveal key={insight.slug} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <Link
                  href={withInstitutionalContext(getInsightHref(insight.slug, locale), contextMode)}
                  className="institution-panel calm-elevation narrative-step block p-6 group"
                >
                  <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 mb-3">
                    {insight.categoryName}
                  </span>
                  <h3 className="text-lg font-semibold text-navy mb-2 leading-snug group-hover:text-[#1f5b84] transition-colors">
                    {insight.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                    {insight.excerpt}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
                    <span>{insight.readTime} read</span>
                    <span>{insight.format}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">Best for: {insight.audience}</p>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">Return to Hub</p>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">Move to another Insights section</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-white/80 mb-8 leading-relaxed">
              Use the submenu above to move between doctrine, methodology, resonance, and category browsing.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              Back to Insights Hub
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

export function InsightsMethodologyPageView({ locale, contextMode = 'executive' }: InsightSectionPageProps) {
  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>Continuity flow, transformation rhythm, and governance symbolism</>}
        description="This page holds the visual frameworks that make the insights doctrine legible: structure, continuity, and calm institutional motion."
      />

      <InsightsHubSubmenu locale={locale} active="methodology" contextMode={contextMode} />

      <MethodologyVisualizationSystem />

      <ContinuityFlowSignature />

      <FragmentationToCoherenceSequence />

      <ConferenceStoryFlow />

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">Continue Reading</p>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Move into the emotional resonance layer</h2>
          <p className="text-white/80 mb-8 leading-relaxed">
            The methodology section is paired with the resonance section to connect structure to memory and executive confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={withInstitutionalContext(`/${locale}/insights/resonance`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              Go to Resonance
            </Link>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-transparent text-white font-medium rounded-xl border border-white/40 hover:bg-white/10 transition-all"
            >
              Back to Hub
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export function InsightsResonancePageView({ locale, contextMode = 'executive' }: InsightSectionPageProps) {
  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>Emotional memorability without theatrics</>}
        description="This section turns institutional continuity into a remembered idea: trust, resilience, clarity, and continuity flow."
      />

      <InsightsHubSubmenu locale={locale} active="resonance" contextMode={contextMode} />

      <ContinuityMappingLanguage />

      <section className="py-16 border-b border-slate-200/70 bg-[#f8f6f2]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">The four registers of institutional resonance</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mx-auto text-center mb-8">
              Resonance is not decoration. It is the quiet architecture that makes governance-grade ideas memorable to executives, boards, and operating committees long after a meeting ends.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: INSIGHTS_RHYTHM.sequenceStep }}>
            {[
              { title: 'Tone of calm authority', detail: 'Every page reads at the cadence of a steady executive briefing — no alarmism, no theatrics, no marketing volume.' },
              { title: 'Continuity over novelty', detail: 'Recurring symbols, palette, and rhythm signal that modernization is a steward of institutional memory, not its disruptor.' },
              { title: 'Memorability without slogans', detail: 'Ideas land through structured contrast and quiet repetition rather than taglines, surviving the move from screen to boardroom conversation.' },
              { title: 'Trust before transformation', detail: 'Resonance reassures governance audiences that the system understands their risk posture before it proposes any change.' },
            ].map((item) => (
              <ScrollReveal key={item.title} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <article className="institution-panel calm-elevation narrative-step p-5">
                  <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">How resonance is engineered, step by step</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
              Resonance is composed deliberately. Each step strengthens the next, so the final impression on a leadership audience is coherent, calm, and remembered.
            </p>
          </ScrollReveal>
          <div className="space-y-3">
            {[
              { stage: 'Anchor the frame', detail: 'Open every narrative on the institutional stakes — continuity, accountability, public trust — before introducing any tool or feature.' },
              { stage: 'Hold a single rhythm', detail: 'Maintain one editorial cadence across hero, doctrine, methodology, and resonance so the reader never feels handed off between voices.' },
              { stage: 'Repeat the symbols that matter', detail: 'Continuity language, palette, and structural motifs recur with intent — turning recognition into trust through quiet repetition.' },
              { stage: 'Close with stewardship, not sales', detail: 'End each section by returning the reader to their governance role, not to a conversion funnel.' },
            ].map((item, idx) => (
              <ScrollReveal key={item.stage} delay={idx * 0.055} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <article className="institution-panel narrative-step px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
                    <span className="text-xs font-semibold text-slate-500 tracking-widest uppercase">Step {idx + 1}</span>
                    <div>
                      <h3 className="text-base font-semibold text-navy mb-1">{item.stage}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">What resonance produces inside an institution</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
              When resonance is doing its work, leaders carry the ideas forward in their own language — across committees, briefings, and procurement reviews — without needing to consult the source material again.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: INSIGHTS_RHYTHM.sequenceStep }}>
            {[
              { title: 'Shared executive vocabulary', detail: 'Leadership conversations converge on a common, governance-safe way of describing continuity, risk, and modernization choices.' },
              { title: 'Lower-friction governance review', detail: 'Boards and committees enter discussions already aligned on framing, so deliberation time focuses on decisions rather than definitions.' },
              { title: 'Durable institutional memory', detail: 'The reasoning behind modernization choices remains legible to future leaders, auditors, and successors — long past the original engagement.' },
            ].map((moment) => (
              <ScrollReveal key={moment.title} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <article className="institution-panel narrative-step p-5">
                  <h3 className="text-sm font-semibold text-navy mb-2">{moment.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{moment.detail}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {contextMode === 'conference' ? <ConferenceMemoryAnchors /> : null}

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">Return to Navigation</p>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">Browse the other Insights sections</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-white/80 mb-8 leading-relaxed">
              Use the submenu to shift from resonance into doctrine, methodology, or category browsing.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              Back to Insights Hub
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

export function InsightsCategoriesPageView({ locale, contextMode = 'executive' }: InsightSectionPageProps) {
  const categoryCounts = getInsightCategoryCounts();

  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>Browse by governance domain</>}
        description="Use this section to move through the insight library by organizational need, not just by article title."
      />

      <InsightsHubSubmenu locale={locale} active="categories" contextMode={contextMode} />

      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-8 text-center">Browse the doctrine library by category</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: INSIGHTS_RHYTHM.sequenceStep }}>
            {insightCategories.map((cat) => (
              <ScrollReveal key={cat.slug} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <Link
                  href={withInstitutionalContext(`/${locale}/insights/category/${cat.slug}`, contextMode)}
                  className="institution-panel calm-elevation narrative-step block p-5 group"
                >
                  <h3 className="text-sm font-semibold text-navy mb-1 group-hover:text-[#1f5b84] transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{cat.description}</p>
                  <span className="text-xs text-slate-500">{categoryCounts[cat.slug] ?? 0} doctrine briefs</span>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-3 text-center">Next in doctrine development</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center">
              These topics are under active development with governance and operations partners across labour institutions.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: INSIGHTS_RHYTHM.sequenceStep }}>
            {upcomingInsightTopics.map((topic) => (
              <ScrollReveal key={topic.slug} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <Link
                  href={withInstitutionalContext(getInsightHref(topic.slug, locale), contextMode)}
                  className="institution-panel calm-elevation narrative-step block p-4 text-sm text-slate-700 leading-relaxed"
                >
                  {topic.title}
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">Return to Hub</p>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">Keep browsing the Insights system</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-white/80 mb-8 leading-relaxed">
              Use the submenu to move back to the overview or across the other thematic pages.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              Back to Insights Hub
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}