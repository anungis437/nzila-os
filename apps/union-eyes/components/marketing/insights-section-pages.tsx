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
  getInsightCategories,
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
      'Doctrine prioritizes organizational memory, transition resilience, and stable organizational operations over novelty.',
  },
  {
    title: 'Executive-readable methodology',
    description:
      'Long-form guidance is structured for decision forums, procurement reviews, and implementation planning.',
  },
  {
    title: 'Labour-safe modernization lens',
    description:
      'Approaches avoid surveillance positioning and keep modernization anchored in organizational trust and accountability.',
  },
];

const narrativePathway = [
  {
    stage: 'Organizational Problem',
    detail:
      'Fragmented governance context, inconsistent operating interpretation, and loss of organizational rationale across transitions.',
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
      'Organizational leaders require transparent, explainable visibility into policy alignment and implementation maturity.',
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
      'Organizations modernize with coherence: resilient transitions, explainable governance, and deployable organizational systems.',
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
    detail: 'Critical context often lives in people, not in reviewable organizational systems.',
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

function isFr(locale: string) {
  return locale === 'fr-CA';
}

function getCategoryLabel(name: string, locale: string) {
  if (!isFr(locale)) return name;

  const labels: Record<string, string> = {
    'Organizational Continuity': 'Continuite organisationnelle',
    'Governance Modernization': 'Modernisation de la gouvernance',
    'Explainable Governance Reasoning': 'Raisonnement de gouvernance explicable',
    'Labour-Safe AI': 'IA sure pour le travail',
    'Organizational Memory': 'Memoire organisationnelle',
    'Governance Resilience': 'Resilience de gouvernance',
    'Operational Fragility': 'Fragilite operationnelle',
  };

  return labels[name] ?? name;
}

function getCategoryDescription(slug: string, fallback: string, locale: string) {
  if (!isFr(locale)) return fallback;

  const descriptions: Record<string, string> = {
    'institutional-continuity': 'Comment les organisations renforcent la memoire organisationnelle, traversent les transitions de leadership et stabilisent la continuite.',
    'governance-modernization': 'Comment moderniser les operations de gouvernance avec une intelligence explicable et des controles de revue clairs.',
    'explainable-intelligence': 'Pourquoi l explicabilite est indispensable et comment l operationnaliser.',
    'labour-safe-ai': 'Principes, pratiques et garde-fous de gouvernance pour une IA responsable.',
    'organizational-memory': 'Preserver la memoire organisationnelle et la rendre utilisable a travers les transitions.',
    'governance-resilience': 'Renforcer des structures de gouvernance capables de resister aux transitions et a la pression de modernisation.',
    'operational-fragility': 'Reperer et reduire les ruptures de coordination qui affaiblissent l organisation.',
  };

  return descriptions[slug] ?? fallback;
}

function getUpcomingTopicTitle(slug: string, fallback: string, locale: string) {
  if (!isFr(locale)) return fallback;

  const titles: Record<string, string> = {
    'board-succession-risk-scoring': 'Evaluer le risque de releve au conseil sans compromis de surveillance',
    'designing-continuity-protocols': 'Concevoir des protocoles de continuite qui survivent au roulement du leadership',
    'explainable-intelligence-policy-workflows': 'Comment operationnaliser une intelligence explicable dans les flux de politiques',
    'explainable-intelligence-procurement-standard': 'Norme d approvisionnement pour les contrats d IA sure pour le travail',
  };

  return titles[slug] ?? fallback;
}



export function InsightsDoctrinePageView({ locale, contextMode = 'executive' }: InsightSectionPageProps) {
  const featuredInsights = getFeaturedInsights();
  const fr = isFr(locale);

  const localizedEditorialStandards = fr
    ? [
        {
          title: 'Securite de gouvernance par defaut',
          description:
            'Chaque recommandation est cadree avec supervision humaine, justification explicite et voies de revue verifiables.',
        },
        {
          title: 'Architecture centree sur la continuite',
          description:
            'La doctrine privilegie la memoire organisationnelle, la resilience en transition et des operations stables plutot que la nouveaute.',
        },
        {
          title: 'Methodologie lisible pour la direction',
          description:
            'Les contenus longs sont structures pour les forums decisionnels, les revues d approvisionnement et la planification de mise en oeuvre.',
        },
        {
          title: 'Lecture de modernisation sure pour le travail',
          description:
            'Les approches evitent le cadrage de surveillance et ancrent la modernisation dans la confiance organisationnelle et la responsabilite.',
        },
      ]
    : editorialStandards;

  const localizedNarrativePathway = fr
    ? [
        {
          stage: 'Probleme organisationnel',
          detail:
            'Contexte de gouvernance fragmente, interpretation operationnelle inegale et perte de raisonnement organisationnel a travers les transitions.',
        },
        {
          stage: 'Risque de gouvernance',
          detail:
            'L ambiguite decisionnelle, la tracabilite faible et la responsabilite inegale augmentent l exposition aux politiques et l incertitude operationnelle.',
        },
        {
          stage: 'Impact sur la continuite',
          detail:
            'Le roulement du leadership et l execution decentralisee peuvent destabiliser la livraison lorsque les systemes de continuite sont informels.',
        },
        {
          stage: 'Visibilite operationnelle',
          detail:
            'Les responsables ont besoin d une visibilite transparente et explicable sur l alignement des politiques et la maturite de mise en oeuvre.',
        },
        {
          stage: 'Intelligence explicable',
          detail:
            'L intelligence soutient la gouvernance avec du contexte et du raisonnement, pas avec une automatisation opaque.',
        },
        {
          stage: 'Renforcement de la confiance',
          detail:
            'La clarte de la supervision, les garde-fous de continuite et le raisonnement documente renforcent la confiance de la direction et de l approvisionnement.',
        },
        {
          stage: 'Resultat strategique',
          detail:
            'Les organisations modernisent avec coherence : transitions resilientes, gouvernance explicable et systemes deployables.',
        },
      ]
    : narrativePathway;

  const localizedRealizationMoments = fr
    ? [
        {
          title: 'Dependance cachee a la continuite',
          detail: 'Le contexte critique vit souvent dans les personnes plutot que dans des systemes organisationnels revisables.',
        },
        {
          title: 'Accumulation de derive de gouvernance',
          detail: 'Les variations d interpretation s accumulent jusqu a ce qu une transition expose une fragilite structurelle.',
        },
        {
          title: 'La coherence comme resilience',
          detail: 'Quand le raisonnement, la supervision et les operations s alignent, la continuite devient durable.',
        },
      ]
    : realizationMoments;

  const adaptiveNarrativePathway = rotateNarrativePathway(localizedNarrativePathway, contextMode);

  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>{fr ? 'Normes editoriales et architecture narrative canonique' : 'Editorial standards and canonical story architecture'}</>}
        description={fr
          ? 'La couche doctrinale definit comment UnionEyes presente une modernisation sure pour la gouvernance, lisible pour la direction et centree sur la continuite.'
          : 'The doctrine layer defines how UnionEyes frames governance-safe modernization, executive readability, and continuity-centered publication design.'}
      />

      <InsightsHubSubmenu locale={locale} active="doctrine" contextMode={contextMode} />

      <section className="py-16 border-b border-slate-200/70 bg-[#f8f6f2]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Concu pour donner confiance dans l adoption organisationnelle' : 'Designed for organizational adoption confidence'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mx-auto text-center mb-8">
              {fr
                ? 'La doctrine UnionEyes est structuree pour les comites de gouvernance, la direction executive, les responsables des operations et les equipes d approvisionnement qui ont besoin de clarte avant de s engager dans une modernisation.'
                : 'UnionEyes doctrine is structured for governance committees, executive leadership, operations stewards, and procurement stakeholders who require clarity before committing to modernization paths.'}
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-4 narrative-sequence [--sequence-step:110ms]">
            {localizedEditorialStandards.map((standard) => (
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
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'De la fragmentation organisationnelle a la confiance operationnelle' : 'From organizational fragmentation to operational trust'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
              {fr
                ? 'Chaque article doctrinal suit une sequence strategique pensee pour la cognition executive : cadrage du probleme, risque de gouvernance, implications de continuite et resultats de mise en oeuvre explicables.'
                : 'Every doctrine article follows a strategic sequence built for executive cognition: problem framing, governance risk, continuity implications, and explainable implementation outcomes.'}
            </p>
          </ScrollReveal>
          <div className="space-y-3">
            {adaptiveNarrativePathway.map((item, idx) => (
              <ScrollReveal key={item.stage} delay={idx * 0.055} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <article className="institution-panel narrative-step px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
                    <span className="text-xs font-semibold text-slate-500 tracking-widest uppercase">{fr ? 'Etape' : 'Step'} {idx + 1}</span>
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
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Ce que les responsables comprennent a mesure que la visibilite progresse' : 'What leaders realize as visibility improves'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
              {fr
                ? 'Cette sequence vise a reveler la fragilite sans alarmisme, puis a la stabiliser par des parcours de continuite explicables.'
                : 'This sequencing is designed to reveal fragility without alarmism, then stabilize through explainable continuity pathways.'}
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-4 narrative-sequence [--sequence-step:110ms]">
            {localizedRealizationMoments.map((moment) => (
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
            <h2 className="text-3xl font-semibold text-navy mb-3 text-center">{fr ? 'Publications executives utilisees en pratique' : 'Executive publications in active use'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center">
              {fr
                ? 'Ces publications sont utilisees dans des ateliers de gouvernance, des comites de modernisation, des revues d approvisionnement et des cycles de planification de transition.'
                : 'These publications are used in governance workshops, modernization committees, procurement reviews, and transition planning cycles.'}
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6 narrative-sequence [--sequence-step:110ms]">
            {featuredInsights.map((insight) => (
              <ScrollReveal key={insight.slug} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <Link
                  href={withInstitutionalContext(getInsightHref(insight.slug, locale), contextMode)}
                  className="institution-panel calm-elevation narrative-step block p-6 group"
                >
                  <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 mb-3">
                    {getCategoryLabel(insight.categoryName, locale)}
                  </span>
                  <h3 className="text-lg font-semibold text-navy mb-2 leading-snug group-hover:text-[#1f5b84] transition-colors">
                    {insight.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                    {insight.excerpt}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
                    <span>{insight.readTime} {fr ? 'lecture' : 'read'}</span>
                    <span>{insight.format}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{fr ? 'Convient surtout a :' : 'Best for:'} {insight.audience}</p>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">{fr ? 'Retour au carrefour' : 'Return to Hub'}</p>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">{fr ? 'Passer a une autre section Perspectives' : 'Move to another Insights section'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-white/80 mb-8 leading-relaxed">
              {fr
                ? 'Utilisez le sous-menu ci-dessus pour passer entre doctrine, methodologie, resonance et navigation par categories.'
                : 'Use the submenu above to move between doctrine, methodology, resonance, and category browsing.'}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              {fr ? 'Retour au carrefour Perspectives' : 'Back to Insights Hub'}
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

export function InsightsMethodologyPageView({ locale, contextMode = 'executive' }: InsightSectionPageProps) {
  const fr = isFr(locale);

  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>{fr ? 'Flux de continuite, rythme de transformation et symbolique de gouvernance' : 'Continuity flow, transformation rhythm, and governance symbolism'}</>}
        description={fr
          ? 'Cette page rassemble les cadres visuels qui rendent la doctrine Perspectives lisible : structure, continuite et mouvement organisationnel calme.'
          : 'This page holds the visual frameworks that make the insights doctrine legible: structure, continuity, and calm organizational motion.'}
      />

      <InsightsHubSubmenu locale={locale} active="methodology" contextMode={contextMode} />

      <MethodologyVisualizationSystem locale={locale} />

      <ContinuityFlowSignature locale={locale} />

      <FragmentationToCoherenceSequence locale={locale} />

      <ConferenceStoryFlow locale={locale} />

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">{fr ? 'Poursuivre la lecture' : 'Continue Reading'}</p>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">{fr ? 'Passer a la couche de resonance emotionnelle' : 'Move into the emotional resonance layer'}</h2>
          <p className="text-white/80 mb-8 leading-relaxed">
            {fr
              ? 'La section methodologie est jumelee a la section resonance afin de relier la structure a la memoire et a la confiance de la direction.'
              : 'The methodology section is paired with the resonance section to connect structure to memory and executive confidence.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={withInstitutionalContext(`/${locale}/insights/resonance`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              {fr ? 'Aller a Resonance' : 'Go to Resonance'}
            </Link>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-transparent text-white font-medium rounded-xl border border-white/40 hover:bg-white/10 transition-all"
            >
              {fr ? 'Retour au carrefour' : 'Back to Hub'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export function InsightsResonancePageView({ locale, contextMode = 'executive' }: InsightSectionPageProps) {
  const fr = isFr(locale);

  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>{fr ? 'Une memorabilite emotionnelle sans theatricalite' : 'Emotional memorability without theatrics'}</>}
        description={fr
          ? 'Cette section transforme la continuite organisationnelle en idee memorable : confiance, resilience, clarte et continuite du mouvement.'
          : 'This section turns organizational continuity into a remembered idea: trust, resilience, clarity, and continuity flow.'}
      />

      <InsightsHubSubmenu locale={locale} active="resonance" contextMode={contextMode} />

      <ContinuityMappingLanguage locale={locale} />

      <section className="py-16 border-b border-slate-200/70 bg-[#f8f6f2]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Les quatre registres de resonance organisationnelle' : 'The four registers of organizational resonance'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mx-auto text-center mb-8">
              {fr
                ? 'La resonance n est pas decorative. C est l architecture discrete qui rend les idees de gouvernance memorables pour la direction, les conseils et les comites d exploitation longtemps apres une reunion.'
                : 'Resonance is not decoration. It is the quiet architecture that makes governance-grade ideas memorable to executives, boards, and operating committees long after a meeting ends.'}
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-4 narrative-sequence [--sequence-step:110ms]">
            {[
              {
                title: fr ? 'Ton d autorite calme' : 'Tone of calm authority',
                detail: fr
                  ? 'Chaque page se lit au rythme d un breffage executif pose, sans alarmisme ni volume marketing.'
                  : 'Every page reads at the cadence of a steady executive briefing — no alarmism, no theatrics, no marketing volume.',
              },
              {
                title: fr ? 'La continuite avant la nouveaute' : 'Continuity over novelty',
                detail: fr
                  ? 'Les symboles, la palette et le rythme recurrents signalent que la modernisation protege la memoire organisationnelle au lieu de la perturber.'
                  : 'Recurring symbols, palette, and rhythm signal that modernization is a steward of organizational memory, not its disruptor.',
              },
              {
                title: fr ? 'Memorabilite sans slogans' : 'Memorability without slogans',
                detail: fr
                  ? 'Les idees s ancrent grace a des contrastes structures et a une repetition discrete, puis survivent au passage vers la salle du conseil.'
                  : 'Ideas land through structured contrast and quiet repetition rather than taglines, surviving the move from screen to boardroom conversation.',
              },
              {
                title: fr ? 'La confiance avant la transformation' : 'Trust before transformation',
                detail: fr
                  ? 'La resonance rassure les publics de gouvernance en montrant que le systeme comprend leur posture de risque avant de proposer un changement.'
                  : 'Resonance reassures governance audiences that the system understands their risk posture before it proposes any change.',
              },
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
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Comment la resonance est construite, etape par etape' : 'How resonance is engineered, step by step'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
              {fr
                ? 'La resonance est composee deliberement. Chaque etape renforce la suivante pour laisser au leadership une impression coherente, calme et memorable.'
                : 'Resonance is composed deliberately. Each step strengthens the next, so the final impression on a leadership audience is coherent, calm, and remembered.'}
            </p>
          </ScrollReveal>
          <div className="space-y-3">
            {[
              {
                stage: fr ? 'Ancrer le cadre' : 'Anchor the frame',
                detail: fr
                  ? 'Ouvrir chaque recit sur les enjeux organisationnels avant d introduire tout outil ou fonctionnalite.'
                  : 'Open every narrative on the organizational stakes — continuity, accountability, public trust — before introducing any tool or feature.',
              },
              {
                stage: fr ? 'Tenir un rythme unique' : 'Hold a single rhythm',
                detail: fr
                  ? 'Maintenir une meme cadence editoriale entre hero, doctrine, methodologie et resonance pour garder une seule voix.'
                  : 'Maintain one editorial cadence across hero, doctrine, methodology, and resonance so the reader never feels handed off between voices.',
              },
              {
                stage: fr ? 'Repeter les symboles utiles' : 'Repeat the symbols that matter',
                detail: fr
                  ? 'Le langage de continuite, la palette et les motifs structurels reviennent avec intention et renforcent la confiance.'
                  : 'Continuity language, palette, and structural motifs recur with intent — turning recognition into trust through quiet repetition.',
              },
              {
                stage: fr ? 'Clore par la gerance, pas par la vente' : 'Close with stewardship, not sales',
                detail: fr
                  ? 'Terminer chaque section en ramenant le lecteur a son role de gouvernance, pas a un tunnel de conversion.'
                  : 'End each section by returning the reader to their governance role, not to a conversion funnel.',
              },
            ].map((item, idx) => (
              <ScrollReveal key={item.stage} delay={idx * 0.055} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <article className="institution-panel narrative-step px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
                    <span className="text-xs font-semibold text-slate-500 tracking-widest uppercase">{fr ? 'Etape' : 'Step'} {idx + 1}</span>
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
            <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Ce que la resonance produit dans une institution' : 'What resonance produces inside an institution'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
              {fr
                ? 'Quand la resonance fonctionne, les responsables portent les idees dans les comites, breffages et revues d approvisionnement sans reouvrir la source.'
                : 'When resonance is doing its work, leaders carry the ideas forward in their own language — across committees, briefings, and procurement reviews — without needing to consult the source material again.'}
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-3 gap-4 narrative-sequence [--sequence-step:110ms]">
            {[
              {
                title: fr ? 'Vocabulaire executif partage' : 'Shared executive vocabulary',
                detail: fr
                  ? 'Les conversations de leadership convergent vers une facon commune et sure de decrire continuite, risque et choix de modernisation.'
                  : 'Leadership conversations converge on a common, governance-safe way of describing continuity, risk, and modernization choices.',
              },
              {
                title: fr ? 'Revue de gouvernance plus fluide' : 'Lower-friction governance review',
                detail: fr
                  ? 'Les conseils et comites arrivent deja alignes sur le cadrage, et le temps porte sur les decisions plutot que sur les definitions.'
                  : 'Boards and committees enter discussions already aligned on framing, so deliberation time focuses on decisions rather than definitions.',
              },
              {
                title: fr ? 'Memoire organisationnelle durable' : 'Durable organizational memory',
                detail: fr
                  ? 'Le raisonnement derriere les choix de modernisation reste lisible pour les futurs responsables, auditeurs et successeurs.'
                  : 'The reasoning behind modernization choices remains legible to future leaders, auditors, and successors — long past the original engagement.',
              },
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

      {contextMode === 'conference' ? <ConferenceMemoryAnchors locale={locale} /> : null}

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">{fr ? 'Retour a la navigation' : 'Return to Navigation'}</p>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">{fr ? 'Parcourir les autres sections Perspectives' : 'Browse the other Insights sections'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-white/80 mb-8 leading-relaxed">
              {fr
                ? 'Utilisez le sous-menu pour passer de la resonance a la doctrine, la methodologie ou la navigation par categories.'
                : 'Use the submenu to shift from resonance into doctrine, methodology, or category browsing.'}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              {fr ? 'Retour au carrefour Perspectives' : 'Back to Insights Hub'}
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

export function InsightsCategoriesPageView({ locale, contextMode = 'executive' }: InsightSectionPageProps) {
  const categoryCounts = getInsightCategoryCounts(locale);
  const fr = isFr(locale);
  const localizedCategories = getInsightCategories(locale);

  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>{fr ? 'Parcourir par domaine de gouvernance' : 'Browse by governance domain'}</>}
        description={fr
          ? 'Utilisez cette section pour parcourir la bibliotheque Perspectives selon les besoins organisationnels, pas seulement selon les titres d articles.'
          : 'Use this section to move through the insight library by organizational need, not just by article title.'}
      />

      <InsightsHubSubmenu locale={locale} active="categories" contextMode={contextMode} />

      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-3xl font-semibold text-navy mb-8 text-center">{fr ? 'Parcourir la bibliotheque doctrinale par categorie' : 'Browse the doctrine library by category'}</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 narrative-sequence [--sequence-step:110ms]">
            {localizedCategories.map((cat) => (
              <ScrollReveal key={cat.slug} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <Link
                  href={withInstitutionalContext(`/${locale}/insights/category/${cat.slug}`, contextMode)}
                  className="institution-panel calm-elevation narrative-step block p-5 group"
                >
                  <h3 className="text-sm font-semibold text-navy mb-1 group-hover:text-[#1f5b84] transition-colors">
                    {getCategoryLabel(cat.name, locale)}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{getCategoryDescription(cat.slug, cat.description, locale)}</p>
                  <span className="text-xs text-slate-500">{categoryCounts[cat.slug] ?? 0} {fr ? 'notes doctrinales' : 'doctrine briefs'}</span>
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
            <h2 className="text-3xl font-semibold text-navy mb-3 text-center">{fr ? 'Prochaines pieces en developpement doctrinal' : 'Next in doctrine development'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-sm text-slate-600 mb-8 max-w-3xl mx-auto text-center">
              {fr
                ? 'Ces sujets sont en developpement actif avec des partenaires de gouvernance et d operations dans les institutions du travail.'
                : 'These topics are under active development with governance and operations partners across labour institutions.'}
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-4 narrative-sequence [--sequence-step:110ms]">
            {upcomingInsightTopics.map((topic) => (
              <ScrollReveal key={topic.slug} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
                <Link
                  href={withInstitutionalContext(getInsightHref(topic.slug, locale), contextMode)}
                  className="institution-panel calm-elevation narrative-step block p-4 text-sm text-slate-700 leading-relaxed"
                >
                  {getUpcomingTopicTitle(topic.slug, topic.title, locale)}
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal duration={INSIGHTS_RHYTHM.kickerDuration} distance={INSIGHTS_RHYTHM.kickerDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">{fr ? 'Retour au carrefour' : 'Return to Hub'}</p>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.titleDelay} duration={INSIGHTS_RHYTHM.titleDuration} distance={INSIGHTS_RHYTHM.titleDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">{fr ? 'Continuer a parcourir le systeme Perspectives' : 'Keep browsing the Insights system'}</h2>
          </ScrollReveal>
          <ScrollReveal delay={INSIGHTS_RHYTHM.bodyDelay} duration={INSIGHTS_RHYTHM.bodyDuration} distance={INSIGHTS_RHYTHM.bodyDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <p className="text-white/80 mb-8 leading-relaxed">
              {fr
                ? 'Utilisez le sous-menu pour revenir a l apercu ou vers les autres pages thematiques.'
                : 'Use the submenu to move back to the overview or across the other thematic pages.'}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} duration={INSIGHTS_RHYTHM.panelDuration} distance={INSIGHTS_RHYTHM.panelDistance} tempo={INSIGHTS_RHYTHM.tempo}>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              {fr ? 'Retour au carrefour Perspectives' : 'Back to Insights Hub'}
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}