'use client';

import { useState, useEffect } from 'react';
import type {
  InstitutionalLearningReport,
  LearningInsight,
} from '@/lib/knowledge-transfer/institutional-learning/learning-models';
import type { AdaptiveResilienceResult } from '@/lib/knowledge-transfer/adaptive-resilience/adaptive-models';
import type { GovernanceAdaptationReport } from '@/lib/knowledge-transfer/governance-adaptation/adaptation-models';
import type { MitigationEffectivenessReport } from '@/lib/knowledge-transfer/mitigation-effectiveness/effectiveness-models';
import type { FederatedBenchmarkResult } from '@/lib/knowledge-transfer/federated-intelligence/federated-models';

type TabKey = 'learning' | 'adaptation' | 'effectiveness' | 'benchmark';

const COHORT_COLORS: Record<string, string> = {
  nascent: 'bg-slate-200 text-slate-700',
  emerging: 'bg-blue-100 text-blue-700',
  developing: 'bg-cyan-100 text-cyan-700',
  established: 'bg-green-100 text-green-700',
  advanced: 'bg-indigo-100 text-indigo-700',
  leading: 'bg-violet-100 text-violet-700',
};

const TREND_COLORS: Record<string, string> = {
  improving: 'text-green-700',
  stable: 'text-slate-600',
  declining: 'text-red-600',
  volatile: 'text-amber-600',
  insufficient_data: 'text-slate-400',
};

const EFFECTIVENESS_COLORS: Record<string, string> = {
  highly_effective: 'text-green-700 bg-green-50',
  moderately_effective: 'text-emerald-700 bg-emerald-50',
  marginally_effective: 'text-amber-700 bg-amber-50',
  ineffective: 'text-red-600 bg-red-50',
  counterproductive: 'text-red-800 bg-red-100',
  unverified: 'text-slate-500 bg-slate-50',
};

const HEALTH_LABELS: Record<string, { label: string; color: string }> = {
  actively_adapting: { label: 'Actively Adapting', color: 'text-green-700 bg-green-50' },
  slowly_adapting: { label: 'Slowly Adapting', color: 'text-amber-700 bg-amber-50' },
  stagnant: { label: 'Stagnant', color: 'text-red-600 bg-red-50' },
  insufficient_history: { label: 'Building History', color: 'text-slate-500 bg-slate-50' },
};

