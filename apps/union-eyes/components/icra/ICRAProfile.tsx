/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * ICRAProfile — results display for the Organizational Continuity Profile.
 *
 * Implements tiered output:
 *   - Continuity Reflection (free): band + insights + signals + burden index
 *   - Executive Continuity Brief: unlocks governance entropy, continuity debt,
 *     dependency review, modernization risk, full recommendations
 *   - Organizational Continuity Diagnostic: full access
 *
 * Tone: calm, organizational, emotionally intelligent.
 * No AI language anywhere in this component.
 *
 * Server component — receives profile and tier as props.
 */

import type {
  ContinuityInsight,
  ContinuityObservation,
  ContinuitySignal,
  InstitutionalContinuityProfile,
  DimensionScore,
  InsightCategory,
  ReportTierId,
  SectionId,
  StewardshipSignal,
} from '@/lib/icra/types';
import { COPY } from '@/lib/icra/copy';
import { isSectionVisible } from '@/lib/icra/tiers';
import { ICRAReportGate } from './ICRAReportGate';

// ─────────────────────────────────────────────────────────────────────────────
// Editorial framing — small, calibrated annotations that turn raw insights and
// observations into a published-document register. Doctrine-aligned, not LLM.
// ─────────────────────────────────────────────────────────────────────────────

const INSIGHT_CATEGORY_META: Record<
  InsightCategory,
  { label: string; framing: string }
> = {
  institutional_forgetting: {
    label: 'Organizational Forgetting',
    framing:
      'When multiple continuity dimensions degrade together, the institution begins to forget itself in operational ways that rarely show up in formal reporting.',
  },
  invisible_labour: {
    label: 'Invisible Labour',
    framing:
      'Continuity that depends on people quietly compensating is durable until it is not. This pattern is most visible the moment the people change.',
  },
  governance_drift: {
    label: 'Governance Drift',
    framing:
      'Governance that cannot reconstruct how a decision was reached is governance that cannot defend itself when the decision is later questioned.',
  },
  reconstruction_burden: {
    label: 'Reconstruction Burden',
    framing:
      'When organizational understanding has to be rebuilt with each transition, the cost is borne by individuals and absorbed into roles — rarely accounted for as a continuity liability.',
  },
  stewardship_concentration: {
    label: 'Stewardship Concentration',
    framing:
      'A reasonable operational posture can mask the fact that a small number of experienced people are quietly holding the institution together. This is sustainable until simultaneous departures expose it.',
  },
  evidence_governance_gap: {
    label: 'Evidence-Governance Gap',
    framing:
      'Structured governance without traceable evidence behaves well in steady state and becomes fragile under audit, regulator review, or contested transition.',
  },
  modernization_continuity_gap: {
    label: 'Modernization-Continuity Gap',
    framing:
      'Modernization that outpaces continuity infrastructure tends to import operational fragility faster than it retires it.',
  },
};

const OBSERVATION_CATEGORY_META: Record<
  ContinuityObservation['category'],
  { label: string; framing: string }
> = {
  governance: {
    label: 'Governance',
    framing: 'How decisions are made, recorded, and later defended.',
  },
  operational: {
    label: 'Operational',
    framing: 'How daily organizational work is sustained between transitions.',
  },
  memory: {
    label: 'Organizational Memory',
    framing: 'How precedent, context, and operational understanding persist over time.',
  },
  transition: {
    label: 'Transition',
    framing: 'How leadership and role changes are absorbed without losing coherence.',
  },
  trust: {
    label: 'Trust & Explainability',
    framing: 'How the institution makes its reasoning legible to members, boards, and regulators.',
  },
  sovereignty: {
    label: 'Sovereignty & Data',
    framing: 'How organizational information remains under organizational control.',
  },
};

const SEVERITY_ORDER: Record<ContinuityInsight['severity'], number> = {
  material: 0,
  notable: 1,
  observed: 2,
};

const OBSERVATION_SEVERITY_ORDER: Record<ContinuityObservation['severity'], number> = {
  material: 0,
  attention: 1,
  informational: 2,
};

interface ICRAProfileProps {
  profile: InstitutionalContinuityProfile;
  tierId?: ReportTierId;
}

const DIMENSION_LABELS: Record<string, string> = {
  institutional_continuity: 'Organizational Continuity',
  governance_fragility: 'Governance Fragility',
  trust_debt: 'Trust Debt',
  operational_memory: 'Operational Memory',
  transition_readiness: 'Transition Readiness',
};

