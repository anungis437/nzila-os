import type { ReactNode } from 'react';
import ScrollReveal from '@/components/public/scroll-reveal';

interface VisualPanelProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

function VisualPanel({ title, subtitle, children }: VisualPanelProps) {
  return (
    <article className="institution-panel calm-elevation narrative-step p-5">
      <p className="institution-kicker mb-2">{subtitle}</p>
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

export function MethodologyVisualizationSystem() {
  return (
    <section className="py-16 bg-white border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>
          <p className="institution-kicker mb-3">Methodology Visualization System</p>
        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={18}>
          <h2 className="text-3xl font-semibold text-navy mb-4">Institutional doctrine, operationalized visually</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.14} duration={0.9} distance={16}>
          <p className="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed">
            These diagrams are designed for governance committees and executive briefings. Each framework maps
            continuity, explainability, and trust as institutional operating infrastructure.
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: '95ms' }}>
          <ScrollReveal delay={0.06} duration={0.9} distance={16}>
            <VisualPanel
              title="Institutional Continuity Intelligence Framework"
              subtitle="Canonical Continuity Map"
            >
              <PillarDiagram
                nodes={[
                  'Institutional Memory',
                  'Governance Continuity',
                  'Operational Coherence',
                  'Explainable Intelligence',
                  'Organizational Resilience',
                ]}
              />
            </VisualPanel>
          </ScrollReveal>

          <ScrollReveal delay={0.12} duration={0.9} distance={16}>
            <VisualPanel title="Anti-Fragmentation Governance Model" subtitle="Governance Convergence Path">
              <PillarDiagram
                nodes={[
                  'Fragmentation',
                  'Coordination',
                  'Explainability',
                  'Alignment',
                  'Continuity',
                  'Resilience',
                ]}
                accentClass="bg-[#b59b61] text-[#12324a] border-transparent"
              />
            </VisualPanel>
          </ScrollReveal>

          <ScrollReveal delay={0.18} duration={0.9} distance={16}>
            <VisualPanel title="Governance Explainability Standard" subtitle="Reviewability Layers">
              <div className="space-y-2">
                {[
                  'Explainability Layer',
                  'Human Oversight Layer',
                  'Governance Review Layer',
                  'Operational Transparency Layer',
                  'Accountability Preservation Layer',
                ].map((layer) => (
                  <div key={layer} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700">
                    {layer}
                  </div>
                ))}
              </div>
            </VisualPanel>
          </ScrollReveal>

          <ScrollReveal delay={0.24} duration={0.9} distance={16}>
            <VisualPanel title="Operational Trust Framework" subtitle="Trust Architecture">
              <PillarDiagram
                nodes={[
                  'Trust Formation',
                  'Explainability',
                  'Governance Confidence',
                  'Modernization Safety',
                  'Continuity Reassurance',
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

export function ContinuityFlowSignature() {
  const flowNodes = [
    {
      title: 'Institutional Memory',
      detail: 'Knowledge remains legible through leadership transitions and policy cycles.',
    },
    {
      title: 'Governance Continuity',
      detail: 'Oversight logic remains coherent across teams, programs, and decision forums.',
    },
    {
      title: 'Operational Coherence',
      detail: 'Execution pathways stay aligned with strategic and governance expectations.',
    },
  ];

  return (
    <section className="py-16 bg-white border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>
          <p className="institution-kicker mb-3">Signature Symbolism</p>
        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-4">Continuity Flow as institutional language</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.12} duration={0.9} distance={16}>
          <p className="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed">
            Union Eyes uses continuity flow to communicate a simple institutional truth: governance knowledge should move safely through time, never breaking at moments of transition.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.18} duration={1} distance={18}>
          <div className="continuity-flow-surface continuity-stage-flow p-5 sm:p-7 continuity-appear">
          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-center">
            <div className="space-y-4 narrative-sequence" style={{ ['--sequence-step' as string]: '120ms' }}>
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

export function FragmentationToCoherenceSequence() {
  return (
    <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>
          <p className="institution-kicker mb-3">Canonical Transformation</p>
        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-4">Fragmentation to resilience, without disruption theatre</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.12} duration={0.9} distance={16}>
          <p className="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed">
            The Union Eyes modernization rhythm is calm and stabilizing: create visibility, align governance, protect continuity, and reinforce institutional trust.
          </p>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 narrative-sequence" style={{ ['--sequence-step' as string]: '95ms' }}>
          {continuityTransformation.map((step, idx) => (
            <article key={step} className="institution-panel p-4 text-center continuity-appear" style={{ animationDelay: `${idx * 80}ms` }}>
              <p className="text-[11px] tracking-widest uppercase text-slate-500 mb-2">Phase {idx + 1}</p>
              <p className="text-xs sm:text-sm font-semibold text-navy leading-relaxed">{step}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ExecutiveResonanceLayer() {
  const resonanceSignals = [
    {
      title: 'Operational reassurance',
      detail: 'Leaders see continuity posture before disruption risk materializes.',
    },
    {
      title: 'Governance confidence',
      detail: 'Decision pathways remain explainable, reviewable, and procurement-safe.',
    },
    {
      title: 'Institutional resilience',
      detail: 'Modernization is experienced as stability amplification, not organizational turbulence.',
    },
  ];

  return (
    <section className="py-16 bg-white border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>
          <p className="institution-kicker mb-3">Executive Emotional Resonance</p>
        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-8">Strategic calmness, made memorable</h2>
        </ScrollReveal>
        <div className="grid md:grid-cols-3 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: '110ms' }}>
          {resonanceSignals.map((signal) => (
            <ScrollReveal key={signal.title} duration={0.88} distance={16}>
              <VisualPanel title={signal.title} subtitle="Resonance Signal">
                <p className="text-sm text-slate-600 leading-relaxed">{signal.detail}</p>
              </VisualPanel>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConferenceMemoryAnchors() {
  const anchors = [
    'The continuity people',
    'The governance trust platform',
    'The explainable modernization company',
    'The fragmentation to coherence visual language',
    'The continuity flow doctrine',
  ];

  return (
    <section className="py-16 bg-[#12324a] text-white border-b border-[#0e2538]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">Conference Recall Layer</p>
        <h2 className="text-3xl font-semibold mb-4">Memory anchors for executive environments</h2>
        <p className="text-sm text-white/80 mb-8 max-w-3xl leading-relaxed">
          This is the language stakeholders should carry after every dialogue, briefing, and conference interaction.
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

export function ContinuityMappingLanguage() {
  const maps = [
    {
      title: 'Leadership Transition Map',
      detail:
        'Shows continuity preservation, onboarding stabilization, and rationale transfer between outgoing and incoming leadership.',
    },
    {
      title: 'Organizational Memory Map',
      detail:
        'Shows where governance context lives, how it is retained, and how institutional intelligence stays coordinated.',
    },
    {
      title: 'Governance Coherence Map',
      detail:
        'Shows policy alignment pathways that reduce fragmentation and improve cross-team coordination visibility.',
    },
    {
      title: 'Continuity Lifecycle Visual',
      detail:
        'Shows maturity progression from reactive continuity handling to resilient institutional operating doctrine.',
    },
  ];

  return (
    <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={14}>
          <p className="institution-kicker mb-3">Continuity Mapping Language</p>
        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-4">A recognizable visual language for institutional resilience</h2>
        </ScrollReveal>
        <div className="grid md:grid-cols-2 gap-4 narrative-sequence" style={{ ['--sequence-step' as string]: '110ms' }}>
          {maps.map((map) => (
            <ScrollReveal key={map.title} duration={0.9} distance={16}>
              <VisualPanel title={map.title} subtitle="Continuity Visual">
                <p className="text-sm text-slate-600 leading-relaxed">{map.detail}</p>
              </VisualPanel>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConferenceStoryFlow() {
  const stages = [
    'Institutional Fragmentation',
    'Hidden Continuity Risk',
    'Governance Complexity',
    'Organizational Memory Loss',
    'Explainable Visibility',
    'Operational Coherence',
    'Institutional Resilience',
  ];

  return (
    <section className="py-16 bg-white border-b border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal duration={0.85} distance={12} tempo="conference">
          <p className="institution-kicker mb-3">Conference Storytelling Sequence</p>
        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.95} distance={14} tempo="conference">
          <h2 className="text-3xl font-semibold text-navy mb-4">Narrative choreography for executive environments</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.12} duration={0.95} distance={14} tempo="conference">
          <p className="text-sm text-slate-600 mb-8 max-w-3xl leading-relaxed">
            The live storytelling sequence below is optimized for under-five-second executive comprehension at each stage.
          </p>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3 narrative-sequence" style={{ ['--sequence-step' as string]: '110ms' }}>
          {stages.map((stage, idx) => (
            <ScrollReveal
              key={stage}
              delay={idx * 0.055}
              duration={0.9}
              distance={12}
              tempo="conference"
            >
              <article className="institution-panel narrative-step p-4 text-center">
                <p className="text-[11px] tracking-widest uppercase text-slate-500 mb-2">Stage {idx + 1}</p>
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
        <ScrollReveal duration={0.85} distance={14}>
          <p className="institution-kicker mb-3">Stakeholder Visual Pathways</p>
        </ScrollReveal>
        <ScrollReveal delay={0.06} duration={0.9} distance={16}>
          <h2 className="text-3xl font-semibold text-navy mb-4">Role-aware visual emphasis by decision context</h2>
        </ScrollReveal>
        <div className="grid md:grid-cols-5 gap-3 narrative-sequence" style={{ ['--sequence-step' as string]: '95ms' }}>
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
