'use client';

/**
 * Continuity Simulation Workspace
 *
 * Interactive workspace for organizational continuity scenario simulation.
 * Combines: cognition graph, propagation playback, mitigation comparison,
 * governance impact, and resilience delta visualization.
 *
 * This workspace helps organizations interactively explore operational fragility,
 * compare mitigation strategies, and reason through continuity decisions.
 *
 * All analysis is organizational — not individual/workforce evaluation.
 */

import { useState, useEffect } from 'react';
import { CognitionGraphViz, type CognitionGraph } from './cognition-graph/cognition-graph-viz';
import { PropagationPlayback, type PropagationPlaybackData } from './propagation-playback/propagation-playback';
import { GovernanceImpactExplorer, type GovernanceImpactData } from './governance-impact/governance-impact-explorer';

type WorkspaceTab = 'graph' | 'playback' | 'governance' | 'comparison';
type OverlayMode = 'risk' | 'governance' | 'propagation' | 'none';

interface SimulationScenario {
  id: string;
  type: string;
  affectedNodes: string[];
  duration: number;
  label: string;
}

interface MitigationScenariosData {
  scenarios: Array<{
    mitigationType: string;
    investmentLevel: 'low' | 'medium' | 'high';
    durationWeeks: number;
    label: string;
    projectedResilienceGain: number;
    impactDeltas: Array<{ domainName: string; exposureReduction: number }>;
  }>;
  recommendation: string;
}

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

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-3">
      <p>{message}</p>
      <button onClick={onRetry} className="text-xs px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600">
        Retry
      </button>
    </div>
  );
}

