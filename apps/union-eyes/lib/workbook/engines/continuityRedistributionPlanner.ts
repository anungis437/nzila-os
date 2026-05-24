/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Transformation Roadmap
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity Redistribution Planner — composes a stewardship
 * redistribution plan: which carriers should be backed up first, which
 * processes should be broadened first, and which lineage should be
 * captured first.
 *
 * Pure, deterministic.
 */

export type RedistributionTargetKind =
  | 'carrier_backup'
  | 'process_broadening'
  | 'lineage_capture';

export interface RedistributionTarget {
  readonly id: string;
  readonly kind: RedistributionTargetKind;
  readonly subjectLabel: string;
  readonly priority: 1 | 2 | 3;
  readonly rationale: string;
}

export interface CarrierExposure {
  readonly id: string;
  readonly label: string;
  /** 0–1 exposure score; higher = more exposed. */
  readonly exposure: number;
}

export interface ProcessConcentration {
  readonly id: string;
  readonly label: string;
  readonly singleCarrier: boolean;
  readonly undocumented: boolean;
}

export interface LineageGap {
  readonly id: string;
  readonly subject: string;
  /** 'fading' | 'lapsed' from precedentContinuityMapper. */
  readonly continuity: 'fading' | 'lapsed';
}

export interface RedistributionPlanInput {
  readonly carriers: readonly CarrierExposure[];
  readonly processes: readonly ProcessConcentration[];
  readonly lineageGaps: readonly LineageGap[];
}

export interface StewardshipRedistributionPlan {
  readonly targets: readonly RedistributionTarget[];
  readonly carrierBackupCount: number;
  readonly processBroadeningCount: number;
  readonly lineageCaptureCount: number;
}

export function planContinuityRedistribution(
  input: RedistributionPlanInput,
): StewardshipRedistributionPlan {
  const carrierTargets: RedistributionTarget[] = [...input.carriers]
    .sort((a, b) => b.exposure - a.exposure)
    .map((c, idx) => ({
      id: `carrier_backup_${c.id}`,
      kind: 'carrier_backup' as const,
      subjectLabel: c.label,
      priority: (idx === 0 ? 1 : idx <= 2 ? 2 : 3) as 1 | 2 | 3,
      rationale: `Carrier exposure score ${c.exposure}; identify a successor and begin shadowing.`,
    }));

  const processTargets: RedistributionTarget[] = input.processes
    .filter((p) => p.singleCarrier || p.undocumented)
    .map((p, idx) => ({
      id: `process_broadening_${p.id}`,
      kind: 'process_broadening' as const,
      subjectLabel: p.label,
      priority: (p.singleCarrier && p.undocumented ? 1 : idx <= 2 ? 2 : 3) as 1 | 2 | 3,
      rationale: buildProcessRationale(p),
    }));

  const lineageTargets: RedistributionTarget[] = input.lineageGaps.map((l, idx) => ({
    id: `lineage_capture_${l.id}`,
    kind: 'lineage_capture' as const,
    subjectLabel: l.subject,
    priority: (l.continuity === 'lapsed' ? 1 : idx <= 2 ? 2 : 3) as 1 | 2 | 3,
    rationale:
      l.continuity === 'lapsed'
        ? 'Precedent is no longer carried in practice; reconstruct interpretation while organizational memory remains accessible.'
        : 'Precedent is fading; brief successor stewards before it is lost.',
  }));

  const targets: RedistributionTarget[] = [
    ...carrierTargets,
    ...processTargets,
    ...lineageTargets,
  ].sort((a, b) => a.priority - b.priority);

  return {
    targets,
    carrierBackupCount: carrierTargets.length,
    processBroadeningCount: processTargets.length,
    lineageCaptureCount: lineageTargets.length,
  };
}

function buildProcessRationale(p: ProcessConcentration): string {
  if (p.singleCarrier && p.undocumented) {
    return 'Process is single-carrier and undocumented; broaden practice and record lineage together.';
  }
  if (p.singleCarrier) {
    return 'Process depends on a single carrier; broaden practice to a second carrier.';
  }
  return 'Process is undocumented; capture written practice while incumbent carriers remain available.';
}
