/**
 * ARTIFACT TYPE: Engine
 * MODULE: Continuity Landscape
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity Mapping Engine — produces the organizational continuity
 * landscape as a single normalized topology: stewardship density,
 * successor readiness, governance coherence, operational surface, and
 * dependency concentration. Combines five-axis topology, operational
 * surface zoning, and an optional dependency graph view.
 *
 * Pure, deterministic. No I/O. Operates on aggregates and counts only.
 *
 * Anti-surveillance: this engine accepts only structural inputs —
 * counts, criticality bands, tenure bands, abstract node ids. Carrier
 * names, free-text notes, and any PII are never accepted as input and
 * never appear in the output.
 */

import { runStewardshipCartography, type CartographyHolderInput } from './stewardshipCartography';
import {
  mapContinuityTopology,
  type GovernanceShape,
  type OperationalSurface,
  type TopologyAxis,
  type TopologyAxisId,
  type TopologyPosture,
} from './continuityTopologyMapper';
import {
  analyzeOperationalSurface,
  type OperationalSurfaceZone,
} from './operationalSurfaceAnalysis';
import {
  buildDependencyGraph,
  type DependencyGraphInput,
  type DependencyGraphResult,
} from './continuityDependencyGraph';

export interface ContinuityLandscapeInput {
  readonly workbookId: string;
  readonly holders: readonly CartographyHolderInput[];
  readonly governance?: GovernanceShape;
  readonly operationalSurface?: OperationalSurface;
  readonly dependencyGraph?: DependencyGraphInput;
}

export type TopologySignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export type TopologySignalCategory =
  | 'multi_axis_fragility'
  | 'single_carrier_dependency_concentration'
  | 'governance_practice_drift'
  | 'undocumented_operational_surface'
  | 'distributed_landscape_healthy'
  | 'graph_articulation_concentration';

