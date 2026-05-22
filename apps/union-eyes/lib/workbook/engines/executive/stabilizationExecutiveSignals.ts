/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Executive Stabilization Operations
 * DOCTRINE_VERSION: 2.0.0
 *
 * Emits canonical signal envelopes from an ExecutiveStabilizationResult
 * for executive consumers (PDF, dashboards, downstream readers).
 *
 * Pure, deterministic. Stably ordered by signalId.
 */

import type { ExecutiveStabilizationResult, ExecutiveDomainReading } from './executiveStabilizationModel';

export const ENGINE_VERSION = '2.0.0';

export type ExecutiveSignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export interface ExecutiveSignal {
  readonly signalId: string;
  readonly severity: ExecutiveSignalSeverity;
  readonly category: string;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface ExecutiveSignalsResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly signals: readonly ExecutiveSignal[];
}

export function emitExecutiveSignals(result: ExecutiveStabilizationResult): ExecutiveSignalsResult {
  const signals: ExecutiveSignal[] = result.domains.map((d) => domainSignal(d));
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));
  return { engineVersion: ENGINE_VERSION, signals };
}

function domainSignal(d: ExecutiveDomainReading): ExecutiveSignal {
  return {
    signalId: `executive:${d.domain}`,
    severity: severityFor(d.band),
    category: `executive_${d.domain}`,
    statement: d.statement,
    evidence: { band: d.band, ...d.evidence },
  };
}

function severityFor(band: ExecutiveDomainReading['band']): ExecutiveSignalSeverity {
  switch (band) {
    case 'regressing':
      return 'critical';
    case 'holding':
      return 'observation';
    case 'stabilizing':
      return 'note';
    case 'not_yet_readable':
      return 'note';
  }
}
