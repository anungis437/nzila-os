'use client';

import { useState, useEffect } from 'react';
import type { GovernanceCultureProfile } from '@/lib/knowledge-transfer/governance-culture/culture-models';
import type { BehaviorPatternReport } from '@/lib/knowledge-transfer/behavior-patterns/behavior-models';
import type { ArchetypeClassificationResult } from '@/lib/knowledge-transfer/learning-archetypes/archetype-models';
import type { ResilienceHabitProfile } from '@/lib/knowledge-transfer/resilience-habits/habit-models';
import type { GovernancePersonalityProfile } from '@/lib/knowledge-transfer/maturity-personalities/personality-models';
import type { LearningTrajectoryReport } from '@/lib/knowledge-transfer/learning-trajectories/trajectory-models';

type TabKey = 'culture' | 'patterns' | 'habits' | 'trajectory';

// ─── Color Maps ────────────────────────────────────────────────────────────────

const POSTURE_COLORS: Record<string, string> = {
  proactive_governance: 'bg-emerald-100 text-emerald-800',
  responsive_governance: 'bg-blue-100 text-blue-800',
  procedural_governance: 'bg-indigo-100 text-indigo-800',
  adaptive_governance: 'bg-violet-100 text-violet-800',
  fragmented_governance: 'bg-amber-100 text-amber-800',
  nascent_governance: 'bg-slate-100 text-slate-700',
};

const HEALTH_COLORS: Record<string, string> = {
  strengthening: 'text-emerald-700',
  stable: 'text-slate-600',
  weakening: 'text-red-600',
  recovering: 'text-amber-600',
  insufficient_history: 'text-slate-400',
};

const HABIT_TIER_COLORS: Record<string, string> = {
  strong: 'bg-emerald-100 text-emerald-800',
  developing: 'bg-blue-100 text-blue-800',
  emerging: 'bg-amber-100 text-amber-800',
  absent: 'bg-slate-100 text-slate-600',
};

const MOMENTUM_COLORS: Record<string, string> = {
  accelerating: 'text-emerald-700',
  steady: 'text-blue-700',
  decelerating: 'text-amber-600',
  stalled: 'text-red-600',
  insufficient_data: 'text-slate-400',
};

const PATTERN_STRENGTH_COLORS: Record<string, string> = {
  strong: 'border-l-indigo-500',
  moderate: 'border-l-blue-400',
  weak: 'border-l-slate-300',
  tentative: 'border-l-slate-200',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-1">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold ${colorClass ?? 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function HabitBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 70 ? 'bg-emerald-500' :
    score >= 40 ? 'bg-blue-500' :
    score >= 15 ? 'bg-amber-400' : 'bg-slate-300';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-medium text-slate-800">{score}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function TrajectoryChart({ points }: { points: { capturedAt: string; resilienceScore: number; hasIntervention: boolean }[] }) {
  if (points.length < 2) {
    return <div className="h-28 flex items-center justify-center text-sm text-slate-400">Not enough data for trajectory chart</div>;
  }
  const W = 400;
  const H = 80;
  const scores = points.map((p) => p.resilienceScore);
  const maxScore = Math.max(...scores, 1);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore || 1;

  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((p.resilienceScore - minScore) / range) * (H - 8) - 4;
    return { x, y, hasIntervention: p.hasIntervention };
  });

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" aria-label="Resilience trajectory chart">
      <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) =>
        p.hasIntervention ? (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="white" strokeWidth="1.5" />
        ) : null
      )}
    </svg>
  );
}