export interface TopologySignal {
  readonly signalId: string;
  readonly severity: TopologySignalSeverity;
  readonly category: TopologySignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface ContinuityLandscapeResult {
  readonly status: 'facilitated' | 'self-guided';
  readonly topology: readonly TopologyAxis[];
  readonly surfaceZones: readonly OperationalSurfaceZone[];
  readonly dependencyGraph: DependencyGraphResult | null;
  readonly signals: readonly TopologySignal[];
  readonly preview: string;
  readonly overallPosture: TopologyPosture;
}

export const ENGINE_VERSION = '2.0.0';

export function runContinuityMapping(
  input: ContinuityLandscapeInput,
): ContinuityLandscapeResult {
  const cartography = runStewardshipCartography(input.holders);
  const topology = mapContinuityTopology(
    {
      holders: input.holders,
      governance: input.governance,
      operationalSurface: input.operationalSurface,
    },
    {
      index: cartography.density.index,
      unsuccessedInstitutionCriticalCount:
        cartography.density.unsuccessedInstitutionCriticalCount,
      unsuccessedLoadBearingCount: cartography.density.unsuccessedLoadBearingCount,
      totalCarriers: cartography.density.totalCarriers,
    },
  );

  const surfaceZones = analyzeOperationalSurface(input.operationalSurface);
  const dependencyGraph = input.dependencyGraph
    ? buildDependencyGraph(input.dependencyGraph)
    : null;

  const signals = synthesizeSignals(topology, surfaceZones, dependencyGraph);

  const overallPosture = aggregatePosture(topology);
  const status: ContinuityLandscapeResult['status'] =
    input.holders.length === 0 ? 'self-guided' : 'facilitated';

  return {
    status,
    topology,
    surfaceZones,
    dependencyGraph,
    signals,
    preview: buildPreview(topology, overallPosture, input.holders.length),
    overallPosture,
  };
}

function aggregatePosture(topology: readonly TopologyAxis[]): TopologyPosture {
  if (topology.length === 0) return 'distributed';
  const order: readonly TopologyPosture[] = [
    'distributed',
    'observed',
    'concentrated',
    'fragile',
    'critical',
  ];
  let worst: TopologyPosture = 'distributed';
  for (const axis of topology) {
    if (order.indexOf(axis.posture) > order.indexOf(worst)) worst = axis.posture;
  }
  return worst;
}

function synthesizeSignals(
  topology: readonly TopologyAxis[],
  zones: readonly OperationalSurfaceZone[],
  graph: DependencyGraphResult | null,
): readonly TopologySignal[] {
  const signals: TopologySignal[] = [];

  const fragileAxes = topology.filter(
    (a) => a.posture === 'fragile' || a.posture === 'critical',
  );
  if (fragileAxes.length >= 2) {
    signals.push({
      signalId: 'multi_axis_fragility',
      severity: fragileAxes.length >= 3 ? 'critical' : 'warning',
      category: 'multi_axis_fragility',
      statement: `${fragileAxes.length} continuity axes show fragile or critical posture. Multi-axis fragility typically compounds during transitions.`,
      evidence: {
        axes: fragileAxes.map((a) => ({ axisId: a.axisId, value: a.value, posture: a.posture })),
      },
    });
  }

  const dependencyAxis = topology.find((a) => a.axisId === 'dependency_concentration');
  if (dependencyAxis && dependencyAxis.value >= 0.5) {
    signals.push({
      signalId: 'single_carrier_dependency_concentration',
      severity: dependencyAxis.value >= 0.7 ? 'critical' : 'warning',
      category: 'single_carrier_dependency_concentration',
      statement:
        'A significant share of organizational dependencies concentrate on a small number of carriers.',
      evidence: { axisId: dependencyAxis.axisId, value: dependencyAxis.value },
    });
  }

  const governanceAxis = topology.find((a) => a.axisId === 'governance_coherence');
  if (governanceAxis && governanceAxis.value >= 0.5) {
    signals.push({
      signalId: 'governance_practice_drift',
      severity: governanceAxis.value >= 0.7 ? 'warning' : 'observation',
      category: 'governance_practice_drift',
      statement:
        'Governance practice diverges measurably from governance design across the named bodies.',
      evidence: { axisId: governanceAxis.axisId, value: governanceAxis.value },
    });
  }

  const undocumented = zones.find((z) => z.zoneId === 'undocumented_concentrated');
  if (undocumented && undocumented.processCount > 0) {
    signals.push({
      signalId: 'undocumented_operational_surface',
      severity: undocumented.share >= 0.25 ? 'warning' : 'observation',
      category: 'undocumented_operational_surface',
      statement: `${undocumented.processCount} operational process${undocumented.processCount === 1 ? ' is' : 'es are'} undocumented and single-carrier.`,
      evidence: { processCount: undocumented.processCount, share: undocumented.share },
    });
  }

  if (graph && graph.metrics.criticalArticulationCount >= 1) {
    signals.push({
      signalId: 'graph_articulation_concentration',
      severity: graph.metrics.criticalArticulationCount >= 3 ? 'warning' : 'observation',
      category: 'graph_articulation_concentration',
      statement: `${graph.metrics.criticalArticulationCount} node${graph.metrics.criticalArticulationCount === 1 ? '' : 's'} would sever a load-bearing dependency if removed.`,
      evidence: { count: graph.metrics.criticalArticulationCount },
    });
  }

  const distributedCount = topology.filter((a) => a.posture === 'distributed').length;
  if (distributedCount >= 4 && fragileAxes.length === 0) {
    signals.push({
      signalId: 'distributed_landscape_healthy',
      severity: 'note',
      category: 'distributed_landscape_healthy',
      statement:
        'The continuity landscape appears broadly distributed across the named axes. Periodic review remains appropriate.',
      evidence: { distributedAxes: distributedCount },
    });
  }

  return signals;
}

function buildPreview(
  topology: readonly TopologyAxis[],
  posture: TopologyPosture,
  holderCount: number,
): string {
  if (holderCount === 0) {
    return 'No continuity carriers have been named yet — the continuity landscape will populate as the Memory Holders module is completed.';
  }
  const worst = [...topology].sort((a, b) => b.value - a.value)[0];
  switch (posture) {
    case 'critical':
      return `The continuity landscape shows critical posture, most acutely on ${describeAxis(worst.axisId)}.`;
    case 'fragile':
      return `The continuity landscape shows fragile posture, most acutely on ${describeAxis(worst.axisId)}.`;
    case 'concentrated':
      return `The continuity landscape shows concentrated posture, most visibly on ${describeAxis(worst.axisId)}.`;
    case 'observed':
      return `The continuity landscape is observed but uneven, most visibly on ${describeAxis(worst.axisId)}.`;
    default:
      return 'The continuity landscape appears broadly distributed across the named axes.';
  }
}

function describeAxis(id: TopologyAxisId): string {
  switch (id) {
    case 'stewardship_density':
      return 'stewardship density';
    case 'successor_readiness':
      return 'successor readiness';
    case 'governance_coherence':
      return 'governance coherence';
    case 'operational_surface':
      return 'operational surface';
    case 'dependency_concentration':
      return 'dependency concentration';
  }
}
