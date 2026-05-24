/**
 * ARTIFACT TYPE: Engine
 * MODULE: Memory Holders
 * DOCTRINE_VERSION: 1.0.0
 *
 * Stewardship Cartography \u2014 the engine that turns named continuity carriers
 * into a stewardship map and a set of continuity signals.
 *
 * Pure, deterministic. Consumes memory-holder rows; produces:
 *   - Stewardship Density Index\u2122 result
 *   - signals for the workbook_stewardship_signals table
 *   - role-band stewardship distribution
 *
 * Anti-surveillance: this engine never inspects holder names or notes. It
 * operates only on criticality, tenure band, and successor identification.
 */

import {
  computeStewardshipDensity,
  type Criticality,
  type HolderForIndex,
  type StewardshipDensityResult,
  type TenureBand,
} from '../../oci/frameworks/stewardship-density-index';

export interface CartographyHolderInput {
  id: string;
  role: string;
  criticality: Criticality | null;
  tenureBand: TenureBand | null;
  successorIdentified: boolean;
}

export interface CartographySignal {
  signalId: string;
  severity: 'note' | 'observation' | 'warning' | 'critical';
  category:
    | 'unsuccessed_institution_critical'
    | 'unsuccessed_load_bearing'
    | 'long_tenure_concentration'
    | 'narrow_carrier_base'
    | 'distributed_stewardship';
  statement: string;
  evidence: Record<string, unknown>;
}

export interface CartographyResult {
  density: StewardshipDensityResult;
  signals: CartographySignal[];
  /** Plain-language one-sentence preview consumable by the UI density preview. */
  preview: string;
}

export const ENGINE_VERSION = '1.0.0';

export function runStewardshipCartography(
  holders: readonly CartographyHolderInput[],
): CartographyResult {
  const density = computeStewardshipDensity(
    holders.map<HolderForIndex>((h) => ({
      criticality: h.criticality,
      tenureBand: h.tenureBand,
      successorIdentified: h.successorIdentified,
    })),
  );

  const signals: CartographySignal[] = [];

  if (density.unsuccessedInstitutionCriticalCount > 0) {
    signals.push({
      signalId: 'unsuccessed_institution_critical',
      severity: 'critical',
      category: 'unsuccessed_institution_critical',
      statement: `${density.unsuccessedInstitutionCriticalCount} institution-critical responsibility ${density.unsuccessedInstitutionCriticalCount === 1 ? 'is held' : 'are held'} by a carrier without an identified successor.`,
      evidence: { count: density.unsuccessedInstitutionCriticalCount },
    });
  }

  if (density.unsuccessedLoadBearingCount > 0) {
    signals.push({
      signalId: 'unsuccessed_load_bearing',
      severity: density.unsuccessedLoadBearingCount >= 2 ? 'warning' : 'observation',
      category: 'unsuccessed_load_bearing',
      statement: `${density.unsuccessedLoadBearingCount} load-bearing carrier${density.unsuccessedLoadBearingCount === 1 ? '' : 's'} ${density.unsuccessedLoadBearingCount === 1 ? 'has' : 'have'} no identified successor.`,
      evidence: { count: density.unsuccessedLoadBearingCount },
    });
  }

  const longTenureExposed = holders.filter(
    (h) => h.tenureBand === '15y_plus' && !h.successorIdentified,
  ).length;
  if (longTenureExposed >= 1) {
    signals.push({
      signalId: 'long_tenure_concentration',
      severity: 'observation',
      category: 'long_tenure_concentration',
      statement: `${longTenureExposed} long-tenure carrier${longTenureExposed === 1 ? '' : 's'} (15+ years) without identified successor concentrate${longTenureExposed === 1 ? 's' : ''} organizational memory in a single dependency.`,
      evidence: { longTenureExposed },
    });
  }

  if (holders.length > 0 && holders.length <= 3) {
    signals.push({
      signalId: 'narrow_carrier_base',
      severity: 'note',
      category: 'narrow_carrier_base',
      statement: `Only ${holders.length} continuity carrier${holders.length === 1 ? ' is' : 's are'} named. A broader carrier base typically surfaces hidden dependencies.`,
      evidence: { count: holders.length },
    });
  }

  if (density.band.id === 'distributed' && holders.length >= 5) {
    signals.push({
      signalId: 'distributed_stewardship',
      severity: 'note',
      category: 'distributed_stewardship',
      statement: 'Stewardship appears reasonably distributed across the named carriers.',
      evidence: { totalCarriers: holders.length, index: density.index },
    });
  }

  return {
    density,
    signals,
    preview: buildPreview(density),
  };
}

function buildPreview(density: StewardshipDensityResult): string {
  if (density.totalCarriers === 0) {
    return 'No continuity carriers have been named yet.';
  }
  const parts: string[] = [
    `You\u2019ve named ${density.totalCarriers} continuity carrier${density.totalCarriers === 1 ? '' : 's'}.`,
  ];
  if (density.unsuccessedInstitutionCriticalCount > 0) {
    parts.push(
      `${density.unsuccessedInstitutionCriticalCount} ${density.unsuccessedInstitutionCriticalCount === 1 ? 'is' : 'are'} institution-critical without an identified successor.`,
    );
  } else if (density.unsuccessedLoadBearingCount > 0) {
    parts.push(
      `${density.unsuccessedLoadBearingCount} ${density.unsuccessedLoadBearingCount === 1 ? 'is' : 'are'} load-bearing without an identified successor.`,
    );
  } else {
    parts.push(density.band.posture);
  }
  return parts.join(' ');
}