export function ContinuitySimulationWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('graph');
  const [overlay, setOverlay] = useState<OverlayMode>('risk');

  const [propagationData, setPropagationData] = useState<CognitionGraph | null>(null);
  const [propagationLoading, setPropagationLoading] = useState(true);
  const [propagationError, setPropagationError] = useState<string | null>(null);

  const [governanceData, setGovernanceData] = useState<GovernanceImpactData | null>(null);
  const [governanceLoading, setGovernanceLoading] = useState(false);

  const [playbackData, setPlaybackData] = useState<PropagationPlaybackData | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario | null>(null);

  const [mitigationData, setMitigationData] = useState<MitigationScenariosData | null>(null);
  const [mitigationLoading, setMitigationLoading] = useState(false);

  // Fetch propagation / cognition graph
  const fetchPropagation = async () => {
    try {
      setPropagationLoading(true);
      setPropagationError(null);
      const res = await fetch('/api/exit-interviews/propagation');
      if (!res.ok) throw new Error('Failed to load propagation data');
      const json = await res.json();
      const raw = json.data;

      // Map raw propagation map to CognitionGraph shape
      const graph: CognitionGraph = {
        nodes: (raw.nodes ?? []).map((n: any) => ({
          id: n.id,
          label: n.label,
          nodeType: n.nodeType ?? 'expertise',
          category: n.category ?? n.nodeType ?? 'general',
          continuitySensitivity: n.continuitySensitivity ?? 'medium',
          isSingleSource: n.isSingleSource ?? false,
          frequency: n.frequency ?? 1,
        })),
        edges: (raw.edges ?? []).map((e: any) => ({
          sourceId: e.sourceId,
          targetId: e.targetId,
          strength: e.weight ?? e.strength ?? 1,
          edgeType: e.edgeType ?? 'dependency',
        })),
        propagationPaths: (raw.propagationPaths ?? []).map((p: any) => ({
          path: p.path ?? [],
          impactScore: p.impactScore ?? 0,
          disruptionScope: p.disruptionScope ?? '',
        })),
        bottlenecks: (raw.bottlenecks ?? []).map((b: any) => (typeof b === 'string' ? b : b.nodeId ?? b.id ?? '')),
      };
      setPropagationData(graph);
    } catch {
      setPropagationError('Unable to load organizational dependency graph.');
    } finally {
      setPropagationLoading(false);
    }
  };

  const fetchGovernance = async () => {
    if (governanceData) return;
    try {
      setGovernanceLoading(true);
      const res = await fetch('/api/exit-interviews/cascade-analysis');
      if (!res.ok) throw new Error('Failed to load governance data');
      const json = await res.json();
      const raw = json.data;

      // Map cascade analysis to GovernanceImpactData
      const mapped: GovernanceImpactData = {
        totalGovernanceProcesses: raw.totalGovernanceNodes ?? 0,
        singleSourceProcesses: raw.singleSourceGovernanceNodes ?? 0,
        criticalGovernanceGaps: raw.criticalGaps ?? [],
        nodes: (raw.governanceNodes ?? []).map((n: any) => ({
          id: n.id ?? n.name,
          name: n.name ?? n.label,
          type: n.type ?? 'procedural',
          isSingleSource: n.isSingleSource ?? false,
          dependsOn: n.dependsOn ?? [],
          downstreamProcesses: n.downstreamProcesses ?? n.downstream ?? [],
          riskLevel: n.riskLevel ?? 'medium',
          continuityImplication: n.continuityImplication ?? n.description ?? '',
        })),
        cascadeRisks: (raw.cascadeRisks ?? []).map((r: any) => ({
          triggerNode: r.triggerNode ?? r.trigger ?? '',
          cascadedProcesses: r.cascadedProcesses ?? r.cascade ?? [],
          severity: r.severity ?? 'medium',
          description: r.description ?? '',
        })),
      };
      setGovernanceData(mapped);
    } catch {
      // Leave null — governance tab will show empty state
    } finally {
      setGovernanceLoading(false);
    }
  };

  const fetchSimulation = async (scenario: SimulationScenario) => {
    try {
      setPlaybackLoading(true);
      const res = await fetch('/api/exit-interviews/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioType: scenario.type,
          affectedNodeIds: scenario.affectedNodes,
          durationWeeks: scenario.duration,
        }),
      });
      if (!res.ok) throw new Error('Failed to run simulation');
      const json = await res.json();
      const raw = json.data;

      const pb: PropagationPlaybackData = {
        scenarioName: scenario.label,
        disruptionType: scenario.type,
        totalWeeks: raw.durationWeeks ?? scenario.duration,
        timeline: (raw.degradationTimeline ?? []).map((t: any) => ({
          week: t.week,
          operationalCapacity: t.operationalCapacity ?? 100,
          affectedDomains: t.affectedDomains ?? [],
          criticalFailures: t.criticalFailures ?? [],
          recoveryProgress: t.recoveryProgress ?? 0,
        })),
        mitigationReplays: [],
        bottlenecksExposed: raw.weaknessIndicators?.map((w: any) => w.area ?? '') ?? [],
        recoveryWeek: raw.estimatedRecoveryWeeks ?? null,
      };
      setPlaybackData(pb);
    } catch {
      // Leave null
    } finally {
      setPlaybackLoading(false);
    }
  };

  const fetchMitigationComparison = async () => {
    if (mitigationData) return;
    try {
      setMitigationLoading(true);
      const res = await fetch('/api/exit-interviews/mitigation-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarios: [
            { mitigationType: 'documentation_campaign', targetNodeIds: [], investmentLevel: 'medium', durationWeeks: 12, label: 'Documentation Campaign' },
            { mitigationType: 'cross_training', targetNodeIds: [], investmentLevel: 'medium', durationWeeks: 16, label: 'Cross-Training Program' },
            { mitigationType: 'governance_decentralization', targetNodeIds: [], investmentLevel: 'high', durationWeeks: 20, label: 'Governance Decentralization' },
          ],
        }),
      });
      if (!res.ok) throw new Error('Failed to load mitigation comparison');
      const json = await res.json();
      const raw = json.data;
      setMitigationData({
        scenarios: (raw.results ?? []).map((r: any) => ({
          mitigationType: r.scenario?.mitigationType ?? '',
          investmentLevel: r.scenario?.investmentLevel ?? 'medium',
          durationWeeks: r.scenario?.durationWeeks ?? 12,
          label: r.scenario?.label ?? r.scenario?.mitigationType ?? '',
          projectedResilienceGain: r.projectedGain?.resilienceScoreGain ?? 0,
          impactDeltas: (r.impactDelta?.perDomainDeltas ?? []).map((d: any) => ({
            domainName: d.domainName ?? '',
            exposureReduction: d.exposureReduction ?? 0,
          })),
        })),
        recommendation: raw.topRecommendation?.mitigationType ?? '',
      });
    } catch {
      // Leave null
    } finally {
      setMitigationLoading(false);
    }
  };

  useEffect(() => {
    fetchPropagation();
  }, []);

  useEffect(() => {
    if (activeTab === 'governance') fetchGovernance();
    if (activeTab === 'comparison') fetchMitigationComparison();
  }, [activeTab]);

  const PRESET_SCENARIOS: SimulationScenario[] = [
    { id: 'retirement_wave', type: 'retirement_wave', affectedNodes: [], duration: 24, label: 'Retirement Wave' },
    { id: 'rapid_turnover', type: 'rapid_turnover', affectedNodes: [], duration: 12, label: 'Rapid Turnover' },
    { id: 'governance_transition', type: 'governance_transition', affectedNodes: [], duration: 16, label: 'Governance Transition' },
    { id: 'vendor_disruption', type: 'vendor_disruption', affectedNodes: [], duration: 8, label: 'Vendor Disruption' },
  ];

  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'graph', label: 'Dependency Graph' },
    { id: 'playback', label: 'Propagation Playback' },
    { id: 'governance', label: 'Governance Impact' },
    { id: 'comparison', label: 'Mitigation Comparison' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Continuity Simulation Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">
          Interactively explore organizational continuity fragility, simulate disruption scenarios,
          and compare mitigation strategies.
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

      {/* Graph Tab */}
      {activeTab === 'graph' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Overlay:</span>
            {(['risk', 'governance', 'propagation', 'none'] as OverlayMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setOverlay(m)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  overlay === m
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {m === 'none' ? 'Type' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {propagationLoading ? (
            <LoadingState message="Loading organizational dependency graph..." />
          ) : propagationError ? (
            <ErrorState message={propagationError} onRetry={fetchPropagation} />
          ) : propagationData ? (
            <CognitionGraphViz graph={propagationData} overlay={overlay} />
          ) : null}
        </div>
      )}

      {/* Playback Tab */}
      {activeTab === 'playback' && (
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-slate-700 mb-2">Select a scenario to simulate</div>
            <div className="flex flex-wrap gap-2">
              {PRESET_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedScenario(s);
                    setPlaybackData(null);
                    fetchSimulation(s);
                  }}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    selectedScenario?.id === s.id
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {!selectedScenario && (
            <div className="text-sm text-slate-400 text-center py-12">
              Select a scenario above to begin propagation playback simulation.
            </div>
          )}

          {selectedScenario && playbackLoading && (
            <LoadingState message={`Running ${selectedScenario.label} simulation...`} />
          )}

          {selectedScenario && !playbackLoading && playbackData && (
            <div className="border border-slate-200 rounded-lg p-5">
              <PropagationPlayback playback={playbackData} />
            </div>
          )}

          {selectedScenario && !playbackLoading && !playbackData && (
            <div className="text-sm text-slate-400 text-center py-12">
              Simulation could not be completed. Check that exit interview data is available.
            </div>
          )}
        </div>
      )}

      {/* Governance Tab */}
      {activeTab === 'governance' && (
        <div>
          {governanceLoading ? (
            <LoadingState message="Loading governance impact analysis..." />
          ) : governanceData ? (
            <GovernanceImpactExplorer data={governanceData} />
          ) : (
            <div className="text-sm text-slate-400 text-center py-12">
              No governance impact data available. Ensure exit interviews have been published.
            </div>
          )}
        </div>
      )}

      {/* Mitigation Comparison Tab */}
      {activeTab === 'comparison' && (
        <div>
          {mitigationLoading ? (
            <LoadingState message="Running mitigation comparison analysis..." />
          ) : mitigationData ? (
            <div className="space-y-4">
              {mitigationData.recommendation && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
                  Top recommendation: <span className="font-medium">{mitigationData.recommendation.replace(/_/g, ' ')}</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mitigationData.scenarios.map((s, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
                    <div className="font-medium text-slate-800 text-sm">{s.label || s.mitigationType.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500">{s.durationWeeks} weeks · {s.investmentLevel} investment</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold text-indigo-600">+{s.projectedResilienceGain}</span>
                      <span className="text-xs text-slate-500">resilience points</span>
                    </div>
                    {s.impactDeltas.slice(0, 3).map((d, di) => (
                      <div key={di} className="text-xs text-slate-600">
                        {d.domainName}: <span className="text-emerald-600">-{d.exposureReduction.toFixed(0)}% exposure</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-12">
              Mitigation comparison data unavailable. Ensure exit interviews have been published.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
