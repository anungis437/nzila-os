/**
 * ARTIFACT TYPE: Runtime Catalogue
 * MODULE: OCI Continuity Event Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * Catalogue of the ten canonical continuity event kinds and their default
 * severity. Severity may be elevated by an engine but never downgraded.
 *
 * The catalogue is closed: new event kinds require a doctrinal change to
 * `runtimeContracts.ts`, this file, and `docs/oci/runtime/OCI_EVENT_RUNTIME.md`.
 */

import type { ContinuityEventKind, ContinuityEventSeverity } from '../contracts/runtimeContracts';

export const CONTINUITY_EVENT_KINDS: readonly ContinuityEventKind[] = [
  'GovernanceInterpretationChanged',
  'StewardshipConcentrationElevated',
  'OperationalDependencyReduced',
  'OnboardingSurvivabilityImproved',
  'ContinuityBreakpointIntroduced',
  'ReconstructionBurdenReduced',
  'GovernanceRecoveryRatified',
  'RuntimeTransitionActivated',
  'InstitutionalMemoryRiskElevated',
  'ModernizationContinuityGapDetected',
] as const;

export const CONTINUITY_EVENT_TYPE_DEFAULT_SEVERITY: Readonly<
  Record<ContinuityEventKind, ContinuityEventSeverity>
> = {
  GovernanceInterpretationChanged: 'observation',
  StewardshipConcentrationElevated: 'warning',
  OperationalDependencyReduced: 'note',
  OnboardingSurvivabilityImproved: 'note',
  ContinuityBreakpointIntroduced: 'critical',
  ReconstructionBurdenReduced: 'note',
  GovernanceRecoveryRatified: 'observation',
  RuntimeTransitionActivated: 'observation',
  InstitutionalMemoryRiskElevated: 'warning',
  ModernizationContinuityGapDetected: 'warning',
};

export function isKnownContinuityEventKind(value: string): value is ContinuityEventKind {
  return (CONTINUITY_EVENT_KINDS as readonly string[]).includes(value);
}
