/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * ICRAProfile — results display for the Institutional Continuity Profile.
 *
 * Implements tiered output:
 *   - Continuity Reflection (free): band + insights + signals + burden index
 *   - Executive Continuity Brief: unlocks governance entropy, continuity debt,
 *     dependency review, modernization risk, full recommendations
 *   - Institutional Continuity Diagnostic: full access
 *
 * Tone: calm, institutional, emotionally intelligent.
 * No AI language anywhere in this component.
 *
 * Server component — receives profile and tier as props.
 */

import type {
  ContinuityInsight,
  ContinuitySignal,
  InstitutionalContinuityProfile,
  DimensionScore,
  ReportTierId,
  SectionId,
  StewardshipSignal,
} from '@/lib/icra/types';
import { COPY } from '@/lib/icra/copy';
import { isSectionVisible } from '@/lib/icra/tiers';
import { ICRAReportGate } from './ICRAReportGate';

interface ICRAProfileProps {
  profile: InstitutionalContinuityProfile;
  tierId?: ReportTierId;
}

const DIMENSION_LABELS: Record<string, string> = {
  institutional_continuity: 'Institutional Continuity',
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
  institutional_memory: 'Institutional Memory',
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

function InsightBlock({ insight }: { insight: ContinuityInsight }) {
  const borderColor =
    insight.severity === 'material'
      ? 'border-stone-300 bg-stone-50'
      : 'border-stone-200 bg-white';
  return (
    <div className={`rounded-xl border p-6 space-y-2 ${borderColor}`}>
      {insight.severity === 'material' && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
          Material observation
        </p>
      )}
      <p className="font-serif text-base font-semibold text-stone-900 leading-snug">
        {insight.headline}
      </p>
      <p className="text-sm text-stone-600 leading-relaxed">{insight.body}</p>
    </div>
  );
}

