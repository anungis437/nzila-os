'use client';

/**
 * Continuity Planning Workspace
 *
 * Interactive workspace for organizational continuity planning.
 * Combines: decision brief, mitigation planning, resilience roadmap,
 * and continuity action tracking.
 *
 * All planning is organizational — not individual workforce management.
 */

import { useState, useEffect } from 'react';

type PlanningTab = 'brief' | 'roadmap' | 'actions';

interface EvidenceItem {
  observation: string;
  dataPoint: string;
  confidence: string;
}

interface ReasoningStep {
  step: number;
  evaluation: string;
  conclusion: string;
  assumption: string;
}

interface Recommendation {
  id: string;
  category: string;
  urgency: string;
  impact: string;
  headline: string;
  rationale: string;
  evidence: EvidenceItem[];
  reasoningChain: ReasoningStep[];
  keyAssumptions: string[];
  governanceImplications: string[];
  continuityLogic: string;
  tradeoffs: string[];
  estimatedResilienceGain: number;
}

interface DecisionBriefData {
  currentStateAssessment: string;
  continuityScore: number;
  recommendations: Recommendation[];
  continuityStrengths: string[];
  criticalGaps: string[];
  governanceExposureSummary: string;
  executiveSummary: string;
}

interface StrategyMilestone {
  week: number;
  description: string;
  successCriteria: string;
  dimensionImpacted: string;
}

interface Strategy {
  strategyType: string;
  name: string;
  description: string;
  currentMaturity: string;
  targetMaturity: string;
  estimatedDurationWeeks: number;
  projectedResilienceGain: number;
  governanceStabilityGain: number;
  dependencyReductionImpact: number;
  milestones: StrategyMilestone[];
  kpis: string[];
}

interface RoadmapData {
  currentScore: number;
  projectedScore: number;
  strategies: Strategy[];
  phase1QuickWins: string[];
  phase2Foundation: string[];
  phase3Sustained: string[];
  maturityNarrative: string;
}

type ActionStatus = 'not_started' | 'in_progress' | 'completed';

interface PlanningAction {
  id: string;
  headline: string;
  category: string;
  urgency: string;
  status: ActionStatus;
}

const URGENCY_COLORS: Record<string, string> = {
  immediate: '#ef4444',
  near_term: '#f97316',
  strategic: '#6366f1',
  aspirational: '#10b981',
};

const IMPACT_LABELS: Record<string, string> = {
  transformative: 'Transformative',
  significant: 'Significant',
  moderate: 'Moderate',
  marginal: 'Marginal',
};

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-indigo-300 animate-pulse" />
        {message}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  return (
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx={45} cy={45} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle
        cx={45} cy={45} r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 45 45)"
      />
      <text x={45} y={45} dominantBaseline="middle" textAnchor="middle" fontSize={18} fontWeight="600" fill={color}>
        {score}
      </text>
      <text x={45} y={60} dominantBaseline="middle" textAnchor="middle" fontSize={8} fill="#94a3b8">
        /100
      </text>
    </svg>
  );
}