function MilestoneList({ milestones }: { milestones: { label: string; scoreThreshold: number; achieved: boolean; achievedAt: string | null }[] }) {
  return (
    <div className="space-y-2">
      {milestones.map((m) => (
        <div key={m.label} className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              m.achieved ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
            }`}
          >
            {m.achieved && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-sm ${m.achieved ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
              {m.label}
            </span>
            <span className="ml-2 text-xs text-slate-400">≥{m.scoreThreshold}</span>
          </div>
          {m.achievedAt && (
            <span className="text-xs text-slate-400 flex-shrink-0">
              {new Date(m.achievedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function ContinuityCultureEvolution() {
  const [activeTab, setActiveTab] = useState<TabKey>('culture');

  const [culture, setCulture] = useState<GovernanceCultureProfile | null>(null);
  const [patterns, setPatterns] = useState<BehaviorPatternReport | null>(null);
  const [archetype, setArchetype] = useState<ArchetypeClassificationResult | null>(null);
  const [habits, setHabits] = useState<ResilienceHabitProfile | null>(null);
  const [personality, setPersonality] = useState<GovernancePersonalityProfile | null>(null);
  const [trajectory, setTrajectory] = useState<LearningTrajectoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [c, p, a, h, per, t] = await Promise.all([
          fetch('/api/exit-interviews/governance-culture').then((r) => r.json()),
          fetch('/api/exit-interviews/behavior-patterns').then((r) => r.json()),
          fetch('/api/exit-interviews/learning-archetypes').then((r) => r.json()),
          fetch('/api/exit-interviews/resilience-habits').then((r) => r.json()),
          fetch('/api/exit-interviews/maturity-personalities').then((r) => r.json()),
          fetch('/api/exit-interviews/learning-trajectories').then((r) => r.json()),
        ]);
        setCulture(c.data ?? null);
        setPatterns(p.data ?? null);
        setArchetype(a.data ?? null);
        setHabits(h.data ?? null);
        setPersonality(per.data ?? null);
        setTrajectory(t.data ?? null);
      } catch {
        setError('Unable to load culture intelligence data. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'culture', label: 'Governance Culture' },
    { key: 'patterns', label: 'Behavior Patterns' },
    { key: 'habits', label: 'Resilience Habits' },
    { key: 'trajectory', label: 'Learning Trajectory' },
  ];

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-500 text-sm">Analyzing organizational culture intelligence…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile
          label="Governance Culture"
          value={culture?.cultureScore != null ? `${culture.cultureScore}/100` : '—'}
          sub={culture?.dominantPosture?.replace(/_/g, ' ')}
          colorClass={HEALTH_COLORS[culture?.cultureHealth ?? 'insufficient_history']}
        />
        <MetricTile
          label="Governance Personality"
          value={personality?.personalityName ?? '—'}
          sub={`Maturity: ${personality?.maturityScore ?? '—'}/100`}
        />
        <MetricTile
          label="Learning Archetype"
          value={archetype?.primaryArchetype?.name ?? '—'}
          sub={`${archetype?.classificationConfidence ?? '—'}% confidence`}
        />
        <MetricTile
          label="Habit Formation"
          value={habits?.overallHabitScore != null ? `${habits.overallHabitScore}/100` : '—'}
          sub={habits?.overallTier?.replace(/_/g, ' ')}
          colorClass={HABIT_TIER_COLORS[habits?.overallTier ?? 'absent']?.split(' ')[1]}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Governance Culture Tab */}
      {activeTab === 'culture' && culture && (
        <div className="space-y-6">
          {/* Culture overview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold mb-2 ${
                    POSTURE_COLORS[culture.dominantPosture] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {culture.dominantPosture.replace(/_/g, ' ')}
                </span>
                <p className="text-sm text-slate-700">{culture.cultureSummary}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-bold text-slate-900">{culture.cultureScore}</div>
                <div className="text-xs text-slate-500">Culture Score</div>
              </div>
            </div>
          </div>

          {/* Discipline profile */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Governance Discipline</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Engagement', value: culture.disciplineProfile.engagementConsistency },
                { label: 'Documentation', value: culture.disciplineProfile.documentationDiscipline },
                { label: 'Mitigation Follow-Through', value: culture.disciplineProfile.mitigationFollowThrough },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className="text-sm font-medium text-slate-800 capitalize">{value?.replace(/_/g, ' ') ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Culture indicators */}
          {culture.indicators.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Culture Indicators</h3>
              <div className="space-y-2">
                {culture.indicators.map((ind, i) => (
                  <div
                    key={i}
                    className={`border-l-4 pl-4 py-2 rounded-r-lg ${
                      ind.valence === 'positive'
                        ? 'border-l-emerald-400 bg-emerald-50'
                        : ind.valence === 'negative'
                          ? 'border-l-red-400 bg-red-50'
                          : 'border-l-slate-300 bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{ind.dimension}</div>
                    <div className="text-sm text-slate-800 mt-0.5">{ind.observation}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{ind.evidence}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evolution phases */}
          {culture.evolutionPhases.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Culture Evolution Phases</h3>
              <div className="space-y-2">
                {culture.evolutionPhases.map((phase) => (
                  <div key={phase.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-800">{phase.label}</span>
                      {phase.resilienceRange && (
                        <span className="text-xs text-slate-500">
                          Score: {phase.resilienceRange.min}–{phase.resilienceRange.max}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{phase.characterization}</p>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(phase.startedAt).toLocaleDateString()}
                      {phase.endedAt ? ` → ${new Date(phase.endedAt).toLocaleDateString()}` : ' → Present'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archetype sidebar */}
          {archetype && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Organizational Archetype</div>
              <div className="text-sm font-semibold text-indigo-900">{archetype.primaryArchetype.name}</div>
              <p className="text-xs text-indigo-700 mt-1">{archetype.primaryArchetype.description}</p>
              <p className="text-xs text-indigo-600 mt-2 italic">{archetype.evolutionContext}</p>
            </div>
          )}

          {/* Governance interpretation guidance */}
          <p className="text-xs text-slate-400 italic">{culture.interpretationGuidance}</p>
        </div>
      )}

      {/* Behavior Patterns Tab */}
      {activeTab === 'patterns' && patterns && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Behavioral Narrative</div>
            <p className="text-sm text-slate-700">{patterns.behaviorNarrative}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">Learning Signal:</span>
              <span className="text-xs font-medium text-slate-700 capitalize">
                {patterns.learningSignal?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {patterns.patterns.length > 0 ? (
            <div className="space-y-3">
              {patterns.patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className={`border-l-4 pl-4 py-3 bg-white border border-slate-200 rounded-r-lg ${
                    PATTERN_STRENGTH_COLORS[pattern.evidenceStrength] ?? 'border-l-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{pattern.label}</div>
                      <p className="text-sm text-slate-600 mt-1">{pattern.description}</p>
                    </div>
                    <div className="flex-shrink-0 text-right space-y-1">
                      <span className="text-xs text-slate-500 capitalize">{pattern.evidenceStrength} evidence</span>
                      {pattern.isCurrentlyActive && (
                        <div className="text-xs bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">Active</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded p-2">
                    <span className="font-medium">Governance implication: </span>
                    {pattern.governanceImplication}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-slate-500 py-8">
              No distinct behavior patterns detected yet. Continue building organizational memory.
            </div>
          )}

          <p className="text-xs text-slate-400 italic">{patterns.interpretationGuidance}</p>
        </div>
      )}

      {/* Resilience Habits Tab */}
      {activeTab === 'habits' && habits && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold mb-2 ${
                    HABIT_TIER_COLORS[habits.overallTier] ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {habits.overallTier?.replace(/_/g, ' ')}
                </span>
                <p className="text-sm text-slate-700">{habits.habitNarrative}</p>
              </div>
              <div className="text-right flex-shrink-0 space-y-1">
                <div>
                  <div className="text-2xl font-bold text-slate-900">{habits.overallHabitScore}</div>
                  <div className="text-xs text-slate-500">Overall Habit Score</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">{habits.consistencyScore}</div>
                  <div className="text-xs text-slate-500">Consistency</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Habit Dimensions</h3>
            <div className="space-y-3">
              {habits.dimensions.map((dim) => (
                <div key={dim.dimension} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                  <HabitBar score={dim.score} label={dim.label} />
                  <p className="text-xs text-slate-600">{dim.observation}</p>
                  <div className="text-xs text-slate-500 bg-blue-50 rounded p-2">
                    <span className="font-medium text-blue-700">Recommendation: </span>
                    {dim.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 italic">{habits.interpretationGuidance}</p>
        </div>
      )}

      {/* Learning Trajectory Tab */}
      {activeTab === 'trajectory' && trajectory && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Learning Momentum</div>
                <div className={`text-lg font-semibold capitalize ${MOMENTUM_COLORS[trajectory.momentum]}`}>
                  {trajectory.momentum?.replace(/_/g, ' ')}
                </div>
              </div>
              {trajectory.interactionsPerMonth !== null && (
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">{trajectory.interactionsPerMonth}</div>
                  <div className="text-xs text-slate-500">Interactions / month</div>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-700">{trajectory.momentumNarrative}</p>
          </div>

          {/* Trajectory chart */}
          {trajectory.trajectoryPoints.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Resilience Trajectory</h3>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <TrajectoryChart points={trajectory.trajectoryPoints} />
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-indigo-500" />
                    <span>Resilience path</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>Governance intervention</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Forecast */}
          {trajectory.forecast.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Resilience Forecast</h3>
              <div className="grid grid-cols-3 gap-3">
                {trajectory.forecast.map((f) => (
                  <div key={f.monthsAhead} className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-500 mb-1">+{f.monthsAhead} months</div>
                    <div className="text-xl font-bold text-indigo-700">{f.forecastedScore}</div>
                    <div className="text-xs text-slate-400">{f.confidenceRange.low}–{f.confidenceRange.high}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2 italic">
                Forecasts are probabilistic projections based on current momentum — not commitments.
              </p>
            </div>
          )}

          {/* Milestones */}
          {trajectory.milestones.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Maturity Milestones</h3>
                {trajectory.estimatedMonthsToNextMilestone !== null && (
                  <span className="text-xs text-slate-500">
                    ~{trajectory.estimatedMonthsToNextMilestone} months to next milestone
                  </span>
                )}
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <MilestoneList milestones={trajectory.milestones} />
              </div>
            </div>
          )}

          {trajectory.trajectorySpanDays !== null && (
            <div className="text-xs text-slate-400">
              Analysis window: {trajectory.trajectorySpanDays} days · {trajectory.entriesAnalyzed} entries analyzed.
            </div>
          )}

          <p className="text-xs text-slate-400 italic">{trajectory.interpretationGuidance}</p>
        </div>
      )}
    </div>
  );
}