function ContinuitySignalList({ signals }: { signals: ContinuitySignal[] }) {
  const observed = signals.filter((s) => s.observed);
  if (observed.length === 0) return null;
  return (
    <div className="space-y-3">
      <h2 className="font-serif text-xl font-bold text-stone-900">
        {COPY.results.continuitySignalsTitle}
      </h2>
      <p className="text-sm text-stone-500">
        Recognizable institutional patterns observed in this assessment.
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
      <h2 className="font-serif text-xl font-bold text-stone-900">
        {COPY.results.stewardshipSignalsTitle}
      </h2>
      <p className="text-sm text-stone-500">
        Stewardship-layer signals — where institutional obligations may be at risk.
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
          Institutional Continuity Profile
        </p>
        <div className="text-7xl font-bold tabular-nums text-stone-900">{composite}</div>
        <div className="space-y-1">
          <div className="text-xl font-serif font-semibold text-stone-800">
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
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-bold text-stone-900">
            {COPY.results.insightsTitle}
          </h2>
          <p className="text-sm text-stone-500">
            Observations derived from the relationship between your continuity dimensions.
          </p>
          <div className="space-y-3">
            {insights.map((insight) => (
              <InsightBlock key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
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
            <h2 className="font-serif text-xl font-bold text-stone-900">
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
              sectionName="Continuity Burden — Human Compensation Indicators"
              teaser="The full analysis identifies specific areas where institutional continuity is currently being maintained through informal human effort rather than institutional systems."
              requiredTier="executive_continuity_brief"
              assessmentId={assessmentId}
            />
          )}
        </div>
      )}

      {/* ── Maturity band characteristics ── */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Operational Characteristics
          </h3>
          <ul className="space-y-2">
            {maturityBand.operationalCharacteristics.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-stone-700">
                <span className="mt-0.5 shrink-0 text-stone-400">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Governance Implications
          </h3>
          <ul className="space-y-2">
            {maturityBand.governanceImplications.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-stone-700">
                <span className="mt-0.5 shrink-0 text-stone-400">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Continuity Implications
          </h3>
          <ul className="space-y-2">
            {maturityBand.continuityImplications.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-stone-700">
                <span className="mt-0.5 shrink-0 text-stone-400">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Dimension scores ── */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-stone-900">Continuity Dimensions</h2>
        <p className="text-sm text-stone-600">
          Each dimension score is computed directly from your answers using published weights.
          Risk dimensions (governance fragility, trust debt) are inverted: a higher score indicates
          less institutional risk.
        </p>
        <div className="space-y-4">
          {dimensions.map((dim) => (
            <DimensionBar key={dim.dimension} dim={dim} />
          ))}
        </div>
      </div>

      {/* ── Section scores ── */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-stone-900">Section Results</h2>
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
      {!visible('governance_entropy') && (
        <ICRAReportGate
          sectionName="Governance Entropy Analysis"
          teaser="Governance continuity drift indicators and inconsistency patterns are present in this assessment."
          requiredTier="executive_continuity_brief"
          assessmentId={assessmentId}
        />
      )}
      {!visible('continuity_debt') && (
        <ICRAReportGate
          sectionName="Continuity Debt Analysis"
          teaser="This assessment identifies areas where invisible continuity burden and reconstruction risk have accumulated."
          requiredTier="executive_continuity_brief"
          assessmentId={assessmentId}
        />
      )}
      {!visible('dependency_review') && (
        <ICRAReportGate
          sectionName="Institutional Dependency Review"
          teaser="Operational dependency concentration and the distribution of continuity knowledge across the institution."
          requiredTier="executive_continuity_brief"
          assessmentId={assessmentId}
        />
      )}
      {!visible('modernization_risk') && (
        <ICRAReportGate
          sectionName="Modernization Risk Layer"
          teaser="A review of continuity risk introduced by current and anticipated modernization efforts."
          requiredTier="executive_continuity_brief"
          assessmentId={assessmentId}
        />
      )}

      {/* ── Observations ── */}
      {observations.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-bold text-stone-900">
            {COPY.results.observationsTitle}
          </h2>
          <div className="space-y-3">
            {observations.map((obs) => {
              const borderColor =
                obs.severity === 'material'
                  ? 'border-stone-300 bg-stone-50'
                  : obs.severity === 'attention'
                  ? 'border-stone-200 bg-stone-50'
                  : 'border-stone-200 bg-white';
              const badgeColor =
                obs.severity === 'material'
                  ? 'bg-stone-200 text-stone-600'
                  : obs.severity === 'attention'
                  ? 'bg-stone-100 text-stone-500'
                  : 'bg-stone-100 text-stone-400';
              return (
                <div key={obs.id} className={`rounded-lg border p-4 space-y-2 ${borderColor}`}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeColor}`}
                    >
                      {obs.severity}
                    </span>
                    <span className="text-xs text-stone-500 capitalize">{obs.category}</span>
                  </div>
                  <p className="text-sm text-stone-800 leading-relaxed">{obs.statement}</p>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recommendations ── */}
      {visibleRecommendations.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-bold text-stone-900">
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
              sectionName="Full Continuity Transformation Recommendations"
              teaser="Additional recommendations — immediate, medium-term, and transformational — are available in the Executive Continuity Brief."
              requiredTier="executive_continuity_brief"
              assessmentId={assessmentId}
            />
          )}
        </div>
      )}

      {/* ── OCI Motif ── */}
      <div className="border-t border-stone-200 pt-10 text-center space-y-3">
        <p className="mx-auto max-w-lg font-serif text-base italic text-stone-500 leading-relaxed">
          &ldquo;{COPY.ociMotif}&rdquo;
        </p>
      </div>

      {/* ── Scoring explainability footer ── */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-xs text-stone-500 space-y-1">
        <p className="font-semibold text-stone-700">About this profile</p>
        <p>
          All scores are computed deterministically using published question weights. There is no
          opaque model. The composite score reflects your institutional continuity dimension score,
          which aggregates weighted responses across all scored sections. Risk dimensions
          (governance fragility, trust debt) are inverted so higher scores consistently indicate
          stronger institutional position.
        </p>
        <p>
          Assessment ID: <code className="font-mono">{profile.assessmentId}</code>
        </p>
      </div>
    </div>
  );
}
