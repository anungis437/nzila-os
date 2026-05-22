/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Facilitator Runtime
 * DOCTRINE_VERSION: 2.0.0
 *
 * Stabilization readiness signals. Composes the four institutional
 * readiness conditions into a deterministic reading. Conditions are
 * institution-scoped only — never about a person.
 *
 * Pure, deterministic.
 */

export const ENGINE_VERSION = '2.0.0';

export type ReadinessConditionKey =
  | 'governance_ratification_capacity_present'
  | 'carrier_consent_capture_mechanism_available'
  | 'no_active_intervention_has_exhausted_reversibility_window'
  | 'workbook_completion_threshold_met';

export const READINESS_CONDITIONS: readonly ReadinessConditionKey[] = [
  'governance_ratification_capacity_present',
  'carrier_consent_capture_mechanism_available',
  'no_active_intervention_has_exhausted_reversibility_window',
  'workbook_completion_threshold_met',
];

export interface ReadinessInput {
  readonly governanceRatificationCapacityPresent: boolean;
  readonly carrierConsentCaptureMechanismAvailable: boolean;
  readonly noActiveInterventionHasExhaustedReversibilityWindow: boolean;
  readonly workbookCompletionThresholdMet: boolean;
}

export interface ReadinessReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly sufficient: boolean;
  readonly unmet: readonly ReadinessConditionKey[];
  readonly statement: string;
}

export function readStabilizationReadiness(input: ReadinessInput): ReadinessReading {
  const unmet: ReadinessConditionKey[] = [];
  if (!input.governanceRatificationCapacityPresent) unmet.push('governance_ratification_capacity_present');
  if (!input.carrierConsentCaptureMechanismAvailable) unmet.push('carrier_consent_capture_mechanism_available');
  if (!input.noActiveInterventionHasExhaustedReversibilityWindow) unmet.push('no_active_intervention_has_exhausted_reversibility_window');
  if (!input.workbookCompletionThresholdMet) unmet.push('workbook_completion_threshold_met');

  const sufficient = unmet.length === 0;
  return {
    engineVersion: ENGINE_VERSION,
    sufficient,
    unmet,
    statement: sufficient
      ? 'All four institutional readiness conditions are present.'
      : `Readiness is insufficient; ${unmet.length} of 4 conditions are unmet.`,
  };
}
