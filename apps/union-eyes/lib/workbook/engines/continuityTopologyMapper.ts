/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Continuity Landscape
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity Topology Mapper — turns the workbook's continuity carriers,
 * governance shape, and operational surface into a normalized topology of
 * axes that the Continuity Landscape Engine plots against.
 *
 * Pure, deterministic. No I/O. Operates on aggregates and counts only —
 * never on carrier names or free-text notes.
 */

import type { CartographyHolderInput } from './stewardshipCartography';

export type TopologyAxisId =
  | 'stewardship_density'
  | 'successor_readiness'
  | 'governance_coherence'
  | 'operational_surface'
  | 'dependency_concentration';

export type TopologyPosture =
  | 'distributed'
  | 'observed'
  | 'concentrated'
  | 'fragile'
  | 'critical';

export interface TopologyAxis {
  readonly axisId: TopologyAxisId;
  readonly label: string;
  /** 0.0 – 1.0. Higher = more concentrated / more fragile. */
  readonly value: number;
  readonly posture: TopologyPosture;
  /** Plain-language one-sentence reading of this axis. */
  readonly reading: string;
}

export interface GovernanceShape {
  /** Number of named governance bodies (board, committees, councils). */
  readonly governanceBodyCount: number;
  /** Number of governance roles with no identified backup. */
  readonly unbackedGovernanceRoleCount: number;
  /** Scalar 0–1 of design ↔ practice drift, if known. */
  readonly designPracticeDrift?: number;
}

export interface OperationalSurface {
  /** Number of operational processes named in the workbook. */
  readonly processCount: number;
  /** Number of processes that depend on a single named carrier. */
  readonly singleCarrierProcessCount: number;
  /** Number of processes with no formal documentation. */
  readonly undocumentedProcessCount: number;
}

export interface TopologyMappingInput {
  readonly holders: readonly CartographyHolderInput[];
  readonly governance?: GovernanceShape;
  readonly operationalSurface?: OperationalSurface;
}

const AXIS_LABEL: Record<TopologyAxisId, string> = {
  stewardship_density: 'Stewardship density',
  successor_readiness: 'Successor readiness',
  governance_coherence: 'Governance coherence',
  operational_surface: 'Operational surface',
  dependency_concentration: 'Dependency concentration',
};

export function classifyPosture(value: number): TopologyPosture {
  if (value >= 0.7) return 'critical';
  if (value >= 0.5) return 'fragile';
  if (value >= 0.3) return 'concentrated';
  if (value >= 0.15) return 'observed';
  return 'distributed';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}

export function mapContinuityTopology(
  input: TopologyMappingInput,
  density: { readonly index: number; readonly unsuccessedInstitutionCriticalCount: number; readonly unsuccessedLoadBearingCount: number; readonly totalCarriers: number },
): readonly TopologyAxis[] {
  const stewardshipValue = density.index;
  const successorExposed =
    density.unsuccessedInstitutionCriticalCount + density.unsuccessedLoadBearingCount;
  const successorValue = safeRatio(successorExposed, Math.max(1, density.totalCarriers));

  const governance = input.governance;
  const governanceValue = governance
    ? Math.max(
        governance.designPracticeDrift ?? 0,
        safeRatio(
          governance.unbackedGovernanceRoleCount,
          Math.max(1, governance.governanceBodyCount),
        ),
      )
    : 0;

  const surface = input.operationalSurface;
  const surfaceValue = surface
    ? safeRatio(
        surface.undocumentedProcessCount + surface.singleCarrierProcessCount,
        Math.max(1, surface.processCount * 2),
      )
    : 0;

  const dependencyValue = surface
    ? safeRatio(surface.singleCarrierProcessCount, Math.max(1, surface.processCount))
    : safeRatio(density.unsuccessedInstitutionCriticalCount, Math.max(1, density.totalCarriers));

  const axes: TopologyAxis[] = [
    axis('stewardship_density', stewardshipValue, stewardshipReading(stewardshipValue)),
    axis('successor_readiness', successorValue, successorReading(successorValue)),
    axis('governance_coherence', governanceValue, governanceReading(governanceValue, !!governance)),
    axis('operational_surface', surfaceValue, surfaceReading(surfaceValue, !!surface)),
    axis('dependency_concentration', dependencyValue, dependencyReading(dependencyValue)),
  ];

  return axes;
}

function axis(id: TopologyAxisId, raw: number, reading: string): TopologyAxis {
  const value = round2(Math.max(0, Math.min(1, raw)));
  return {
    axisId: id,
    label: AXIS_LABEL[id],
    value,
    posture: classifyPosture(value),
    reading,
  };
}

function stewardshipReading(value: number): string {
  if (value >= 0.7) return 'A small number of carriers hold a disproportionate share of institutional weight.';
  if (value >= 0.5) return 'Stewardship is narrow relative to the institutional weight being carried.';
  if (value >= 0.3) return 'Stewardship is recognisable but uneven across carriers.';
  if (value >= 0.15) return 'Stewardship is broadly distributed with localised concentration.';
  return 'Stewardship is broadly distributed across the named carriers.';
}

function successorReading(value: number): string {
  if (value >= 0.7) return 'Most load-bearing carriers have no identified successor.';
  if (value >= 0.5) return 'A majority of load-bearing carriers have no identified successor.';
  if (value >= 0.3) return 'A meaningful share of load-bearing carriers have no identified successor.';
  if (value >= 0.15) return 'Some load-bearing carriers have no identified successor.';
  return 'Successor identification is in good standing across load-bearing carriers.';
}

function governanceReading(value: number, present: boolean): string {
  if (!present) return 'Governance shape has not yet been named in the workbook.';
  if (value >= 0.6) return 'Governance practice diverges materially from governance design.';
  if (value >= 0.3) return 'Governance practice shows recognisable drift from governance design.';
  return 'Governance practice tracks governance design closely.';
}

function surfaceReading(value: number, present: boolean): string {
  if (!present) return 'Operational surface has not yet been named in the workbook.';
  if (value >= 0.6) return 'Operational processes carry significant undocumented or single-carrier exposure.';
  if (value >= 0.3) return 'A recognisable share of operational processes are undocumented or single-carrier.';
  return 'Operational surface is largely documented and multi-carrier.';
}

function dependencyReading(value: number): string {
  if (value >= 0.6) return 'A significant share of institutional load depends on a single carrier.';
  if (value >= 0.3) return 'Recognisable single-carrier dependencies are present.';
  return 'Single-carrier dependencies are limited.';
}