export function ContinuityPlanningWorkspace() {
  const [activeTab, setActiveTab] = useState<PlanningTab>('brief');
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  const [expandedStrategyIdx, setExpandedStrategyIdx] = useState<number | null>(null);

  const [briefData, setBriefData] = useState<DecisionBriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);

  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);

  const [actions, setActions] = useState<PlanningAction[]>([]);

  const fetchBrief = async () => {
    try {
      setBriefLoading(true);
      const res = await fetch('/api/exit-interviews/decision-brief');
      if (!res.ok) throw new Error('Failed to load decision brief');
      const json = await res.json();
      const raw = json.data;
      setBriefData(raw);

      // Initialize action tracker from recommendations
      const initialActions: PlanningAction[] = (raw.recommendations ?? []).map((r: Recommendation) => ({
        id: r.id,
        headline: r.headline,
        category: r.category,
        urgency: r.urgency,
        status: 'not_started' as ActionStatus,
      }));
      setActions(initialActions);
    } catch {
      // Show empty state
    } finally {
      setBriefLoading(false);
    }
  };

  const fetchRoadmap = async () => {
    if (roadmapData) return;
    try {
      setRoadmapLoading(true);
      const res = await fetch('/api/exit-interviews/resilience-roadmap');
      if (!res.ok) throw new Error('Failed to load roadmap');
      const json = await res.json();
      setRoadmapData(json.data);
    } catch {
      // Show empty state
    } finally {
      setRoadmapLoading(false);
    }
  };

  useEffect(() => {
    fetchBrief();
  }, []);

  useEffect(() => {
    if (activeTab === 'roadmap') fetchRoadmap();
  }, [activeTab]);

  const updateActionStatus = (id: string, status: ActionStatus) => {
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  };

  const tabs: Array<{ id: PlanningTab; label: string }> = [
    { id: 'brief', label: 'Decision Brief' },
    { id: 'roadmap', label: 'Resilience Roadmap' },
    { id: 'actions', label: 'Planning Actions' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Continuity Planning Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">
          Prioritized continuity planning recommendations with full reasoning transparency,
          resilience roadmap, and action tracking.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Decision Brief Tab */}
      {activeTab === 'brief' && (
        <>
          {briefLoading ? (
            <LoadingState message="Generating continuity decision brief..." />
          ) : briefData ? (
            <div className="space-y-5">
              {/* Executive summary + score */}
              <div className="flex gap-4 items-start">
                <ScoreRing score={briefData.continuityScore} />
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{briefData.executiveSummary}</p>
                </div>
              </div>

              {/* Critical gaps + strengths */}
              <div className="grid grid-cols-2 gap-4">
                {briefData.criticalGaps.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-red-700 mb-1">Critical Gaps</div>
                    <ul className="space-y-1">
                      {briefData.criticalGaps.map((g, i) => (
                        <li key={i} className="text-xs text-red-700">• {g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {briefData.continuityStrengths.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-emerald-700 mb-1">Continuity Strengths</div>
                    <ul className="space-y-1">
                      {briefData.continuityStrengths.map((s, i) => (
                        <li key={i} className="text-xs text-emerald-700">• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Governance exposure */}
              {briefData.governanceExposureSummary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  {briefData.governanceExposureSummary}
                </div>
              )}

              {/* Recommendations */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">
                  Prioritized Continuity Recommendations
                </h3>
                <div className="space-y-2">
                  {briefData.recommendations.map((rec) => (
                    <div key={rec.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                        onClick={() => setExpandedRecId(expandedRecId === rec.id ? null : rec.id)}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: URGENCY_COLORS[rec.urgency] ?? '#94a3b8' }}
                        />
                        <span className="flex-1 text-sm font-medium text-slate-800">{rec.headline}</span>
                        <span className="text-xs text-slate-500 mr-2">{IMPACT_LABELS[rec.impact] ?? rec.impact}</span>
                        <span className="text-xs text-slate-400">+{rec.estimatedResilienceGain} pts</span>
                        <span className="text-slate-300 ml-2">{expandedRecId === rec.id ? '▲' : '▼'}</span>
                      </button>

                      {expandedRecId === rec.id && (
                        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-white">
                          <p className="text-sm text-slate-700">{rec.rationale}</p>

                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xs font-semibold text-slate-700 mb-1">Continuity Logic</h4>
                              <p className="text-xs text-slate-600">{rec.continuityLogic}</p>
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold text-slate-700 mb-1">Evidence ({rec.evidence.length})</h4>
                              {rec.evidence.map((e, i) => (
                                <div key={i} className="text-xs text-slate-600 flex gap-2 mb-1">
                                  <span className="text-slate-400">{i + 1}.</span>
                                  <span>{e.observation} <span className="text-slate-400">({e.confidence} confidence)</span></span>
                                </div>
                              ))}
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold text-slate-700 mb-1">Reasoning Chain</h4>
                              {rec.reasoningChain.map((r) => (
                                <div key={r.step} className="text-xs text-slate-600 flex gap-2 mb-1">
                                  <span className="text-slate-400 w-4 flex-shrink-0">{r.step}.</span>
                                  <span><span className="text-slate-500">{r.evaluation}</span> → {r.conclusion}</span>
                                </div>
                              ))}
                            </div>

                            {rec.keyAssumptions.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-1">Key Assumptions</h4>
                                {rec.keyAssumptions.map((a, i) => (
                                  <div key={i} className="text-xs text-slate-500">• {a}</div>
                                ))}
                              </div>
                            )}

                            {rec.governanceImplications.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-1">Governance Implications</h4>
                                {rec.governanceImplications.map((g, i) => (
                                  <div key={i} className="text-xs text-blue-700">• {g}</div>
                                ))}
                              </div>
                            )}

                            {rec.tradeoffs.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-1">Tradeoffs</h4>
                                {rec.tradeoffs.map((t, i) => (
                                  <div key={i} className="text-xs text-slate-500">• {t}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-16">
              No decision brief available. Ensure exit interviews have been published.
            </div>
          )}
        </>
      )}

      {/* Resilience Roadmap Tab */}
      {activeTab === 'roadmap' && (
        <>
          {roadmapLoading ? (
            <LoadingState message="Building resilience roadmap..." />
          ) : roadmapData ? (
            <div className="space-y-5">
              {/* Score projection */}
              <div className="flex gap-8 items-center">
                <div className="text-center">
                  <ScoreRing score={roadmapData.currentScore} />
                  <div className="text-xs text-slate-500 mt-1">Current</div>
                </div>
                <div className="text-2xl text-slate-300">→</div>
                <div className="text-center">
                  <ScoreRing score={roadmapData.projectedScore} />
                  <div className="text-xs text-slate-500 mt-1">Projected</div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{roadmapData.maturityNarrative}</p>
                </div>
              </div>

              {/* Phases */}
              <div className="grid grid-cols-3 gap-3">
                {roadmapData.phase1QuickWins.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-emerald-700 mb-1">Phase 1 — Quick Wins (0–8 wks)</div>
                    {roadmapData.phase1QuickWins.map((s, i) => <div key={i} className="text-xs text-emerald-700">• {s}</div>)}
                  </div>
                )}
                {roadmapData.phase2Foundation.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-blue-700 mb-1">Phase 2 — Foundation (8–24 wks)</div>
                    {roadmapData.phase2Foundation.map((s, i) => <div key={i} className="text-xs text-blue-700">• {s}</div>)}
                  </div>
                )}
                {roadmapData.phase3Sustained.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-indigo-700 mb-1">Phase 3 — Sustained (24+ wks)</div>
                    {roadmapData.phase3Sustained.map((s, i) => <div key={i} className="text-xs text-indigo-700">• {s}</div>)}
                  </div>
                )}
              </div>

              {/* Strategies */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Recommended Strategies</h3>
                <div className="space-y-2">
                  {roadmapData.strategies.map((s, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                        onClick={() => setExpandedStrategyIdx(expandedStrategyIdx === idx ? null : idx)}
                      >
                        <span className="flex-1 text-sm font-medium text-slate-800">{s.name}</span>
                        <span className="text-xs text-slate-500">{s.estimatedDurationWeeks} wks</span>
                        <span className="text-xs text-indigo-600 font-medium">+{s.projectedResilienceGain} pts</span>
                        <span className="text-slate-300 ml-2">{expandedStrategyIdx === idx ? '▲' : '▼'}</span>
                      </button>

                      {expandedStrategyIdx === idx && (
                        <div className="border-t border-slate-100 px-4 py-4 space-y-3 bg-white">
                          <p className="text-sm text-slate-700">{s.description}</p>

                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div className="bg-slate-50 rounded p-2 text-center">
                              <div className="font-medium text-indigo-600">+{s.projectedResilienceGain}</div>
                              <div className="text-slate-500">Resilience pts</div>
                            </div>
                            <div className="bg-slate-50 rounded p-2 text-center">
                              <div className="font-medium text-blue-600">+{s.governanceStabilityGain}</div>
                              <div className="text-slate-500">Gov. stability</div>
                            </div>
                            <div className="bg-slate-50 rounded p-2 text-center">
                              <div className="font-medium text-emerald-600">-{s.dependencyReductionImpact}%</div>
                              <div className="text-slate-500">Dependency</div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 mb-1.5">Milestones</h4>
                            {s.milestones.map((m, mi) => (
                              <div key={mi} className="flex gap-2 text-xs text-slate-600 mb-1">
                                <span className="text-slate-400 w-12 flex-shrink-0">Wk {m.week}</span>
                                <span className="flex-1">{m.description}</span>
                              </div>
                            ))}
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-slate-700 mb-1">KPIs</h4>
                            {s.kpis.map((k, ki) => (
                              <div key={ki} className="text-xs text-slate-500">• {k}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-16">
              No roadmap available. Ensure exit interviews have been published.
            </div>
          )}
        </>
      )}

      {/* Actions Tab */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          {actions.length === 0 && (
            <div className="text-sm text-slate-400 text-center py-16">
              No planning actions yet. Review the Decision Brief tab to generate recommendations.
            </div>
          )}

          {actions.length > 0 && (
            <>
              <div className="flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-300" /> Not started: {actions.filter((a) => a.status === 'not_started').length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" /> In progress: {actions.filter((a) => a.status === 'in_progress').length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Completed: {actions.filter((a) => a.status === 'completed').length}
                </span>
              </div>

              <div className="space-y-2">
                {actions.map((action) => (
                  <div
                    key={action.id}
                    className={`border rounded-lg p-3 flex items-center gap-3 ${
                      action.status === 'completed' ? 'border-emerald-200 bg-emerald-50/50' :
                      action.status === 'in_progress' ? 'border-indigo-200 bg-indigo-50/30' :
                      'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: URGENCY_COLORS[action.urgency] ?? '#94a3b8' }}
                    />
                    <span className={`flex-1 text-sm ${action.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {action.headline}
                    </span>
                    <div className="flex gap-1.5">
                      {(['not_started', 'in_progress', 'completed'] as ActionStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateActionStatus(action.id, s)}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                            action.status === s
                              ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {s === 'not_started' ? 'Not started' : s === 'in_progress' ? 'In progress' : 'Done'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
