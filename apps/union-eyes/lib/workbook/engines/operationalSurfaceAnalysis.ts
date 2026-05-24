/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Continuity Landscape
 * DOCTRINE_VERSION: 2.0.0
 *
 * Operational Surface Analysis — derives operational zones from the
 * workbook's process inventory. Zones are calm, editorial observations
 * about where organizational load concentrates, never alarmist findings.
 *
 * Pure, deterministic.
 */

import type { OperationalSurface } from './continuityTopologyMapper';

export type OperationalZoneId =
  | 'documented_resilient'
  | 'documented_concentrated'
  | 'undocumented_distributed'
  | 'undocumented_concentrated';

export interface OperationalSurfaceZone {
  readonly zoneId: OperationalZoneId;
  readonly label: string;
  readonly processCount: number;
  readonly share: number;
  readonly posture: string;
}

const ZONE_LABEL: Record<OperationalZoneId, string> = {
  documented_resilient: 'Documented and multi-carrier',
  documented_concentrated: 'Documented but single-carrier',
  undocumented_distributed: 'Undocumented but multi-carrier',
  undocumented_concentrated: 'Undocumented and single-carrier',
};

const ZONE_POSTURE: Record<OperationalZoneId, string> = {
  documented_resilient:
    'Operational coherence is durable here. Periodic review is sufficient.',
  documented_concentrated:
    'Documentation exists, but day-to-day execution depends on a single carrier. Broadening practice is appropriate.',
  undocumented_distributed:
    'Practice is held by multiple carriers but is not written down. Lineage capture is the next step.',
  undocumented_concentrated:
    'Practice is undocumented and single-carrier. This is the configuration in which operational coherence is most likely to fail quietly.',
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function analyzeOperationalSurface(
  surface: OperationalSurface | undefined,
): readonly OperationalSurfaceZone[] {
  if (!surface || surface.processCount <= 0) return [];

  const total = surface.processCount;
  const single = Math.min(surface.singleCarrierProcessCount, total);
  const undocumented = Math.min(surface.undocumentedProcessCount, total);

  // Estimate quadrant overlap using inclusion-exclusion against the totals.
  // We don't have per-process flags, so we apportion conservatively:
  //   undocumented_concentrated ≈ min(single, undocumented)
  //   documented_concentrated   = single - undoc_concentrated
  //   undocumented_distributed  = undocumented - undoc_concentrated
  //   documented_resilient      = remainder
  const undocConcentrated = Math.min(single, undocumented);
  const docConcentrated = Math.max(0, single - undocConcentrated);
  const undocDistributed = Math.max(0, undocumented - undocConcentrated);
  const docResilient = Math.max(
    0,
    total - undocConcentrated - docConcentrated - undocDistributed,
  );

  const zones: OperationalSurfaceZone[] = [
    zone('undocumented_concentrated', undocConcentrated, total),
    zone('documented_concentrated', docConcentrated, total),
    zone('undocumented_distributed', undocDistributed, total),
    zone('documented_resilient', docResilient, total),
  ];

  // Emit only zones with population; preserve severity ordering above.
  return zones.filter((z) => z.processCount > 0);
}

function zone(id: OperationalZoneId, count: number, total: number): OperationalSurfaceZone {
  return {
    zoneId: id,
    label: ZONE_LABEL[id],
    processCount: count,
    share: round2(count / Math.max(1, total)),
    posture: ZONE_POSTURE[id],
  };
}
