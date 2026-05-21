/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Executive Stabilization Operations
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity operational health — a categorical composite reading
 * over the executive domains. Returns the composite band, the
 * contributing domain bands, and a calm institutional statement.
 *
 * Pure, deterministic.
 */

import type {
  ExecutiveDomainBand,
  ExecutiveDomainId,
  ExecutiveStabilizationResult,
} from './executiveStabilizationModel';

export const ENGINE_VERSION = '2.0.0';

export interface ContinuityOperationalHealthReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly band: ExecutiveDomainBand;
  readonly perDomain: Readonly<Record<ExecutiveDomainId, ExecutiveDomainBand>>;
  readonly readableDomainCount: number;
  readonly totalDomainCount: number;
  readonly statement: string;
}

export function readContinuityOperationalHealth(
  result: ExecutiveStabilizationResult,
): ContinuityOperationalHealthReading {
  const perDomain = {} as Record<ExecutiveDomainId, ExecutiveDomainBand>;
  for (const d of result.domains) perDomain[d.domain] = d.band;

  const totalDomainCount = result.domains.length;
  const readableDomainCount = result.domains.filter((d) => d.band !== 'not_yet_readable').length;

  return {
    engineVersion: ENGINE_VERSION,
    band: result.compositeBand,
    perDomain,
    readableDomainCount,
    totalDomainCount,
    statement: result.reading,
  };
}
