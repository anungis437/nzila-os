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
 *
 * What each panel shows is mapped from the service's own result (./workspace-data), and a simulation or comparison is aimed at nodes
 * of the organization's own dependency graph: a scenario that reaches no node is refused by the service, and one that evaluates
 * nothing says nothing, so neither is offered.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { GovernanceCascadeAnalysis } from '@/lib/knowledge-transfer/cascade-analysis/cascade-analyzer';
import type { MitigationComparison, MitigationScenario } from '@/lib/knowledge-transfer/mitigation-comparison/mitigation-models';
import type { PropagationMap } from '@/lib/knowledge-transfer/propagation/propagation-models';
import type { ContinuitySimulationResult } from '@/lib/knowledge-transfer/simulation/simulation-models';
import { CognitionGraphViz } from './cognition-graph/cognition-graph-viz';
import { PropagationPlayback, type PropagationPlaybackData } from './propagation-playback/propagation-playback';
import { GovernanceImpactExplorer, type GovernanceImpactData } from './governance-impact/governance-impact-explorer';
import {
  SIMULATION_PRESETS,
  mitigationScenarios,
  toCognitionGraph,
  toGovernanceImpact,
  toMitigationView,
  toPlayback,
  type MitigationView,
  type SimulationPreset,
} from './workspace-data';

type WorkspaceTab = 'graph' | 'playback' | 'governance' | 'comparison';
type OverlayMode = 'risk' | 'governance' | 'propagation' | 'none';

/** The framework's success answer: what the service returned is under `data`. */
interface Answer<T> {
  data?: T;
}

/** The reason a failed answer gives (`{ code, message }`), or the fallback when it gives none. */
async function failureMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === 'string' && body.message ? body.message : fallback;
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

function EmptyState({ message }: { message: string }) {
  return <div className="text-sm text-slate-400 text-center py-12">{message}</div>;
}

