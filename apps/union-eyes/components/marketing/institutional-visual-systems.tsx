import type { ReactNode } from 'react';
import ScrollReveal from '@/components/public/scroll-reveal';

function isFr(locale: string) {
  return locale === 'fr-CA';
}

interface VisualPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

function VisualPanel({ title, subtitle, children }: VisualPanelProps) {
  return (
    <article className="institution-panel calm-elevation narrative-step p-5">
      {subtitle ? <p className="institution-kicker mb-2">{subtitle}</p> : null}
      <h3 className="text-base font-semibold text-navy mb-4 leading-tight">{title}</h3>
      {children}
    </article>
  );
}

const continuityTransformation = [
  'Fragmentation',
  'Visibility',
  'Alignment',
  'Continuity',
  'Trust',
  'Resilience',
];

const CONTINUITY_DELAY_CLASSES = [
  '[animation-delay:0ms]',
  '[animation-delay:80ms]',
  '[animation-delay:160ms]',
  '[animation-delay:240ms]',
  '[animation-delay:320ms]',
  '[animation-delay:400ms]',
];

export function PillarDiagram({
  nodes,
  accentClass = 'bg-[#1f5b84] text-white border-transparent',
  compact = false,
}: {
  nodes: string[];
  accentClass?: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      {nodes.map((node, idx) => (
        <div key={node}>
          <div
            className={`rounded-lg border px-3 py-2 text-xs sm:text-sm font-medium ${
              idx === 0 ? accentClass : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {node}
          </div>
          {idx < nodes.length - 1 ? (
            <div
              className={`${compact ? 'h-2' : 'h-4'} flex items-center justify-center text-slate-400 text-xs`}
              aria-hidden
            >
              ↓
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function MethodologyVisualizationSystem({ locale = 'en-CA' }: { locale?: string }) {
  const fr = isFr(locale);

  return (
    <section className="py-16 bg-white border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={18}>
          <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Doctrine organisationnelle, operationnalisee visuellement' : 'Organizational doctrine, operationalized visually'}</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.14} duration={0.9} distance={16}>
          <p className="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed">
            {fr
              ? 'Ces schemas sont concus pour les comites de gouvernance et les breffages executifs. Chaque cadre cartographie la continuite, l explicabilite et la confiance comme infrastructure operationnelle.'
              : 'These diagrams are designed for governance committees and executive briefings. Each framework maps continuity, explainability, and trust as organizational operating infrastructure.'}
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-4 narrative-sequence [--sequence-step:95ms]">
          <ScrollReveal delay={0.06} duration={0.9} distance={16}>
            <VisualPanel
              title={fr ? 'Cadre de raisonnement de continuite organisationnelle' : 'Organizational Continuity Reasoning Framework'}
              subtitle={fr ? 'Carte canonique de continuite' : 'Canonical Continuity Map'}
            >
              <PillarDiagram
                nodes={[
                  fr ? 'Memoire organisationnelle' : 'Organizational Memory',
                  fr ? 'Continuite de gouvernance' : 'Governance Continuity',
                  fr ? 'Coherence operationnelle' : 'Operational Coherence',
                  fr ? 'Revue de gouvernance explicable' : 'Explainable Governance Review',
                  fr ? 'Resilience organisationnelle' : 'Organizational Resilience',
                ]}
              />
            </VisualPanel>
          </ScrollReveal>

          <ScrollReveal delay={0.12} duration={0.9} distance={16}>
            <VisualPanel title={fr ? 'Modele de gouvernance anti-fragmentation' : 'Anti-Fragmentation Governance Model'} subtitle={fr ? 'Parcours de convergence de gouvernance' : 'Governance Convergence Path'}>
              <PillarDiagram
                nodes={[
                  fr ? 'Fragmentation' : 'Fragmentation',
                  fr ? 'Coordination' : 'Coordination',
                  fr ? 'Explicabilite' : 'Explainability',
                  fr ? 'Alignement' : 'Alignment',
                  fr ? 'Continuite' : 'Continuity',
                  fr ? 'Resilience' : 'Resilience',
                ]}
                accentClass="bg-[#b59b61] text-[#12324a] border-transparent"
              />
            </VisualPanel>
          </ScrollReveal>

          <ScrollReveal delay={0.18} duration={0.9} distance={16}>
            <VisualPanel title={fr ? 'Norme d explicabilite de gouvernance' : 'Governance Explainability Standard'} subtitle={fr ? 'Couches de revue' : 'Reviewability Layers'}>
              <div className="space-y-2">
                {[
                  fr ? 'Couche d explicabilite' : 'Explainability Layer',
                  fr ? 'Couche de supervision humaine' : 'Human Oversight Layer',
                  fr ? 'Couche de revue de gouvernance' : 'Governance Review Layer',
                  fr ? 'Couche de transparence operationnelle' : 'Operational Transparency Layer',
                  fr ? 'Couche de preservation de la responsabilite' : 'Accountability Preservation Layer',
                ].map((layer) => (
                  <div key={layer} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700">
                    {layer}
                  </div>
                ))}
              </div>
            </VisualPanel>
          </ScrollReveal>

          <ScrollReveal delay={0.24} duration={0.9} distance={16}>
            <VisualPanel title={fr ? 'Cadre de confiance operationnelle' : 'Operational Trust Framework'} subtitle={fr ? 'Architecture de confiance' : 'Trust Architecture'}>
              <PillarDiagram
                nodes={[
                  fr ? 'Formation de la confiance' : 'Trust Formation',
                  fr ? 'Explicabilite' : 'Explainability',
                  fr ? 'Confiance de gouvernance' : 'Governance Confidence',
                  fr ? 'Securite de modernisation' : 'Modernization Safety',
                  fr ? 'Assurance de continuite' : 'Continuity Reassurance',
                ]}
                accentClass="bg-[#2b6a62] text-white border-transparent"
              />
            </VisualPanel>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export function ContinuityFlowSignature({ locale = 'en-CA' }: { locale?: string }) {
  const fr = isFr(locale);

  const flowNodes = [
    {
      title: fr ? 'Memoire organisationnelle' : 'Organizational Memory',
      detail: fr
        ? 'La connaissance reste lisible a travers les transitions de leadership et les cycles de politiques.'
        : 'Knowledge remains legible through leadership transitions and policy cycles.',
    },
    {
      title: fr ? 'Continuite de gouvernance' : 'Governance Continuity',
      detail: fr
        ? 'La logique de supervision reste coherente entre equipes, programmes et forums de decision.'
        : 'Oversight logic remains coherent across teams, programs, and decision forums.',
    },
    {
      title: fr ? 'Coherence operationnelle' : 'Operational Coherence',
      detail: fr
        ? 'Les parcours d execution restent alignes sur les attentes strategiques et de gouvernance.'
        : 'Execution pathways stay aligned with strategic and governance expectations.',
    },
  ];

  return (
    <section className="py-16 bg-white border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Le flux de continuite comme langage organisationnel' : 'Continuity Flow as organizational language'}</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.12} duration={0.9} distance={16}>
          <p className="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed">
            {fr
              ? 'UnionEyes utilise le flux de continuite pour communiquer une verite simple : la connaissance de gouvernance doit circuler de facon sure dans le temps, sans rupture en transition.'
              : 'UnionEyes uses continuity flow to communicate a simple organizational truth: governance knowledge should move safely through time, never breaking at moments of transition.'}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.18} duration={1} distance={18}>
          <div className="continuity-flow-surface continuity-stage-flow p-5 sm:p-7 continuity-appear">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-center">
            <div className="space-y-4 narrative-sequence [--sequence-step:120ms]">
              {flowNodes.map((node) => (
                <article key={node.title} className="institution-panel continuity-node px-4 py-3">
                  <h3 className="text-sm font-semibold text-navy mb-1">{node.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{node.detail}</p>
                </article>
              ))}
              <div className="continuity-flow-track continuity-stabilize-track" aria-hidden />
            </div>

            <div className="grid grid-cols-3 gap-3 justify-items-center">
              <div className="continuity-ring" aria-hidden />
              <div className="continuity-ring-muted self-end" aria-hidden />
              <div className="continuity-ring" aria-hidden />
            </div>
          </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export function FragmentationToCoherenceSequence({ locale = 'en-CA' }: { locale?: string }) {
  const fr = isFr(locale);

  return (
    <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'De la fragmentation a la resilience, sans theatre de disruption' : 'Fragmentation to resilience, without disruption theatre'}</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.12} duration={0.9} distance={16}>
          <p className="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed">
            {fr
              ? 'Le rythme de modernisation UnionEyes est calme et stabilisant : creer de la visibilite, aligner la gouvernance, proteger la continuite et renforcer la confiance organisationnelle.'
              : 'The UnionEyes modernization rhythm is calm and stabilizing: create visibility, align governance, protect continuity, and reinforce organizational trust.'}
          </p>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 narrative-sequence [--sequence-step:95ms]">
          {continuityTransformation.map((step, idx) => (
            <article key={step} className={`institution-panel p-4 text-center continuity-appear ${CONTINUITY_DELAY_CLASSES[idx] ?? ''}`}>
              <p className="text-[11px] tracking-widest uppercase text-slate-500 mb-2">Phase {idx + 1}</p>
              <p className="text-xs sm:text-sm font-semibold text-navy leading-relaxed">
                {fr
                  ? ({
                      Fragmentation: 'Fragmentation',
                      Visibility: 'Visibilite',
                      Alignment: 'Alignement',
                      Continuity: 'Continuite',
                      Trust: 'Confiance',
                      Resilience: 'Resilience',
                    } as Record<string, string>)[step] ?? step
                  : step}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConferenceMemoryAnchors({ locale = 'en-CA' }: { locale?: string }) {
  const fr = isFr(locale);

  const anchors = [
    fr ? 'Les architectes de la continuite' : 'The continuity people',
    fr ? 'La plateforme de confiance de gouvernance' : 'The governance trust platform',
    fr ? 'La modernisation explicable' : 'The explainable modernization company',
    fr ? 'Le langage visuel de la fragmentation a la coherence' : 'The fragmentation to coherence visual language',
    fr ? 'La doctrine du flux de continuite' : 'The continuity flow doctrine',
  ];

  return (
    <section className="py-16 bg-[#12324a] text-white border-b border-[#0e2538]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3 text-center">{fr ? 'Couche de rappel conference' : 'Conference Recall Layer'}</p>
        <h2 className="text-3xl font-semibold mb-4 text-center">{fr ? 'Ancrages de memoire pour les environnements executifs' : 'Memory anchors for executive environments'}</h2>
        <p className="text-sm text-white/80 mb-8 max-w-3xl mx-auto text-center leading-relaxed">
          {fr
            ? 'C est le langage que les parties prenantes doivent retenir apres chaque dialogue, breffage et interaction en conference.'
            : 'This is the language stakeholders should carry after every dialogue, briefing, and conference interaction.'}
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {anchors.map((anchor) => (
            <article key={anchor} className="rounded-xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs sm:text-sm font-medium leading-relaxed">{anchor}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContinuityMappingLanguage({ locale = 'en-CA' }: { locale?: string }) {
  const fr = isFr(locale);

  const maps = [
    {
      title: fr ? 'Carte de transition de leadership' : 'Leadership Transition Map',
      detail:
        fr
          ? 'Montre la preservation de la continuite, la stabilisation de l accueil et le transfert de raisonnement entre leadership sortant et entrant.'
          : 'Shows continuity preservation, onboarding stabilization, and rationale transfer between outgoing and incoming leadership.',
    },
    {
      title: fr ? 'Carte de memoire organisationnelle' : 'Organizational Memory Map',
      detail:
        fr
          ? 'Montre ou vit le contexte de gouvernance, comment il est preserve et comment le contexte organisationnel reste coordonne.'
          : 'Shows where governance context lives, how it is retained, and how organizational context stays coordinated.',
    },
    {
      title: fr ? 'Carte de coherence de gouvernance' : 'Governance Coherence Map',
      detail:
        fr
          ? 'Montre les parcours d alignement des politiques qui reduisent la fragmentation et ameliorent la visibilite de coordination entre equipes.'
          : 'Shows policy alignment pathways that reduce fragmentation and improve cross-team coordination visibility.',
    },
    {
      title: fr ? 'Visuel du cycle de vie de continuite' : 'Continuity Lifecycle Visual',
      detail:
        fr
          ? 'Montre la progression de maturite, de la gestion reactive de continuite vers une doctrine operationnelle resiliente.'
          : 'Shows maturity progression from reactive continuity handling to resilient organizational operating doctrine.',
    },
  ];

  return (
    <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Un langage visuel reconnaissable pour la resilience organisationnelle' : 'A recognizable visual language for organizational resilience'}</h2>
        </ScrollReveal>
        <div className="grid md:grid-cols-2 gap-4 narrative-sequence [--sequence-step:110ms]">
          {maps.map((map) => (
            <ScrollReveal key={map.title} duration={0.9} distance={16}>
              <VisualPanel title={map.title}>
                <p className="text-sm text-slate-600 leading-relaxed">{map.detail}</p>
              </VisualPanel>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConferenceStoryFlow({ locale = 'en-CA' }: { locale?: string }) {
  const fr = isFr(locale);

  const stages = [
    fr ? 'Fragmentation organisationnelle' : 'Organizational Fragmentation',
    fr ? 'Risque cache de continuite' : 'Hidden Continuity Risk',
    fr ? 'Complexite de gouvernance' : 'Governance Complexity',
    fr ? 'Perte de memoire organisationnelle' : 'Organizational Memory Loss',
    fr ? 'Visibilite explicable' : 'Explainable Visibility',
    fr ? 'Coherence operationnelle' : 'Operational Coherence',
    fr ? 'Resilience organisationnelle' : 'Organizational Resilience',
  ];

  return (
    <section className="py-16 bg-white border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={12} tempo="conference">        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.95} distance={14} tempo="conference">
          <h2 className="text-3xl font-semibold text-navy mb-4 text-center">{fr ? 'Choregraphie narrative pour les environnements executifs' : 'Narrative choreography for executive environments'}</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.12} duration={0.95} distance={14} tempo="conference">
          <p className="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed">
            {fr
              ? 'La sequence de recit ci-dessous est optimisee pour une comprehension executive en moins de cinq secondes a chaque etape.'
              : 'The live storytelling sequence below is optimized for under-five-second executive comprehension at each stage.'}
          </p>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3 narrative-sequence [--sequence-step:110ms]">
          {stages.map((stage, idx) => (
            <ScrollReveal
              key={stage}
              delay={idx * 0.055}
              duration={0.9}
              distance={12}
              tempo="conference"
            >
              <article className="institution-panel narrative-step p-4 text-center">
                <p className="text-[11px] tracking-widest uppercase text-slate-500 mb-2">{fr ? 'Etape' : 'Stage'} {idx + 1}</p>
                <p className="text-xs sm:text-sm font-medium text-navy leading-relaxed">{stage}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StakeholderVisualPathways() {
  const pathways = [
    {
      stakeholder: 'Executives',
      emphasis: 'Continuity and resilience',
    },
    {
      stakeholder: 'Governance leaders',
      emphasis: 'Explainability and oversight',
    },
    {
      stakeholder: 'Operations leaders',
      emphasis: 'Coordination and continuity workflows',
    },
    {
      stakeholder: 'Procurement stakeholders',
      emphasis: 'Trust, reviewability, deployment confidence',
    },
    {
      stakeholder: 'Technology leaders',
      emphasis: 'Governance-safe architecture and explainability',
    },
  ];

  return (
    <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-4 text-center">Role-aware visual emphasis by decision context</h2>
        </ScrollReveal>
        <div className="grid md:grid-cols-5 gap-3 narrative-sequence [--sequence-step:95ms]">
          {pathways.map((pathway) => (
            <article key={pathway.stakeholder} className="institution-panel narrative-step p-4">
              <h3 className="text-sm font-semibold text-navy mb-2">{pathway.stakeholder}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{pathway.emphasis}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