const RISK_DIMENSIONS = new Set(['governance_fragility', 'trust_debt']);

const SECTION_LABELS: Record<SectionId, string> = {
  organizational_context: 'Organizational Context',
  operational_dependency: 'Operational Dependency',
  governance_visibility: 'Governance Visibility',
  institutional_memory: 'Organizational Memory',
  transition_readiness: 'Transition Readiness',
  operational_coordination: 'Operational Coordination',
  explainability_trust: 'Explainability & Trust',
  sovereignty_governance: 'Sovereignty & Data Governance',
};

function scoreColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-400';
  if (score >= 25) return 'bg-orange-400';
  return 'bg-red-500';
}

function DimensionBar({ dim }: { dim: DimensionScore }) {
  const isRisk = RISK_DIMENSIONS.has(dim.dimension);
  const label = DIMENSION_LABELS[dim.dimension] ?? dim.dimension;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-stone-700">
          {label}
          {isRisk && (
            <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
              risk dimension
            </span>
          )}
        </span>
        <span className="tabular-nums text-stone-500">{dim.score}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-stone-100">
        <div
          className={`h-2 rounded-full transition-all ${scoreColor(dim.score)}`}
          style={{ width: `${dim.score}%` }}
        />
      </div>
    </div>
  );
}

function InsightBlock({
  insight,
  index,
  total,
}: {
  insight: ContinuityInsight;
  index: number;
  total: number;
}) {
  const isMaterial = insight.severity === 'material';
  const isNotable = insight.severity === 'notable';
  const meta = INSIGHT_CATEGORY_META[insight.category];

  const severityLabel = isMaterial
    ? 'Material'
    : isNotable
    ? 'Notable'
    : 'Observed';

  const accentBar = isMaterial
    ? 'bg-stone-900'
    : isNotable
    ? 'bg-stone-600'
    : 'bg-stone-400';

  const severityChip = isMaterial
    ? 'bg-stone-900 text-white'
    : isNotable
    ? 'bg-stone-200 text-stone-800'
    : 'bg-stone-100 text-stone-600';

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.03)] transition hover:border-stone-300 hover:shadow-[0_1px_0_0_rgba(0,0,0,0.03),0_18px_36px_-28px_rgba(28,25,23,0.18)]"
      aria-label={`Insight ${index + 1} of ${total}: ${meta.label}`}
    >
      {/* Severity accent rail */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${accentBar}`} />

      <div className="space-y-5 px-7 py-7 md:px-8">
        {/* Eyebrow row */}
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.22em]">
          <span className="font-mono tabular-nums text-stone-400">
            Insight {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <span className="text-stone-300">·</span>
          <span className="text-stone-600">{meta.label}</span>
          <span className={`ml-auto rounded-full px-2.5 py-1 ${severityChip}`}>
            {severityLabel}
          </span>
        </header>

        {/* Headline */}
        <h3 className="font-sans text-[19px] font-semibold leading-snug tracking-tight text-stone-900 md:text-[20px]">
          {insight.headline}
        </h3>

        {/* Body */}
        <p className="text-[15px] leading-relaxed text-stone-700">{insight.body}</p>

        {/* Doctrine framing line — what this pattern means */}
        <p className="border-l-2 border-stone-200 pl-4 text-[13px] italic leading-relaxed text-stone-500">
          {meta.framing}
        </p>

        {/* Dimensions involved + affected sections + evidence */}
        <footer className="space-y-3 border-t border-stone-100 pt-4">
          {insight.dimensionsInvolved.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Dimensions
              </span>
              {insight.dimensionsInvolved.map((d) => (
                <span
                  key={d}
                  className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] font-medium text-stone-700"
                >
                  {DIMENSION_LABELS[d] ?? d}
                </span>
              ))}
            </div>
          )}
          {insight.affectedSections && insight.affectedSections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Surfaces in
              </span>
              {insight.affectedSections.map((s) => (
                <span
                  key={s}
                  className="text-[11px] text-stone-500"
                >
                  {SECTION_LABELS[s] ?? s}
                </span>
              ))}
            </div>
          )}
          {insight.evidenceBasis && (
            <p className="font-mono text-[10.5px] leading-relaxed text-stone-400">
              Evidence basis: {insight.evidenceBasis}
            </p>
          )}
        </footer>
      </div>
    </article>
  );
}

function ContinuitySignalList({ signals }: { signals: ContinuitySignal[] }) {
  const observed = signals.filter((s) => s.observed);
  if (observed.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="font-sans text-xl font-semibold tracking-tight text-stone-900">
        {COPY.results.continuitySignalsTitle}
      </h2>
      <p className="text-sm text-stone-500">
        Recognizable organizational patterns observed in this assessment.
      </p>
      <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 overflow-hidden">
        {observed.map((sig) => (
          <li key={sig.id} className="flex items-center gap-3 px-5 py-3 bg-white">
            <span className="h-1.5 w-1.5 rounded-full bg-stone-400 shrink-0" />
            <span className="text-sm text-stone-800">{sig.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StewardshipSignalList({ signals }: { signals: StewardshipSignal[] }) {
  if (signals.length === 0) return null;
  const dotColor = (severity: StewardshipSignal['severity']) =>
    severity === 'elevated' ? 'bg-red-400' : severity === 'moderate' ? 'bg-amber-400' : 'bg-stone-300';
  return (
    <div className="space-y-3">
      <h2 className="font-sans text-xl font-semibold tracking-tight text-stone-900">
        {COPY.results.stewardshipSignalsTitle}
      </h2>
      <p className="text-sm text-stone-500">
        Stewardship-layer signals — where organizational obligations may be at risk.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {signals.map((sig) => (
          <div
            key={sig.id}
            className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3"
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor(sig.severity)}`} />
            <span className="text-sm text-stone-800">{sig.label}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-stone-400">
              {sig.severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ICRAProfile({ profile, tierId = 'continuity_reflection' }: ICRAProfileProps) {
  const { maturityBand, composite, dimensions, sections, observations, recommendations } = profile;
  const assessmentId = profile.assessmentId;
  const insights = profile.insights ?? [];
  const continuitySignals = profile.continuitySignals ?? [];
  const stewardshipSignals = profile.stewardshipSignals ?? [];
  const burdenIndex = profile.burdenIndex;

  const scoredSections = sections.filter((s) => s.section !== 'organizational_context');
  const visible = (section: string) => isSectionVisible(section, tierId);
  const visibleRecommendations = visible('full_recommendations')
    ? recommendations
    : recommendations.slice(0, 1);

  return (
    <div className="mx-auto max-w-4xl space-y-14 py-12">
      {/* ── Composite + Band ── */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-8 text-center space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
          Organizational Continuity Profile
        </p>
        <div className="text-7xl font-bold tabular-nums text-stone-900">{composite}</div>
        <div className="space-y-1">
          <div className="text-xl font-sans font-semibold tracking-tight text-stone-800">
            {maturityBand.ociBandName ?? maturityBand.name}
          </div>
          {maturityBand.operationalPattern && (
            <div className="text-xs text-stone-400 tracking-wide">
              {COPY.results.operationalPatternLabel}:{' '}
              <span className="font-medium text-stone-500">{maturityBand.operationalPattern}</span>
            </div>
          )}
        </div>
        <p className="mx-auto max-w-xl text-sm text-stone-600 leading-relaxed">
          {maturityBand.summary}
        </p>
        <p className="text-xs text-stone-400">
          {profile.answeredQuestionCount} questions answered · Question bank v
          {profile.questionBankVersion}
        </p>
      </div>

      {/* ── Continuity Insights ── */}
      {insights.length > 0 && (
        <section className="space-y-6">
          <header className="space-y-3 border-b border-stone-200 pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
              Part I · Cross-dimensional findings
            </p>
            <h2 className="font-sans text-2xl font-semibold leading-tight tracking-tight text-stone-900 md:text-[1.7rem]">
              {COPY.results.insightsTitle}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-600">
              These are the organizational patterns this assessment surfaces — derived not from
              any single answer, but from the relationships between continuity dimensions.
              Each finding names a recognizable pattern, places it in doctrine, and points to
              where it shows up in operational life.
            </p>
          </header>
          <div className="space-y-5">
            {insights.map((insight, i) => (
              <InsightBlock
                key={insight.id}
                insight={insight}
                index={i}
                total={insights.length}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Continuity Signals ── */}
      {visible('continuity_signals') && (
        <ContinuitySignalList signals={continuitySignals} />
      )}

      {/* ── Stewardship Signals ── */}
      {visible('stewardship_signals') && stewardshipSignals.length > 0 && (
        <StewardshipSignalList signals={stewardshipSignals} />
      )}

      {/* ── Continuity Burden Index ── */}
      {burdenIndex && visible('burden_index_summary') && (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-sans text-xl font-semibold tracking-tight text-stone-900">
              {COPY.results.burdenIndexTitle}
            </h2>
            <span className="text-2xl font-bold tabular-nums text-stone-700">
              {burdenIndex.score}
              <span className="text-sm font-normal text-stone-400">/100</span>
            </span>
          </div>
          <p className="text-xs text-stone-500">{COPY.results.burdenIndexSub}</p>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 space-y-3">
            <div className="h-2 w-full rounded-full bg-stone-200">
              <div
                className={`h-2 rounded-full ${scoreColor(burdenIndex.score)}`}
                style={{ width: `${burdenIndex.score}%` }}
              />
            </div>
            <p className="text-sm text-stone-700 leading-relaxed">{burdenIndex.interpretation}</p>
          </div>
          {!visible('burden_index_full') && burdenIndex.humanCompensationIndicators.length > 0 && (
            <ICRAReportGate
              sectionName="Continuity Burden — Human Compensation Topography"
              teaser="The full analysis names the specific places where organizational continuity is currently being maintained through informal human effort rather than organizational systems."
              requiredTier="executive_continuity_brief"
              assessmentId={assessmentId}
              chapterNumber={5}
              chapters={[
                'A ranked list of the institution\u2019s active human-compensation indicators',
                'The named operational areas where continuity is currently informal',
                'A read of how concentrated that compensation is across roles',
                'Where organizational infrastructure would most reduce the burden carried by individuals',
              ]}
            />
          )}
        </div>
      )}

      {/* ── Maturity band characteristics ── */}
      <section className="space-y-6">
        <header className="space-y-3 border-b border-stone-200 pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
            Part II · The structural reality of this band
          </p>
          <h2 className="font-sans text-2xl font-semibold leading-tight tracking-tight text-stone-900 md:text-[1.7rem]">
            How institutions in the {maturityBand.ociBandName ?? maturityBand.name} band typically operate
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-stone-600">
            These three lenses — operational, governance, and continuity — describe the
            characteristic posture of institutions in this band. They are not predictions;
            they are recognizable patterns documented across comparable assessments.
          </p>
        </header>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              kicker: 'I · Operational',
              title: 'Operational Characteristics',
              intro: 'How daily work is sustained.',
              items: maturityBand.operationalCharacteristics,
              accent: 'before:bg-stone-700',
            },
            {
              kicker: 'II · Governance',
              title: 'Governance Implications',
              intro: 'What the governance body should know.',
              items: maturityBand.governanceImplications,
              accent: 'before:bg-stone-500',
            },
            {
              kicker: 'III · Continuity',
              title: 'Continuity Implications',
              intro: 'What this posture means over time.',
              items: maturityBand.continuityImplications,
              accent: 'before:bg-stone-300',
            },
          ].map((col) => (
            <article
              key={col.title}
              className={`group relative overflow-hidden rounded-2xl border border-stone-200 bg-white px-6 py-6 shadow-[0_1px_0_0_rgba(0,0,0,0.02)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${col.accent}`}
            >
              <header className="mb-4 space-y-1.5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
                  {col.kicker}
                </p>
                <h3 className="font-sans text-base font-semibold tracking-tight text-stone-900">
                  {col.title}
                </h3>
                <p className="text-[12px] italic text-stone-500">{col.intro}</p>
              </header>
              <ol className="space-y-3 text-[13.5px] leading-relaxed text-stone-700">
                {col.items.map((c, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-[3px] inline-block w-5 shrink-0 font-mono text-[11px] tabular-nums text-stone-400">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      {/* ── Dimension scores ── */}
      <div className="space-y-4">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-stone-900">Continuity Dimensions</h2>
        <p className="text-sm text-stone-600">
          Each dimension score is computed directly from your answers using published weights.
          Risk dimensions (governance fragility, trust debt) are inverted: a higher score indicates
          less organizational risk.
        </p>
        <div className="space-y-4">
          {dimensions.map((dim) => (
            <DimensionBar key={dim.dimension} dim={dim} />
          ))}
        </div>
      </div>

      {/* ── Section scores ── */}
      <div className="space-y-4">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-stone-900">Section Results</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {scoredSections.map((sec) => (
            <div
              key={sec.section}
              className="rounded-lg border border-stone-200 p-4 space-y-2"
            >
              <div className="flex justify-between">
                <span className="text-sm font-medium text-stone-800">
                  {SECTION_LABELS[sec.section] ?? sec.section}
                </span>
                <span className="tabular-nums text-sm text-stone-500">{sec.score}/100</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-stone-100">
                <div
                  className={`h-1.5 rounded-full ${scoreColor(sec.score)}`}
                  style={{ width: `${sec.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gated sections ── */}
      {(!visible('governance_entropy') ||
        !visible('continuity_debt') ||
        !visible('dependency_review') ||
        !visible('modernization_risk')) && (
        <section className="space-y-6">
          <header className="space-y-3 border-b border-stone-200 pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
              Part IV · Executive Continuity Brief — chapter previews
            </p>
            <h2 className="font-sans text-2xl font-semibold leading-tight tracking-tight text-stone-900 md:text-[1.7rem]">
              The chapters of your full continuity analysis
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-600">
              The Reflection above names what is visible. The Executive Continuity Brief is
              where the analysis becomes actionable — chapter by chapter, with the evidence
              traceable back to the questions you answered. Each chapter below is part of the
              same issued document.
            </p>
          </header>
          <div className="space-y-6">
            {!visible('governance_entropy') && (
              <ICRAReportGate
                sectionName="Governance Entropy Map"
                teaser="Governance procedures are in place, but the evidentiary trail required to defend them under audit appears thinner than the structure suggests."
                requiredTier="executive_continuity_brief"
                assessmentId={assessmentId}
                chapterNumber={1}
                chapters={[
                  'Where governance interpretation has quietly concentrated in a small number of people',
                  'Decisions for which the institution can — and cannot — currently reconstruct the reasoning',
                  'Patterns of drift between documented procedure and observed practice',
                  'Specific exposures during audit, regulator review, or contested transition',
                ]}
              />
            )}
            {!visible('continuity_debt') && (
              <ICRAReportGate
                sectionName="Continuity Debt Topography"
                teaser="A meaningful portion of organizational continuity appears to be carried informally — sustainable until the people carrying it change."
                requiredTier="executive_continuity_brief"
                assessmentId={assessmentId}
                chapterNumber={2}
                chapters={[
                  'Where continuity is currently held by individuals rather than organizational systems',
                  'The hidden operational cost being absorbed into roles and transitions',
                  'A ranked map of which continuity debts compound fastest if left unaddressed',
                  'Where targeted organizational investment would most reduce informal dependency',
                ]}
              />
            )}
            {!visible('dependency_review') && (
              <ICRAReportGate
                sectionName="Organizational Dependency Review"
                teaser="Operational coherence may currently depend on a smaller circle of people than the governance posture suggests."
                requiredTier="executive_continuity_brief"
                assessmentId={assessmentId}
                chapterNumber={3}
                chapters={[
                  'A map of where critical organizational knowledge is currently concentrated',
                  'Roles, relationships, and undocumented stewardship the institution is leaning on',
                  'The exposure profile if a small number of departures occurred simultaneously',
                  'Where dependency is healthy stewardship and where it has become organizational fragility',
                ]}
              />
            )}
            {!visible('modernization_risk') && (
              <ICRAReportGate
                sectionName="Modernization Risk Layer"
                teaser="Modernization that outpaces continuity infrastructure tends to import operational fragility faster than it retires it."
                requiredTier="executive_continuity_brief"
                assessmentId={assessmentId}
                chapterNumber={4}
                chapters={[
                  'Where current modernization plans may erode organizational memory if unaccompanied',
                  'Continuity preconditions that should be met before each modernization step',
                  'Decisions that are reversible — and decisions that quietly are not',
                  'A sequencing principle for modernization that protects continuity rather than displacing it',
                ]}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Observations ── */}
      {observations.length > 0 && (
        <section className="space-y-6">
          <header className="space-y-3 border-b border-stone-200 pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400">
              Part III · Section-level observations
            </p>
            <h2 className="font-sans text-2xl font-semibold leading-tight tracking-tight text-stone-900 md:text-[1.7rem]">
              {COPY.results.observationsTitle}
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-600">
              These observations are derived directly from the sections you answered. They are
              grouped by severity and annotated with the organizational lens they belong to —
              not as alerts, but as plain readings of what the responses reveal.
            </p>
          </header>
          <ol className="space-y-4">
            {[...observations]
              .sort(
                (a, b) =>
                  OBSERVATION_SEVERITY_ORDER[a.severity] -
                  OBSERVATION_SEVERITY_ORDER[b.severity],
              )
              .map((obs, i, arr) => {
                const isMaterial = obs.severity === 'material';
                const isAttention = obs.severity === 'attention';
                const accent = isMaterial
                  ? 'bg-stone-900'
                  : isAttention
                  ? 'bg-amber-500'
                  : 'bg-stone-300';
                const sevChip = isMaterial
                  ? 'bg-stone-900 text-white'
                  : isAttention
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-stone-100 text-stone-600';
                const sevLabel = isMaterial
                  ? 'Material'
                  : isAttention
                  ? 'Attention'
                  : 'Observed';
                const meta = OBSERVATION_CATEGORY_META[obs.category];
                return (
                  <li
                    key={obs.id}
                    className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.02)]"
                  >
                    <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${accent}`} />
                    <div className="space-y-3 px-7 py-6 md:px-8">
                      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.22em]">
                        <span className="font-mono tabular-nums text-stone-400">
                          Observation {String(i + 1).padStart(2, '0')} / {String(arr.length).padStart(2, '0')}
                        </span>
                        <span className="text-stone-300">·</span>
                        <span className="text-stone-600">{meta.label}</span>
                        <span className={`ml-auto rounded-full px-2.5 py-1 ${sevChip}`}>
                          {sevLabel}
                        </span>
                      </header>
                      <p className="text-[15px] leading-relaxed text-stone-800">{obs.statement}</p>
                      <p className="border-l-2 border-stone-200 pl-4 text-[12.5px] italic leading-relaxed text-stone-500">
                        {meta.framing}
                      </p>
                      {obs.evidence && obs.evidence.length > 0 && (
                        <p className="font-mono text-[10.5px] leading-relaxed text-stone-400">
                          Evidence: {obs.evidence.join('; ')}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      )}

      {/* ── Recommendations ── */}
      {visibleRecommendations.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-sans text-xl font-semibold tracking-tight text-stone-900">
            {COPY.results.recommendationsTitle}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleRecommendations.map((rec) => (
              <div
                key={rec.id}
                className="rounded-xl border border-stone-200 bg-white p-6 space-y-3"
              >
                <h3 className="font-semibold text-stone-900">{rec.title}</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{rec.description}</p>
                <a
                  href={rec.ctaHref}
                  className="inline-flex items-center text-sm font-medium text-stone-800 underline underline-offset-4 hover:text-stone-600"
                >
                  {rec.ctaLabel} →
                </a>
              </div>
            ))}
          </div>
          {!visible('full_recommendations') && recommendations.length > 1 && (
            <ICRAReportGate
              sectionName="Continuity Transformation Sequence"
              teaser="Additional recommendations — immediate, medium-term, and structural — are sequenced inside the Executive Continuity Brief so they reinforce rather than fragment one another."
              requiredTier="executive_continuity_brief"
              assessmentId={assessmentId}
              chapterNumber={6}
              chapters={[
                'A sequenced list of immediate, medium-term, and structural recommendations',
                'Doctrine-aligned rationale for the order in which they should be undertaken',
                'Preconditions that should be met before each recommendation is acted on',
                'How to brief the board on the recommended trajectory in plain language',
              ]}
            />
          )}
        </div>
      )}

      {/* ── OCI Motif ── */}
      <div className="border-t border-stone-200 pt-10 text-center space-y-3">
        <p className="mx-auto max-w-lg font-sans text-base italic text-stone-500 leading-relaxed">
          &ldquo;{COPY.ociMotif}&rdquo;
        </p>
      </div>

      {/* ── Scoring explainability footer ── */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-xs text-stone-500 space-y-1">
        <p className="font-semibold text-stone-700">About this profile</p>
        <p>
          All scores are computed deterministically using published question weights. There is no
          opaque model. The composite score reflects your organizational continuity dimension score,
          which aggregates weighted responses across all scored sections. Risk dimensions
          (governance fragility, trust debt) are inverted so higher scores consistently indicate
          stronger organizational position.
        </p>
        <p>
          Assessment ID: <code className="font-mono">{profile.assessmentId}</code>
        </p>
      </div>
    </div>
  );
}