function ResilienceSparkline({ dataPoints }: { dataPoints: { score: number }[] }) {
  if (dataPoints.length < 2) {
    return <div className="h-10 flex items-center text-sm text-slate-400">Not enough data</div>;
  }
  const max = Math.max(...dataPoints.map((d) => d.score), 1);
  const min = Math.min(...dataPoints.map((d) => d.score));
  const range = max - min || 1;
  const H = 40;
  const W = 120;
  const pts = dataPoints.map((d, i) => {
    const x = (i / (dataPoints.length - 1)) * W;
    const y = H - ((d.score - min) / range) * H;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-24 h-10" aria-hidden="true">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#4f46e5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LearningInsightCard({ insight }: { insight: LearningInsight }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {insight.insightType.replace(/_/g, ' ')}
          </span>
          <p className="font-medium text-slate-800 mt-0.5">{insight.headline}</p>
        </div>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {insight.confidence}
        </span>
      </div>
      {expanded && (
        <div className="space-y-2 text-sm text-slate-700">
          <p>{insight.explanation}</p>
          <p className="text-slate-500 italic">
            <span className="font-medium not-italic text-slate-700">Governance implication: </span>
            {insight.governanceImplication}
          </p>
          <p className="text-indigo-700 font-medium">{insight.suggestedAction}</p>
        </div>
      )}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-indigo-600 hover:text-indigo-800"
      >
        {expanded ? 'Show less' : 'Show details'}
      </button>
    </div>
  );
}

export function GovernanceEvolutionTracker() {
  const [activeTab, setActiveTab] = useState<TabKey>('learning');
  const [learning, setLearning] = useState<InstitutionalLearningReport | null>(null);
  const [adaptive, setAdaptive] = useState<AdaptiveResilienceResult | null>(null);
  const [adaptation, setAdaptation] = useState<GovernanceAdaptationReport | null>(null);
  const [effectiveness, setEffectiveness] = useState<MitigationEffectivenessReport | null>(null);
  const [benchmark, setBenchmark] = useState<FederatedBenchmarkResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [learningRes, adaptiveRes, adaptationRes, effectivenessRes, benchmarkRes] =
          await Promise.all([
            fetch('/api/exit-interviews/organizational-learning'),
            fetch('/api/exit-interviews/adaptive-resilience'),
            fetch('/api/exit-interviews/governance-adaptation'),
            fetch('/api/exit-interviews/mitigation-effectiveness'),
            fetch('/api/exit-interviews/federated-benchmarking'),
          ]);

        const [l, a, ad, e, b] = await Promise.all([
          learningRes.json(),
          adaptiveRes.json(),
          adaptationRes.json(),
          effectivenessRes.json(),
          benchmarkRes.json(),
        ]);

        setLearning(l.data);
        setAdaptive(a.data);
        setAdaptation(ad.data);
        setEffectiveness(e.data);
        setBenchmark(b.data);
      } catch {
        setError('Failed to load organizational intelligence data.');
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'learning', label: 'Learning Insights' },
    { key: 'adaptation', label: 'Adaptation History' },
    { key: 'effectiveness', label: 'Mitigation Effectiveness' },
    { key: 'benchmark', label: 'Maturity Benchmark' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      {learning && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Maturity Stage</div>
            <div
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${COHORT_COLORS[learning.maturityAssessment.maturityStage] ?? 'bg-slate-100 text-slate-700'}`}
            >
              {learning.maturityAssessment.maturityStage}
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {learning.maturityAssessment.maturityScore}
              <span className="text-sm font-normal text-slate-500">/100</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Resilience Trend</div>
            <div
              className={`text-sm font-semibold ${TREND_COLORS[learning.resilienceEvolution.trend] ?? 'text-slate-600'}`}
            >
              {learning.resilienceEvolution.trend.replace(/_/g, ' ')}
            </div>
            <ResilienceSparkline
              dataPoints={[
                learning.resilienceEvolution.trough,
                learning.resilienceEvolution.peak,
              ].map((s) => ({ score: s }))}
            />
          </div>

          {adaptation && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Adaptation Health</div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${HEALTH_LABELS[adaptation.adaptationHealth]?.color ?? 'text-slate-600 bg-slate-50'}`}
              >
                {HEALTH_LABELS[adaptation.adaptationHealth]?.label ?? adaptation.adaptationHealth}
              </span>
              <div className="text-2xl font-bold text-slate-900">
                {adaptation.adaptationTimeline.totalEvents}
                <span className="text-sm font-normal text-slate-500"> events</span>
              </div>
            </div>
          )}

          {benchmark && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Benchmark Position</div>
              <div
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${COHORT_COLORS[benchmark.orgPosition.cohort] ?? 'bg-slate-100 text-slate-700'}`}
              >
                {benchmark.orgPosition.cohort}
              </div>
              <div className="text-sm text-slate-600">
                ~{benchmark.orgPosition.estimatedPercentile}th percentile
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Intelligence tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && (
        <div className="py-12 text-center text-slate-500">Loading organizational intelligence…</div>
      )}
      {error && (
        <div className="py-6 text-center text-red-600">{error}</div>
      )}

      {/* Learning Insights tab */}
      {!loading && activeTab === 'learning' && learning && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{learning.summary}</p>
          <div className="grid gap-3">
            {learning.insights.length === 0 ? (
              <p className="text-slate-400 text-sm">No insights available yet. Build more organizational memory to enable learning analysis.</p>
            ) : (
              learning.insights.map((insight) => (
                <LearningInsightCard key={insight.id} insight={insight} />
              ))
            )}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold text-slate-800">Advancement Focus</h3>
            <p className="text-sm text-slate-700">{learning.maturityAssessment.advancementFocus}</p>
            {learning.maturityAssessment.primaryDrivers.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Drivers</p>
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-0.5">
                  {learning.maturityAssessment.primaryDrivers.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {learning.maturityAssessment.primaryLimiters.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Limiters</p>
                <ul className="list-disc list-inside text-sm text-amber-700 space-y-0.5">
                  {learning.maturityAssessment.primaryLimiters.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Adaptation History tab */}
      {!loading && activeTab === 'adaptation' && adaptation && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {adaptation.adaptationTimeline.progressionNarrative}
          </p>
          {adaptation.recurringPatterns.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800">Recurring Patterns</h3>
              {adaptation.recurringPatterns.map((pattern, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {pattern.patternType.replace(/_/g, ' ')}
                  </span>
                  <p className="text-sm font-medium text-slate-800">{pattern.description}</p>
                  <p className="text-xs text-slate-500">
                    Detected {pattern.occurrenceCount} times — last:{' '}
                    {new Date(pattern.mostRecentAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-slate-600 italic">{pattern.governanceImplication}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800">Event Timeline</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {adaptation.adaptationTimeline.events.slice(0, 30).map((event) => (
                <div key={event.id} className="flex gap-3 text-sm">
                  <div className="w-28 shrink-0 text-slate-400">
                    {new Date(event.occurredAt).toLocaleDateString()}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-slate-700 capitalize">
                      {event.eventType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-600"> — {event.description}</span>
                  </div>
                  {event.resilienceScoreAtEvent !== null && (
                    <div className="shrink-0 text-indigo-600 font-medium">
                      {event.resilienceScoreAtEvent}
                    </div>
                  )}
                </div>
              ))}
              {adaptation.adaptationTimeline.totalEvents > 30 && (
                <p className="text-xs text-slate-400 text-center py-1">
                  Showing 30 of {adaptation.adaptationTimeline.totalEvents} events
                </p>
              )}
            </div>
          </div>
          <p className="text-sm text-indigo-700 font-medium">{adaptation.nextFocusRecommendation}</p>
        </div>
      )}

      {/* Mitigation Effectiveness tab */}
      {!loading && activeTab === 'effectiveness' && effectiveness && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wide">Overall Effectiveness</span>
              <div
                className={`mt-0.5 inline-flex px-3 py-1 rounded-full text-sm font-semibold ${EFFECTIVENESS_COLORS[effectiveness.overallEffectivenessRating] ?? 'text-slate-600 bg-slate-50'}`}
              >
                {effectiveness.overallEffectivenessRating.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="text-slate-400 text-sm">Avg resilience gain:</div>
            <div className={`text-lg font-bold ${effectiveness.averageResilienceGain >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {effectiveness.averageResilienceGain > 0 ? '+' : ''}{effectiveness.averageResilienceGain}
            </div>
          </div>

          <p className="text-sm text-slate-600">{effectiveness.continuityRecommendation}</p>

          {effectiveness.dimensionBreakdown.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-800">By Governance Dimension</h3>
              {effectiveness.dimensionBreakdown.map((dim) => (
                <div key={dim.dimension} className="flex items-center gap-3 text-sm">
                  <div className="w-32 text-slate-600 capitalize">{dim.dimension}</div>
                  <div
                    className={`px-2 py-0.5 rounded text-xs font-medium ${EFFECTIVENESS_COLORS[dim.effectivenessRating] ?? 'text-slate-500 bg-slate-50'}`}
                  >
                    {dim.effectivenessRating.replace(/_/g, ' ')}
                  </div>
                  <div className={`font-medium ${dim.averageScoreChange >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {dim.averageScoreChange > 0 ? '+' : ''}{dim.averageScoreChange}
                  </div>
                  <div className="text-slate-400">({dim.interventionCount} interventions)</div>
                </div>
              ))}
            </div>
          )}

          {effectiveness.outcomes.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-800">Intervention Outcomes</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {effectiveness.outcomes.map((outcome) => (
                  <div
                    key={outcome.interventionId}
                    className="border border-slate-200 rounded-lg p-3 flex items-start gap-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{outcome.interventionTitle}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(outcome.recordedAt).toLocaleDateString()} — {outcome.daysToObservableEffect}d to effect
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-semibold ${(outcome.scoreChange ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}
                      >
                        {(outcome.scoreChange ?? 0) > 0 ? '+' : ''}{outcome.scoreChange ?? 0}
                      </div>
                      <div
                        className={`text-xs px-2 py-0.5 rounded-full ${EFFECTIVENESS_COLORS[outcome.effectivenessRating] ?? ''}`}
                      >
                        {outcome.effectivenessRating.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Maturity Benchmark tab */}
      {!loading && activeTab === 'benchmark' && benchmark && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Cohort</span>
                <div
                  className={`mt-0.5 inline-flex px-3 py-1 rounded-full text-sm font-semibold ${COHORT_COLORS[benchmark.orgPosition.cohort] ?? 'bg-slate-100 text-slate-700'}`}
                >
                  {benchmark.orgPosition.cohort}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Score</span>
                <div className="text-2xl font-bold text-slate-900">
                  {benchmark.orgPosition.currentScore}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Percentile</span>
                <div className="text-xl font-semibold text-indigo-700">
                  ~{benchmark.orgPosition.estimatedPercentile}th
                </div>
              </div>
              {benchmark.orgPosition.pointsToNextCohort > 0 && (
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wide">To next cohort</span>
                  <div className="text-base font-semibold text-amber-700">
                    +{benchmark.orgPosition.pointsToNextCohort} pts
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600">{benchmark.orgPosition.positionDescription}</p>
          </div>

          {/* Cohort progression visual */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800">Maturity Progression</h3>
            <div className="flex gap-1 items-end h-8">
              {benchmark.maturityCurve.cohortBands.map((band) => {
                const isActive = band.cohort === benchmark.orgPosition.cohort;
                const isPast = benchmark.orgPosition.currentScore > band.maxScore;
                return (
                  <div
                    key={band.cohort}
                    className={`flex-1 rounded text-center text-xs font-medium py-1 transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white scale-110 shadow'
                        : isPast
                        ? 'bg-indigo-200 text-indigo-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                    title={band.description}
                  >
                    {band.cohort.charAt(0).toUpperCase() + band.cohort.slice(1, 3)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dimension comparisons */}
          {benchmark.dimensionComparisons.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-800">Dimension Comparison vs Cohort</h3>
              {benchmark.dimensionComparisons.map((dim) => (
                <div key={dim.dimensionName} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">{dim.dimensionName}</span>
                    <span
                      className={`text-xs font-medium ${
                        dim.relativePosition === 'above_cohort'
                          ? 'text-green-700'
                          : dim.relativePosition === 'below_cohort'
                          ? 'text-red-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {dim.gapToCohortAverage > 0 ? '+' : ''}{dim.gapToCohortAverage} vs cohort avg
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        dim.relativePosition === 'above_cohort'
                          ? 'bg-green-500'
                          : dim.relativePosition === 'below_cohort'
                          ? 'bg-red-400'
                          : 'bg-indigo-400'
                      }`}
                      style={{ width: `${Math.min(dim.orgScore, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{dim.insight}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
            {benchmark.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
