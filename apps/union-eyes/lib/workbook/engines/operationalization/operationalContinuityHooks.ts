/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Continuity Operationalization
 * DOCTRINE_VERSION: 2.0.0
 *
 * Declarative operational continuity hooks. Names the six hook
 * attachment points. Composition only — these are NOT background
 * workers, NOT daemons, NOT schedulers, NOT transactional.
 *
 * Pure, deterministic.
 */

import type { OperationalizationDomainKey } from './continuityOperationalization';

export const ENGINE_VERSION = '2.0.0';

export interface OperationalContinuityHook {
  readonly key: OperationalizationDomainKey;
  readonly attachmentPoint: string;
  readonly intent: string;
}

export const OPERATIONAL_CONTINUITY_HOOKS: readonly OperationalContinuityHook[] = [
  {
    key: 'governance_ratification_cycle',
    attachmentPoint: 'governance_cycle_open',
    intent: 'Re-check stewardship ratification at each governance cycle.',
  },
  {
    key: 'onboarding_intake_rhythm',
    attachmentPoint: 'onboarding_intake_open',
    intent: 'Re-check survivability at each onboarding intake.',
  },
  {
    key: 'carrier_change_event',
    attachmentPoint: 'carrier_change_recorded',
    intent: 'Re-check carrier consent on any carrier change.',
  },
  {
    key: 'intervention_reversibility_window_end',
    attachmentPoint: 'reversibility_window_closing',
    intent: 'Re-check reversibility before any window closes.',
  },
  {
    key: 'executive_reporting_cycle',
    attachmentPoint: 'executive_cycle_open',
    intent: 'Re-read executive composite health each executive cycle.',
  },
  {
    key: 'longitudinal_reading_cycle',
    attachmentPoint: 'longitudinal_cycle_open',
    intent: 'Re-read evolution and progression each longitudinal cycle.',
  },
];

export function listOperationalContinuityHooks(): readonly OperationalContinuityHook[] {
  return OPERATIONAL_CONTINUITY_HOOKS;
}
