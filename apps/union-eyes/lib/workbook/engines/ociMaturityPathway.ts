/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Transformation Roadmap
 * DOCTRINE_VERSION: 2.0.0
 *
 * OCI Maturity Pathway — places the institution on the OCI Method™
 * methodology spine and projects the structural continuity pathway from
 * the current phase forward.
 *
 * Pure, deterministic.
 */

import { OCI_METHOD, type OciMethodPhaseId } from '../../oci/frameworks';

export type OciMaturityStage =
  | 'recognition_only'
  | 'mapping_underway'
  | 'stabilization_underway'
  | 'infrastructure_underway'
  | 'intelligence_underway';

export interface OciMaturityInput {
  /** Composite Stewardship Density Index (0–1). */
  readonly densityIndex: number;
  /** True if the workbook has named carriers, precedents, and processes. */
  readonly workbookCompleted: boolean;
  /** True if stabilization moves have been ratified by governance. */
  readonly stabilizationRatified: boolean;
  /** True if continuity practice is embedded in operating rhythm. */
  readonly continuityEmbedded: boolean;
  /** True if longitudinal sector intelligence is being consumed. */
  readonly longitudinalIntelligenceConsumed: boolean;
}

export interface OciMaturityPathwayResult {
  readonly currentStage: OciMaturityStage;
  readonly currentPhase: OciMethodPhaseId;
  readonly nextPhase: OciMethodPhaseId | null;
  readonly pathway: ReadonlyArray<{
    readonly phaseId: OciMethodPhaseId;
    readonly ordinal: number;
    readonly name: string;
    readonly status: 'underway' | 'next' | 'reached' | 'upcoming';
  }>;
  readonly reading: string;
}

const STAGE_TO_PHASE: Record<OciMaturityStage, OciMethodPhaseId> = {
  recognition_only: 'recognition',
  mapping_underway: 'mapping',
  stabilization_underway: 'stabilization',
  infrastructure_underway: 'infrastructure',
  intelligence_underway: 'intelligence',
};

export function locateOciMaturity(input: OciMaturityInput): OciMaturityPathwayResult {
  const stage = classifyStage(input);
  const currentPhase = STAGE_TO_PHASE[stage];
  const phases = OCI_METHOD.phases;
  const currentIndex = phases.findIndex((p) => p.id === currentPhase);
  const nextPhase: OciMethodPhaseId | null =
    currentIndex >= 0 && currentIndex < phases.length - 1
      ? phases[currentIndex + 1].id
      : null;

  const pathway = phases.map((phase, idx) => ({
    phaseId: phase.id,
    ordinal: phase.ordinal,
    name: phase.name,
    status:
      idx < currentIndex
        ? ('reached' as const)
        : idx === currentIndex
          ? ('underway' as const)
          : idx === currentIndex + 1
            ? ('next' as const)
            : ('upcoming' as const),
  }));

  return {
    currentStage: stage,
    currentPhase,
    nextPhase,
    pathway,
    reading: buildReading(stage, currentPhase, nextPhase),
  };
}

function classifyStage(input: OciMaturityInput): OciMaturityStage {
  if (input.longitudinalIntelligenceConsumed) return 'intelligence_underway';
  if (input.continuityEmbedded) return 'infrastructure_underway';
  if (input.stabilizationRatified) return 'stabilization_underway';
  if (input.workbookCompleted) return 'mapping_underway';
  return 'recognition_only';
}

function buildReading(
  stage: OciMaturityStage,
  current: OciMethodPhaseId,
  next: OciMethodPhaseId | null,
): string {
  const currentName = OCI_METHOD.phases.find((p) => p.id === current)?.name ?? current;
  const nextName = next ? OCI_METHOD.phases.find((p) => p.id === next)?.name ?? next : null;
  switch (stage) {
    case 'recognition_only':
      return `Institution is in the Recognition phase. ${nextName ? `Mapping is the next phase, beginning with the Memory Holders module.` : ''}`;
    case 'mapping_underway':
      return `Institution is in the Mapping phase. ${nextName ? `Stabilization is the next phase once mapping is complete.` : ''}`;
    case 'stabilization_underway':
      return `Institution is in the Stabilization phase. ${nextName ? `Infrastructure is the next phase once stabilization is ratified.` : ''}`;
    case 'infrastructure_underway':
      return `Institution is in the Infrastructure phase. ${nextName ? `Intelligence is the next phase once continuity practice is embedded in operating rhythm.` : ''}`;
    case 'intelligence_underway':
      return `Institution is in the Intelligence phase. The pathway continues through longitudinal sector intelligence.`;
  }
  return `Institution is in the ${currentName} phase.`;
}
