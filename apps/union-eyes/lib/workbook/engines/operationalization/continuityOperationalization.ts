/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Continuity Operationalization
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity operationalization reader. Emits one categorical
 * reading per operationalization domain. Pure observation.
 *
 * Pure, deterministic.
 */

import type { ReadinessReading } from '../facilitator/stabilizationReadinessSignals';

export const ENGINE_VERSION = '2.0.0';

export type OperationalizationDomainKey =
  | 'governance_ratification_cycle'
  | 'onboarding_intake_rhythm'
  | 'carrier_change_event'
  | 'intervention_reversibility_window_end'
  | 'executive_reporting_cycle'
  | 'longitudinal_reading_cycle';

export const OPERATIONALIZATION_DOMAINS: readonly OperationalizationDomainKey[] = [
  'governance_ratification_cycle',
  'onboarding_intake_rhythm',
  'carrier_change_event',
  'intervention_reversibility_window_end',
  'executive_reporting_cycle',
  'longitudinal_reading_cycle',
];

export type OperationalizationBand = 'not_yet_readable' | 'observed' | 'deferred_readiness_insufficient';

export interface OperationalizationDomainReading {
  readonly domain: OperationalizationDomainKey;
  readonly band: OperationalizationBand;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface OperationalizationInput {
  readonly readiness: ReadinessReading;
  readonly governanceCycleObserved: boolean;
  readonly onboardingIntakeObserved: boolean;
  readonly carrierChangeObserved: boolean;
  readonly reversibilityWindowEndObserved: boolean;
  readonly executiveReportingCycleObserved: boolean;
  readonly longitudinalReadingCycleObserved: boolean;
}

export interface OperationalizationResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly perDomain: readonly OperationalizationDomainReading[];
}

export function runContinuityOperationalization(input: OperationalizationInput): OperationalizationResult {
  const perDomain: OperationalizationDomainReading[] = OPERATIONALIZATION_DOMAINS.map((d) =>
    readDomain(d, input),
  );
  return { engineVersion: ENGINE_VERSION, perDomain };
}

function readDomain(
  domain: OperationalizationDomainKey,
  input: OperationalizationInput,
): OperationalizationDomainReading {
  const observed = observedFor(domain, input);
  if (!input.readiness.sufficient) {
    return {
      domain,
      band: 'deferred_readiness_insufficient',
      statement: `Operationalization reading for ${domain} is deferred; organizational readiness is insufficient.`,
      evidence: { unmetReadiness: input.readiness.unmet, observed },
    };
  }
  if (!observed) {
    return {
      domain,
      band: 'not_yet_readable',
      statement: `Operationalization reading for ${domain} is not yet readable; the source event has not been observed.`,
      evidence: { observed: false },
    };
  }
  return {
    domain,
    band: 'observed',
    statement: `Operationalization reading for ${domain} has been observed.`,
    evidence: { observed: true },
  };
}

function observedFor(domain: OperationalizationDomainKey, input: OperationalizationInput): boolean {
  switch (domain) {
    case 'governance_ratification_cycle':
      return input.governanceCycleObserved;
    case 'onboarding_intake_rhythm':
      return input.onboardingIntakeObserved;
    case 'carrier_change_event':
      return input.carrierChangeObserved;
    case 'intervention_reversibility_window_end':
      return input.reversibilityWindowEndObserved;
    case 'executive_reporting_cycle':
      return input.executiveReportingCycleObserved;
    case 'longitudinal_reading_cycle':
      return input.longitudinalReadingCycleObserved;
  }
}