export function ContinuitySimulationWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('graph');
  const [overlay, setOverlay] = useState<OverlayMode>('risk');

  const [propagationMap, setPropagationMap] = useState<(PropagationMap & { message?: string }) | null>(null);
  const [propagationLoading, setPropagationLoading] = useState(true);
  const [propagationError, setPropagationError] = useState<string | null>(null);
  const graph = useMemo(() => (propagationMap ? toCognitionGraph(propagationMap) : null), [propagationMap]);

  const [governanceData, setGovernanceData] = useState<GovernanceImpactData | null>(null);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);

  const [playbackData, setPlaybackData] = useState<PropagationPlaybackData | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<SimulationPreset | null>(null);

  const [mitigationData, setMitigationData] = useState<MitigationView | null>(null);
  const [mitigationLoading, setMitigationLoading] = useState(false);
  const [mitigationNote, setMitigationNote] = useState<string | null>(null);

  // Fetch the dependency map the graph, the simulations and the governance view are all drawn from
  const fetchPropagation = async () => {
    try {
      setPropagationLoading(true);
      setPropagationError(null);
      const res = await fetch('/api/exit-interviews/propagation');
      if (!res.ok) throw new Error(await failureMessage(res, 'Failed to load propagation data'));
      const json = (await res.json()) as Answer<PropagationMap & { message?: string }>;
      if (!json.data) throw new Error('Failed to load propagation data');
      setPropagationMap(json.data);
    } catch {
      setPropagationError('Unable to load organizational dependency graph.');
    } finally {
      setPropagationLoading(false);
    }
  };

  const fetchGovernance = useCallback(async () => {
    if (governanceData || !propagationMap) return;
    try {
      setGovernanceLoading(true);
      setGovernanceError(null);
      const res = await fetch('/api/exit-interviews/cascade-analysis');
      if (!res.ok) throw new Error(await failureMessage(res, 'Failed to load governance data'));
      const json = (await res.json()) as Answer<GovernanceCascadeAnalysis>;
      if (!json.data) throw new Error('Failed to load governance data');
      setGovernanceData(toGovernanceImpact(json.data, propagationMap));
    } catch (error) {
      setGovernanceError(error instanceof Error ? error.message : 'Failed to load governance data');
    } finally {
      setGovernanceLoading(false);
    }
  }, [governanceData, propagationMap]);

  const fetchSimulation = async (preset: SimulationPreset) => {
    if (!graph) return;
    try {
      setPlaybackLoading(true);
      setPlaybackError(null);
      const res = await fetch('/api/exit-interviews/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulationType: preset.simulationType, affectedNodeIds: preset.affected(graph) }),
      });
      if (!res.ok) throw new Error(await failureMessage(res, 'Failed to run simulation'));
      const json = (await res.json()) as Answer<ContinuitySimulationResult>;
      if (!json.data) throw new Error('Failed to run simulation');
      setPlaybackData(toPlayback(json.data, preset.label));
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Failed to run simulation');
    } finally {
      setPlaybackLoading(false);
    }
  };

  const fetchMitigationComparison = useCallback(async () => {
    if (mitigationData || !graph) return;
    const scenarios: MitigationScenario[] = mitigationScenarios(graph);
    if (scenarios.length === 0) {
      setMitigationNote('No single-source or governance knowledge is recorded, so there is nothing to aim a mitigation at.');
      return;
    }
    try {
      setMitigationLoading(true);
      setMitigationNote(null);
      const res = await fetch('/api/exit-interviews/mitigation-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarios }),
      });
      if (!res.ok) throw new Error(await failureMessage(res, 'Failed to load mitigation comparison'));
      const json = (await res.json()) as Answer<MitigationComparison>;
      if (!json.data) throw new Error('Failed to load mitigation comparison');
      setMitigationData(toMitigationView(json.data, scenarios));
    } catch (error) {
      setMitigationNote(error instanceof Error ? error.message : 'Failed to load mitigation comparison');
    } finally {
      setMitigationLoading(false);
    }
  }, [mitigationData, graph]);

  useEffect(() => {
    fetchPropagation();
  }, []);

  useEffect(() => {
    if (activeTab === 'governance') {
      void fetchGovernance();
    }
    if (activeTab === 'comparison') {
      void fetchMitigationComparison();
    }
  }, [activeTab, fetchGovernance, fetchMitigationComparison]);

  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'graph', label: 'Dependency Graph' },
    { id: 'playback', label: 'Propagation Playback' },
    { id: 'governance', label: 'Governance Impact' },
    { id: 'comparison', label: 'Mitigation Comparison' },
  ];

  const unavailablePresets = graph ? SIMULATION_PRESETS.filter((preset) => preset.affected(graph).length === 0) : [];

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
          ) : graph && graph.nodes.length === 0 ? (
            <EmptyState message={propagationMap?.message ?? 'No published interviews to analyze yet.'} />
          ) : graph ? (
            <CognitionGraphViz graph={graph} overlay={overlay} />
          ) : null}
        </div>
      )}

      {/* Playback Tab */}
      {activeTab === 'playback' && (
        <div className="space-y-4">
          {propagationLoading ? (
            <LoadingState message="Loading organizational dependency graph..." />
          ) : propagationError || !graph ? (
            <ErrorState message={propagationError ?? 'The dependency graph is not available.'} onRetry={fetchPropagation} />
          ) : (
            <>
              <div>
                <div className="text-xs font-medium text-slate-700 mb-2">Select a scenario to simulate</div>
                <div className="flex flex-wrap gap-2">
                  {SIMULATION_PRESETS.map((s) => (
                    <button
                      key={s.id}
                      disabled={s.affected(graph).length === 0}
                      onClick={() => {
                        setSelectedPreset(s);
                        setPlaybackData(null);
                        void fetchSimulation(s);
                      }}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedPreset?.id === s.id
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {unavailablePresets.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                    {unavailablePresets.map((s) => (
                      <li key={s.id}>
                        {s.label} is not available: {s.noneReason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {!selectedPreset && (
                <EmptyState message="Select a scenario above to begin propagation playback simulation." />
              )}

              {selectedPreset && playbackLoading && (
                <LoadingState message={`Running ${selectedPreset.label} simulation...`} />
              )}

              {selectedPreset && !playbackLoading && playbackData && (
                <div className="border border-slate-200 rounded-lg p-5">
                  <PropagationPlayback playback={playbackData} />
                </div>
              )}

              {selectedPreset && !playbackLoading && !playbackData && (
                <EmptyState message={playbackError ?? 'Simulation could not be completed.'} />
              )}
            </>
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
            <EmptyState message={governanceError ?? 'No governance impact data available. Ensure exit interviews have been published.'} />
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
              {mitigationData.noNodesEvaluated ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">{mitigationData.rationale}</div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 space-y-1">
                  {mitigationData.recommended && (
                    <div>
                      Highest projected gain: <span className="font-medium">{mitigationData.recommended}</span>
                    </div>
                  )}
                  <div className="text-xs">{mitigationData.rationale}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mitigationData.scenarios.map((s) => (
                  <div key={s.scenarioId} className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
                    <div className="font-medium text-slate-800 text-sm">{s.label}</div>
                    {s.durationWeeks !== null && s.investmentLevel !== null && (
                      <div className="text-xs text-slate-500">{s.durationWeeks} weeks · {s.investmentLevel} investment</div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-semibold text-indigo-600">+{s.resilienceGain}</span>
                      <span className="text-xs text-slate-500">resilience points (assumed)</span>
                    </div>
                    <div className="text-xs text-slate-600">Exposure reduced by {Math.round(s.exposureReductionPct)}%</div>
                    {s.domainDeltas.slice(0, 3).map((d) => (
                      <div key={d.domain} className="text-xs text-slate-600">
                        {d.domain}: exposure {Math.round(d.baselineExposure)} → <span className="text-emerald-600">{Math.round(d.mitigatedExposure)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {mitigationData.residualRisks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-1">Still unaddressed</h4>
                  <ul className="space-y-0.5 text-xs text-slate-600">
                    {mitigationData.residualRisks.map((risk) => (
                      <li key={risk}>• {risk}</li>
                    ))}
                  </ul>
                </div>
              )}
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer font-medium text-slate-600">How these figures are produced</summary>
                <ul className="mt-1 space-y-0.5">
                  {mitigationData.assumptions.map((assumption) => (
                    <li key={assumption}>• {assumption}</li>
                  ))}
                </ul>
                <p className="mt-1">
                  {mitigationData.verifiedEvidenceCoverage.verifiedEdgeCount} of {mitigationData.verifiedEvidenceCoverage.exploratoryEdgeCount} inferred dependencies are currently verified in their stated direction; every other dependency, and every node-level figure, is exploratory signal only.
                </p>
              </details>
            </div>
          ) : (
            <EmptyState message={mitigationNote ?? 'Mitigation comparison data unavailable. Ensure exit interviews have been published.'} />
          )}
        </div>
      )}
    </div>
  );
}
