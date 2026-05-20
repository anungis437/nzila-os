/**
 * ARTIFACT TYPE: React Component
 * DOCTRINE_VERSION: 1.0.0
 *
 * ICRAProfile — results display for the institutional continuity profile.
 * Full explainability: shows maturity band, dimension scores, section scores,
 * observations, and recommendations. No opaque output.
 *
 * Server component — receives profile as prop.
 */

import type { InstitutionalContinuityProfile, DimensionScore, SectionId } from '@/lib/icra/types';

interface ICRAProfileProps {
  profile: InstitutionalContinuityProfile;
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

export function ICRAProfile({ profile }: ICRAProfileProps) {
  const { maturityBand, composite, dimensions, sections, observations, recommendations } = profile;

  const scoredSections = sections.filter((s) => s.section !== 'organizational_context');

  return (
    <div className="mx-auto max-w-4xl space-y-12 py-12">
      {/* Composite + Band */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-8 text-center space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
          Institutional Continuity Profile
        </p>
        <div className="text-7xl font-bold tabular-nums text-stone-900">{composite}</div>
        <div className="text-xl font-serif font-semibold text-stone-800">{maturityBand.name}</div>
        <p className="mx-auto max-w-xl text-sm text-stone-600 leading-relaxed">
          {maturityBand.summary}
        </p>
        <p className="text-xs text-stone-400">
          {profile.answeredQuestionCount} questions answered · Question bank v
          {profile.questionBankVersion}
        </p>
      </div>

      {/* Maturity band characteristics */}
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

      {/* Dimension scores */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-stone-900">Dimension Scores</h2>
        <p className="text-sm text-stone-600">
          Each dimension score is computed directly from your answers using published weights.
          Risk dimensions (governance fragility, trust debt) are inverted: a higher score means
          less risk.
        </p>
        <div className="space-y-4">
          {dimensions.map((dim) => (
            <DimensionBar key={dim.dimension} dim={dim} />
          ))}
        </div>
      </div>

      {/* Section scores */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl font-bold text-stone-900">Section Scores</h2>
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

      {/* Observations */}
      {observations.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-bold text-stone-900">
            Continuity Observations
          </h2>
          <div className="space-y-3">
            {observations.map((obs) => {
              const borderColor =
                obs.severity === 'material'
                  ? 'border-red-200 bg-red-50'
                  : obs.severity === 'attention'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-stone-200 bg-stone-50';
              const badgeColor =
                obs.severity === 'material'
                  ? 'bg-red-100 text-red-700'
                  : obs.severity === 'attention'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-stone-100 text-stone-500';
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
                  {obs.evidence && obs.evidence.length > 0 && (
                    <ul className="space-y-0.5">
                      {obs.evidence.map((e, i) => (
                        <li key={i} className="text-xs text-stone-500">
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-bold text-stone-900">Recommended Next Steps</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map((rec) => (
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
        </div>
      )}

      {/* Scoring explainability footer */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-xs text-stone-500 space-y-1">
        <p className="font-semibold text-stone-700">About this assessment</p>
        <p>
          All scores are computed deterministically using published question weights. There is no
          opaque AI model. The composite score reflects your institutional_continuity dimension
          score, which aggregates weighted responses across all seven scored sections. Risk
          dimensions (governance_fragility, trust_debt) are inverted so that higher scores
          consistently indicate stronger institutional position.
        </p>
        <p>
          Assessment ID: <code className="font-mono">{profile.assessmentId}</code>
        </p>
      </div>
    </div>
  );
}
